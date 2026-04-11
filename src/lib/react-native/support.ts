import type { HWWalletId } from '@/lib/hwsigner/types';

export type ReactNativeWalletSupportStatus = 'implemented' | 'adapter-ready' | 'planned' | 'web-only';

export type ReactNativeWalletSupport = {
  walletId: HWWalletId;
  status: ReactNativeWalletSupportStatus;
  runtimes: string[];
  note: string;
};

export const reactNativeWalletSupport: ReactNativeWalletSupport[] = [
  {
    walletId: 'tangem',
    status: 'implemented',
    runtimes: ['tangem-react-native-nfc', 'react-native-walletconnect'],
    note: 'Native NFC path through the injected Tangem React Native SDK, plus injected React Native WalletConnect support.',
  },
  {
    walletId: 'ledger',
    status: 'planned',
    runtimes: [],
    note: 'Requires native BLE/USB transport validation with physical Ledger devices.',
  },
  {
    walletId: 'trezor',
    status: 'planned',
    runtimes: [],
    note: 'Requires a React Native compatible Trezor bridge or deep-link strategy.',
  },
  {
    walletId: 'keystone',
    status: 'adapter-ready',
    runtimes: ['react-native-keystone-qr'],
    note: 'React Native QR adapter wrapper is available; the app must provide the native camera/Keystone UR client.',
  },
  {
    walletId: 'dcent',
    status: 'adapter-ready',
    runtimes: ['react-native-walletconnect'],
    note: 'React Native WalletConnect wrapper is available; D\'CENT app/device validation is still required.',
  },
  {
    walletId: 'ellipal',
    status: 'adapter-ready',
    runtimes: ['react-native-walletconnect'],
    note: 'React Native WalletConnect wrapper is available; ELLIPAL app validation is still required.',
  },
  {
    walletId: 'arculus',
    status: 'adapter-ready',
    runtimes: ['react-native-walletconnect'],
    note: 'React Native WalletConnect wrapper is available; NFC card confirmation still happens in the Arculus app.',
  },
  {
    walletId: 'solflare-shield',
    status: 'adapter-ready',
    runtimes: ['react-native-walletconnect'],
    note: 'React Native WalletConnect wrapper is available; Shield detection still depends on Solflare APIs.',
  },
  {
    walletId: 'coolwallet',
    status: 'planned',
    runtimes: [],
    note: 'Requires React Native BLE transport and physical CoolWallet validation.',
  },
  {
    walletId: 'safepal',
    status: 'web-only',
    runtimes: [],
    note: 'Current adapter is browser injected-provider based.',
  },
  {
    walletId: 'onekey',
    status: 'planned',
    runtimes: [],
    note: 'Requires a React Native compatible OneKey transport and device validation.',
  },
  {
    walletId: 'secux',
    status: 'planned',
    runtimes: [],
    note: 'Requires native USB/BLE transport validation.',
  },
  {
    walletId: 'cypherock',
    status: 'planned',
    runtimes: [],
    note: 'Requires a React Native compatible transport path.',
  },
  {
    walletId: 'gridplus-lattice',
    status: 'web-only',
    runtimes: [],
    note: 'Current adapter depends on the NuFi browser provider.',
  },
  {
    walletId: 'keypal',
    status: 'web-only',
    runtimes: [],
    note: 'Current adapter depends on the TokenPocket browser provider.',
  },
  {
    walletId: 'bc-vault',
    status: 'adapter-ready',
    runtimes: ['react-native-walletconnect'],
    note: 'React Native WalletConnect wrapper is available; BC Vault app/device validation is still required.',
  },
  {
    walletId: 'ngrave',
    status: 'planned',
    runtimes: [],
    note: 'Waiting on a public Solana adapter path.',
  },
];

export function getReactNativeWalletSupport(walletId: HWWalletId): ReactNativeWalletSupport {
  return reactNativeWalletSupport.find((wallet) => wallet.walletId === walletId) ?? {
    walletId,
    status: 'planned',
    runtimes: [],
    note: 'No React Native runtime has been mapped for this wallet yet.',
  };
}
