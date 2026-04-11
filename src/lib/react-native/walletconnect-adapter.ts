import { UnsupportedOperationError } from '@/lib/hwsigner/errors';
import type {
  HWSignerEventListener,
  HWSignerRuntime,
  HWWalletId,
  WalletAdapter,
} from '@/lib/hwsigner/types';
import { ReactNativeWalletConnectClient } from '@/lib/react-native/walletconnect-client';

const supportedReactNativeWalletConnectWallets = new Set<HWWalletId>([
  'arculus',
  'bc-vault',
  'dcent',
  'ellipal',
  'solflare-shield',
  'tangem',
]);

export function createReactNativeWalletConnectAdapter(
  walletId: HWWalletId,
  runtime: HWSignerRuntime,
  onEvent?: HWSignerEventListener,
): WalletAdapter {
  if (runtime.kind !== 'react-native-walletconnect') {
    throw new UnsupportedOperationError('React Native WalletConnect requires the react-native-walletconnect runtime.');
  }

  if (!supportedReactNativeWalletConnectWallets.has(walletId)) {
    throw new UnsupportedOperationError(`${walletId} does not have a React Native WalletConnect runtime mapped yet.`);
  }

  return new ReactNativeWalletConnectAdapter(walletId, runtime, onEvent);
}

class ReactNativeWalletConnectAdapter implements WalletAdapter {
  private readonly client: ReactNativeWalletConnectClient;

  constructor(
    walletId: HWWalletId,
    runtime: Extract<HWSignerRuntime, { kind: 'react-native-walletconnect' }>,
    onEvent?: HWSignerEventListener,
  ) {
    this.client = new ReactNativeWalletConnectClient({
      walletId,
      runtime,
      onEvent,
    });
  }

  connect() {
    return this.client.connect();
  }

  disconnect() {
    return this.client.disconnect();
  }

  getCapabilities() {
    return this.client.getCapabilities();
  }

  getAppConfiguration() {
    return this.client.getAppConfiguration();
  }

  getAccounts(input: Parameters<WalletAdapter['getAccounts']>[0]) {
    return this.client.getAccounts(input);
  }

  signMessage(input: Parameters<WalletAdapter['signMessage']>[0]) {
    return this.client.signMessage(input);
  }

  signTransaction(input: Parameters<WalletAdapter['signTransaction']>[0]) {
    return this.client.signTransaction(input);
  }

  signVersionedTransaction(input: Parameters<WalletAdapter['signVersionedTransaction']>[0]) {
    return this.client.signVersionedTransaction(input);
  }
}
