import { describe, expect, it } from 'vitest';

import { UnsupportedOperationError } from '@/lib/hwsigner/errors';
import { createBcVaultAdapter } from '@/lib/bc-vault/adapter';

describe('BC Vault adapter', () => {
  it('exposes the expected capability shape for walletconnect', () => {
    const adapter = createBcVaultAdapter({
      kind: 'bc-vault-walletconnect',
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
    expect(() => createBcVaultAdapter({
      kind: 'real-device',
      transport: 'webhid',
    })).toThrow(UnsupportedOperationError);
  });
});
