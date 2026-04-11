'use client';

import { DeviceManagementKitBuilder, type DeviceManagementKit, type DeviceSessionId } from '@ledgerhq/device-management-kit';
import { SignMessageVersion, SignerSolanaBuilder } from '@ledgerhq/device-signer-kit-solana';
import { webHidIdentifier, webHidTransportFactory } from '@ledgerhq/device-transport-kit-web-hid';
import { firstValueFrom, timeout } from 'rxjs';

import { getLedgerCapabilities } from '@/lib/hwsigner/capabilities';
import { getSolanaDerivationPaths, resolveDerivationPath, toLedgerDerivationPath } from '@/lib/hwsigner/derivation';
import {
  AdapterInitializationError,
  DeviceConnectionError,
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
  HWSignerAccount,
  HWSignerAppConfiguration,
  HWSignerConnection,
  HWSignerEventListener,
  SignMessageInput,
  SignedMessageResult,
  SignedTransactionResult,
  SignTransactionInput,
  SignVersionedTransactionInput,
} from '@/lib/hwsigner/types';
import { resolveLedgerDeviceAction } from '@/lib/ledger/action';

const WEBHID_DISCOVERY_TIMEOUT_MS = 20_000;

let browserDmk: DeviceManagementKit | null = null;

export class LedgerRealDeviceClient {
  private readonly dmk: DeviceManagementKit;
  private readonly onEvent?: HWSignerEventListener;
  private sessionId: DeviceSessionId | null = null;

  constructor(onEvent?: HWSignerEventListener) {
    this.dmk = getBrowserDmk();
    this.onEvent = onEvent;
  }

  getCapabilities() {
    return getLedgerCapabilities({
      kind: 'real-device',
      transport: 'webhid',
    });
  }

  async connect(): Promise<HWSignerConnection> {
    this.ensureWebHidSupported();

    if (this.sessionId) {
      return {
        walletId: 'ledger',
        walletName: 'Ledger',
        runtime: {
          kind: 'real-device',
          transport: 'webhid',
        },
        capabilities: this.getCapabilities(),
        appConfiguration: await this.getAppConfiguration(),
      };
    }

    this.onEvent?.({
      type: 'action',
      message: 'Requesting WebHID device access for Ledger.',
    });

    const device = await firstValueFrom(
      this.dmk.startDiscovering({ transport: webHidIdentifier }).pipe(
        timeout({
          first: WEBHID_DISCOVERY_TIMEOUT_MS,
        }),
      ),
    ).catch((error: unknown) => {
      throw new DeviceConnectionError('Ledger discovery over WebHID failed.', { cause: error });
    });

    this.sessionId = await this.dmk.connect({
      device,
      sessionRefresherOptions: {
        isRefresherDisabled: true,
      },
    });

    const appConfiguration = await this.getAppConfiguration().catch(() => null);

    return {
      walletId: 'ledger',
      walletName: 'Ledger',
      runtime: {
        kind: 'real-device',
        transport: 'webhid',
      },
      capabilities: this.getCapabilities(),
      appConfiguration,
    };
  }

  async disconnect(): Promise<void> {
    if (!this.sessionId) {
      return;
    }

    await this.dmk.disconnect({
      sessionId: this.sessionId,
    });

    this.sessionId = null;
  }

  async getAppConfiguration(): Promise<HWSignerAppConfiguration | null> {
    const signer = this.getSigner();
    const configuration = await resolveLedgerDeviceAction(signer.getAppConfiguration(), {
      operation: 'Read Solana app configuration',
      onEvent: this.onEvent,
    }).catch(() => null);

    if (!configuration) {
      return null;
    }

    return {
      blindSigningEnabled: configuration.blindSigningEnabled,
      pubKeyDisplayMode: String(configuration.pubKeyDisplayMode),
      version: configuration.version,
    };
  }

  async getAccounts(input: GetAccountsInput): Promise<HWSignerAccount[]> {
    const signer = this.getSigner();
    const paths = getSolanaDerivationPaths(input.startIndex, input.count);
    const accounts: HWSignerAccount[] = [];

    for (let offset = 0; offset < paths.length; offset += 1) {
      const path = paths[offset];
      const ledgerPath = toLedgerDerivationPath(path);
      const address = await resolveLedgerDeviceAction(
        signer.getAddress(ledgerPath, {
          checkOnDevice: input.checkOnDevice,
          skipOpenApp: offset > 0,
        }),
        {
          operation: `Derive account ${path}`,
          onEvent: this.onEvent,
        },
      );

      accounts.push({
        index: input.startIndex + offset,
        path,
        address,
      });
    }

    return accounts;
  }

