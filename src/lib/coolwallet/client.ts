'use client';

import { Buffer } from 'buffer';
import bs58 from 'bs58';
import type { Transaction, VersionedTransaction } from '@solana/web3.js';

import {
  getSolanaDerivationPaths,
  parseSolanaDerivationPath,
  resolveDerivationPath,
} from '../hwsigner/derivation';
import {
  AdapterInitializationError,
  DeviceConnectionError,
  InvalidTransactionError,
  UnsupportedOperationError,
  UserRejectedError,
} from '../hwsigner/errors';
import { bytesToBase64, messageToDisplayText, normalizeMessageBytes } from '../hwsigner/message';
import {
  assertTransactionHasFeePayer,
  buildSignedLegacyResult,
  buildSignedVersionedResult,
} from '../hwsigner/transactions';
import type {
  GetAccountsInput,
  HWSignerAppConfiguration,
  HWSignerConnection,
  HWSignerEventListener,
  SignMessageInput,
  SignedMessageResult,
  SignedTransactionResult,
  SignTransactionInput,
  SignVersionedTransactionInput,
} from '../hwsigner/types';
import { getCoolWalletErrorMessage, mapCoolWalletError } from './error-map';

const COOLWALLET_APP_NAME = 'HWSigner';
const COOLWALLET_STORAGE_PREFIX = 'hwsigner:coolwallet:registration:';

type CoolWalletCoreModule = typeof import('@coolwallet/core');
type CoolWalletBleModule = typeof import('@coolwallet/transport-web-ble');
type CoolWalletSolModule = typeof import('@coolwallet/sol');
type CoolWalletMessageModule = typeof import('@coolwallet/sol/lib/message');

type CoolWalletModules = {
  core: CoolWalletCoreModule;
  ble: CoolWalletBleModule;
  sol: CoolWalletSolModule;
  message: CoolWalletMessageModule;
};

type CoolWalletRegistration = {
  appId: string;
  appPrivateKey: string;
  appPublicKey: string;
  cardId: string;
  createdAt: string;
};

type CoolWalletSession = {
  transport: InstanceType<CoolWalletCoreModule['Transport']>;
  wallet: InstanceType<CoolWalletSolModule['default']>;
  registration: CoolWalletRegistration;
  address: string;
};

let coolWalletModulesPromise: Promise<CoolWalletModules> | null = null;

export class CoolWalletWebBleClient {
  private readonly onEvent?: HWSignerEventListener;
  private session: CoolWalletSession | null = null;

  constructor(onEvent?: HWSignerEventListener) {
    this.onEvent = onEvent;
  }

  getCapabilities() {
    return {
      connect: true,
      disconnect: true,
      getAccounts: true,
      signMessage: true,
      signTransaction: true,
      signVersionedTransaction: true,
      emulator: false,
      usb: false,
      ble: true,
      qr: false,
      nfc: false,
    };
  }

  async connect(): Promise<HWSignerConnection> {
    this.ensureBrowser();
    this.ensureWebBluetooth();

    const modules = await loadCoolWalletModules();
    this.session = null;

    this.onEvent?.({
      type: 'action',
      message: 'Opening CoolWallet Web Bluetooth device chooser.',
    });

    let transport: InstanceType<CoolWalletCoreModule['Transport']>;
    try {
      transport = await modules.ble.createTransport();
    } catch (error) {
      throw mapCoolWalletError(error);
    }

    const wallet = new modules.sol.default();

    try {
      const cardId = await modules.core.apdu.general.getCardId(transport);
      let registration = readStoredRegistration(cardId);

      if (!registration) {
        this.onEvent?.({
          type: 'info',
          message: 'No cached CoolWallet app registration was found. Pairing this browser with the card now.',
        });
        registration = await this.registerApplication(modules, transport, cardId);
      }

      let address: string;
      try {
        address = await wallet.getAddress(transport, registration.appPrivateKey, registration.appId, 0);
      } catch (error) {
        if (!needsRegistrationRefresh(error)) {
          throw error;
        }

        clearStoredRegistration(cardId);
        this.onEvent?.({
          type: 'warning',
          message: 'Stored CoolWallet app registration is stale. Re-registering with the card.',
        });
        registration = await this.registerApplication(modules, transport, cardId);
        address = await wallet.getAddress(transport, registration.appPrivateKey, registration.appId, 0);
      }

      this.session = {
        transport,
        wallet,
        registration,
        address,
      };

      return {
        walletId: 'coolwallet',
        walletName: 'CoolWallet',
        runtime: {
          kind: 'coolwallet-web-ble',
          transport: 'web-ble',
        },
        capabilities: this.getCapabilities(),
        appConfiguration: null,
      };
    } catch (error) {
      await safeCoolWalletDisconnect(modules);
      throw mapCoolWalletError(error);
    }
  }

