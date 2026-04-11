'use client';

import bs58 from 'bs58';
import type { Features, KnownDevice, SearchDevice } from '@onekeyfe/hd-core';

import { getSolanaDerivationPaths, resolveDerivationPath } from '@/lib/hwsigner/derivation';
import {
  AdapterInitializationError,
  DeviceConnectionError,
  DeviceNotFoundError,
  UnsupportedOperationError,
} from '@/lib/hwsigner/errors';
import { bytesToBase64, messageToDisplayText, normalizeMessageBytes } from '@/lib/hwsigner/message';
import {
  buildSignedLegacyResult,
  buildSignedVersionedResult,
  resolveLedgerTransactionSigningPayload,
  serializeTransactionForLedger,
} from '@/lib/hwsigner/transactions';
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
import { getOneKeyErrorMessage, mapOneKeyError } from '@/lib/onekey/error-map';

const ONEKEY_DEFAULT_PATH = `m/44'/501'/0'/0'`;

type OneKeySdk = typeof import('@onekeyfe/hd-common-connect-sdk').default;

type OneKeySession = {
  connectId: string;
  deviceId: string;
  features: Features | null;
  deviceName: string;
};

let oneKeySdkPromise: Promise<OneKeySdk> | null = null;
let oneKeyInitialized = false;

