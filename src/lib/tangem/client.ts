import bs58 from 'bs58';
import { PublicKey } from '@solana/web3.js';

import { AdapterInitializationError, DeviceConnectionError, UnsupportedOperationError } from '../hwsigner/errors';
import { bytesToBase64, messageToDisplayText, normalizeMessageBytes } from '../hwsigner/message';
import { buildSignedLegacyResult, buildSignedVersionedResult } from '../hwsigner/transactions';
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
import { mapTangemError } from './error-map';
import type { TangemCardSession, TangemReactNativeSdk } from './types';

export const TANGEM_SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'";

export class TangemReactNativeNfcClient {
  private readonly onEvent?: HWSignerEventListener;
  private readonly sdk?: TangemReactNativeSdk;
  private readonly defaultDerivationPath: string;
  private session: TangemCardSession | null = null;

  constructor(options: {
    sdk?: TangemReactNativeSdk;
    defaultDerivationPath?: string;
    onEvent?: HWSignerEventListener;
  }) {
    this.sdk = options.sdk;
    this.defaultDerivationPath = options.defaultDerivationPath ?? TANGEM_SOLANA_DERIVATION_PATH;
    this.onEvent = options.onEvent;
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
      ble: false,
      qr: false,
      nfc: true,
    };
  }

  async connect(): Promise<HWSignerConnection> {
    const sdk = this.requireSdk();

    this.onEvent?.({
      type: 'action',
      message: 'Opening Tangem NFC scan through the React Native runtime.',
    });

    try {
      await sdk.startSession?.({
        attestationMode: 'offline',
        defaultDerivationPaths: this.defaultDerivationPath,
      });

      if (typeof sdk.scanCard !== 'function') {
        throw new AdapterInitializationError('Tangem runtime requires RNTangemSdk.scanCard().');
      }

      const card = await sdk.scanCard();
      this.session = extractTangemCardSession(card, this.defaultDerivationPath);
    } catch (error) {
      throw mapTangemError(error);
    }

    return {
      walletId: 'tangem',
      walletName: 'Tangem',
      runtime: {
        kind: 'tangem-react-native-nfc',
        transport: 'nfc',
        defaultDerivationPath: this.defaultDerivationPath,
      },
      capabilities: this.getCapabilities(),
      appConfiguration: null,
    };
  }

  async disconnect(): Promise<void> {
    if (!this.sdk) {
      this.session = null;
      return;
    }

    try {
      await this.sdk.stopSession?.();
    } catch {
      // Native NFC session cleanup should not block UI state reset.
    } finally {
      this.session = null;
    }
  }

  async getAppConfiguration(): Promise<HWSignerAppConfiguration | null> {
    return null;
  }

  async getAccounts(input: GetAccountsInput) {
    const session = this.requireSession();

    if (input.count < 1 || input.startIndex > 0) {
      return [];
    }

    return [{
      index: 0,
      path: session.derivationPath,
      address: session.address,
    }];
  }

  async signMessage(input: SignMessageInput): Promise<SignedMessageResult> {
    const session = this.requireSession();
    const messageBytes = normalizeMessageBytes(input.message);
    const signature = await this.signBytes(messageBytes);

    return {
      address: session.address,
      derivationPath: session.derivationPath,
      message: messageToDisplayText(input.message),
      messageBytesBase64: bytesToBase64(messageBytes),
      signature: bs58.encode(signature),
      verified: null,
    };
  }

  async signTransaction(input: SignTransactionInput): Promise<SignedTransactionResult> {
    const session = this.requireSession();
    const mode = input.signingPayloadMode ?? 'legacy-message-bytes';

    if (mode !== 'legacy-message-bytes') {
      throw new UnsupportedOperationError('Tangem signs legacy Solana transaction message bytes in the React Native NFC runtime.');
    }

    const signature = await this.signBytes(Uint8Array.from(input.transaction.serializeMessage()));

    return buildSignedLegacyResult({
      transaction: input.transaction,
      signerAddress: session.address,
      address: session.address,
      derivationPath: session.derivationPath,
      signature,
    });
  }

  async signVersionedTransaction(input: SignVersionedTransactionInput): Promise<SignedTransactionResult> {
    const session = this.requireSession();
    const mode = input.signingPayloadMode ?? 'versioned-message-bytes';

    if (mode !== 'versioned-message-bytes') {
      throw new UnsupportedOperationError('Tangem signs versioned Solana transaction message bytes in the React Native NFC runtime.');
    }

    const signature = await this.signBytes(Uint8Array.from(input.transaction.message.serialize()));

    return buildSignedVersionedResult({
      transaction: input.transaction,
      derivationPath: session.derivationPath,
      address: session.address,
      signature,
    });
  }

  private async signBytes(bytes: Uint8Array): Promise<Uint8Array> {
    const sdk = this.requireSdk();
    const session = this.requireSession();

    if (typeof sdk.sign !== 'function') {
      throw new AdapterInitializationError('Tangem runtime requires RNTangemSdk.sign().');
    }

    this.onEvent?.({
      type: 'action',
      message: 'Requesting Tangem NFC signature.',
    });

    try {
      const result = await sdk.sign({
        cardId: session.cardId,
        hashes: [bytesToHex(bytes)],
      });

      return extractTangemSignature(result);
    } catch (error) {
      throw mapTangemError(error);
    }
  }

  private requireSdk(): TangemReactNativeSdk {
    if (!this.sdk) {
      throw new AdapterInitializationError(
        'Tangem requires a React Native NFC runtime. Pass RNTangemSdk from tangem-sdk-react-native in runtime.sdk.',
      );
    }

    return this.sdk;
  }

  private requireSession(): TangemCardSession {
    if (!this.session) {
      throw new DeviceConnectionError('Tangem is not connected.');
    }

    return this.session;
  }
}