  async disconnect(): Promise<void> {
    const activeSession = this.session;
    this.session = null;

    if (!activeSession) {
      return;
    }

    try {
      const modules = await loadCoolWalletModules();
      await safeCoolWalletDisconnect(modules);
    } catch {
      // CoolWallet BLE teardown should not block the UI.
    }
  }

  async getAppConfiguration(): Promise<HWSignerAppConfiguration | null> {
    return null;
  }

  async getAccounts(input: GetAccountsInput) {
    if (input.count < 1) {
      return [];
    }

    const { wallet, transport, registration } = await this.requireSession();
    const paths = getSolanaDerivationPaths(input.startIndex, input.count);

    return Promise.all(paths.map(async (path, offset) => {
      const accountIndex = parseSolanaDerivationPath(path).accountIndex;
      const address = await wallet.getAddress(transport, registration.appPrivateKey, registration.appId, accountIndex);

      return {
        index: input.startIndex + offset,
        path,
        address,
      };
    }));
  }

  async signMessage(input: SignMessageInput): Promise<SignedMessageResult> {
    const { wallet, transport, registration } = await this.requireSession();
    const derivationPath = resolveDerivationPath(input);
    const accountIndex = parseSolanaDerivationPath(derivationPath).accountIndex;
    const address = await wallet.getAddress(transport, registration.appPrivateKey, registration.appId, accountIndex);
    const messageBytes = normalizeMessageBytes(input.message);
    const message = toCoolWalletMessageText(input.message, messageBytes);

    this.onEvent?.({
      type: 'action',
      message: `Requesting CoolWallet message signature at ${derivationPath}.`,
    });

    let signatureHex: string;
    try {
      signatureHex = await wallet.signMessage({
        transport,
        appPrivateKey: registration.appPrivateKey,
        appId: registration.appId,
        addressIndex: accountIndex,
        message,
      });
    } catch (error) {
      throw mapCoolWalletError(error);
    }

    return {
      address,
      derivationPath,
      message: messageToDisplayText(input.message),
      messageBytesBase64: bytesToBase64(messageBytes),
      signature: bs58.encode(hexToBytes(signatureHex, 'message')),
      verified: null,
    };
  }

  async signTransaction(input: SignTransactionInput): Promise<SignedTransactionResult> {
    if (input.signingPayloadMode && input.signingPayloadMode !== 'serialized-transaction') {
      throw new UnsupportedOperationError('CoolWallet only supports "serialized-transaction" signing in this runtime.');
    }

    const { wallet, transport, registration } = await this.requireSession();
    const derivationPath = resolveDerivationPath(input);
    const accountIndex = parseSolanaDerivationPath(derivationPath).accountIndex;
    const address = await wallet.getAddress(transport, registration.appPrivateKey, registration.appId, accountIndex);
    const transaction = toCoolWalletLegacyTransaction(input.transaction);

    this.onEvent?.({
      type: 'action',
      message: `Requesting CoolWallet signature for a legacy transaction at ${derivationPath}.`,
    });

    let signedHex: string;
    try {
      signedHex = await signCoolWalletTransaction(wallet, {
        transport,
        appPrivateKey: registration.appPrivateKey,
        appId: registration.appId,
        addressIndex: accountIndex,
        transaction,
      });
    } catch (error) {
      throw mapCoolWalletError(error);
    }

    const signed = (await import('@solana/web3.js')).Transaction.from(Buffer.from(signedHex, 'hex'));
    const signature = signed.signature;

    if (!signature) {
      throw new DeviceConnectionError('CoolWallet did not return a legacy transaction signature.');
    }

    return buildSignedLegacyResult({
      transaction: input.transaction,
      signerAddress: address,
      address,
      derivationPath,
      signature: Uint8Array.from(signature),
    });
  }

