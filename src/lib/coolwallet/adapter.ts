import type {
  HWSignerEventListener,
  HWSignerRuntime,
  WalletAdapter,
} from '../hwsigner/types';
import { UnsupportedOperationError } from '../hwsigner/errors';
import { CoolWalletWebBleClient } from './client';

export function createCoolWalletAdapter(runtime: HWSignerRuntime, onEvent?: HWSignerEventListener): WalletAdapter {
  if (runtime.kind !== 'coolwallet-web-ble') {
    throw new UnsupportedOperationError('CoolWallet only supports the Web Bluetooth runtime in this project.');
  }

  return new CoolWalletAdapter(onEvent);
}

class CoolWalletAdapter implements WalletAdapter {
  private readonly client: CoolWalletWebBleClient;

  constructor(onEvent?: HWSignerEventListener) {
    this.client = new CoolWalletWebBleClient(onEvent);
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