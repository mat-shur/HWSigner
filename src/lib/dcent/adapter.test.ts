import { describe, expect, it } from 'vitest';

import { UnsupportedOperationError } from '../hwsigner/errors';
import { createDcentAdapter } from './adapter';

describe("D'CENT adapter", () => {
  it('exposes the expected capability shape for walletconnect qr', () => {
    const adapter = createDcentAdapter({
      kind: 'dcent-walletconnect',
      transport: 'qr',
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
      qr: true,
      nfc: false,
    });
  });

  it('rejects unsupported runtimes', () => {
    expect(() => createDcentAdapter({
      kind: 'real-device',
      transport: 'webhid',
    })).toThrow(UnsupportedOperationError);
  });
});