  async signVersionedTransaction(input: SignVersionedTransactionInput): Promise<SignedTransactionResult> {
    if (input.signingPayloadMode && input.signingPayloadMode !== 'serialized-transaction') {
      throw new UnsupportedOperationError('CoolWallet only supports "serialized-transaction" signing in this runtime.');
    }

    const { wallet, transport, registration } = await this.requireSession();
    const modules = await loadCoolWalletModules();
    const derivationPath = resolveDerivationPath(input);
    const accountIndex = parseSolanaDerivationPath(derivationPath).accountIndex;
    const address = await wallet.getAddress(transport, registration.appPrivateKey, registration.appId, accountIndex);
    const transaction = {
      signatures: input.transaction.signatures.map((signature) => Uint8Array.from(signature)),
      message: modules.message.VersionedMessage.deserialize(input.transaction.message.serialize()),
    };

    this.onEvent?.({
      type: 'action',
      message: `Requesting CoolWallet signature for a versioned transaction at ${derivationPath}.`,
    });

    let signedHex: string;
    try {
      signedHex = await signCoolWalletTransaction(wallet, {
        transport,
        appPrivateKey: registration.appPrivateKey,
        appId: registration.appId,
        addressIndex: accountIndex,
        transaction,
      });
    } catch (error) {
      throw mapCoolWalletError(error);
    }

    const signed = (await import('@solana/web3.js')).VersionedTransaction.deserialize(Buffer.from(signedHex, 'hex'));
    const signature = signed.signatures[0];

    if (!signature) {
      throw new DeviceConnectionError('CoolWallet did not return a versioned transaction signature.');
    }

    return buildSignedVersionedResult({
      transaction: input.transaction,
      derivationPath,
      address,
      signature: Uint8Array.from(signature),
    });
  }

  private async requireSession(): Promise<CoolWalletSession> {
    if (!this.session) {
      throw new DeviceConnectionError('CoolWallet is not connected.');
    }

    return this.session;
  }

  private async registerApplication(
    modules: CoolWalletModules,
    transport: InstanceType<CoolWalletCoreModule['Transport']>,
    cardId: string,
  ): Promise<CoolWalletRegistration> {
    const pairingPassword = promptForCoolWalletPairingPassword();
    const sePublicKey = await modules.core.config.getSEPublicKey(transport);
    const appKeyPair = modules.core.crypto.key.generateKeyPair() as {
      privateKey: string;
      publicKey: string;
    };

    this.onEvent?.({
      type: 'action',
      message: 'Registering HWSigner as a paired CoolWallet application.',
    });

    const appId = await modules.core.apdu.pair.register(
      transport,
      appKeyPair.publicKey,
      pairingPassword,
      COOLWALLET_APP_NAME,
      sePublicKey,
    );

    const registration = {
      appId,
      appPrivateKey: appKeyPair.privateKey,
      appPublicKey: appKeyPair.publicKey,
      cardId,
      createdAt: new Date().toISOString(),
    };

    writeStoredRegistration(registration);
    return registration;
  }

  private ensureBrowser() {
    if (typeof window === 'undefined') {
      throw new UnsupportedOperationError('CoolWallet Web Bluetooth can only run in a browser.');
    }
  }

  private ensureWebBluetooth() {
    if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
      throw new UnsupportedOperationError('Web Bluetooth is not available in this browser.');
    }

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      throw new UnsupportedOperationError('Web Bluetooth requires https or localhost.');
    }
  }
}

async function loadCoolWalletModules(): Promise<CoolWalletModules> {
  ensureCoolWalletGlobals();

  coolWalletModulesPromise ??= Promise.all([
    import('@coolwallet/core'),
    import('@coolwallet/transport-web-ble'),
    import('@coolwallet/sol'),
    import('@coolwallet/sol/lib/message'),
  ]).then(([core, ble, sol, message]) => ({
    core,
    ble,
    sol,
    message,
  }));

  return coolWalletModulesPromise;
}

async function safeCoolWalletDisconnect(modules: CoolWalletModules): Promise<void> {
  try {
    await modules.ble.default.disconnect();
  } catch {
    // Ignore disconnect teardown failures.
  }
}

