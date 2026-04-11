'use client';

import bs58 from 'bs58';
import type { Transaction, VersionedTransaction } from '@solana/web3.js';

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
  SignMessageInput,
  SignedMessageResult,
  SignedTransactionResult,
  SignTransactionInput,
  SignVersionedTransactionInput,
} from '@/lib/hwsigner/types';
import { getKeystoneErrorMessage, mapKeystoneError } from '@/lib/keystone/error-map';

const KEYSTONE_ACCOUNT_PATH = 'keystone://selected-account';

type KeystoneAdapter = typeof import('@solana/wallet-adapter-keystone').KeystoneWalletAdapter.prototype;
type KeystoneModule = typeof import('@solana/wallet-adapter-keystone');
type KeystoneSdkService = typeof import('@keystonehq/sdk').default;

let keystoneModulePromise: Promise<KeystoneModule> | null = null;
let keystoneSdkReadyPromise: Promise<void> | null = null;
let legacyReactDomPatched = false;
const legacyReactDomRoots = new WeakMap<Element | DocumentFragment, { render(node: unknown): void; unmount(): void }>();

export class KeystoneQrClient {
  private readonly onEvent?: HWSignerEventListener;
  private adapter: KeystoneAdapter | null = null;
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
    await ensureKeystoneSdkReady();

    const adapter = await this.getAdapter();

    this.onEvent?.({
      type: 'action',
      message: 'Opening Keystone QR flow.',
    });

    try {
      await adapter.connect();
    } catch (error) {
      throw mapKeystoneError(error);
    }

    const publicKey = adapter.publicKey?.toBase58();
    if (!publicKey) {
      throw new DeviceConnectionError('Keystone did not return a public key.');
    }

    this.address = publicKey;

    return {
      walletId: 'keystone',
      walletName: 'Keystone',
      runtime: {
        kind: 'keystone-qr',
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
      // Keystone adapter does not need strict cleanup on our side.
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
      path: KEYSTONE_ACCOUNT_PATH,
      address,
    }];
  }

  async signMessage(input: SignMessageInput): Promise<SignedMessageResult> {
    const { adapter, address } = await this.requireConnection();
    const messageBytes = normalizeMessageBytes(input.message);

    this.onEvent?.({
      type: 'action',
      message: 'Requesting Keystone QR message signature.',
    });

    let signatureBytes: Uint8Array;
    try {
      signatureBytes = await adapter.signMessage(messageBytes);
    } catch (error) {
      throw mapKeystoneError(error);
    }

    const signature = bs58.encode(signatureBytes);

    return {
      address,
      derivationPath: KEYSTONE_ACCOUNT_PATH,
      message: messageToDisplayText(input.message),
      messageBytesBase64: bytesToBase64(messageBytes),
      signature,
      verified: null,
    };
  }

  async signTransaction(input: SignTransactionInput): Promise<SignedTransactionResult> {
    if (input.signingPayloadMode && input.signingPayloadMode !== 'serialized-transaction') {
      throw new UnsupportedOperationError(`Keystone only supports "serialized-transaction" signing in this runtime.`);
    }

    const { adapter, address } = await this.requireConnection();

    this.onEvent?.({
      type: 'action',
      message: 'Requesting Keystone QR signature for a legacy transaction.',
    });

    let signed: Transaction;
    try {
      signed = await adapter.signTransaction(input.transaction);
    } catch (error) {
      throw mapKeystoneError(error);
    }

    const signature = signed.signature;
    if (!signature) {
      throw new DeviceConnectionError('Keystone did not return a transaction signature.');
    }

    return buildSignedLegacyResult({
      transaction: signed,
      signerAddress: address,
      address,
      derivationPath: input.derivationPath ?? KEYSTONE_ACCOUNT_PATH,
      signature: Uint8Array.from(signature),
    });
  }

  async signVersionedTransaction(input: SignVersionedTransactionInput): Promise<SignedTransactionResult> {
    if (input.signingPayloadMode && input.signingPayloadMode !== 'serialized-transaction') {
      throw new UnsupportedOperationError(`Keystone only supports "serialized-transaction" signing in this runtime.`);
    }

    const { adapter, address } = await this.requireConnection();

    this.onEvent?.({
      type: 'action',
      message: 'Requesting Keystone QR signature for a versioned transaction.',
    });

    let signed: VersionedTransaction;
    try {
      signed = await adapter.signTransaction(input.transaction);
    } catch (error) {
      throw mapKeystoneError(error);
    }

    const signature = signed.signatures[0];
    if (!signature || signature.length === 0) {
      throw new DeviceConnectionError('Keystone did not return a versioned transaction signature.');
    }

    return buildSignedVersionedResult({
      transaction: signed,
      derivationPath: input.derivationPath ?? KEYSTONE_ACCOUNT_PATH,
      address,
      signature,
    });
  }

  private async getAdapter(): Promise<KeystoneAdapter> {
    if (this.adapter) {
      return this.adapter;
    }

    const module = await getKeystoneModule();
    this.adapter = new module.KeystoneWalletAdapter();
    return this.adapter;
  }

  private async requireAddress(): Promise<string> {
    const { address } = await this.requireConnection();
    return address;
  }

  private async requireConnection(): Promise<{ adapter: KeystoneAdapter; address: string }> {
    const adapter = await this.getAdapter();
    const address = this.address ?? adapter.publicKey?.toBase58();

    if (!address) {
      throw new DeviceConnectionError('Keystone is not connected.');
    }

    this.address = address;
    return { adapter, address };
  }

  private ensureBrowser() {
    if (typeof window === 'undefined') {
      throw new UnsupportedOperationError('Keystone QR flow can only run in a browser.');
    }
  }
}

