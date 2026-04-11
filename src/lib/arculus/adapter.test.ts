import { describe, expect, it } from 'vitest';

import { UnsupportedOperationError } from '@/lib/hwsigner/errors';
import { createArculusAdapter } from '@/lib/arculus/adapter';

describe('Arculus adapter', () => {
  it('exposes the expected capability shape for walletconnect', () => {
    const adapter = createArculusAdapter({
      kind: 'arculus-walletconnect',
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
      nfc: true,
    });
  });

  it('rejects unsupported runtimes', () => {
    expect(() => createArculusAdapter({
      kind: 'real-device',
      transport: 'webhid',
    })).toThrow(UnsupportedOperationError);
  });
});
