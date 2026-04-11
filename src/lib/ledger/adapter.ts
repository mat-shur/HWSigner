'use client';

import {
  AdapterInitializationError,
  DeviceConnectionError,
  DeviceNotFoundError,
  InvalidDerivationPathError,
  InvalidTransactionError,
  TimeoutError,
  UnsupportedOperationError,
  UserRejectedError,
  getErrorMessage,
} from '@/lib/hwsigner/errors';
import { bytesToBase64 } from '@/lib/hwsigner/message';
import { serializeTransactionForLedger } from '@/lib/hwsigner/transactions';
import type {
  GetAccountsInput,
  HWSignerAppConfiguration,
  HWSignerConnection,
  HWSignerEventListener,
  HWSignerRuntime,
  SignMessageInput,
  SignedMessageResult,
  SignedTransactionResult,
  SignTransactionInput,
  SignVersionedTransactionInput,
  WalletAdapter,
} from '@/lib/hwsigner/types';
import { LedgerRealDeviceClient } from '@/lib/ledger/client';

export function createLedgerAdapter(runtime: HWSignerRuntime, onEvent?: HWSignerEventListener): WalletAdapter {
  if (runtime.kind === 'real-device') {
    return new LedgerRealAdapter(onEvent);
  }

  if (runtime.kind !== 'speculos') {
    throw new UnsupportedOperationError('Ledger only supports WebHID and Speculos runtimes in this project.');
  }

  return new LedgerSpeculosAdapter(runtime.apiBaseUrl, onEvent);
}

class LedgerRealAdapter implements WalletAdapter {
  private readonly client: LedgerRealDeviceClient;

  constructor(onEvent?: HWSignerEventListener) {
    this.client = new LedgerRealDeviceClient(onEvent);
  }

  connect(): Promise<HWSignerConnection> {
    return this.client.connect();
  }

  disconnect(): Promise<void> {
    return this.client.disconnect();
  }

  getCapabilities() {
    return this.client.getCapabilities();
  }

  getAppConfiguration(): Promise<HWSignerAppConfiguration | null> {
    return this.client.getAppConfiguration();
  }

  getAccounts(input: GetAccountsInput) {
    return this.client.getAccounts(input);
  }

  signMessage(input: SignMessageInput): Promise<SignedMessageResult> {
    return this.client.signMessage(input);
  }

  signTransaction(input: SignTransactionInput): Promise<SignedTransactionResult> {
    return this.client.signTransaction(input);
  }

  signVersionedTransaction(input: SignVersionedTransactionInput): Promise<SignedTransactionResult> {
    return this.client.signVersionedTransaction(input);
  }
}

class LedgerSpeculosAdapter implements WalletAdapter {
  private readonly apiBaseUrl: string;
  private readonly onEvent?: HWSignerEventListener;
  private sessionToken: string | null = null;
  private appConfiguration: HWSignerAppConfiguration | null = null;
  private capabilities: HWSignerConnection['capabilities'] | null = null;

  constructor(apiBaseUrl: string, onEvent?: HWSignerEventListener) {
    this.apiBaseUrl = apiBaseUrl.replace(/\/$/, '');
    this.onEvent = onEvent;
  }

  async connect(): Promise<HWSignerConnection> {
    this.onEvent?.({
      type: 'action',
      message: 'Connecting to Speculos through the local bridge.',
    });

    const response = await this.post<{
      sessionToken: string;
      connection: HWSignerConnection;
    }>('/connect', {});

    this.sessionToken = response.sessionToken;
    this.appConfiguration = response.connection.appConfiguration;
    this.capabilities = response.connection.capabilities;

    return response.connection;
  }

  async disconnect(): Promise<void> {
    if (!this.sessionToken) {
      return;
    }

    await this.post('/disconnect', {
      sessionToken: this.sessionToken,
    });

    this.sessionToken = null;
    this.appConfiguration = null;
    this.capabilities = null;
  }

