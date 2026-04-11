import type {
  HWSignerEventListener,
  HWSignerRuntime,
  WalletAdapter,
} from '@/lib/hwsigner/types';
import { UnsupportedOperationError } from '@/lib/hwsigner/errors';
import { GridPlusNufiClient } from '@/lib/gridplus/client';

export function createGridPlusAdapter(runtime: HWSignerRuntime, onEvent?: HWSignerEventListener): WalletAdapter {
  if (runtime.kind !== 'gridplus-nufi-provider') {
    throw new UnsupportedOperationError('GridPlus Lattice1 only supports the NuFi injected provider runtime in this project.');
  }

  return new GridPlusAdapter(onEvent);
}

class GridPlusAdapter implements WalletAdapter {
  private readonly client: GridPlusNufiClient;

  constructor(onEvent?: HWSignerEventListener) {
    this.client = new GridPlusNufiClient(onEvent);
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
