import { NextResponse } from 'next/server';

import { getHttpStatusForErrorCode, toErrorPayload } from '@/lib/hwsigner/errors';
import { disconnectSpeculosSession } from '@/lib/ledger/speculos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionToken?: unknown;
    };

    if (typeof body.sessionToken !== 'string') {
      throw new Error('Missing Speculos session token.');
    }

    await disconnectSpeculosSession(body.sessionToken);
    return NextResponse.json({ ok: true });
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
