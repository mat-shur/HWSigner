import bs58 from 'bs58';
import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

import { DeviceConnectionError, UnsupportedOperationError } from '@/lib/hwsigner/errors';
import { bytesToBase64, messageToDisplayText, normalizeMessageBytes } from '@/lib/hwsigner/message';
import {
  buildSignedLegacyResult,
  buildSignedVersionedResult,
} from '@/lib/hwsigner/transactions';
import type {
  GetAccountsInput,
  HWSignerAppConfiguration,
  HWSignerConnection,
  HWSignerEventListener,
  HWSignerRuntime,
  HWWalletId,
  SignMessageInput,
  SignedMessageResult,
  SignedTransactionResult,
  SignTransactionInput,
  SignVersionedTransactionInput,
} from '@/lib/hwsigner/types';
import type { ReactNativeSolanaWalletClient, ReactNativeWalletSignature } from '@/lib/react-native/walletconnect-types';

type ReactNativeInjectedSolanaRuntime =
  | Extract<HWSignerRuntime, { kind: 'react-native-walletconnect' }>
  | Extract<HWSignerRuntime, { kind: 'react-native-keystone-qr' }>;

export class ReactNativeInjectedSolanaClient {
  private readonly walletId: HWWalletId;
  private readonly walletName: string;
  private readonly wallet: ReactNativeSolanaWalletClient;
  private readonly runtime: ReactNativeInjectedSolanaRuntime;
  private readonly onEvent?: HWSignerEventListener;
  private address: string | null = null;

  constructor(options: {
    walletId: HWWalletId;
    runtime: ReactNativeInjectedSolanaRuntime;
    onEvent?: HWSignerEventListener;
  }) {
    this.walletId = options.walletId;
    this.runtime = options.runtime;
    this.wallet = options.runtime.wallet;
    this.walletName = options.runtime.walletName ?? getWalletDisplayName(options.walletId);
    this.onEvent = options.onEvent;
  }

  getCapabilities() {
    const overrides = this.runtime.capabilities ?? {};
    const canSignTransaction = typeof this.wallet.signTransaction === 'function';

    return {
      connect: true,
      disconnect: true,
      getAccounts: true,
      signMessage: overrides.signMessage ?? typeof this.wallet.signMessage === 'function',
      signTransaction: overrides.signTransaction ?? canSignTransaction,
      signVersionedTransaction: overrides.signVersionedTransaction ?? canSignTransaction,
      emulator: false,
      usb: false,
      ble: false,
      qr: overrides.qr ?? true,
      nfc: overrides.nfc ?? false,
    };
  }

  async connect(): Promise<HWSignerConnection> {
    this.onEvent?.({
      type: 'action',
      message: `Opening ${this.walletName} ${this.getRuntimeLabel()} flow.`,
    });

    await this.wallet.connect();
    const address = normalizePublicKey(this.wallet.publicKey);

    if (!address) {
      throw new DeviceConnectionError(`${this.walletName} did not return a public key.`);
    }

    this.address = address;

    return {
      walletId: this.walletId,
      walletName: this.walletName,
      runtime: this.runtime,
      capabilities: this.getCapabilities(),
      appConfiguration: null,
    };
  }

  async disconnect(): Promise<void> {
    try {
      await this.wallet.disconnect?.();
    } finally {
      this.address = null;
    }
  }

  async getAppConfiguration(): Promise<HWSignerAppConfiguration | null> {
    return null;
  }

  async getAccounts(input: GetAccountsInput) {
    const address = this.requireAddress();

    if (input.count < 1 || input.startIndex > 0) {
      return [];
    }

    return [{
      index: 0,
      path: this.getAccountPath(),
      address,
    }];
  }

  async signMessage(input: SignMessageInput): Promise<SignedMessageResult> {
    if (!this.getCapabilities().signMessage || typeof this.wallet.signMessage !== 'function') {
      throw new UnsupportedOperationError(`${this.walletName} ${this.getRuntimeLabel()} runtime does not support message signing.`);
    }

    const address = this.requireAddress();
    const messageBytes = normalizeMessageBytes(input.message);

    this.onEvent?.({
      type: 'action',
      message: `Requesting ${this.walletName} ${this.getRuntimeLabel()} message signature.`,
    });

    const signature = decodeWalletSignature(await this.wallet.signMessage(messageBytes));

    return {
      address,
      derivationPath: this.getAccountPath(),
      message: messageToDisplayText(input.message),
      messageBytesBase64: bytesToBase64(messageBytes),
      signature: bs58.encode(signature),
      verified: null,
    };
  }

  async signTransaction(input: SignTransactionInput): Promise<SignedTransactionResult> {
    if (input.signingPayloadMode && input.signingPayloadMode !== 'serialized-transaction') {
      throw new UnsupportedOperationError(`${this.walletName} ${this.getRuntimeLabel()} runtime accepts native @solana/web3.js transactions.`);
    }

    if (!this.getCapabilities().signTransaction || typeof this.wallet.signTransaction !== 'function') {
      throw new UnsupportedOperationError(`${this.walletName} ${this.getRuntimeLabel()} runtime does not support transaction signing.`);
    }

    const address = this.requireAddress();

    this.onEvent?.({
      type: 'action',
      message: `Requesting ${this.walletName} ${this.getRuntimeLabel()} legacy transaction signature.`,
    });

    const signed = await this.wallet.signTransaction(cloneLegacyTransaction(input.transaction));
    const signature = signed.signature;

    if (!signature) {
      throw new DeviceConnectionError(`${this.walletName} did not return a transaction signature.`);
    }

    return buildSignedLegacyResult({
      transaction: signed,
      signerAddress: address,
      address,
      derivationPath: input.derivationPath ?? this.getAccountPath(),
      signature: Uint8Array.from(signature),
    });
  }

