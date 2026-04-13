import { describe, expect, it } from 'vitest';

import { UnsupportedOperationError } from '../hwsigner/errors';
import { createGridPlusAdapter } from './adapter';
import { getGridPlusErrorMessage, mapGridPlusError } from './error-map';

describe('GridPlus Lattice1 adapter', () => {
  it('exposes the expected capability shape for the NuFi provider runtime', () => {
    const adapter = createGridPlusAdapter({
      kind: 'gridplus-nufi-provider',
      transport: 'injected-provider',
    });

    expect(adapter.getCapabilities()).toMatchObject({
      connect: true,
      disconnect: true,
      getAccounts: true,
      signMessage: true,
      signTransaction: true,
      signVersionedTransaction: true,
      usb: false,
      ble: false,
      qr: false,
      nfc: false,
    });
  });

  it('rejects unsupported runtimes', () => {
    expect(() => createGridPlusAdapter({
      kind: 'real-device',
      transport: 'webhid',
    })).toThrow(UnsupportedOperationError);
  });
});

describe('GridPlus Lattice1 errors', () => {
  it('extracts nested NuFi error messages', () => {
    expect(getGridPlusErrorMessage({
      error: {
        message: 'NuFi wallet is not ready',
      },
    })).toBe('NuFi wallet is not ready');
  });

  it('maps not-ready provider errors to device-not-found', () => {
    expect(mapGridPlusError(new Error('NuFi wallet is not ready')).code).toBe('DEVICE_NOT_FOUND');
  });
});