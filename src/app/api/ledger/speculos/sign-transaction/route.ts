import { NextResponse } from 'next/server';
import { getHttpStatusForErrorCode, InvalidTransactionError, toErrorPayload } from '@/lib/hwsigner/errors';
import { base64ToBytes } from '@/lib/hwsigner/message';
import type { TransactionSigningPayloadMode } from '@/lib/hwsigner/types';
import { signSpeculosSerializedTransaction } from '@/lib/ledger/speculos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionToken?: unknown;
      derivationPath?: unknown;
      accountIndex?: unknown;
      serializedTransactionBase64?: unknown;
      version?: unknown;
      signingPayloadMode?: unknown;
    };

    if (typeof body.sessionToken !== 'string') {
      throw new Error('Missing Speculos session token.');
    }

    if (typeof body.serializedTransactionBase64 !== 'string') {
      throw new InvalidTransactionError('Missing serialized transaction payload.');
    }

    if (!isTransactionSigningPayloadMode(body.signingPayloadMode) && body.signingPayloadMode !== undefined) {
      throw new InvalidTransactionError('Unsupported transaction signing mode.');
    }

    const bytes = base64ToBytes(body.serializedTransactionBase64);
    const sharedInput = {
      derivationPath: typeof body.derivationPath === 'string' ? body.derivationPath : undefined,
      accountIndex: typeof body.accountIndex === 'number' ? body.accountIndex : undefined,
    };

    const result = await signSpeculosSerializedTransaction(body.sessionToken, {
      ...sharedInput,
      serializedTransaction: bytes,
      version: body.version === 'v0' ? 'v0' : 'legacy',
      signingPayloadMode: body.signingPayloadMode,
    });

    return NextResponse.json({ result });
  } catch (error) {
    const payload = toErrorPayload(error);
    return NextResponse.json(
      {
        error: payload,
      },
      {
        status: getHttpStatusForErrorCode(payload.code),
      },
    );
  }
}

function isTransactionSigningPayloadMode(value: unknown): value is TransactionSigningPayloadMode {
  return value === 'serialized-transaction'
    || value === 'legacy-message-bytes'
    || value === 'versioned-message-bytes';
}
