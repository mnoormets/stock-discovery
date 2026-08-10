import { NextResponse } from 'next/server';
import { runCollection } from '@/lib/collect';

// POST /api/collect — käivitab kogumise (nii käsitsi nupp kui cron kasutavad seda).
export async function POST() {
  try {
    const result = await runCollection();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('Kogumine ebaõnnestus:', err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}

// Lubame ka GET'i, et scheduler saaks lihtsa curl'iga käivitada.
export const GET = POST;

export const dynamic = 'force-dynamic';
