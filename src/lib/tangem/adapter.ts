import type {
  HWSignerEventListener,
  HWSignerRuntime,
  WalletAdapter,
} from '../hwsigner/types';
import { UnsupportedOperationError } from '../hwsigner/errors';
import { TangemReactNativeNfcClient } from './client';
import { TangemWalletConnectClient } from './walletconnect-client';

export function createTangemAdapter(runtime: HWSignerRuntime, onEvent?: HWSignerEventListener): WalletAdapter {
  if (runtime.kind === 'tangem-walletconnect') {
    return new TangemWalletConnectAdapter(onEvent);
  }

  if (runtime.kind !== 'tangem-react-native-nfc') {
    throw new UnsupportedOperationError('Tangem supports WalletConnect and React Native NFC runtimes in this project.');
  }

  return new TangemReactNativeAdapter(runtime, onEvent);
}

class TangemReactNativeAdapter implements WalletAdapter {
  private readonly client: TangemReactNativeNfcClient;

  constructor(runtime: Extract<HWSignerRuntime, { kind: 'tangem-react-native-nfc' }>, onEvent?: HWSignerEventListener) {
    this.client = new TangemReactNativeNfcClient({
      sdk: runtime.sdk,
      defaultDerivationPath: runtime.defaultDerivationPath,
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

class TangemWalletConnectAdapter implements WalletAdapter {
  private readonly client: TangemWalletConnectClient;

  constructor(onEvent?: HWSignerEventListener) {
    this.client = new TangemWalletConnectClient(onEvent);
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