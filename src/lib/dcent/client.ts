'use client';

import bs58 from 'bs58';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import type { Transaction, VersionedTransaction } from '@solana/web3.js';

import { AdapterInitializationError, DeviceConnectionError, UnsupportedOperationError } from '../hwsigner/errors';
import { bytesToBase64, messageToDisplayText, normalizeMessageBytes } from '../hwsigner/message';
import {
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
import { getDcentErrorMessage, mapDcentError } from './error-map';

const DCENT_ACCOUNT_PATH = 'dcent://selected-account';

type WalletConnectModule = typeof import('@solana/wallet-adapter-walletconnect');
type WalletConnectAdapter = InstanceType<WalletConnectModule['WalletConnectWalletAdapter']>;

let walletConnectModulePromise: Promise<WalletConnectModule> | null = null;

export class DcentWalletConnectClient {
  private readonly onEvent?: HWSignerEventListener;
  private adapter: WalletConnectAdapter | null = null;
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
      signVersionedTransaction: true,
      emulator: false,
      usb: false,
      ble: false,
      qr: true,
      nfc: false,
    };
  }

  async connect(): Promise<HWSignerConnection> {
    this.ensureBrowser();
    const adapter = await this.getAdapter();

    this.onEvent?.({
      type: 'action',
      message: "Opening D'CENT WalletConnect QR flow.",
    });

    try {
      await adapter.connect();
    } catch (error) {
      throw mapDcentError(error);
    }

    const publicKey = adapter.publicKey?.toBase58();
    if (!publicKey) {
      throw new DeviceConnectionError("D'CENT did not return a public key.");
    }

    this.address = publicKey;

    return {
      walletId: 'dcent',
      walletName: "D'CENT",
      runtime: {
        kind: 'dcent-walletconnect',
        transport: 'qr',
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
      // WalletConnect cleanup should not block UI state reset.
    } finally {
      this.address = null;
    }
  }

  async getAppConfiguration(): Promise<HWSignerAppConfiguration | null> {
    return null;
  }

  async getAccounts(input: GetAccountsInput) {
    const address = await this.requireAddress();

    if (input.count < 1) {
      return [];
    }

    if (input.startIndex > 0) {
      return [];
    }

    return [{
      index: 0,
      path: DCENT_ACCOUNT_PATH,
      address,
    }];
  }

  async signMessage(input: SignMessageInput): Promise<SignedMessageResult> {
    const { adapter, address } = await this.requireConnection();
    const messageBytes = normalizeMessageBytes(input.message);

    this.onEvent?.({
      type: 'action',
      message: "Requesting D'CENT message signature over WalletConnect.",
    });

    let signatureBytes: Uint8Array;
    try {
      signatureBytes = await adapter.signMessage(messageBytes);
    } catch (error) {
      throw mapDcentError(error);
    }

    return {
      address,
      derivationPath: DCENT_ACCOUNT_PATH,
      message: messageToDisplayText(input.message),
      messageBytesBase64: bytesToBase64(messageBytes),
      signature: bs58.encode(signatureBytes),
      verified: null,
    };
  }

  async signTransaction(input: SignTransactionInput): Promise<SignedTransactionResult> {
    if (input.signingPayloadMode && input.signingPayloadMode !== 'serialized-transaction') {
      throw new UnsupportedOperationError(`D'CENT only supports "serialized-transaction" signing in this runtime.`);
    }

    const { adapter, address } = await this.requireConnection();

    this.onEvent?.({
      type: 'action',
      message: "Requesting D'CENT signature for a legacy transaction.",
    });

    let signed: Transaction;
    try {
      signed = await adapter.signTransaction(input.transaction);
    } catch (error) {
      throw mapDcentError(error);
    }

    const signature = signed.signature;
    if (!signature) {
      throw new DeviceConnectionError("D'CENT did not return a transaction signature.");
    }

    return buildSignedLegacyResult({
      transaction: signed,
      signerAddress: address,
      address,
      derivationPath: input.derivationPath ?? DCENT_ACCOUNT_PATH,
      signature: Uint8Array.from(signature),
    });
  }

  async signVersionedTransaction(input: SignVersionedTransactionInput): Promise<SignedTransactionResult> {
    if (input.signingPayloadMode && input.signingPayloadMode !== 'serialized-transaction') {
      throw new UnsupportedOperationError(`D'CENT only supports "serialized-transaction" signing in this runtime.`);
    }

    const { adapter, address } = await this.requireConnection();

    this.onEvent?.({
      type: 'action',
      message: "Requesting D'CENT signature for a versioned transaction.",
    });

    let signed: VersionedTransaction;
    try {
      signed = await adapter.signTransaction(input.transaction);
    } catch (error) {
      throw mapDcentError(error);
    }

    const signature = signed.signatures[0];
    if (!signature || signature.length === 0) {
      throw new DeviceConnectionError("D'CENT did not return a versioned transaction signature.");
    }

    return buildSignedVersionedResult({
      transaction: signed,
      derivationPath: input.derivationPath ?? DCENT_ACCOUNT_PATH,
      address,
      signature,
    });
  }

  private async getAdapter(): Promise<WalletConnectAdapter> {
    if (this.adapter) {
      return this.adapter;
    }

    const projectId = getWalletConnectProjectId();
    const module = await getWalletConnectModule();

    this.adapter = new module.WalletConnectWalletAdapter({
      network: WalletAdapterNetwork.Devnet,
      options: {
        projectId,
        metadata: buildWalletConnectMetadata(),
      },
    });

    return this.adapter;
  }

  private async requireConnection(): Promise<{ adapter: WalletConnectAdapter; address: string }> {
    const adapter = await this.getAdapter();
    const address = this.address ?? adapter.publicKey?.toBase58();

    if (!address) {
      throw new DeviceConnectionError("D'CENT is not connected.");
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
      throw new UnsupportedOperationError("D'CENT WalletConnect can only run in a browser.");
    }
  }
}

async function getWalletConnectModule(): Promise<WalletConnectModule> {
  walletConnectModulePromise ??= import('@solana/wallet-adapter-walletconnect');
  return walletConnectModulePromise;
}

function getWalletConnectProjectId(): string {
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();

  if (!projectId) {
    throw new AdapterInitializationError('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is required for the D\'CENT WalletConnect runtime.');
  }

  return projectId;
}

function buildWalletConnectMetadata() {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  return {
    name: 'HWSigner',
    description: 'HWSigner Solana hardware wallet playground',
    url: origin,
    icons: [`${origin}/favicon.ico`],
  };
}

export function normalizeDcentErrorMessage(error: unknown): string {
  return getDcentErrorMessage(error);
}