  async signVersionedTransaction(input: SignVersionedTransactionInput): Promise<SignedTransactionResult> {
    if (input.signingPayloadMode && input.signingPayloadMode !== 'serialized-transaction') {
      throw new UnsupportedOperationError(`${this.walletName} ${this.getRuntimeLabel()} runtime accepts native @solana/web3.js versioned transactions.`);
    }

    if (!this.getCapabilities().signVersionedTransaction || typeof this.wallet.signTransaction !== 'function') {
      throw new UnsupportedOperationError(`${this.walletName} ${this.getRuntimeLabel()} runtime does not support versioned transaction signing.`);
    }

    const address = this.requireAddress();

    this.onEvent?.({
      type: 'action',
      message: `Requesting ${this.walletName} ${this.getRuntimeLabel()} versioned transaction signature.`,
    });

    const signed = await this.wallet.signTransaction(cloneVersionedTransaction(input.transaction));
    const signature = signed.signatures[0];

    if (!signature || signature.length === 0) {
      throw new DeviceConnectionError(`${this.walletName} did not return a versioned transaction signature.`);
    }

    return buildSignedVersionedResult({
      transaction: signed,
      derivationPath: input.derivationPath ?? this.getAccountPath(),
      address,
      signature,
    });
  }

  private requireAddress(): string {
    const address = this.address ?? normalizePublicKey(this.wallet.publicKey);

    if (!address) {
      throw new DeviceConnectionError(`${this.walletName} ${this.getRuntimeLabel()} is not connected.`);
    }

    this.address = address;
    return address;
  }

  private getAccountPath(): string {
    if (this.runtime.accountPath) {
      return this.runtime.accountPath;
    }

    return this.runtime.kind === 'react-native-keystone-qr'
      ? 'keystone://react-native-qr-selected-account'
      : `${this.walletId}://react-native-walletconnect-selected-account`;
  }

  private getRuntimeLabel(): string {
    return this.runtime.kind === 'react-native-keystone-qr'
      ? 'React Native Keystone QR'
      : 'React Native WalletConnect';
  }
}

export class ReactNativeWalletConnectClient extends ReactNativeInjectedSolanaClient {}

function normalizePublicKey(publicKey: ReactNativeSolanaWalletClient['publicKey']): string | null {
  if (!publicKey) {
    return null;
  }

  if (typeof publicKey === 'string') {
    return new PublicKey(publicKey).toBase58();
  }

  if (typeof publicKey.toBase58 === 'function') {
    return new PublicKey(publicKey.toBase58()).toBase58();
  }

  if (typeof publicKey.toBytes === 'function') {
    return new PublicKey(publicKey.toBytes()).toBase58();
  }

  if (typeof publicKey.toString === 'function') {
    return new PublicKey(publicKey.toString()).toBase58();
  }

  return null;
}

function decodeWalletSignature(value: ReactNativeWalletSignature): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  if (Array.isArray(value) && value.every((item) => typeof item === 'number')) {
    return Uint8Array.from(value);
  }

  if (isRecord(value)) {
    if ('signature' in value && value.signature !== undefined) {
      return decodeWalletSignature(value.signature);
    }

    if ('data' in value && value.data !== undefined) {
      return decodeWalletSignature(value.data);
    }
  }

  if (typeof value === 'string' && value) {
    const trimmed = value.trim();
    const hex = trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed;

    if (/^[0-9a-f]+$/i.test(hex) && hex.length % 2 === 0) {
      return hexToBytes(hex);
    }

    try {
      return bs58.decode(trimmed);
    } catch {
      const base64Signature = base64ToBytes(trimmed);

      if (base64Signature) {
        return base64Signature;
      }
    }
  }

  throw new DeviceConnectionError('React Native wallet client returned a signature in an unknown format.');
}

function cloneLegacyTransaction(transaction: Transaction): Transaction {
  return Transaction.from(transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  }));
}

function cloneVersionedTransaction(transaction: VersionedTransaction): VersionedTransaction {
  return VersionedTransaction.deserialize(transaction.serialize());
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}

function base64ToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    return null;
  }

  if (typeof globalThis.atob === 'function') {
    const decoded = globalThis.atob(value);
    return Uint8Array.from(Array.from(decoded, (char) => char.charCodeAt(0)));
  }

  const runtime = globalThis as typeof globalThis & {
    Buffer?: {
      from: (input: string, encoding: 'base64') => Uint8Array;
    };
  };

  if (runtime.Buffer) {
    return Uint8Array.from(runtime.Buffer.from(value, 'base64'));
  }

  return null;
}

function getWalletDisplayName(walletId: HWWalletId): string {
  switch (walletId) {
    case 'bc-vault':
      return 'BC Vault';
    case 'dcent':
      return "D'CENT";
    case 'ellipal':
      return 'ELLIPAL';
    case 'solflare-shield':
      return 'Solflare Shield';
    case 'tangem':
      return 'Tangem';
    case 'arculus':
      return 'Arculus';
    default:
      return walletId;
  }
}

function isRecord(value: unknown): value is Record<string, ReactNativeWalletSignature | undefined> {
  return typeof value === 'object' && value !== null;
}
