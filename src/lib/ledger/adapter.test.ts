import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createPlaygroundTransaction } from '../hwsigner/transactions';
import type { HWSignerConnection } from '../hwsigner/types';
import { createLedgerAdapter } from './adapter';

const CONNECTED_SPECULOS_RESPONSE: HWSignerConnection = {
  walletId: 'ledger',
  walletName: 'Ledger',
  runtime: {
    kind: 'speculos',
    apiBaseUrl: '/api/ledger/speculos',
  },
  capabilities: {
    connect: true,
    disconnect: true,
    getAccounts: true,
    signMessage: true,
    signTransaction: true,
    signVersionedTransaction: true,
    emulator: true,
    usb: false,
    ble: false,
    qr: false,
    nfc: false,
  },
  appConfiguration: {
    blindSigningEnabled: false,
    pubKeyDisplayMode: 'LONG',
    version: '1.14.0',
  },
};

describe('Ledger Speculos adapter routing', () => {
  const originalFetch = global.fetch;
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('routes transaction signing through the sign-transaction bridge', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        sessionToken: 'speculos-session',
        connection: CONNECTED_SPECULOS_RESPONSE,
      }))
      .mockResolvedValueOnce(jsonResponse({
        result: {
          address: 'EDUded8fGxKkRTWWjE9YFzCmrW54aXXabVKLn3NyvHqV',
          derivationPath: `m/44'/501'/0'/0'`,
          signature: 'mock-signature',
          version: 'legacy',
          recentBlockhash: 'US517G5965aydkZ46HS38QLi7UQiSojurfbQfKCELFx',
          serializedTransactionBase64: 'AQ==',
          transactionSummary: {
            network: 'devnet (offline)',
            version: 'legacy',
            type: 'Transfer',
            from: 'EDUded8fGxKkRTWWjE9YFzCmrW54aXXabVKLn3NyvHqV',
            to: 'DRpbCBMxVnDK7maPMoGQfFiRLNGhFM1M7J9sX9g3BJ2j',
            amount: '0.0015 SOL',
            recentBlockhash: 'US517G5965aydkZ46HS38QLi7UQiSojurfbQfKCELFx',
            instructions: [],
          },
        },
      }));

    const adapter = createLedgerAdapter(
      {
        kind: 'speculos',
        apiBaseUrl: '/api/ledger/speculos',
      },
    );

    await adapter.connect();
    await adapter.signTransaction({
      derivationPath: `m/44'/501'/0'/0'`,
      transaction: createPlaygroundTransaction({
        fromAddress: 'EDUded8fGxKkRTWWjE9YFzCmrW54aXXabVKLn3NyvHqV',
      }),
      signingPayloadMode: 'legacy-message-bytes',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/ledger/speculos/sign-transaction',
      expect.objectContaining({
        method: 'POST',
      }),
    );

    const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as {
      serializedTransactionBase64?: string;
      version?: string;
      signingPayloadMode?: string;
    };

    expect(secondBody.serializedTransactionBase64).toEqual(expect.any(String));
    expect(secondBody.version).toBe('legacy');
    expect(secondBody.signingPayloadMode).toBe('legacy-message-bytes');
  });

  it('routes message signing through the sign-message bridge', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        sessionToken: 'speculos-session',
        connection: CONNECTED_SPECULOS_RESPONSE,
      }))
      .mockResolvedValueOnce(jsonResponse({
        result: {
          address: 'EDUded8fGxKkRTWWjE9YFzCmrW54aXXabVKLn3NyvHqV',
          derivationPath: `m/44'/501'/0'/0'`,
          message: 'hello',
          messageBytesBase64: 'aGVsbG8=',
          signature: 'mock-message-signature',
          verified: null,
        },
      }));

    const adapter = createLedgerAdapter(
      {
        kind: 'speculos',
        apiBaseUrl: '/api/ledger/speculos',
      },
    );

    await adapter.connect();
    await adapter.signMessage({
      derivationPath: `m/44'/501'/0'/0'`,
      message: 'hello',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/ledger/speculos/sign-message',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json',
    },
  });
}