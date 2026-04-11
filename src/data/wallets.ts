import { isSpeculosEnabled } from '@/lib/ledger/env';
import type { HWWalletId } from '@/lib/hwsigner/types';

export type WalletStatus = 'live' | 'experimental' | 'adapter-ready' | 'planned' | 'coming-next';

export type Transport = 'USB' | 'BLE' | 'NFC' | 'QR' | 'Bridge';

export interface WalletCapabilities {
  connect: boolean;
  usb: boolean;
  ble: boolean;
  nfc: boolean;
  qr: boolean;
  getAccounts: boolean;
  signTransaction: boolean;
  signVersionedTransaction: boolean;
  signMessage: boolean;
  emulatorMode: boolean;
  react: boolean;
  reactNative: boolean;
}

export interface WalletRuntime {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  localOnly?: boolean;
  nativeOnly?: boolean;
}

export interface Wallet {
  id: HWWalletId;
  name: string;
  status: WalletStatus;
  transports: Transport[];
  capabilities: WalletCapabilities;
  runtimes: WalletRuntime[];
  color: string;
  icon: string;
  description: string;
  interactive: boolean;
}

const speculosEnabled = isSpeculosEnabled();
const walletConnectEnabled = Boolean(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim());

export const wallets: Wallet[] = [
  {
    id: 'ledger',
    name: 'Ledger',
    status: 'live',
    transports: ['USB', 'BLE'],
    capabilities: {
      connect: true,
      usb: true,
      ble: false,
      nfc: false,
      qr: false,
      getAccounts: true,
      signTransaction: true,
      signVersionedTransaction: true,
      signMessage: true,
      emulatorMode: true,
      react: true,
      reactNative: false,
    },
    runtimes: [
      {
        id: 'ledger-real',
        label: 'Real Device',
        description: 'WebHID connection to a physical Ledger device.',
        enabled: true,
      },
      {
        id: 'ledger-speculos',
        label: 'Speculos Emulator',
        description: speculosEnabled
          ? 'Local bridge to a running Speculos instance.'
          : 'Local-only runtime. Enable NEXT_PUBLIC_ENABLE_SPECULOS=true in development.',
        enabled: speculosEnabled,
        localOnly: true,
      },
    ],
    color: '#6490FF',
    icon: 'Shield',
    description: 'Live Ledger adapter with WebHID and dev-only Speculos support.',
    interactive: true,
  },
  {
    id: 'trezor',
    name: 'Trezor',
    status: 'experimental',
    transports: ['USB'],
    capabilities: {
      connect: true,
      usb: true,
      ble: false,
      nfc: false,
      qr: false,
      getAccounts: true,
      signTransaction: true,
      signVersionedTransaction: true,
      signMessage: false,
      emulatorMode: false,
      react: true,
      reactNative: false,
    },
    runtimes: [
      {
        id: 'trezor-connect',
        label: 'Trezor Connect',
        description: 'Popup bridge to a physical Trezor over the official web flow.',
        enabled: true,
      },
    ],
    color: '#00854D',
    icon: 'Lock',
    description: 'Experimental Trezor adapter with Connect-based account derivation and transaction signing.',
    interactive: true,
  },
  {
    id: 'keystone',
    name: 'Keystone',
    status: 'experimental',
    transports: ['QR', 'USB'],
    capabilities: {
      connect: true,
      usb: false,
      ble: false,
      nfc: false,
      qr: true,
      getAccounts: true,
      signTransaction: true,
      signVersionedTransaction: true,
      signMessage: true,
      emulatorMode: false,
      react: true,
      reactNative: true,
    },
    runtimes: [
      {
        id: 'keystone-qr',
        label: 'QR Signing',
        description: 'Keystone QR flow through the Solana wallet adapter runtime.',
        enabled: true,
      },
      {
        id: 'keystone-react-native-qr',
        label: 'React Native QR',
        description: 'Native camera / Keystone UR flow. Pass a React Native QR wallet client into runtime.wallet.',
        enabled: false,
        nativeOnly: true,
      },
    ],
    color: '#2E5BFF',
    icon: 'QrCode',
    description: 'Experimental Keystone adapter with QR-based connect and signing, plus an adapter-ready React Native QR wrapper for native camera flows.',
    interactive: true,
  },
  {
    id: 'safepal',
    name: 'SafePal',
    status: 'experimental',
    transports: ['BLE', 'QR'],
    capabilities: {
      connect: true,
      usb: false,
      ble: false,
      nfc: false,
      qr: false,
      getAccounts: true,
      signTransaction: true,
      signVersionedTransaction: false,
      signMessage: true,
      emulatorMode: false,
      react: true,
      reactNative: false,
    },
    runtimes: [
      {
        id: 'safepal-provider',
        label: 'Extension / In-App Browser',
        description: 'Injected SafePal provider for the browser extension or SafePal in-app browser.',
        enabled: true,
      },
    ],
    color: '#4A3AFF',
    icon: 'Wallet',
    description: 'Experimental SafePal adapter through the official injected Solana provider runtime.',
    interactive: true,
  },
  {
    id: 'onekey',
    name: 'OneKey',
    status: 'experimental',
    transports: ['USB', 'BLE'],
    capabilities: {
      connect: true,
      usb: true,
      ble: false,
      nfc: false,
      qr: false,
      getAccounts: true,
      signTransaction: true,
      signVersionedTransaction: true,
      signMessage: true,
      emulatorMode: false,
      react: true,
      reactNative: false,
    },
    runtimes: [
      {
        id: 'onekey-webusb',
        label: 'Browser WebUSB',
        description: 'Official OneKey WebUSB flow for a physical device.',
        enabled: true,
      },
    ],
    color: '#00B812',
    icon: 'Key',
    description: 'Experimental OneKey adapter with official WebUSB account derivation and signing flows.',
    interactive: true,
  },
  {
    id: 'dcent',
    name: "D'CENT",
    status: 'experimental',
    transports: ['QR', 'BLE'],
    capabilities: {
      connect: true,
      usb: false,
      ble: false,
      nfc: false,
      qr: true,
      getAccounts: true,
      signTransaction: true,
      signVersionedTransaction: true,
      signMessage: true,
      emulatorMode: false,
      react: true,
      reactNative: true,
    },
    runtimes: [
      {
        id: 'dcent-walletconnect',
        label: 'WalletConnect QR',
        description: walletConnectEnabled
          ? "D'CENT mobile app QR flow through WalletConnect for Solana sessions."
          : 'Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to enable the D\'CENT WalletConnect runtime.',
        enabled: walletConnectEnabled,
      },
    ],
    color: '#FF6B2B',
    icon: 'Cpu',
    description: "Experimental D'CENT adapter with WalletConnect QR connect, single-account access, Solana signing through the D'CENT mobile app, and an adapter-ready React Native WalletConnect wrapper.",
    interactive: true,
  },
  {
    id: 'secux',
    name: 'SecuX',
    status: 'experimental',
    transports: ['USB'],
    capabilities: {
      connect: true,
      usb: true,
      ble: false,
      nfc: false,
      qr: false,
      getAccounts: true,
      signTransaction: true,
      signVersionedTransaction: true,
      signMessage: true,
      emulatorMode: false,
      react: true,
      reactNative: false,
    },
    runtimes: [
      {
        id: 'secux-webusb',
        label: 'Browser WebUSB',
        description: 'Official SecuX WebUSB flow for physical SecuX devices.',
        enabled: true,
      },
    ],
    color: '#0EA5E9',
    icon: 'Usb',
    description: 'Experimental SecuX adapter with WebUSB connect, account derivation, message signing, and serialized Solana transaction signing.',
    interactive: true,
  },
  {
    id: 'coolwallet',
    name: 'CoolWallet',
    status: 'experimental',
    transports: ['BLE'],
    capabilities: {
      connect: true,
      usb: false,
      ble: true,
      nfc: false,
      qr: false,
      getAccounts: true,
      signTransaction: true,
      signVersionedTransaction: true,
      signMessage: true,
      emulatorMode: false,
      react: true,
      reactNative: false,
    },
    runtimes: [
      {
        id: 'coolwallet-web-ble',
        label: 'Browser Web Bluetooth',
        description: 'Official CoolWallet Web BLE flow with local app registration caching in the browser.',
        enabled: true,
      },
    ],
    color: '#3B82F6',
    icon: 'CreditCard',
    description: 'Experimental CoolWallet adapter with Web Bluetooth pairing, account derivation, and Solana signing.',
    interactive: true,
  },
  {
    id: 'ellipal',
    name: 'ELLIPAL',
    status: 'experimental',
    transports: ['QR'],
    capabilities: {
      connect: true,
      usb: false,
      ble: false,
      nfc: false,
      qr: true,
      getAccounts: true,
      signTransaction: true,
      signVersionedTransaction: true,
      signMessage: true,
      emulatorMode: false,
      react: true,
      reactNative: true,
    },
    runtimes: [
      {
        id: 'ellipal-walletconnect',
        label: 'WalletConnect QR',
        description: walletConnectEnabled
          ? 'ELLIPAL mobile app QR flow through WalletConnect for Solana sessions.'
          : 'Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to enable the ELLIPAL WalletConnect runtime.',
        enabled: walletConnectEnabled,
      },
    ],
    color: '#F59E0B',
    icon: 'Smartphone',
    description: 'Experimental ELLIPAL adapter with WalletConnect QR connect, single-account access, Solana signing through the ELLIPAL mobile app, and an adapter-ready React Native WalletConnect wrapper.',
    interactive: true,
  },
  {
    id: 'cypherock',
    name: 'Cypherock',
    status: 'experimental',
    transports: ['USB', 'NFC'],
    capabilities: {
      connect: true,
      usb: true,
      ble: false,
      nfc: false,
      qr: false,
      getAccounts: true,
      signTransaction: true,
      signVersionedTransaction: false,
      signMessage: false,
      emulatorMode: false,
      react: true,
      reactNative: false,
    },
    runtimes: [
      {
        id: 'cypherock-webusb',
        label: 'Browser WebUSB',
        description: 'Official Cypherock WebUSB flow with on-device wallet selection.',
        enabled: true,
      },
    ],
    color: '#8B5CF6',
    icon: 'Layers',
    description: 'Experimental Cypherock adapter with WebUSB wallet selection, Solana account derivation, and legacy transaction signing.',
    interactive: true,
  },
  {
    id: 'bc-vault',
    name: 'BC Vault',
    status: 'experimental',
    transports: ['USB', 'QR'],
    capabilities: {
      connect: true,
      usb: false,
      ble: false,
      nfc: false,
      qr: true,
      getAccounts: true,
      signTransaction: true,
      signVersionedTransaction: true,
      signMessage: true,
      emulatorMode: false,
      react: true,
      reactNative: true,
    },
    runtimes: [
      {
        id: 'bc-vault-walletconnect',
        label: 'WalletConnect',
        description: walletConnectEnabled
          ? 'BC Vault Desktop app WalletConnect flow for Solana signing.'
          : 'Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to enable the BC Vault WalletConnect runtime.',
        enabled: walletConnectEnabled,
      },
    ],
    color: '#E5E7EB',
    icon: 'Shield',
    description: 'Experimental BC Vault adapter through WalletConnect. HWSigner connects to the BC Vault Desktop app while the private key remains on the hardware device; React Native can use the generic WalletConnect wrapper.',
    interactive: true,
  },
  {
    id: 'keypal',
    name: 'KeyPal',
    status: 'experimental',
    transports: ['Bridge'],
    capabilities: {
      connect: true,
      usb: false,
      ble: false,
      nfc: false,
      qr: false,
      getAccounts: true,
      signTransaction: true,
      signVersionedTransaction: false,
      signMessage: true,
      emulatorMode: false,
      react: true,
      reactNative: false,
    },
    runtimes: [
      {
        id: 'keypal-tokenpocket-provider',
        label: 'TokenPocket Provider',
        description: 'TokenPocket browser extension flow for a KeyPal-backed Solana account.',
        enabled: true,
      },
    ],
    color: '#2980FE',
    icon: 'Key',
    description: 'Experimental KeyPal path through TokenPocket. HWSigner uses the Solana TokenPocket adapter while the user keeps the account backed by KeyPal hardware.',
    interactive: true,
  },
  {
    id: 'gridplus-lattice',
    name: 'GridPlus Lattice1',
    status: 'experimental',
    transports: ['Bridge'],
    capabilities: {
      connect: true,
      usb: false,
      ble: false,
      nfc: false,
      qr: false,
      getAccounts: true,
      signTransaction: true,
      signVersionedTransaction: true,
      signMessage: true,
      emulatorMode: false,
      react: true,
      reactNative: false,
    },
    runtimes: [
      {
        id: 'gridplus-nufi-provider',
        label: 'NuFi Provider',
        description: 'NuFi browser wallet flow for a GridPlus Lattice1-backed Solana account.',
        enabled: true,
      },
    ],
    color: '#C6FF00',
    icon: 'Cpu',
    description: 'Experimental GridPlus Lattice1 path through NuFi. HWSigner uses the Solana NuFi adapter while the private key stays on the Lattice1 device.',
    interactive: true,
  },
  {
    id: 'tangem',
    name: 'Tangem',
    status: 'experimental',
    transports: ['NFC', 'QR'],
    capabilities: {
      connect: true,
      usb: false,
      ble: false,
      nfc: true,
      qr: true,
      getAccounts: true,
      signTransaction: true,
      signVersionedTransaction: true,
      signMessage: true,
      emulatorMode: false,
      react: true,
      reactNative: true,
    },
    runtimes: [
      {
        id: 'tangem-walletconnect',
        label: 'WalletConnect',
        description: walletConnectEnabled
          ? 'Tangem mobile WalletConnect flow for Solana dApps. The card confirmation happens through Tangem NFC.'
          : 'Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to enable the Tangem WalletConnect runtime.',
        enabled: walletConnectEnabled,
      },
      {
        id: 'tangem-react-native-nfc',
        label: 'React Native NFC',
        description: 'Native iOS/Android NFC runtime. Pass RNTangemSdk from tangem-sdk-react-native into runtime.sdk.',
        enabled: false,
        nativeOnly: true,
      },
    ],
    color: '#00D8A0',
    icon: 'CreditCard',
    description: 'Experimental Tangem adapter with WalletConnect for the web playground and a React Native NFC runtime for native apps.',
    interactive: true,
  },
  {
    id: 'arculus',
    name: 'Arculus',
    status: 'experimental',
    transports: ['NFC', 'QR'],
    capabilities: {
      connect: true,
      usb: false,
      ble: false,
      nfc: true,
      qr: true,
      getAccounts: true,
      signTransaction: true,
      signVersionedTransaction: true,
      signMessage: true,
      emulatorMode: false,
      react: true,
      reactNative: true,
    },
    runtimes: [
      {
        id: 'arculus-walletconnect',
        label: 'WalletConnect',
        description: walletConnectEnabled
          ? 'Arculus mobile app WalletConnect flow. The card confirmation happens through Arculus NFC.'
          : 'Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to enable the Arculus WalletConnect runtime.',
        enabled: walletConnectEnabled,
      },
    ],
    color: '#D7FF3F',
    icon: 'CreditCard',
    description: 'Experimental Arculus adapter through WalletConnect. HWSigner connects to Arculus mobile; the user confirms with the NFC card in the Arculus flow. React Native can use the generic WalletConnect wrapper.',
    interactive: true,
  },
  {
    id: 'solflare-shield',
    name: 'Solflare Shield',
    status: 'experimental',
    transports: ['NFC'],
    capabilities: {
      connect: true,
      usb: false,
      ble: false,
      nfc: true,
      qr: false,
      getAccounts: true,
      signTransaction: true,
      signVersionedTransaction: true,
      signMessage: true,
      emulatorMode: false,
      react: true,
      reactNative: true,
    },
    runtimes: [
      {
        id: 'solflare-shield-sdk',
        label: 'Solflare SDK',
        description: 'Official Solflare Wallet SDK flow. Shield NFC confirmation happens inside Solflare mobile when the selected account is Shield-backed.',
        enabled: true,
      },
    ],
    color: '#FF7A1A',
    icon: 'Smartphone',
    description: 'Experimental Solflare Shield path through the official Solflare Wallet SDK. HWSigner cannot directly inspect the Shield card; it signs through Solflare and can use the React Native WalletConnect wrapper when a Solana wallet client is injected.',
    interactive: true,
  },
  {
    id: 'ngrave',
    name: 'NGRAVE',
    status: 'planned',
    transports: ['QR'],
    capabilities: {
      connect: false,
      usb: false,
      ble: false,
      nfc: false,
      qr: false,
      getAccounts: false,
      signTransaction: false,
      signVersionedTransaction: false,
      signMessage: false,
      emulatorMode: false,
      react: false,
      reactNative: false,
    },
    runtimes: [
      {
        id: 'ngrave-planned',
        label: 'Waiting',
        description: 'Waiting on a public Solana web SDK or dApp adapter. Current ZERO flows appear to be app-specific QR sync/signing with LIQUID.',
        enabled: false,
      },
    ],
    color: '#EC4899',
    icon: 'Fingerprint',
    description: 'NGRAVE ZERO supports Solana in LIQUID, but we have not found a public web or React Native adapter path that HWSigner can integrate yet.',
    interactive: false,
  },
];

export const statusLabels: Record<WalletStatus, string> = {
  live: 'Live',
  experimental: 'Experimental',
  'adapter-ready': 'Adapter-ready',
  planned: 'Planned',
  'coming-next': 'Coming next',
};

export const statusColors: Record<WalletStatus, string> = {
  live: 'bg-success/20 text-success border-success/30',
  experimental: 'bg-warning/20 text-warning border-warning/30',
  'adapter-ready': 'bg-info/20 text-info border-info/30',
  planned: 'bg-muted-foreground/20 text-muted-foreground border-muted-foreground/30',
  'coming-next': 'bg-primary/20 text-primary border-primary/30',
};
