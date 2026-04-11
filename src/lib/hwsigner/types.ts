import type { Transaction, VersionedTransaction } from '@solana/web3.js';
import type { TangemReactNativeSdk } from '@/lib/tangem/types';
import type { ReactNativeSolanaWalletClient } from '@/lib/react-native/walletconnect-types';

export type HWWalletId =
  | 'ledger'
  | 'trezor'
  | 'keystone'
  | 'safepal'
  | 'onekey'
  | 'secux'
  | 'dcent'
  | 'coolwallet'
  | 'ellipal'
  | 'cypherock'
  | 'tangem'
  | 'solflare-shield'
  | 'gridplus-lattice'
  | 'arculus'
  | 'keypal'
  | 'bc-vault'
  | 'ngrave';

export type HWSignerEventType = 'info' | 'success' | 'error' | 'warning' | 'action';

export interface HWSignerEvent {
  type: HWSignerEventType;
  message: string;
  details?: unknown;
}

export type HWSignerEventListener = (event: HWSignerEvent) => void;

export type HWSignerRuntime =
  | {
      kind: 'real-device';
      transport: 'webhid';
    }
  | {
      kind: 'cypherock-webusb';
      transport: 'webusb';
    }
  | {
      kind: 'coolwallet-web-ble';
      transport: 'web-ble';
    }
  | {
      kind: 'safepal-provider';
      transport: 'injected-provider';
    }
  | {
      kind: 'onekey-webusb';
      transport: 'webusb';
    }
  | {
      kind: 'dcent-walletconnect';
      transport: 'qr';
    }
  | {
      kind: 'ellipal-walletconnect';
      transport: 'qr';
    }
  | {
      kind: 'tangem-react-native-nfc';
      transport: 'nfc';
      sdk?: TangemReactNativeSdk;
      defaultDerivationPath?: string;
    }
  | {
      kind: 'tangem-walletconnect';
      transport: 'qr';
    }
  | {
      kind: 'solflare-shield-sdk';
      transport: 'nfc';
      network?: 'mainnet-beta' | 'testnet' | 'devnet';
    }
  | {
      kind: 'gridplus-nufi-provider';
      transport: 'injected-provider';
    }
  | {
      kind: 'arculus-walletconnect';
      transport: 'qr';
    }
  | {
      kind: 'keypal-tokenpocket-provider';
      transport: 'injected-provider';
    }
  | {
      kind: 'bc-vault-walletconnect';
      transport: 'qr';
    }
  | {
      kind: 'react-native-walletconnect';
      transport: 'qr' | 'deep-link';
      wallet: ReactNativeSolanaWalletClient;
      walletName?: string;
      accountPath?: string;
      capabilities?: Partial<Pick<HWSignerCapabilities, 'signMessage' | 'signTransaction' | 'signVersionedTransaction' | 'qr' | 'nfc'>>;
    }
  | {
      kind: 'react-native-keystone-qr';
      transport: 'qr';
      wallet: ReactNativeSolanaWalletClient;
      walletName?: string;
      accountPath?: string;
      capabilities?: Partial<Pick<HWSignerCapabilities, 'signMessage' | 'signTransaction' | 'signVersionedTransaction' | 'qr' | 'nfc'>>;
    }
  | {
      kind: 'secux-webusb';
      transport: 'webusb';
    }
  | {
      kind: 'keystone-qr';
      transport: 'qr';
    }
  | {
      kind: 'trezor-connect';
      transport: 'popup-bridge';
    }
  | {
      kind: 'speculos';
      apiBaseUrl: string;
    };

export interface HWSignerCapabilities {
  connect: boolean;
  disconnect: boolean;
  getAccounts: boolean;
  signMessage: boolean;
  signTransaction: boolean;
  signVersionedTransaction: boolean;
  emulator: boolean;
  usb: boolean;
  ble: boolean;
  qr: boolean;
  nfc: boolean;
}

export interface HWSignerAccount {
  index: number;
  path: string;
  address: string;
}

export interface HWSignerAppConfiguration {
  blindSigningEnabled: boolean;
  pubKeyDisplayMode: string;
  version: string;
}

export interface HWSignerConnection {
  walletId: HWWalletId;
  walletName: string;
  runtime: HWSignerRuntime;
  capabilities: HWSignerCapabilities;
  appConfiguration: HWSignerAppConfiguration | null;
}

export interface GetAccountsInput {
  startIndex: number;
  count: number;
  checkOnDevice?: boolean;
}

export interface SignMessageInput {
  derivationPath?: string;
  accountIndex?: number;
  message: string | Uint8Array;
}

export type TransactionSigningPayloadMode =
  | 'serialized-transaction'
  | 'legacy-message-bytes'
  | 'versioned-message-bytes';

export interface SignTransactionInput {
  derivationPath?: string;
  accountIndex?: number;
  transaction: Transaction;
  signingPayloadMode?: TransactionSigningPayloadMode;
}

export interface SignVersionedTransactionInput {
  derivationPath?: string;
  accountIndex?: number;
  transaction: VersionedTransaction;
  signingPayloadMode?: TransactionSigningPayloadMode;
}

export interface SignedMessageResult {
  address: string;
  derivationPath: string;
  message: string;
  messageBytesBase64: string;
  signature: string;
  verified: boolean | null;
}

export interface TransactionSummaryInstruction {
  program: string;
  type: string;
  data: string;
}

export interface TransactionSummary {
  network: string;
  version: 'legacy' | 'v0';
  type: string;
  from: string;
  to: string;
  amount: string;
  recentBlockhash: string;
  instructions: TransactionSummaryInstruction[];
}

export interface SignedTransactionResult {
  address: string;
  derivationPath: string;
  signature: string;
  version: 'legacy' | 'v0';
  recentBlockhash: string;
  serializedTransactionBase64: string;
  transactionSummary: TransactionSummary;
}

export interface WalletAdapter {
  connect(): Promise<HWSignerConnection>;
  disconnect(): Promise<void>;
  getCapabilities(): HWSignerCapabilities;
  getAppConfiguration(): Promise<HWSignerAppConfiguration | null>;
  getAccounts(input: GetAccountsInput): Promise<HWSignerAccount[]>;
  signMessage(input: SignMessageInput): Promise<SignedMessageResult>;
  signTransaction(input: SignTransactionInput): Promise<SignedTransactionResult>;
  signVersionedTransaction(input: SignVersionedTransactionInput): Promise<SignedTransactionResult>;
}

export interface CreateHWSignerOptions {
  walletId: HWWalletId;
  runtime: HWSignerRuntime;
  onEvent?: HWSignerEventListener;
}
