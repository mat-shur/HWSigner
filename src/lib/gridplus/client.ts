'use client';

import bs58 from 'bs58';
import type { Transaction, VersionedTransaction } from '@solana/web3.js';

import { DeviceConnectionError, UnsupportedOperationError } from '@/lib/hwsigner/errors';
import { bytesToBase64, messageToDisplayText, normalizeMessageBytes } from '@/lib/hwsigner/message';
import { buildSignedLegacyResult, buildSignedVersionedResult } from '@/lib/hwsigner/transactions';
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
} from '@/lib/hwsigner/types';
import { mapGridPlusError } from '@/lib/gridplus/error-map';

const GRIDPLUS_ACCOUNT_PATH = 'gridplus-lattice://nufi-selected-account';

type NufiModule = typeof import('@solana/wallet-adapter-nufi');
type NufiAdapter = InstanceType<NufiModule['NufiWalletAdapter']>;

let nufiModulePromise: Promise<NufiModule> | null = null;

export class GridPlusNufiClient {
  private readonly onEvent?: HWSignerEventListener;
  private adapter: NufiAdapter | null = null;
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
      qr: false,
      nfc: false,
    };
  }

  async connect(): Promise<HWSignerConnection> {
    this.ensureBrowser();
    const adapter = await this.getAdapter();

    this.onEvent?.({
      type: 'action',
      message: 'Opening NuFi for a GridPlus Lattice1-backed Solana account.',
    });

    try {
      await adapter.connect();
    } catch (error) {
      throw mapGridPlusError(error);
    }

    const address = adapter.publicKey?.toBase58();
    if (!address) {
      throw new DeviceConnectionError('NuFi did not return a GridPlus Lattice1 public key.');
    }

    this.address = address;

    return {
      walletId: 'gridplus-lattice',
      walletName: 'GridPlus Lattice1',
      runtime: {
        kind: 'gridplus-nufi-provider',
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
      // NuFi cleanup should not block the UI state reset.
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
      path: GRIDPLUS_ACCOUNT_PATH,
      address,
    }];
  }

  async signMessage(input: SignMessageInput): Promise<SignedMessageResult> {
    const { adapter, address } = await this.requireConnection();
    const messageBytes = normalizeMessageBytes(input.message);

    this.onEvent?.({
      type: 'action',
      message: 'Requesting NuFi message signature from the GridPlus Lattice1-backed account.',
    });

    let signatureBytes: Uint8Array;
    try {
      signatureBytes = await adapter.signMessage(messageBytes);
    } catch (error) {
      throw mapGridPlusError(error);
    }

    return {
      address,
      derivationPath: GRIDPLUS_ACCOUNT_PATH,
      message: messageToDisplayText(input.message),
      messageBytesBase64: bytesToBase64(messageBytes),
      signature: bs58.encode(signatureBytes),
      verified: null,
    };
  }

  async signTransaction(input: SignTransactionInput): Promise<SignedTransactionResult> {
    if (input.signingPayloadMode && input.signingPayloadMode !== 'serialized-transaction') {
      throw new UnsupportedOperationError('GridPlus Lattice1 via NuFi accepts native @solana/web3.js transactions through the NuFi wallet adapter.');
    }

    const { adapter, address } = await this.requireConnection();

    this.onEvent?.({
      type: 'action',
      message: 'Requesting NuFi legacy transaction signature from the GridPlus Lattice1-backed account.',
    });

    let signed: Transaction;
    try {
      signed = await adapter.signTransaction(input.transaction);
    } catch (error) {
      throw mapGridPlusError(error);
    }

    const signature = signed.signature;
    if (!signature) {
      throw new DeviceConnectionError('NuFi did not return a GridPlus Lattice1 transaction signature.');
    }

    return buildSignedLegacyResult({
      transaction: signed,
      signerAddress: address,
      address,
      derivationPath: input.derivationPath ?? GRIDPLUS_ACCOUNT_PATH,
      signature: Uint8Array.from(signature),
    });
  }

  async signVersionedTransaction(input: SignVersionedTransactionInput): Promise<SignedTransactionResult> {
    if (input.signingPayloadMode && input.signingPayloadMode !== 'serialized-transaction') {
      throw new UnsupportedOperationError('GridPlus Lattice1 via NuFi accepts native @solana/web3.js versioned transactions through the NuFi wallet adapter.');
    }

    const { adapter, address } = await this.requireConnection();

    this.onEvent?.({
      type: 'action',
      message: 'Requesting NuFi versioned transaction signature from the GridPlus Lattice1-backed account.',
    });

    let signed: VersionedTransaction;
    try {
      signed = await adapter.signTransaction(input.transaction);
    } catch (error) {
      throw mapGridPlusError(error);
    }

    const signature = signed.signatures[0];
    if (!signature || signature.length === 0) {
      throw new DeviceConnectionError('NuFi did not return a GridPlus Lattice1 versioned transaction signature.');
    }

    return buildSignedVersionedResult({
      transaction: signed,
      derivationPath: input.derivationPath ?? GRIDPLUS_ACCOUNT_PATH,
      address,
      signature,
    });
  }

  private async getAdapter(): Promise<NufiAdapter> {
    if (this.adapter) {
      return this.adapter;
    }

    const module = await getNufiModule();
    this.adapter = new module.NufiWalletAdapter();
    return this.adapter;
  }

  private async requireConnection(): Promise<{ adapter: NufiAdapter; address: string }> {
    const adapter = await this.getAdapter();
    const address = this.address ?? adapter.publicKey?.toBase58();

    if (!address) {
      throw new DeviceConnectionError('GridPlus Lattice1 via NuFi is not connected.');
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
      throw new UnsupportedOperationError('GridPlus Lattice1 via NuFi can only run in a browser.');
    }
  }
}

export function getGridPlusAccountPath(): string {
  return GRIDPLUS_ACCOUNT_PATH;
}

async function getNufiModule(): Promise<NufiModule> {
  nufiModulePromise ??= import('@solana/wallet-adapter-nufi');
  return nufiModulePromise;
}