function ensureCoolWalletGlobals() {
  if (typeof window === 'undefined') {
    return;
  }

  const scopedWindow = window as typeof window & {
    Buffer?: typeof Buffer;
    global?: typeof globalThis;
  };

  scopedWindow.Buffer ??= Buffer;
  scopedWindow.global ??= globalThis;
}

function readStoredRegistration(cardId: string): CoolWalletRegistration | null {
  try {
    const raw = window.localStorage.getItem(getCoolWalletStorageKey(cardId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<CoolWalletRegistration>;
    if (
      typeof parsed.appId !== 'string'
      || typeof parsed.appPrivateKey !== 'string'
      || typeof parsed.appPublicKey !== 'string'
      || typeof parsed.cardId !== 'string'
    ) {
      clearStoredRegistration(cardId);
      return null;
    }

    return {
      appId: parsed.appId,
      appPrivateKey: parsed.appPrivateKey,
      appPublicKey: parsed.appPublicKey,
      cardId: parsed.cardId,
      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date(0).toISOString(),
    };
  } catch {
    clearStoredRegistration(cardId);
    return null;
  }
}

function writeStoredRegistration(registration: CoolWalletRegistration) {
  try {
    window.localStorage.setItem(getCoolWalletStorageKey(registration.cardId), JSON.stringify(registration));
  } catch {
    // Persisting the registration is optional for this demo.
  }
}

function clearStoredRegistration(cardId: string) {
  try {
    window.localStorage.removeItem(getCoolWalletStorageKey(cardId));
  } catch {
    // Ignore storage cleanup failures.
  }
}

function getCoolWalletStorageKey(cardId: string): string {
  return `${COOLWALLET_STORAGE_PREFIX}${cardId}`;
}

function promptForCoolWalletPairingPassword(): string {
  const password = window.prompt('Enter the CoolWallet pairing password shown by the device or companion app.');

  if (password === null) {
    throw new UserRejectedError('CoolWallet pairing was cancelled before a pairing password was entered.');
  }

  const normalized = password.trim();
  if (!normalized) {
    throw new AdapterInitializationError('A CoolWallet pairing password is required to register this browser.');
  }

  return normalized;
}

function needsRegistrationRefresh(error: unknown): boolean {
  const message = getCoolWalletErrorMessage(error).toLowerCase();

  return (
    message.includes('appid need registered')
    || message.includes('could not get pair password when card is not registered')
    || message.includes('please register')
  );
}

function toCoolWalletLegacyTransaction(transaction: Transaction): {
  feePayer: string;
  recentBlockhash: string;
  instructions: Array<{
    accounts: Array<{
      pubkey: string;
      isSigner: boolean;
      isWritable: boolean;
    }>;
    programId: string;
    data: Buffer;
  }>;
} {
  const feePayer = assertTransactionHasFeePayer(transaction);

  if (!transaction.recentBlockhash) {
    throw new InvalidTransactionError('Legacy transactions must set recentBlockhash before signing.');
  }

  return {
    feePayer,
    recentBlockhash: transaction.recentBlockhash,
    instructions: transaction.instructions.map((instruction) => ({
      accounts: instruction.keys.map((key) => ({
        pubkey: key.pubkey.toBase58(),
        isSigner: key.isSigner,
        isWritable: key.isWritable,
      })),
      programId: instruction.programId.toBase58(),
      data: Buffer.from(instruction.data),
    })),
  };
}

function toCoolWalletMessageText(input: string | Uint8Array, messageBytes: Uint8Array): string {
  if (typeof input === 'string') {
    return input;
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(messageBytes);
  } catch {
    throw new UnsupportedOperationError('CoolWallet signMessage only supports UTF-8 text payloads in this runtime.');
  }
}

function hexToBytes(hex: string, action: 'message' | 'transaction'): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
    throw new DeviceConnectionError(`CoolWallet returned a ${action} signature in an unknown format.`);
  }

  const bytes = new Uint8Array(hex.length / 2);

  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16);
  }

  return bytes;
}

async function signCoolWalletTransaction(wallet: CoolWalletSession['wallet'], payload: unknown): Promise<string> {
  return (wallet.signTransaction as (input: unknown) => Promise<string>)(payload);
}