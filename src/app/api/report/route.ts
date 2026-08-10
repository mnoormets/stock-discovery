import { NextResponse } from 'next/server';
import { getLatestDate, getTop } from '@/lib/db';
import { buildReport } from '@/lib/report';
import { TOP_N } from '@/lib/config';

// GET /api/report?date=YYYY-MM-DD — tagastab loetava markdown-aruande.
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const date = url.searchParams.get('date') || (await getLatestDate());
    if (!date) {
      return NextResponse.json({ ok: false, error: 'Andmeid pole veel.' }, { status: 404 });
    }
    const rows = await getTop(date, TOP_N);
    const markdown = buildReport(date, rows);
    return NextResponse.json({ ok: true, date, markdown, rows });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
