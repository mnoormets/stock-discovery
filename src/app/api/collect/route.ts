import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { handleCollectRequest } from '@/lib/collect-route-handler';

function isAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  const authorization = req.headers.get('authorization') || '';
  const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!expected || !supplied) return false;

  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  return handleCollectRequest(req);
}

export const dynamic = 'force-dynamic';
