import type {
  HWSignerEventListener,
  HWSignerRuntime,
  WalletAdapter,
} from '@/lib/hwsigner/types';
import { UnsupportedOperationError } from '@/lib/hwsigner/errors';
import { KeystoneQrClient } from '@/lib/keystone/client';

export function createKeystoneAdapter(runtime: HWSignerRuntime, onEvent?: HWSignerEventListener): WalletAdapter {
  if (runtime.kind !== 'keystone-qr') {
    throw new UnsupportedOperationError('Keystone only supports the QR runtime in this project.');
  }

  return new KeystoneAdapter(onEvent);
}

class KeystoneAdapter implements WalletAdapter {
  private readonly client: KeystoneQrClient;

  constructor(onEvent?: HWSignerEventListener) {
    this.client = new KeystoneQrClient(onEvent);
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
