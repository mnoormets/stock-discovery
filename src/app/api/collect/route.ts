import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { runCollection } from '@/lib/collect';
import { refreshCandidateOutcomes } from '@/lib/discovery-validation';

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

  try {
    const result = await runCollection();
    const outcomeUpdates = await refreshCandidateOutcomes();
    return NextResponse.json({ ok: true, ...result, outcomeUpdates });
  } catch (err) {
    console.error('Kogumine ebaõnnestus:', err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
