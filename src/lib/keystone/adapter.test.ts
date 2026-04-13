import { describe, expect, it } from 'vitest';

import { UnsupportedOperationError } from '../hwsigner/errors';
import { createKeystoneAdapter } from './adapter';

describe('Keystone adapter', () => {
  it('exposes the expected capability shape for keystone-qr', () => {
    const adapter = createKeystoneAdapter({
      kind: 'keystone-qr',
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
    expect(() => createKeystoneAdapter({
      kind: 'real-device',
      transport: 'webhid',
    })).toThrow(UnsupportedOperationError);
  });
});