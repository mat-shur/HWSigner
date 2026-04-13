'use client';

import bs58 from 'bs58';

import type { PopupClosedMessage } from '@trezor/connect-web';

import { getSolanaDerivationPaths, resolveDerivationPath } from '../hwsigner/derivation';
import {
  DeviceConnectionError,
  UnsupportedOperationError,
} from '../hwsigner/errors';
import {
  buildSignedLegacyResult,
  buildSignedVersionedResult,
  resolveLedgerTransactionSigningPayload,
  serializeTransactionForLedger,
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
import { mapTrezorError, getTrezorErrorMessage } from './error-map';

const TREZOR_DEFAULT_PATH = `m/44'/501'/0'/0'`;

type TrezorModule = typeof import('@trezor/connect-web');
type TrezorConnect = TrezorModule['default'];

let trezorModulePromise: Promise<TrezorModule> | null = null;
let trezorInitialized = false;

export class TrezorConnectClient {
  private readonly onEvent?: HWSignerEventListener;
  private connected = false;

  constructor(onEvent?: HWSignerEventListener) {
    this.onEvent = onEvent;
  }

  getCapabilities() {
    return {
      connect: true,
      disconnect: true,
      getAccounts: true,
      signMessage: false,
      signTransaction: true,
      signVersionedTransaction: true,
      emulator: false,
      usb: true,
      ble: false,
      qr: false,
      nfc: false,
    };
  }

  async connect(): Promise<HWSignerConnection> {
    this.ensureBrowser();

    this.onEvent?.({
      type: 'action',
      message: 'Opening Trezor Connect to request device access.',
    });

    await withTrezorPopupGuard(() => this.lookupAddress(TREZOR_DEFAULT_PATH, false));
    this.connected = true;

    return {
      walletId: 'trezor',
      walletName: 'Trezor',
      runtime: {
        kind: 'trezor-connect',
        transport: 'popup-bridge',
      },
      capabilities: this.getCapabilities(),
      appConfiguration: null,
    };
  }

  async disconnect(): Promise<void> {
    this.connected = false;

    try {
      const trezor = await getTrezorConnect();
      trezor.cancel();
    } catch {
      // Trezor Connect does not keep a meaningful session on our side.
    }
  }

  async getAppConfiguration(): Promise<HWSignerAppConfiguration | null> {
    return null;
  }

  async getAccounts(input: GetAccountsInput) {
    this.requireConnected();

    const trezor = await ensureTrezorInitialized();
    const paths = getSolanaDerivationPaths(input.startIndex, input.count);
    const response = await withTrezorPopupGuard(() => trezor.solanaGetAddress({
      bundle: paths.map((path) => ({
        path,
        showOnTrezor: input.checkOnDevice ?? false,
      })),
    }));
    const payload = unwrapTrezorResponse<Array<{ address: string }>>(response);

    return payload.map((account, offset) => ({
      index: input.startIndex + offset,
      path: paths[offset],
      address: account.address,
    }));
  }

  async signMessage(_input: SignMessageInput): Promise<SignedMessageResult> {
    throw new UnsupportedOperationError('Trezor Connect does not expose Solana signMessage.');
  }

  async signTransaction(input: SignTransactionInput): Promise<SignedTransactionResult> {
    this.requireConnected();

    const derivationPath = resolveDerivationPath(input);
    const address = await this.lookupAddress(derivationPath, false);
    const serialized = serializeTransactionForLedger(input.transaction);
    const payload = resolveLedgerTransactionSigningPayload(
      serialized.bytes,
      input.signingPayloadMode ?? 'serialized-transaction',
    );
    const signature = await this.signPayload(derivationPath, payload.bytes, payload.mode === 'serialized-transaction');

    return buildSignedLegacyResult({
      transaction: input.transaction,
      signerAddress: address,
      address,
      derivationPath,
      signature,
    });
  }

  async signVersionedTransaction(input: SignVersionedTransactionInput): Promise<SignedTransactionResult> {
    this.requireConnected();

    const derivationPath = resolveDerivationPath(input);
    const address = await this.lookupAddress(derivationPath, false);
    const serialized = serializeTransactionForLedger(input.transaction);
    const payload = resolveLedgerTransactionSigningPayload(
      serialized.bytes,
      input.signingPayloadMode ?? 'serialized-transaction',
    );
    const signature = await this.signPayload(derivationPath, payload.bytes, payload.mode === 'serialized-transaction');

    return buildSignedVersionedResult({
      transaction: input.transaction,
      derivationPath,
      address,
      signature,
    });
  }

  private async signPayload(path: string, bytes: Uint8Array, serialize: boolean): Promise<Uint8Array> {
    const trezor = await ensureTrezorInitialized();

    this.onEvent?.({
      type: 'action',
      message: serialize
        ? `Requesting Trezor signature for serialized transaction at ${path}.`
        : `Requesting Trezor signature for transaction message bytes at ${path}.`,
    });

    const response = await withTrezorPopupGuard(() => trezor.solanaSignTransaction({
      path,
      serializedTx: bytesToHex(bytes),
      serialize,
    }));
    const payload = unwrapTrezorResponse<{ signature: string }>(response);

    return decodeTrezorSignature(payload.signature);
  }

  private async lookupAddress(path: string, showOnTrezor: boolean): Promise<string> {
    const trezor = await ensureTrezorInitialized();
    const response = await withTrezorPopupGuard(() => trezor.solanaGetAddress({
      path,
      showOnTrezor,
    }));
    const payload = unwrapTrezorResponse<{ address: string }>(response);
    return payload.address;
  }

  private requireConnected() {
    if (!this.connected) {
      throw new DeviceConnectionError('Trezor is not connected.');
    }
  }

  private ensureBrowser() {
    if (typeof window === 'undefined') {
      throw new UnsupportedOperationError('Trezor Connect can only run in a browser.');
    }
  }
}

async function getTrezorConnect(): Promise<TrezorConnect> {
  const module = await getTrezorModule();
  return module.default;
}

async function getTrezorModule(): Promise<TrezorModule> {
  trezorModulePromise ??= import('@trezor/connect-web');
  return trezorModulePromise;
}

async function ensureTrezorInitialized(): Promise<TrezorConnect> {
  const trezor = await getTrezorConnect();

  if (trezorInitialized) {
    return trezor;
  }

  try {
    await trezor.init({
      manifest: {
        appName: process.env.NEXT_PUBLIC_TREZOR_MANIFEST_APP_NAME ?? 'HWSigner',
        email: process.env.NEXT_PUBLIC_TREZOR_MANIFEST_EMAIL ?? 'dev@hwsigner.local',
        appUrl: process.env.NEXT_PUBLIC_TREZOR_MANIFEST_APP_URL ?? getDefaultAppUrl(),
      },
      lazyLoad: true,
    });
    trezorInitialized = true;
    return trezor;
  } catch (error) {
    if (getTrezorErrorMessage(error).toLowerCase().includes('already initialized')) {
      trezorInitialized = true;
      return trezor;
    }

    throw mapTrezorError(error);
  }
}

function unwrapTrezorResponse<T>(response: { success: boolean; payload: unknown }): T {
  if (response.success) {
    return response.payload as T;
  }

  throw mapTrezorError(response.payload);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function decodeTrezorSignature(signature: string): Uint8Array {
  if (/^[0-9a-f]+$/i.test(signature) && signature.length % 2 === 0) {
    const bytes = new Uint8Array(signature.length / 2);

    for (let index = 0; index < signature.length; index += 2) {
      bytes[index / 2] = Number.parseInt(signature.slice(index, index + 2), 16);
    }

    return bytes;
  }

  try {
    return bs58.decode(signature);
  } catch {
    // fall through
  }

  try {
    if (typeof atob === 'function') {
      return Uint8Array.from(atob(signature), (char) => char.charCodeAt(0));
    }

    if (typeof Buffer !== 'undefined') {
      return Uint8Array.from(Buffer.from(signature, 'base64'));
    }

    throw new Error('No base64 decoder available.');
  } catch {
    throw new DeviceConnectionError('Trezor returned a signature in an unknown format.');
  }
}

function getDefaultAppUrl(): string {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }

  return 'http://localhost:3000';
}

async function withTrezorPopupGuard<T>(operation: () => Promise<T>): Promise<T> {
  const module = await getTrezorModule();
  const trezor = module.default;
  const popupEvent = module.POPUP.CLOSED as never;

  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      trezor.off(popupEvent, handlePopupClosed as never);
    };

    const settle = (fn: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      fn();
    };

    const handlePopupClosed = (event?: PopupClosedMessage) => {
      const error = event?.payload?.error ?? 'Trezor Connect popup was closed.';
      settle(() => reject(mapTrezorError(error)));
    };

    trezor.on(popupEvent, handlePopupClosed as never);

    void operation()
      .then((result) => {
        settle(() => resolve(result));
      })
      .catch((error) => {
        settle(() => reject(error));
      });
  });
}