export class OneKeyWebUsbClient {
  private readonly onEvent?: HWSignerEventListener;
  private session: OneKeySession | null = null;

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
      usb: true,
      ble: false,
      qr: false,
      nfc: false,
    };
  }

  async connect(): Promise<HWSignerConnection> {
    this.ensureBrowser();
    this.ensureWebUsb();

    const sdk = await ensureOneKeyInitialized();
    this.session = null;

    this.onEvent?.({
      type: 'action',
      message: 'Opening OneKey WebUSB access prompt.',
    });

    const device = await this.requestDevice(sdk);
    const features = await this.loadFeatures(sdk, device.connectId);

    await this.lookupAddress({
      sdk,
      connectId: device.connectId,
      deviceId: device.deviceId,
      path: ONEKEY_DEFAULT_PATH,
      showOnOneKey: false,
    });

    this.session = {
      connectId: device.connectId,
      deviceId: device.deviceId,
      features,
      deviceName: device.name,
    };

    const firmwareVersion = formatFirmwareVersion(features);
    if (firmwareVersion) {
      this.onEvent?.({
        type: 'info',
        message: `OneKey firmware ${firmwareVersion} detected.`,
      });
    }

    return {
      walletId: 'onekey',
      walletName: 'OneKey',
      runtime: {
        kind: 'onekey-webusb',
        transport: 'webusb',
      },
      capabilities: this.getCapabilities(),
      appConfiguration: null,
    };
  }

  async disconnect(): Promise<void> {
    const activeSession = this.session;
    this.session = null;

    if (!activeSession) {
      return;
    }

    try {
      const sdk = await ensureOneKeyInitialized();
      sdk.cancel(activeSession.connectId);
    } catch {
      // OneKey does not expose a dedicated disconnect hook in this web flow.
    }
  }

  async getAppConfiguration(): Promise<HWSignerAppConfiguration | null> {
    return null;
  }

  async getAccounts(input: GetAccountsInput) {
    const { sdk, connectId, deviceId } = await this.requireSession();
    const paths = getSolanaDerivationPaths(input.startIndex, input.count);
    const response = await sdk.solGetAddress(connectId, deviceId, {
      bundle: paths.map((path) => ({
        path,
        showOnOneKey: input.checkOnDevice ?? false,
      })),
    });
    const payload = unwrapOneKeyResponse<Array<{ address?: string; path: string }>>(response);

    return payload.map((account, offset) => ({
      index: input.startIndex + offset,
      path: account.path || paths[offset],
      address: expectString(account.address, 'OneKey did not return a Solana address.'),
    }));
  }

  async signMessage(input: SignMessageInput): Promise<SignedMessageResult> {
    const { sdk, connectId, deviceId } = await this.requireSession();
    const derivationPath = resolveDerivationPath(input);
    const address = await this.lookupAddress({
      sdk,
      connectId,
      deviceId,
      path: derivationPath,
      showOnOneKey: false,
    });
    const messageBytes = normalizeMessageBytes(input.message);

    this.onEvent?.({
      type: 'action',
      message: `Requesting OneKey message signature at ${derivationPath}.`,
    });

    const response = await sdk.solSignMessage(connectId, deviceId, {
      path: derivationPath,
      messageHex: bytesToHex(messageBytes),
    });
    const payload = unwrapOneKeyResponse<{ signature?: string }>(response);
    const signatureBytes = decodeOneKeySignature(payload.signature, 'message');

    return {
      address,
      derivationPath,
      message: messageToDisplayText(input.message),
      messageBytesBase64: bytesToBase64(messageBytes),
      signature: bs58.encode(signatureBytes),
      verified: null,
    };
  }

  async signTransaction(input: SignTransactionInput): Promise<SignedTransactionResult> {
    const { sdk, connectId, deviceId } = await this.requireSession();
    const derivationPath = resolveDerivationPath(input);
    const address = await this.lookupAddress({
      sdk,
      connectId,
      deviceId,
      path: derivationPath,
      showOnOneKey: false,
    });
    const payload = resolveLedgerTransactionSigningPayload(
      serializeTransactionForLedger(input.transaction).bytes,
      input.signingPayloadMode ?? 'serialized-transaction',
    );

    this.onEvent?.({
      type: 'action',
      message: `Requesting OneKey signature for ${payload.mode} at ${derivationPath}.`,
    });

    const response = await sdk.solSignTransaction(connectId, deviceId, {
      path: derivationPath,
      rawTx: bytesToHex(payload.bytes),
    });
    const signed = unwrapOneKeyResponse<{ signature?: string }>(response);
    const signature = decodeOneKeySignature(signed.signature, 'transaction');

    return buildSignedLegacyResult({
      transaction: input.transaction,
      signerAddress: address,
      address,
      derivationPath,
      signature,
    });
  }

  async signVersionedTransaction(input: SignVersionedTransactionInput): Promise<SignedTransactionResult> {
    const { sdk, connectId, deviceId } = await this.requireSession();
    const derivationPath = resolveDerivationPath(input);
    const address = await this.lookupAddress({
      sdk,
      connectId,
      deviceId,
      path: derivationPath,
      showOnOneKey: false,
    });
    const payload = resolveLedgerTransactionSigningPayload(
      serializeTransactionForLedger(input.transaction).bytes,
      input.signingPayloadMode ?? 'serialized-transaction',
    );

    this.onEvent?.({
      type: 'action',
      message: `Requesting OneKey signature for ${payload.mode} at ${derivationPath}.`,
    });

    const response = await sdk.solSignTransaction(connectId, deviceId, {
      path: derivationPath,
      rawTx: bytesToHex(payload.bytes),
    });
    const signed = unwrapOneKeyResponse<{ signature?: string }>(response);
    const signature = decodeOneKeySignature(signed.signature, 'transaction');

    return buildSignedVersionedResult({
      transaction: input.transaction,
      derivationPath,
      address,
      signature,
    });
  }

  private async requireSession(): Promise<{
    sdk: OneKeySdk;
    connectId: string;
    deviceId: string;
  }> {
    if (!this.session) {
      throw new DeviceConnectionError('OneKey is not connected.');
    }

    const sdk = await ensureOneKeyInitialized();
    return {
      sdk,
      connectId: this.session.connectId,
      deviceId: this.session.deviceId,
    };
  }

  private async requestDevice(sdk: OneKeySdk): Promise<{
    connectId: string;
    deviceId: string;
    name: string;
  }> {
    const promptResponse = await sdk.promptWebDeviceAccess();
    const promptedDevice = unwrapOneKeyResponse<{ device: KnownDevice | null }>(promptResponse).device;

    const searchResponse = await sdk.searchDevices();
    const devices = unwrapOneKeyResponse<SearchDevice[]>(searchResponse);

    return resolveOneKeyDevice(promptedDevice, devices);
  }

  private async loadFeatures(sdk: OneKeySdk, connectId: string): Promise<Features | null> {
    try {
      const response = await sdk.getFeatures(connectId);
      return unwrapOneKeyResponse<Features>(response);
    } catch (error) {
      this.onEvent?.({
        type: 'warning',
        message: `OneKey features lookup failed: ${getOneKeyErrorMessage(error)}`,
      });
      return null;
    }
  }

  private async lookupAddress(params: {
    sdk: OneKeySdk;
    connectId: string;
    deviceId: string;
    path: string;
    showOnOneKey: boolean;
  }): Promise<string> {
    const response = await params.sdk.solGetAddress(params.connectId, params.deviceId, {
      path: params.path,
      showOnOneKey: params.showOnOneKey,
    });
    const payload = unwrapOneKeyResponse<{ address?: string }>(response);

    return expectString(payload.address, 'OneKey did not return a Solana address.');
  }

  private ensureBrowser() {
    if (typeof window === 'undefined') {
      throw new UnsupportedOperationError('OneKey WebUSB can only run in a browser.');
    }
  }

  private ensureWebUsb() {
    if (typeof navigator === 'undefined' || !('usb' in navigator)) {
      throw new UnsupportedOperationError('WebUSB is not available in this browser.');
    }
  }
}

