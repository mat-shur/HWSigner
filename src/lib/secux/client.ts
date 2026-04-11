'use client';

import { Buffer } from 'buffer';
import bs58 from 'bs58';
import { Transaction, VersionedTransaction } from '@solana/web3.js';

import {
  getSolanaDerivationPaths,
  resolveDerivationPath,
} from '@/lib/hwsigner/derivation';
import {
  DeviceConnectionError,
  UnsupportedOperationError,
} from '@/lib/hwsigner/errors';
import { bytesToBase64, messageToDisplayText, normalizeMessageBytes, base64ToBytes } from '@/lib/hwsigner/message';
import {
  buildSignedLegacyResult,
  buildSignedVersionedResult,
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
import { getSecuXErrorMessage, mapSecuXError } from '@/lib/secux/error-map';

type SecuXTransportModule = typeof import('@secux/transport-webusb');
type SecuXSolanaModule = typeof import('@secux/app-sol');
type SecuXCommunicationModule = typeof import('@secux/utility/lib/communication');

type SecuXModules = {
  transport: SecuXTransportModule;
  solana: SecuXSolanaModule;
  communication: SecuXCommunicationModule;
};

type SecuXTransport = Awaited<ReturnType<SecuXTransportModule['SecuxWebUSB']['Create']>>;

type SecuXSession = {
  transport: SecuXTransport;
};

let secuxModulesPromise: Promise<SecuXModules> | null = null;

export class SecuXWebUsbClient {
  private readonly onEvent?: HWSignerEventListener;
  private session: SecuXSession | null = null;

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
    ensureSecuXGlobals();

    const modules = await loadSecuXModules();
    this.session = null;

    this.onEvent?.({
      type: 'action',
      message: 'Opening SecuX WebUSB access prompt.',
    });

    let transport: SecuXTransport | null = null;

    try {
      transport = await modules.transport.SecuxWebUSB.Create(
        () => {
          this.onEvent?.({
            type: 'info',
            message: 'SecuX USB transport connected.',
          });
        },
        () => {
          this.onEvent?.({
            type: 'warning',
            message: 'SecuX USB transport disconnected.',
          });
          this.session = null;
        },
      );

      await transport.Connect();
      this.session = { transport };

      const model = transport.Model || transport.DeviceName || 'SecuX device';
      const firmware = [transport.MCU, transport.SE].filter(Boolean).join(' / ');

      if (firmware) {
        this.onEvent?.({
          type: 'info',
          message: `${model} connected (${firmware}).`,
        });
      }

      return {
        walletId: 'secux',
        walletName: 'SecuX',
        runtime: {
          kind: 'secux-webusb',
          transport: 'webusb',
        },
        capabilities: this.getCapabilities(),
        appConfiguration: null,
      };
    } catch (error) {
      if (transport) {
        await safeSecuXDisconnect(transport);
      }

      throw mapSecuXError(error);
    }
  }

  async disconnect(): Promise<void> {
    const activeSession = this.session;
    this.session = null;

    if (!activeSession) {
      return;
    }

    await safeSecuXDisconnect(activeSession.transport);
  }

  async getAppConfiguration(): Promise<HWSignerAppConfiguration | null> {
    return null;
  }

  async getAccounts(input: GetAccountsInput) {
    if (input.count < 1) {
      return [];
    }

    const { transport } = await this.requireSession();
    const paths = getSolanaDerivationPaths(input.startIndex, input.count);

    return Promise.all(paths.map(async (path, offset) => ({
      index: input.startIndex + offset,
      path,
      address: await this.getAddressForPath(transport, path),
    })));
  }

  async signMessage(input: SignMessageInput): Promise<SignedMessageResult> {
    const { transport } = await this.requireSession();
    const modules = await loadSecuXModules();
    const derivationPath = resolveDerivationPath(input);
    const address = await this.getAddressForPath(transport, derivationPath);
    const messageBytes = normalizeMessageBytes(input.message);

    this.onEvent?.({
      type: 'action',
      message: `Requesting SecuX message signature at ${derivationPath}.`,
    });

    let response: Buffer;
    try {
      const commandData = modules.solana.SecuxSOL.prepareSignMessage(derivationPath, Buffer.from(messageBytes));
      response = await transport.Exchange(modules.communication.getBuffer(commandData));
    } catch (error) {
      throw mapSecuXError(error);
    }

    const signatureBytes = base64ToBytes(modules.solana.SecuxSOL.resolveSignature(response));

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
    if (input.signingPayloadMode && input.signingPayloadMode !== 'serialized-transaction') {
      throw new UnsupportedOperationError('SecuX only supports "serialized-transaction" signing in this runtime.');
    }

    const { transport } = await this.requireSession();
    const derivationPath = resolveDerivationPath(input);
    const address = await this.getAddressForPath(transport, derivationPath);

    this.onEvent?.({
      type: 'action',
      message: `Requesting SecuX signature for a legacy transaction at ${derivationPath}.`,
    });

    let signed: Transaction;
    try {
      const signedHex = await this.signSerializedTransaction({
        transport,
        derivationPath,
        address,
        serializedTransaction: input.transaction.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        }),
      });
      signed = Transaction.from(Buffer.from(signedHex, 'hex'));
    } catch (error) {
      throw mapSecuXError(error);
    }

    const signature = signed.signature;
    if (!signature) {
      throw new DeviceConnectionError('SecuX did not return a legacy transaction signature.');
    }

    return buildSignedLegacyResult({
      transaction: input.transaction,
      signerAddress: address,
      address,
      derivationPath,
      signature: Uint8Array.from(signature),
    });
  }

  async signVersionedTransaction(input: SignVersionedTransactionInput): Promise<SignedTransactionResult> {
    if (input.signingPayloadMode && input.signingPayloadMode !== 'serialized-transaction') {
      throw new UnsupportedOperationError('SecuX only supports "serialized-transaction" signing in this runtime.');
    }

    const { transport } = await this.requireSession();
    const derivationPath = resolveDerivationPath(input);
    const address = await this.getAddressForPath(transport, derivationPath);

    this.onEvent?.({
      type: 'action',
      message: `Requesting SecuX signature for a versioned transaction at ${derivationPath}.`,
    });

    let signed: VersionedTransaction;
    try {
      const signedHex = await this.signSerializedTransaction({
        transport,
        derivationPath,
        address,
        serializedTransaction: input.transaction.serialize(),
      });
      signed = VersionedTransaction.deserialize(Buffer.from(signedHex, 'hex'));
    } catch (error) {
      throw mapSecuXError(error);
    }

    const signature = signed.signatures[0];
    if (!signature) {
      throw new DeviceConnectionError('SecuX did not return a versioned transaction signature.');
    }

    return buildSignedVersionedResult({
      transaction: input.transaction,
      derivationPath,
      address,
      signature: Uint8Array.from(signature),
    });
  }

  private async signSerializedTransaction(params: {
    transport: SecuXTransport;
    derivationPath: string;
    address: string;
    serializedTransaction: Uint8Array;
  }): Promise<string> {
    const modules = await loadSecuXModules();
    const { commandData, serialized } = modules.solana.SecuxSOL.prepareSignSerialized(
      Buffer.from(params.serializedTransaction),
      [{ path: params.derivationPath, account: params.address }],
    );
    const response = await params.transport.Exchange(modules.communication.getBuffer(commandData));
    return modules.solana.SecuxSOL.resolveTransaction(response, serialized);
  }

  private async getAddressForPath(transport: SecuXTransport, derivationPath: string): Promise<string> {
    const modules = await loadSecuXModules();

    try {
      const commandData = modules.solana.SecuxSOL.prepareAddress(derivationPath);
      const response = await transport.Exchange(modules.communication.getBuffer(commandData));
      return modules.solana.SecuxSOL.resolveAddress(response);
    } catch (error) {
      throw mapSecuXError(error);
    }
  }

  private async requireSession(): Promise<SecuXSession> {
    if (!this.session) {
      throw new DeviceConnectionError('SecuX is not connected.');
    }

    return this.session;
  }

  private ensureBrowser() {
    if (typeof window === 'undefined') {
      throw new UnsupportedOperationError('SecuX WebUSB can only run in a browser.');
    }
  }

  private ensureWebUsb() {
    if (typeof navigator === 'undefined' || !('usb' in navigator)) {
      throw new UnsupportedOperationError('WebUSB is not available in this browser.');
    }

    if (!window.isSecureContext) {
      throw new UnsupportedOperationError('WebUSB requires https or localhost.');
    }
  }
}

async function loadSecuXModules(): Promise<SecuXModules> {
  secuxModulesPromise ??= Promise.all([
    import('@secux/transport-webusb'),
    import('@secux/app-sol'),
    import('@secux/utility/lib/communication'),
  ]).then(([transport, solana, communication]) => ({
    transport,
    solana,
    communication,
  }));

  return secuxModulesPromise;
}

async function safeSecuXDisconnect(transport: SecuXTransport): Promise<void> {
  try {
    await transport.Disconnect();
  } catch (error) {
    const message = getSecuXErrorMessage(error).toLowerCase();

    if (!message.includes('not opened')) {
      // Ignore teardown failures. This is a UI cleanup path.
    }
  }
}

function ensureSecuXGlobals() {
  if (typeof window === 'undefined') {
    return;
  }

  const scopedWindow = window as typeof window & {
    Buffer?: typeof Buffer;
    global?: typeof globalThis;
  };

  scopedWindow.Buffer ??= Buffer;
  scopedWindow.global ??= globalThis;
}
