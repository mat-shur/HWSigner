'use client';

import bs58 from 'bs58';

import {
  formatSolanaDerivationPath,
  getSolanaDerivationPaths,
  parseSolanaDerivationPath,
  resolveDerivationPath,
  SOLANA_COIN_TYPE,
  SOLANA_PURPOSE,
} from '@/lib/hwsigner/derivation';
import {
  DeviceConnectionError,
  DeviceNotFoundError,
  InvalidDerivationPathError,
  UnsupportedOperationError,
  UserRejectedError,
} from '@/lib/hwsigner/errors';
import {
  buildSignedLegacyResult,
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
import { getCypherockErrorMessage, mapCypherockError } from '@/lib/cypherock/error-map';

type CypherockUsbModule = typeof import('@cypherock/sdk-hw-webusb');
type CypherockManagerModule = typeof import('@cypherock/sdk-app-manager');
type CypherockSolanaModule = typeof import('@cypherock/sdk-app-solana');

type CypherockModules = {
  usb: CypherockUsbModule;
  manager: CypherockManagerModule;
  solana: CypherockSolanaModule;
};

type CypherockConnection = Awaited<ReturnType<CypherockUsbModule['DeviceConnection']['create']>>;
type CypherockManagerApp = Awaited<ReturnType<CypherockManagerModule['ManagerApp']['create']>>;
type CypherockSolanaApp = Awaited<ReturnType<CypherockSolanaModule['SolanaApp']['create']>>;

type CypherockWalletItem = {
  id: Uint8Array;
  name: string;
};

type CypherockSession = {
  connection: CypherockConnection;
  solanaApp: CypherockSolanaApp;
  walletId: Uint8Array;
  walletLabel: string;
  appConfiguration: HWSignerAppConfiguration | null;
};

const CYPHEROCK_SOLANA_APPLET_ID = 10;
const CYPHEROCK_DEFAULT_PATH = formatSolanaDerivationPath(0);

let cypherockModulesPromise: Promise<CypherockModules> | null = null;

export class CypherockWebUsbClient {
  private readonly onEvent?: HWSignerEventListener;
  private session: CypherockSession | null = null;

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
      signVersionedTransaction: false,
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

    const modules = await loadCypherockModules();
    this.session = null;

    this.onEvent?.({
      type: 'action',
      message: 'Opening Cypherock WebUSB access prompt.',
    });

    let connection: CypherockConnection | null = null;

    try {
      connection = await modules.usb.DeviceConnection.create();
      const managerApp = await modules.manager.ManagerApp.create(connection);
      const deviceInfo = await this.safeReadDeviceInfo(managerApp);
      const selectedWallet = await this.selectWallet(managerApp);
      const solanaApp = await modules.solana.SolanaApp.create(connection);
      const [address] = await this.getPublicKeys(solanaApp, selectedWallet.id, [CYPHEROCK_DEFAULT_PATH]);
      const appConfiguration = buildCypherockAppConfiguration(deviceInfo);

      this.session = {
        connection,
        solanaApp,
        walletId: Uint8Array.from(selectedWallet.id),
        walletLabel: selectedWallet.name || 'Unnamed wallet',
        appConfiguration,
      };

      this.onEvent?.({
        type: 'info',
        message: `Selected Cypherock wallet profile "${this.session.walletLabel}".`,
      });

      return {
        walletId: 'cypherock',
        walletName: 'Cypherock',
        runtime: {
          kind: 'cypherock-webusb',
          transport: 'webusb',
        },
        capabilities: this.getCapabilities(),
        appConfiguration,
      };
    } catch (error) {
      if (connection) {
        await safeDestroyCypherockConnection(connection);
      }

      throw mapCypherockError(error);
    }
  }

  async disconnect(): Promise<void> {
    const activeSession = this.session;
    this.session = null;

    if (!activeSession) {
      return;
    }

    await safeDestroyCypherockConnection(activeSession.connection);
  }

  async getAppConfiguration(): Promise<HWSignerAppConfiguration | null> {
    return this.session?.appConfiguration ?? null;
  }

  async getAccounts(input: GetAccountsInput) {
    if (input.count < 1) {
      return [];
    }

    const { solanaApp, walletId } = await this.requireSession();
    const paths = getSolanaDerivationPaths(input.startIndex, input.count);
    const addresses = await this.getPublicKeys(solanaApp, walletId, paths);

    return addresses.map((address, offset) => ({
      index: input.startIndex + offset,
      path: paths[offset],
      address,
    }));
  }

  async signMessage(_input: SignMessageInput): Promise<SignedMessageResult> {
    throw new UnsupportedOperationError('Cypherock WebUSB does not expose Solana signMessage in this SDK.');
  }

  async signTransaction(input: SignTransactionInput): Promise<SignedTransactionResult> {
    const requestedMode = input.signingPayloadMode ?? 'legacy-message-bytes';
    if (requestedMode !== 'legacy-message-bytes') {
      throw new UnsupportedOperationError('Cypherock WebUSB only supports "legacy-message-bytes" for Solana transaction signing.');
    }

    const { solanaApp, walletId } = await this.requireSession();
    const derivationPath = resolveDerivationPath(input);
    const cypherockPath = toCypherockDerivationPath(derivationPath);
    const signerAddress = await this.lookupAddress(solanaApp, walletId, derivationPath);

    this.onEvent?.({
      type: 'action',
      message: `Requesting Cypherock signature for a legacy transaction at ${derivationPath}.`,
    });

    let result: Awaited<ReturnType<CypherockSolanaApp['signTxn']>>;
    try {
      result = await solanaApp.signTxn({
        walletId,
        derivationPath: cypherockPath,
        txn: bytesToHex(input.transaction.serializeMessage()),
        serializeTxn: false,
      });
    } catch (error) {
      throw mapCypherockError(error);
    }

    const signature = decodeCypherockSignature(result.signature);

    return buildSignedLegacyResult({
      transaction: input.transaction,
      signerAddress,
      address: signerAddress,
      derivationPath,
      signature,
    });
  }

  async signVersionedTransaction(_input: SignVersionedTransactionInput): Promise<SignedTransactionResult> {
    throw new UnsupportedOperationError('Cypherock WebUSB does not support Solana versioned transaction signing in this SDK.');
  }

  private async requireSession(): Promise<{
    solanaApp: CypherockSolanaApp;
    walletId: Uint8Array;
  }> {
    if (!this.session) {
      throw new DeviceConnectionError('Cypherock is not connected.');
    }

    return {
      solanaApp: this.session.solanaApp,
      walletId: Uint8Array.from(this.session.walletId),
    };
  }

  private async safeReadDeviceInfo(managerApp: CypherockManagerApp): Promise<Awaited<ReturnType<CypherockManagerApp['getDeviceInfo']>> | null> {
    try {
      const deviceInfo = await managerApp.getDeviceInfo();
      const firmwareVersion = formatVersion(deviceInfo.firmwareVersion);

      if (firmwareVersion) {
        this.onEvent?.({
          type: 'info',
          message: `Cypherock firmware ${firmwareVersion} detected.`,
        });
      }

      return deviceInfo;
    } catch (error) {
      this.onEvent?.({
        type: 'warning',
        message: `Cypherock device info lookup failed: ${getCypherockErrorMessage(error)}`,
      });
      return null;
    }
  }

  private async selectWallet(managerApp: CypherockManagerApp): Promise<CypherockWalletItem> {
    const { walletList } = await managerApp.getWallets();

    if (walletList.length === 0) {
      throw new DeviceNotFoundError('No Cypherock wallet profiles were found on the selected device.');
    }

    if (walletList.length === 1) {
      return toCypherockWalletItem(walletList[0]);
    }

    this.onEvent?.({
      type: 'action',
      message: `Cypherock reports ${walletList.length} wallet profiles. Select one on the device.`,
    });

    const selection = await managerApp.selectWallet();
    if (!selection.wallet) {
      throw new UserRejectedError('No Cypherock wallet was selected on the device.');
    }

    return toCypherockWalletItem(selection.wallet);
  }

  private async getPublicKeys(
    solanaApp: CypherockSolanaApp,
    walletId: Uint8Array,
    derivationPaths: string[],
  ): Promise<string[]> {
    try {
      const result = await solanaApp.getPublicKeys({
        walletId,
        derivationPaths: derivationPaths.map((path) => ({
          path: toCypherockDerivationPath(path),
        })),
      });

      if (result.publicKeys.length !== derivationPaths.length) {
        throw new DeviceConnectionError('Cypherock returned an incomplete Solana account list.');
      }

      return result.publicKeys;
    } catch (error) {
      throw mapCypherockError(error);
    }
  }

  private async lookupAddress(
    solanaApp: CypherockSolanaApp,
    walletId: Uint8Array,
    derivationPath: string,
  ): Promise<string> {
    const [address] = await this.getPublicKeys(solanaApp, walletId, [derivationPath]);
    return address;
  }

  private ensureBrowser() {
    if (typeof window === 'undefined') {
      throw new UnsupportedOperationError('Cypherock WebUSB can only run in a browser.');
    }
  }

  private ensureWebUsb() {
    if (typeof navigator === 'undefined' || !('usb' in navigator)) {
      throw new UnsupportedOperationError('WebUSB is not available in this browser.');
    }

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      throw new UnsupportedOperationError('WebUSB requires https or localhost.');
    }
  }
}