async function getKeystoneModule(): Promise<KeystoneModule> {
  await ensureLegacyReactDomApi();
  keystoneModulePromise ??= import('@solana/wallet-adapter-keystone');
  return keystoneModulePromise;
}

export function getKeystoneAccountPath(): string {
  return KEYSTONE_ACCOUNT_PATH;
}

export function normalizeKeystoneErrorMessage(error: unknown): string {
  return getKeystoneErrorMessage(error);
}

async function ensureLegacyReactDomApi(): Promise<void> {
  if (legacyReactDomPatched || typeof window === 'undefined') {
    return;
  }

  const [reactDomModule, reactDomClientModule] = await Promise.all([
    import('react-dom'),
    import('react-dom/client'),
  ]);

  const reactDomTarget = (('default' in reactDomModule ? reactDomModule.default : reactDomModule) as Record<string, unknown>);

  if (typeof reactDomTarget.render !== 'function') {
    reactDomTarget.render = (node: unknown, container: Element | DocumentFragment) => {
      let root = legacyReactDomRoots.get(container);

      if (!root) {
        root = reactDomClientModule.createRoot(container);
        legacyReactDomRoots.set(container, root);
      }

      root.render(node);
      return root;
    };
  }

  if (typeof reactDomTarget.unmountComponentAtNode !== 'function') {
    reactDomTarget.unmountComponentAtNode = (container: Element | DocumentFragment) => {
      const root = legacyReactDomRoots.get(container);

      if (!root) {
        return false;
      }

      root.unmount();
      legacyReactDomRoots.delete(container);
      return true;
    };
  }

  legacyReactDomPatched = true;
}

async function ensureKeystoneSdkReady(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  keystoneSdkReadyPromise ??= (async () => {
    await ensureLegacyReactDomApi();

    const sdkModule = await import('@keystonehq/sdk');
    const sdk = ('default' in sdkModule ? sdkModule.default : sdkModule) as KeystoneSdkService;

    if (isKeystoneSdkReady(sdk)) {
      return;
    }

    if (!document.getElementById('kv_sdk_container')) {
      sdk.bootstrap();
    }

    const startedAt = Date.now();
    let lastError: unknown = null;

    while (Date.now() - startedAt < 3000) {
      try {
        sdk.getSdk();
        return;
      } catch (error) {
        lastError = error;
        await waitForNextFrame();
      }
    }

    throw new DeviceConnectionError('Keystone SDK did not finish initializing.', { cause: lastError });
  })().catch((error) => {
    keystoneSdkReadyPromise = null;
    throw error;
  });

  return keystoneSdkReadyPromise;
}

function isKeystoneSdkReady(sdk: KeystoneSdkService): boolean {
  try {
    sdk.getSdk();
    return true;
  } catch {
    return false;
  }
}

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => resolve());
      return;
    }

    setTimeout(resolve, 16);
  });
}
