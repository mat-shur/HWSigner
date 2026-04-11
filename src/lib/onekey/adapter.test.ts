import { describe, expect, it } from 'vitest';

import { UnsupportedOperationError } from '@/lib/hwsigner/errors';
import { createOneKeyAdapter } from '@/lib/onekey/adapter';

describe('OneKey adapter', () => {
  it('exposes the expected capability shape for onekey-webusb', () => {
    const adapter = createOneKeyAdapter({
      kind: 'onekey-webusb',
      transport: 'webusb',
    });

    expect(adapter.getCapabilities()).toMatchObject({
      connect: true,
      disconnect: true,
      getAccounts: true,
      signMessage: true,
      signTransaction: true,
      signVersionedTransaction: true,
      usb: true,
      ble: false,
      qr: false,
      nfc: false,
    });
  });

  it('rejects unsupported runtimes', () => {
    expect(() => createOneKeyAdapter({
      kind: 'real-device',
      transport: 'webhid',
    })).toThrow(UnsupportedOperationError);
  });
});