async function loadCypherockModules(): Promise<CypherockModules> {
  cypherockModulesPromise ??= Promise.all([
    import('@cypherock/sdk-hw-webusb'),
    import('@cypherock/sdk-app-manager'),
    import('@cypherock/sdk-app-solana'),
  ]).then(([usb, manager, solana]) => ({
    usb,
    manager,
    solana,
  }));

  return cypherockModulesPromise;
}

async function safeDestroyCypherockConnection(connection: CypherockConnection): Promise<void> {
  try {
    await connection.destroy();
  } catch {
    // Ignore teardown failures.
  }
}

function buildCypherockAppConfiguration(
  deviceInfo: {
    appletList: Array<{
      id: number;
      version: { major: number; minor: number; patch: number } | undefined;
    }>;
  } | null,
): HWSignerAppConfiguration | null {
  const solanaApplet = deviceInfo?.appletList.find((applet) => applet.id === CYPHEROCK_SOLANA_APPLET_ID);
  const version = formatVersion(solanaApplet?.version);

  if (!version) {
    return null;
  }

  return {
    blindSigningEnabled: false,
    pubKeyDisplayMode: 'device-confirmation',
    version,
  };
}

function toCypherockWalletItem(wallet: { id: Uint8Array; name: string }): CypherockWalletItem {
  return {
    id: Uint8Array.from(wallet.id),
    name: wallet.name?.trim() || shortWalletId(wallet.id),
  };
}