async function getOneKeySdk(): Promise<OneKeySdk> {
  oneKeySdkPromise ??= import('@onekeyfe/hd-common-connect-sdk').then((module) => module.default);
  return oneKeySdkPromise;
}

async function ensureOneKeyInitialized(): Promise<OneKeySdk> {
  const sdk = await getOneKeySdk();

  if (oneKeyInitialized) {
    return sdk;
  }

  try {
    const initialized = await sdk.init({
      debug: false,
      env: 'webusb',
      lazyLoad: true,
      origin: getDefaultAppOrigin(),
    });

    if (!initialized) {
      throw new AdapterInitializationError('OneKey SDK initialization failed.');
    }

    oneKeyInitialized = true;
    return sdk;
  } catch (error) {
    if (getOneKeyErrorMessage(error).toLowerCase().includes('already initialized')) {
      oneKeyInitialized = true;
      return sdk;
    }

    throw mapOneKeyError(error);
  }
}

function unwrapOneKeyResponse<T>(response: { success: boolean; payload: unknown }): T {
  if (response.success) {
    return response.payload as T;
  }

  throw mapOneKeyError(response.payload);
}

function resolveOneKeyDevice(
  promptedDevice: KnownDevice | null,
  devices: SearchDevice[],
): {
  connectId: string;
  deviceId: string;
  name: string;
} {
  const candidate = [
    promptedDevice ? toResolvedDevice(promptedDevice) : null,
    ...devices.map((device) => toResolvedDevice(device)),
  ].find((device) => device !== null);

  if (!candidate) {
    throw new DeviceNotFoundError('No OneKey device was selected or granted for WebUSB access.');
  }

  return candidate;
}

function toResolvedDevice(device: Pick<KnownDevice, 'connectId' | 'deviceId' | 'name'> | Pick<SearchDevice, 'connectId' | 'deviceId' | 'name'>): {
  connectId: string;
  deviceId: string;
  name: string;
} | null {
  if (!device.connectId || !device.deviceId) {
    return null;
  }

  return {
    connectId: device.connectId,
    deviceId: device.deviceId,
    name: device.name,
  };
}

function decodeOneKeySignature(signature: string | undefined, action: 'message' | 'transaction'): Uint8Array {
  if (!signature) {
    throw new DeviceConnectionError(`OneKey did not return a ${action} signature.`);
  }

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
    throw new DeviceConnectionError('OneKey returned a signature in an unknown format.');
  }
}

function expectString(value: string | undefined, message: string): string {
  if (!value) {
    throw new DeviceConnectionError(message);
  }

  return value;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getDefaultAppOrigin(): string {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }

  return 'http://localhost:3000';
}

function formatFirmwareVersion(features: Features | null): string | null {
  if (!features) {
    return null;
  }

  const record = features as Record<string, unknown>;
  const parts = [
    record.major_version,
    record.minor_version,
    record.patch_version,
  ].filter((part): part is number => typeof part === 'number');

  return parts.length === 3 ? parts.join('.') : null;
}