  getCapabilities() {
    if (!this.capabilities) {
      return {
        connect: true,
        disconnect: true,
        getAccounts: true,
        signMessage: true,
        signTransaction: true,
        signVersionedTransaction: true,
        emulator: true,
        usb: false,
        ble: false,
        qr: false,
        nfc: false,
      };
    }

    return this.capabilities;
  }

  async getAppConfiguration(): Promise<HWSignerAppConfiguration | null> {
    return this.appConfiguration;
  }

  async getAccounts(input: GetAccountsInput) {
    const response = await this.post<{ accounts: Awaited<WalletAdapter['getAccounts']> extends Promise<infer T> ? T : never }>(
      '/accounts',
      {
        sessionToken: this.requireSessionToken(),
        ...input,
      },
    );

    return response.accounts;
  }

  async signMessage(input: SignMessageInput): Promise<SignedMessageResult> {
    const messageBytes = normalizeMessageInput(input);
    const response = await this.post<{ result: SignedMessageResult }>('/sign-message', {
      sessionToken: this.requireSessionToken(),
      derivationPath: input.derivationPath,
      accountIndex: input.accountIndex,
      messageBase64: bytesToBase64(messageBytes),
      raw: !(typeof input.message === 'string'),
      messageText: typeof input.message === 'string' ? input.message : null,
    });

    return response.result;
  }

  async signTransaction(input: SignTransactionInput): Promise<SignedTransactionResult> {
    const serialized = serializeTransactionForLedger(input.transaction);
    const response = await this.post<{ result: SignedTransactionResult }>('/sign-transaction', {
      sessionToken: this.requireSessionToken(),
      derivationPath: input.derivationPath,
      accountIndex: input.accountIndex,
      serializedTransactionBase64: bytesToBase64(serialized.bytes),
      version: serialized.version,
      signingPayloadMode: input.signingPayloadMode,
    });

    return response.result;
  }

  async signVersionedTransaction(input: SignVersionedTransactionInput): Promise<SignedTransactionResult> {
    const serialized = serializeTransactionForLedger(input.transaction);
    const response = await this.post<{ result: SignedTransactionResult }>('/sign-transaction', {
      sessionToken: this.requireSessionToken(),
      derivationPath: input.derivationPath,
      accountIndex: input.accountIndex,
      serializedTransactionBase64: bytesToBase64(serialized.bytes),
      version: serialized.version,
      signingPayloadMode: input.signingPayloadMode,
    });

    return response.result;
  }

  private requireSessionToken(): string {
    if (!this.sessionToken) {
      throw new DeviceConnectionError('Speculos is not connected.');
    }

    return this.sessionToken;
  }

  private async post<Response>(path: string, payload: object): Promise<Response> {
    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => ({}))) as
      | Response
      | {
          error?: {
            code?: string;
            message?: string;
            details?: unknown;
          };
        };

    if (!response.ok) {
      throw hydrateRemoteError(body as { error?: { code?: string; message?: string; details?: unknown } });
    }

    return body as Response;
  }
}

function hydrateRemoteError(payload: { error?: { code?: string; message?: string; details?: unknown } }): Error {
  const message = payload.error?.message ?? 'Speculos bridge request failed.';
  const options = {
    details: payload.error?.details,
  };

  switch (payload.error?.code) {
    case 'USER_REJECTED':
      return new UserRejectedError(message, options);
    case 'DEVICE_NOT_FOUND':
      return new DeviceNotFoundError(message, options);
    case 'UNSUPPORTED_OPERATION':
      return new UnsupportedOperationError(message, options);
    case 'INVALID_DERIVATION_PATH':
      return new InvalidDerivationPathError(message, options);
    case 'INVALID_TRANSACTION':
      return new InvalidTransactionError(message, options);
    case 'TIMEOUT':
      return new TimeoutError(message, options);
    case 'ADAPTER_INITIALIZATION':
      return new AdapterInitializationError(message, options);
    default:
      return new DeviceConnectionError(getErrorMessage(message), options);
  }
}

function normalizeMessageInput(input: SignMessageInput): Uint8Array {
  return typeof input.message === 'string' ? new TextEncoder().encode(input.message) : input.message;
}
