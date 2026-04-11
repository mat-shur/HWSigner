import { NextResponse } from 'next/server';

import { getHttpStatusForErrorCode, toErrorPayload } from '@/lib/hwsigner/errors';
import { connectSpeculosSession } from '@/lib/ledger/speculos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      speculosUrl?: unknown;
    };

    const result = await connectSpeculosSession({
      speculosUrl: typeof body.speculosUrl === 'string' ? body.speculosUrl : undefined,
    });

    return NextResponse.json(result);
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
