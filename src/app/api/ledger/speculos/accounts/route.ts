import { NextResponse } from 'next/server';

import { getHttpStatusForErrorCode, toErrorPayload } from '@/lib/hwsigner/errors';
import { getSpeculosAccounts } from '@/lib/ledger/speculos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionToken?: unknown;
      startIndex?: unknown;
      count?: unknown;
      checkOnDevice?: unknown;
    };

    if (typeof body.sessionToken !== 'string') {
      throw new Error('Missing Speculos session token.');
    }

    const accounts = await getSpeculosAccounts(body.sessionToken, {
      startIndex: Number(body.startIndex ?? 0),
      count: Number(body.count ?? 1),
      checkOnDevice: Boolean(body.checkOnDevice),
    });

    return NextResponse.json({ accounts });
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
