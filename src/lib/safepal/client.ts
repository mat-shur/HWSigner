'use client';

import bs58 from 'bs58';
import { Transaction } from '@solana/web3.js';
import type { PublicKey } from '@solana/web3.js';

import {
  AdapterInitializationError,
  DeviceConnectionError,
  DeviceNotFoundError,
  UnsupportedOperationError,
} from '../hwsigner/errors';
import { bytesToBase64, messageToDisplayText, normalizeMessageBytes } from '../hwsigner/message';
import { buildSignedLegacyResult } from '../hwsigner/transactions';
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
import { getSafePalErrorMessage, mapSafePalError } from './error-map';

const SAFEPAL_ACCOUNT_PATH = 'safepal://selected-account';

type SafePalProvider = {
  isSafePalWallet?: boolean;
  connected?: boolean;
  publicKey?: PublicKey | { toString(): string };
  connect?: () => Promise<unknown>;
  disconnect?: () => Promise<unknown>;
  getAccount?: () => Promise<string>;
  signMessage?: (message: string | Uint8Array) => Promise<unknown>;
  signTransaction?: <T extends Transaction>(transaction: T) => Promise<T>;
};

declare global {
  interface Window {
    safepal?: SafePalProvider;
  }
}

export class SafePalProviderClient {
  private readonly onEvent?: HWSignerEventListener;
  private provider: SafePalProvider | null = null;
  private address: string | null = null;

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
      signVersionedTransaction: false,
      emulator: false,
      usb: false,
      ble: false,
      qr: false,
      nfc: false,
    };
  }

  async connect(): Promise<HWSignerConnection> {
    this.ensureBrowser();
    const provider = this.getProvider();

    if (typeof provider.connect !== 'function') {
      throw new AdapterInitializationError('SafePal provider does not expose connect().');
    }

    this.onEvent?.({
      type: 'action',
      message: 'Requesting SafePal access through the injected provider.',
    });

    try {
      await provider.connect();
    } catch (error) {
      throw mapSafePalError(error);
    }

    const address = await this.resolveAddress(provider);
    this.provider = provider;
    this.address = address;

    return {
      walletId: 'safepal',
      walletName: 'SafePal',
      runtime: {
        kind: 'safepal-provider',
        transport: 'injected-provider',
      },
      capabilities: this.getCapabilities(),
      appConfiguration: null,
    };
  }

  async disconnect(): Promise<void> {
    const provider = this.provider;
    this.provider = null;
    this.address = null;

    if (!provider || typeof provider.disconnect !== 'function') {
      return;
    }

    try {
      await provider.disconnect();
    } catch {
      // SafePal injected providers do not guarantee a disconnect hook.
    }
  }

  async getAppConfiguration(): Promise<HWSignerAppConfiguration | null> {
    return null;
  }

  async getAccounts(input: GetAccountsInput) {
    const address = await this.requireAddress();

    if (input.count < 1 || input.startIndex > 0) {
      return [];
    }

    return [{
      index: 0,
      path: SAFEPAL_ACCOUNT_PATH,
      address,
    }];
  }

  async signMessage(input: SignMessageInput): Promise<SignedMessageResult> {
    const { provider, address } = await this.requireConnection();

    if (typeof provider.signMessage !== 'function') {
      throw new UnsupportedOperationError('SafePal signMessage is not available in this runtime.');
    }

    const messageBytes = normalizeMessageBytes(input.message);

    this.onEvent?.({
      type: 'action',
      message: 'Requesting SafePal message signature.',
    });

    let signature: Uint8Array;
    try {
      signature = decodeSafePalSignature(await provider.signMessage(messageBytes), 'message');
    } catch (error) {
      throw mapSafePalError(error);
    }

    return {
      address,
      derivationPath: SAFEPAL_ACCOUNT_PATH,
      message: messageToDisplayText(input.message),
      messageBytesBase64: bytesToBase64(messageBytes),
      signature: bs58.encode(signature),
      verified: null,
    };
  }

  async signTransaction(input: SignTransactionInput): Promise<SignedTransactionResult> {
    if (input.signingPayloadMode && input.signingPayloadMode !== 'serialized-transaction') {
      throw new UnsupportedOperationError('SafePal only supports "serialized-transaction" signing in this runtime.');
    }

    const { provider, address } = await this.requireConnection();

    if (typeof provider.signTransaction !== 'function') {
      throw new UnsupportedOperationError('SafePal signTransaction is not available in this runtime.');
    }

    this.onEvent?.({
      type: 'action',
      message: 'Requesting SafePal signature for a legacy transaction.',
    });

    let signed: Transaction;
    try {
      signed = await provider.signTransaction(cloneLegacyTransaction(input.transaction));
    } catch (error) {
      throw mapSafePalError(error);
    }

    const signature = signed.signature;
    if (!signature) {
      throw new DeviceConnectionError('SafePal did not return a transaction signature.');
    }

    return buildSignedLegacyResult({
      transaction: input.transaction,
      signerAddress: address,
      address,
      derivationPath: input.derivationPath ?? SAFEPAL_ACCOUNT_PATH,
      signature: Uint8Array.from(signature),
    });
  }

  async signVersionedTransaction(_input: SignVersionedTransactionInput): Promise<SignedTransactionResult> {
    throw new UnsupportedOperationError('SafePal versioned transaction signing is not implemented in this runtime.');
  }

  private async requireConnection(): Promise<{ provider: SafePalProvider; address: string }> {
    const provider = this.provider ?? this.getProvider();
    const address = this.address ?? await this.resolveAddress(provider);

    if (!address) {
      throw new DeviceConnectionError('SafePal is not connected.');
    }

    this.provider = provider;
    this.address = address;

    return { provider, address };
  }

  private async requireAddress(): Promise<string> {
    const { address } = await this.requireConnection();
    return address;
  }

  private async resolveAddress(provider: SafePalProvider): Promise<string> {
    if (typeof provider.getAccount === 'function') {
      try {
        const account = await provider.getAccount();
        if (account) {
          return account;
        }
      } catch (error) {
        throw mapSafePalError(error);
      }
    }

    const publicKey = provider.publicKey;
    if (publicKey && typeof publicKey.toString === 'function') {
      const address = publicKey.toString();
      if (address) {
        return address;
      }
    }

    throw new DeviceConnectionError('SafePal did not return a public key.');
  }

  private getProvider(): SafePalProvider {
    const provider = typeof window !== 'undefined' ? window.safepal : undefined;

    if (!provider || !provider.isSafePalWallet) {
      throw new DeviceNotFoundError('SafePal provider was not found. Install the SafePal extension or open the SafePal in-app browser.');
    }

    return provider;
  }

  private ensureBrowser() {
    if (typeof window === 'undefined') {
      throw new UnsupportedOperationError('SafePal can only run in a browser.');
    }
  }
}