export function extractTangemCardSession(scanResult: unknown, fallbackDerivationPath: string): TangemCardSession {
  const card = unwrapTangemPayload(scanResult);

  if (!isRecord(card)) {
    throw new DeviceConnectionError('Tangem scan did not return card details.');
  }

  const cardId = findFirstString(card, ['cardId', 'id']);

  if (!cardId) {
    throw new DeviceConnectionError('Tangem scan did not return a card id.');
  }

  const keyCandidate = findSolanaPublicKeyCandidate(card);
  if (!keyCandidate) {
    throw new DeviceConnectionError('Tangem scan did not return a Solana public key.');
  }

  return {
    cardId,
    address: normalizeTangemSolanaPublicKey(keyCandidate.publicKey),
    derivationPath: keyCandidate.derivationPath ?? fallbackDerivationPath,
  };
}

export function extractTangemSignature(signResult: unknown): Uint8Array {
  const payload = unwrapTangemPayload(signResult);
  const signature = findSignatureCandidate(payload);

  if (!signature) {
    throw new DeviceConnectionError('Tangem did not return a signature.');
  }

  const bytes = stringToBytes(signature);

  if (bytes.length !== 64) {
    throw new DeviceConnectionError(`Tangem returned a ${bytes.length}-byte signature; Solana expects 64 bytes.`);
  }

  return bytes;
}

export function normalizeTangemSolanaPublicKey(publicKey: string): string {
  const trimmed = publicKey.trim();
  const withoutPrefix = trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed;

  if (isHexString(withoutPrefix) && withoutPrefix.length === 64) {
    return new PublicKey(hexToBytes(withoutPrefix)).toBase58();
  }

  return new PublicKey(trimmed).toBase58();
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function unwrapTangemPayload(value: unknown): unknown {
  const parsed = parseJsonIfNeeded(value);

  if (!isRecord(parsed)) {
    return parsed;
  }

  if ('card' in parsed) {
    return parseJsonIfNeeded(parsed.card);
  }

  if ('result' in parsed) {
    return parseJsonIfNeeded(parsed.result);
  }

  return parsed;
}

function findSolanaPublicKeyCandidate(value: unknown): {
  publicKey: string;
  derivationPath?: string;
} | null {
  if (!isRecord(value)) {
    return null;
  }

  const direct = findFirstString(value, ['walletPublicKey', 'publicKey', 'derivedPublicKey']);
  if (direct) {
    return {
      publicKey: direct,
      derivationPath: findFirstString(value, ['derivationPath', 'path']) ?? undefined,
    };
  }

  const wallets = Array.isArray(value.wallets) ? value.wallets : [];
  const wallet = wallets
    .filter(isRecord)
    .find((candidate) => {
      const text = JSON.stringify(candidate).toLowerCase();
      return text.includes('501') || text.includes('solana') || text.includes('ed25519');
    }) ?? wallets.find(isRecord);

  if (wallet) {
    const walletKey = findFirstString(wallet, ['publicKey', 'walletPublicKey', 'derivedPublicKey']);
    if (walletKey) {
      return {
        publicKey: walletKey,
        derivationPath: findFirstString(wallet, ['derivationPath', 'path']) ?? undefined,
      };
    }
  }

  const derivedKeys = value.derivedKeys;
  if (isRecord(derivedKeys)) {
    for (const [path, publicKey] of Object.entries(derivedKeys)) {
      if (typeof publicKey === 'string' && (path.includes("501'") || path.includes('/501/'))) {
        return {
          publicKey,
          derivationPath: path,
        };
      }
    }
  }

  return null;
}

function findSignatureCandidate(value: unknown): string | null {
  if (typeof value === 'string' && value) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = findSignatureCandidate(item);
      if (candidate) {
        return candidate;
      }
    }
  }

  if (!isRecord(value)) {
    return null;
  }

  const direct = findFirstString(value, ['signature', 'sig']);
  if (direct) {
    return direct;
  }

  for (const key of ['signatures', 'results', 'responses']) {
    if (key in value) {
      const candidate = findSignatureCandidate(value[key]);
      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
}

function findFirstString(value: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }

  return null;
}

function stringToBytes(value: string): Uint8Array {
  const trimmed = value.trim();
  const withoutPrefix = trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed;

  if (isHexString(withoutPrefix) && withoutPrefix.length % 2 === 0) {
    return hexToBytes(withoutPrefix);
  }

  return bs58.decode(trimmed);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}

function isHexString(value: string): boolean {
  return /^[0-9a-fA-F]+$/.test(value);
}

function parseJsonIfNeeded(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return value;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}