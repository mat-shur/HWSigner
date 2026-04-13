import type {
  HWSignerEventListener,
  HWSignerRuntime,
  WalletAdapter,
} from '../hwsigner/types';
import { UnsupportedOperationError } from '../hwsigner/errors';
import { EllipalWalletConnectClient } from './client';

export function createEllipalAdapter(runtime: HWSignerRuntime, onEvent?: HWSignerEventListener): WalletAdapter {
  if (runtime.kind !== 'ellipal-walletconnect') {
    throw new UnsupportedOperationError('ELLIPAL only supports the WalletConnect QR runtime in this project.');
  }

  return new EllipalAdapter(onEvent);
}

class EllipalAdapter implements WalletAdapter {
  private readonly client: EllipalWalletConnectClient;

  constructor(onEvent?: HWSignerEventListener) {
    this.client = new EllipalWalletConnectClient(onEvent);
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