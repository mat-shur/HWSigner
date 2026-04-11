import { NextResponse } from 'next/server';

import { getHttpStatusForErrorCode, toErrorPayload } from '@/lib/hwsigner/errors';
import { base64ToBytes } from '@/lib/hwsigner/message';
import { signSpeculosMessage } from '@/lib/ledger/speculos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionToken?: unknown;
      derivationPath?: unknown;
      accountIndex?: unknown;
      messageBase64?: unknown;
      raw?: unknown;
      messageText?: unknown;
    };

    if (typeof body.sessionToken !== 'string') {
      throw new Error('Missing Speculos session token.');
    }

    if (typeof body.messageBase64 !== 'string') {
      throw new Error('Missing message payload.');
    }

    const raw = Boolean(body.raw);
    const message = raw
      ? base64ToBytes(body.messageBase64)
      : typeof body.messageText === 'string'
        ? body.messageText
        : new TextDecoder().decode(base64ToBytes(body.messageBase64));

    const result = await signSpeculosMessage(body.sessionToken, {
      derivationPath: typeof body.derivationPath === 'string' ? body.derivationPath : undefined,
      accountIndex: typeof body.accountIndex === 'number' ? body.accountIndex : undefined,
      message,
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