function toCypherockDerivationPath(path: string): number[] {
  const parsed = parseSolanaDerivationPath(path);

  if (parsed.change !== 0) {
    throw new InvalidDerivationPathError('Cypherock WebUSB only supports Solana change index 0.');
  }

  return [
    harden(SOLANA_PURPOSE),
    harden(SOLANA_COIN_TYPE),
    harden(parsed.accountIndex),
  ];
}

function harden(index: number): number {
  return (0x80000000 | index) >>> 0;
}

function decodeCypherockSignature(signature: string | undefined): Uint8Array {
  if (!signature) {
    throw new DeviceConnectionError('Cypherock did not return a Solana transaction signature.');
  }

  if (!/^[0-9a-f]+$/i.test(signature) || signature.length % 2 !== 0) {
    throw new DeviceConnectionError('Cypherock returned a Solana transaction signature in an unknown format.');
  }

  const bytes = new Uint8Array(signature.length / 2);

  for (let index = 0; index < signature.length; index += 2) {
    bytes[index / 2] = Number.parseInt(signature.slice(index, index + 2), 16);
  }

  return bytes;
}

function formatVersion(version?: { major: number; minor: number; patch: number }): string | null {
  if (!version) {
    return null;
  }

  return `${version.major}.${version.minor}.${version.patch}`;
}

function shortWalletId(walletId: Uint8Array): string {
  const encoded = bs58.encode(walletId);

  if (encoded.length <= 12) {
    return encoded;
  }

  return `${encoded.slice(0, 4)}...${encoded.slice(-4)}`;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
