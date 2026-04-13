import { describe, expect, it } from 'vitest';

import { UnsupportedOperationError } from '../hwsigner/errors';
import { createCypherockAdapter } from './adapter';

describe('Cypherock adapter', () => {
  it('exposes the expected capability shape for webusb', () => {
    const adapter = createCypherockAdapter({
      kind: 'cypherock-webusb',
      transport: 'webusb',
    });

    expect(adapter.getCapabilities()).toMatchObject({
      connect: true,
      disconnect: true,
      getAccounts: true,
      signMessage: false,
      signTransaction: true,
      signVersionedTransaction: false,
      usb: true,
      ble: false,
      qr: false,
      nfc: false,
    });
  });

  it('rejects unsupported runtimes', () => {
    expect(() => createCypherockAdapter({
      kind: 'real-device',
      transport: 'webhid',
    })).toThrow(UnsupportedOperationError);
  });
});