export function getSafePalAccountPath(): string {
  return SAFEPAL_ACCOUNT_PATH;
}

export function normalizeSafePalErrorMessage(error: unknown): string {
  return getSafePalErrorMessage(error);
}

function cloneLegacyTransaction(transaction: Transaction): Transaction {
  return Transaction.from(transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  }));
}

function decodeSafePalSignature(value: unknown, action: 'message' | 'transaction'): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  if (Array.isArray(value) && value.every((item) => typeof item === 'number')) {
    return Uint8Array.from(value);
  }

  if (isRecord(value)) {
    if ('signature' in value) {
      return decodeSafePalSignature(value.signature, action);
    }

    if ('data' in value) {
      return decodeSafePalSignature(value.data, action);
    }
  }

  if (typeof value === 'string' && value) {
    if (/^[0-9a-f]+$/i.test(value) && value.length % 2 === 0) {
      const bytes = new Uint8Array(value.length / 2);

      for (let index = 0; index < value.length; index += 2) {
        bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
      }

      return bytes;
    }

    try {
      return bs58.decode(value);
    } catch {
      // fall through
    }

    try {
      if (typeof atob === 'function') {
        return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
      }

      if (typeof Buffer !== 'undefined') {
        return Uint8Array.from(Buffer.from(value, 'base64'));
      }
    } catch {
      // fall through
    }
  }

  throw new DeviceConnectionError(`SafePal returned a ${action} signature in an unknown format.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}