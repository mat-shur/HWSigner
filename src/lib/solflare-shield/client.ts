'use client';

import bs58 from 'bs58';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import type { Cluster } from '@solana/web3.js';
import type Solflare from '@solflare-wallet/sdk';

import { DeviceConnectionError, UnsupportedOperationError } from '../hwsigner/errors';
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
import { mapSolflareShieldError } from './error-map';

const SOLFLARE_SHIELD_ACCOUNT_PATH = 'solflare-shield://selected-account';

type SolflareWallet = Solflare;
type SolflareModule = typeof import('@solflare-wallet/sdk');

let solflareModulePromise: Promise<SolflareModule> | null = null;

export class SolflareShieldClient {
  private readonly onEvent?: HWSignerEventListener;
  private readonly network: Cluster;
  private wallet: SolflareWallet | null = null;
  private address: string | null = null;

  constructor(options: {
    network?: Cluster;
    onEvent?: HWSignerEventListener;
  }) {
    this.network = options.network ?? 'devnet';
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
    this.ensureBrowser();
    const wallet = await this.getWallet();

    this.onEvent?.({
      type: 'action',
      message: 'Opening Solflare for Shield-backed account access.',
    });

    try {
      await wallet.connect();
    } catch (error) {
      throw mapSolflareShieldError(error);
    }

    const address = wallet.publicKey?.toBase58();
    if (!address) {
      throw new DeviceConnectionError('Solflare did not return a public key.');
    }

    this.address = address;

    return {
      walletId: 'solflare-shield',
      walletName: 'Solflare Shield',
      runtime: {
        kind: 'solflare-shield-sdk',
        transport: 'nfc',
        network: this.network,
      },
      capabilities: this.getCapabilities(),
      appConfiguration: null,
    };
  }

  async disconnect(): Promise<void> {
    const wallet = this.wallet;
    this.address = null;

    if (!wallet) {
      return;
    }

    try {
      await wallet.disconnect();
    } catch {
      // Solflare cleanup should not block HWSigner UI reset.
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
      path: SOLFLARE_SHIELD_ACCOUNT_PATH,
      address,
    }];
  }

  async signMessage(input: SignMessageInput): Promise<SignedMessageResult> {
    const { wallet, address } = await this.requireConnection();
    const messageBytes = normalizeMessageBytes(input.message);

    this.onEvent?.({
      type: 'action',
      message: 'Requesting Solflare Shield-backed message signature.',
    });

    let signature: Uint8Array;
    try {
      signature = await wallet.signMessage(messageBytes, typeof input.message === 'string' ? 'utf8' : 'hex');
    } catch (error) {
      throw mapSolflareShieldError(error);
    }

    return {
      address,
      derivationPath: SOLFLARE_SHIELD_ACCOUNT_PATH,
      message: messageToDisplayText(input.message),
      messageBytesBase64: bytesToBase64(messageBytes),
      signature: bs58.encode(signature),
      verified: null,
    };
  }

  async signTransaction(input: SignTransactionInput): Promise<SignedTransactionResult> {
    if (input.signingPayloadMode && input.signingPayloadMode !== 'serialized-transaction') {
      throw new UnsupportedOperationError('Solflare Shield runtime accepts native @solana/web3.js transactions through the Solflare SDK.');
    }

    const { wallet, address } = await this.requireConnection();

    this.onEvent?.({
      type: 'action',
      message: 'Requesting Solflare Shield-backed legacy transaction signature.',
    });

    let signed: Transaction;
    try {
      signed = await wallet.signTransaction(cloneLegacyTransaction(input.transaction)) as Transaction;
    } catch (error) {
      throw mapSolflareShieldError(error);
    }

    const signature = signed.signature;
    if (!signature) {
      throw new DeviceConnectionError('Solflare did not return a transaction signature.');
    }

    return buildSignedLegacyResult({
      transaction: input.transaction,
      signerAddress: address,
      address,
      derivationPath: input.derivationPath ?? SOLFLARE_SHIELD_ACCOUNT_PATH,
      signature: Uint8Array.from(signature),
    });
  }

  async signVersionedTransaction(input: SignVersionedTransactionInput): Promise<SignedTransactionResult> {
    if (input.signingPayloadMode && input.signingPayloadMode !== 'serialized-transaction') {
      throw new UnsupportedOperationError('Solflare Shield runtime accepts native @solana/web3.js versioned transactions through the Solflare SDK.');
    }

    const { wallet, address } = await this.requireConnection();

    this.onEvent?.({
      type: 'action',
      message: 'Requesting Solflare Shield-backed versioned transaction signature.',
    });

    let signed: VersionedTransaction;
    try {
      signed = await wallet.signTransaction(cloneVersionedTransaction(input.transaction)) as VersionedTransaction;
    } catch (error) {
      throw mapSolflareShieldError(error);
    }

    const signature = signed.signatures[0];
    if (!signature || signature.length === 0) {
      throw new DeviceConnectionError('Solflare did not return a versioned transaction signature.');
    }

    return buildSignedVersionedResult({
      transaction: input.transaction,
      derivationPath: input.derivationPath ?? SOLFLARE_SHIELD_ACCOUNT_PATH,
      address,
      signature,
    });
  }

  private async getWallet(): Promise<SolflareWallet> {
    if (this.wallet) {
      return this.wallet;
    }

    const module = await getSolflareModule();
    this.wallet = new module.default({
      network: this.network,
    });

    return this.wallet;
  }

  private async requireConnection(): Promise<{ wallet: SolflareWallet; address: string }> {
    const wallet = await this.getWallet();
    const address = this.address ?? wallet.publicKey?.toBase58();

    if (!address) {
      throw new DeviceConnectionError('Solflare Shield is not connected.');
    }

    this.address = address;
    return { wallet, address };
  }

  private async requireAddress(): Promise<string> {
    const { address } = await this.requireConnection();
    return address;
  }

  private ensureBrowser() {
    if (typeof window === 'undefined') {
      throw new UnsupportedOperationError('Solflare Shield can only run in a browser through the Solflare Wallet SDK.');
    }
  }
}

export function getSolflareShieldAccountPath(): string {
  return SOLFLARE_SHIELD_ACCOUNT_PATH;
}

async function getSolflareModule(): Promise<SolflareModule> {
  solflareModulePromise ??= import('@solflare-wallet/sdk');
  return solflareModulePromise;
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