  async signMessage(input: SignMessageInput): Promise<SignedMessageResult> {
    const signer = this.getSigner();
    const derivationPath = resolveDerivationPath(input);
    const ledgerPath = toLedgerDerivationPath(derivationPath);
    const address = await this.lookupAddress(derivationPath, false);
    const messageBytes = normalizeMessageBytes(input.message);
    const output = await resolveLedgerDeviceAction(
      signer.signMessage(
        ledgerPath,
        typeof input.message === 'string' ? input.message : messageBytes,
        typeof input.message === 'string'
          ? { skipOpenApp: true }
          : {
              skipOpenApp: true,
              version: SignMessageVersion.Raw,
            },
      ),
      {
        operation: `Sign message with ${derivationPath}`,
        onEvent: this.onEvent,
      },
    );

    return {
      address,
      derivationPath,
      message: messageToDisplayText(input.message),
      messageBytesBase64: bytesToBase64(messageBytes),
      signature: output.signature,
      verified: null,
    };
  }

  async signTransaction(input: SignTransactionInput): Promise<SignedTransactionResult> {
    const signer = this.getSigner();
    const derivationPath = resolveDerivationPath(input);
    const ledgerPath = toLedgerDerivationPath(derivationPath);
    const address = await this.lookupAddress(derivationPath, false);
    const serialized = serializeTransactionForLedger(input.transaction);
    const payload = resolveLedgerTransactionSigningPayload(
      serialized.bytes,
      input.signingPayloadMode ?? 'serialized-transaction',
    );
    const signature = await resolveLedgerDeviceAction(
      signer.signTransaction(ledgerPath, payload.bytes, {
        skipOpenApp: true,
      }),
      {
        operation: `Sign transaction with ${derivationPath}`,
        onEvent: this.onEvent,
      },
    );

    return buildSignedLegacyResult({
      transaction: input.transaction,
      signerAddress: address,
      address,
      derivationPath,
      signature,
    });
  }

  async signVersionedTransaction(input: SignVersionedTransactionInput): Promise<SignedTransactionResult> {
    const signer = this.getSigner();
    const derivationPath = resolveDerivationPath(input);
    const ledgerPath = toLedgerDerivationPath(derivationPath);
    const address = await this.lookupAddress(derivationPath, false);
    const serialized = serializeTransactionForLedger(input.transaction);
    const payload = resolveLedgerTransactionSigningPayload(
      serialized.bytes,
      input.signingPayloadMode ?? 'serialized-transaction',
    );
    const signature = await resolveLedgerDeviceAction(
      signer.signTransaction(ledgerPath, payload.bytes, {
        skipOpenApp: true,
      }),
      {
        operation: `Sign versioned transaction with ${derivationPath}`,
        onEvent: this.onEvent,
      },
    );

    return buildSignedVersionedResult({
      transaction: input.transaction,
      derivationPath,
      address,
      signature,
    });
  }

  private getSigner() {
    const sessionId = this.requireSessionId();

    return new SignerSolanaBuilder({
      dmk: this.dmk,
      sessionId,
      originToken: 'HWSigner',
    }).build();
  }

  private async lookupAddress(derivationPath: string, skipOpenApp: boolean): Promise<string> {
    const ledgerPath = toLedgerDerivationPath(derivationPath);
    return resolveLedgerDeviceAction(
      this.getSigner().getAddress(ledgerPath, {
        checkOnDevice: false,
        skipOpenApp,
      }),
      {
        operation: `Resolve address for ${derivationPath}`,
        onEvent: this.onEvent,
      },
    );
  }

  private requireSessionId(): DeviceSessionId {
    if (!this.sessionId) {
      throw new DeviceConnectionError('Ledger is not connected.');
    }

    return this.sessionId;
  }

  private ensureWebHidSupported() {
    if (typeof window === 'undefined') {
      throw new AdapterInitializationError('WebHID can only be used in a browser.');
    }

    if (!('hid' in navigator)) {
      throw new UnsupportedOperationError('WebHID is not available in this browser.');
    }
  }
}

function getBrowserDmk(): DeviceManagementKit {
  browserDmk ??= new DeviceManagementKitBuilder().addTransport(webHidTransportFactory).build();
  return browserDmk;
}
