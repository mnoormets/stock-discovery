import { NextResponse } from 'next/server';
import { generateResearchBrief, getResearchBriefState } from '@/lib/research-brief';
import { normalizeTicker } from '@/lib/investment';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { ticker: string } }) {
  const requestOrigin = request.headers.get('origin');
  const requestHost = request.headers.get('host');
  if (requestOrigin && requestHost && new URL(requestOrigin).host !== requestHost) {
    return NextResponse.json({ ok: false, error: 'Päringu päritolu pole lubatud.' }, { status: 403 });
  }
  const ticker = normalizeTicker(decodeURIComponent(params.ticker));
  if (!ticker) return NextResponse.json({ ok: false, error: 'Ticker pole korrektne.' }, { status: 400 });

  const state = await getResearchBriefState(ticker);
  if (!state.sufficient) {
    return NextResponse.json({ ok: false, error: state.reason }, { status: 422 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const brief = await generateResearchBrief(ticker, body?.force === true);
    return NextResponse.json({ ok: true, brief });
  } catch (error) {
    console.error(`Ettevõtte ${ticker} automaatse kokkuvõtte loomine ebaõnnestus:`, error);
    return NextResponse.json(
      { ok: false, error: 'Automaatse kokkuvõtte loomine ebaõnnestus. Proovi hiljem uuesti.' },
      { status: 502 },
    );
  }
}
