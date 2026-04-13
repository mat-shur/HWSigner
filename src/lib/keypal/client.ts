'use client';

import bs58 from 'bs58';
import { Transaction } from '@solana/web3.js';

import { DeviceConnectionError, UnsupportedOperationError } from '../hwsigner/errors';
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
import { mapKeyPalError } from './error-map';

const KEYPAL_ACCOUNT_PATH = 'keypal://tokenpocket-selected-account';

type TokenPocketModule = typeof import('@solana/wallet-adapter-tokenpocket');
type TokenPocketAdapter = InstanceType<TokenPocketModule['TokenPocketWalletAdapter']>;

let tokenPocketModulePromise: Promise<TokenPocketModule> | null = null;

export class KeyPalTokenPocketClient {
  private readonly onEvent?: HWSignerEventListener;
  private adapter: TokenPocketAdapter | null = null;
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
    const adapter = await this.getAdapter();

    this.onEvent?.({
      type: 'action',
      message: 'Opening TokenPocket for a KeyPal-backed Solana account.',
    });

    try {
      await adapter.connect();
    } catch (error) {
      throw mapKeyPalError(error);
    }

    const address = adapter.publicKey?.toBase58();
    if (!address) {
      throw new DeviceConnectionError('TokenPocket did not return a KeyPal public key.');
    }

    this.address = address;

    return {
      walletId: 'keypal',
      walletName: 'KeyPal',
      runtime: {
        kind: 'keypal-tokenpocket-provider',
        transport: 'injected-provider',
      },
      capabilities: this.getCapabilities(),
      appConfiguration: null,
    };
  }

  async disconnect(): Promise<void> {
    if (!this.adapter) {
      this.address = null;
      return;
    }

    try {
      await this.adapter.disconnect();
    } catch {
      // TokenPocket cleanup should not block UI state reset.
    } finally {
      this.address = null;
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
      path: KEYPAL_ACCOUNT_PATH,
      address,
    }];
  }

  async signMessage(input: SignMessageInput): Promise<SignedMessageResult> {
    const { adapter, address } = await this.requireConnection();
    const messageBytes = normalizeMessageBytes(input.message);

    this.onEvent?.({
      type: 'action',
      message: 'Requesting TokenPocket message signature from the KeyPal-backed account.',
    });

    let signatureBytes: Uint8Array;
    try {
      signatureBytes = await adapter.signMessage(messageBytes);
    } catch (error) {
      throw mapKeyPalError(error);
    }

    return {
      address,
      derivationPath: KEYPAL_ACCOUNT_PATH,
      message: messageToDisplayText(input.message),
      messageBytesBase64: bytesToBase64(messageBytes),
      signature: bs58.encode(signatureBytes),
      verified: null,
    };
  }

  async signTransaction(input: SignTransactionInput): Promise<SignedTransactionResult> {
    if (input.signingPayloadMode && input.signingPayloadMode !== 'serialized-transaction') {
      throw new UnsupportedOperationError('KeyPal via TokenPocket accepts native @solana/web3.js legacy transactions through the TokenPocket wallet adapter.');
    }

    const { adapter, address } = await this.requireConnection();

    this.onEvent?.({
      type: 'action',
      message: 'Requesting TokenPocket legacy transaction signature from the KeyPal-backed account.',
    });

    let signed: Transaction;
    try {
      signed = await adapter.signTransaction(input.transaction);
    } catch (error) {
      throw mapKeyPalError(error);
    }

    const signature = signed.signature;
    if (!signature) {
      throw new DeviceConnectionError('TokenPocket did not return a KeyPal transaction signature.');
    }

    return buildSignedLegacyResult({
      transaction: signed,
      signerAddress: address,
      address,
      derivationPath: input.derivationPath ?? KEYPAL_ACCOUNT_PATH,
      signature: Uint8Array.from(signature),
    });
  }

  async signVersionedTransaction(_input: SignVersionedTransactionInput): Promise<SignedTransactionResult> {
    throw new UnsupportedOperationError('KeyPal versioned transaction signing is not enabled because TokenPocket reports no supported transaction versions.');
  }

  private async getAdapter(): Promise<TokenPocketAdapter> {
    if (this.adapter) {
      return this.adapter;
    }

    const module = await getTokenPocketModule();
    this.adapter = new module.TokenPocketWalletAdapter();
    return this.adapter;
  }

  private async requireConnection(): Promise<{ adapter: TokenPocketAdapter; address: string }> {
    const adapter = await this.getAdapter();
    const address = this.address ?? adapter.publicKey?.toBase58();

    if (!address) {
      throw new DeviceConnectionError('KeyPal via TokenPocket is not connected.');
    }

    this.address = address;
    return { adapter, address };
  }

  private async requireAddress(): Promise<string> {
    const { address } = await this.requireConnection();
    return address;
  }

  private ensureBrowser() {
    if (typeof window === 'undefined') {
      throw new UnsupportedOperationError('KeyPal via TokenPocket can only run in a browser.');
    }
  }
}

export function getKeyPalAccountPath(): string {
  return KEYPAL_ACCOUNT_PATH;
}

async function getTokenPocketModule(): Promise<TokenPocketModule> {
  tokenPocketModulePromise ??= import('@solana/wallet-adapter-tokenpocket');
  return tokenPocketModulePromise;
}