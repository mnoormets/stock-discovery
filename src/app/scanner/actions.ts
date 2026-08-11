'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ensureTickerWatchPosition } from '@/lib/portfolio';

function refreshDiscovery() {
  revalidatePath('/scanner');
  revalidatePath('/watchlist');
  revalidatePath('/portfolio');
  revalidatePath('/daily');
}

export async function addDiscoveryWatchlistAction(formData: FormData) {
  const ticker = String(formData.get('ticker') || '');
  let created = false;
  try {
    const result = await ensureTickerWatchPosition(ticker);
    created = result.created;
  } catch (error) {
    redirect(`/scanner?preset=rklb&error=${encodeURIComponent((error as Error).message)}`);
  }
  refreshDiscovery();
  redirect(`/scanner?preset=rklb&message=${encodeURIComponent(created ? `${ticker.toUpperCase()} lisatud Watchlisti.` : `${ticker.toUpperCase()} on juba jälgimisel või portfellis.`)}`);
}

export async function startDiscoveryThesisAction(formData: FormData) {
  const ticker = String(formData.get('ticker') || '');
  let positionId = 0;
  try {
    const position = await ensureTickerWatchPosition(ticker);
    positionId = position.id;
  } catch (error) {
    redirect(`/scanner?preset=rklb&error=${encodeURIComponent((error as Error).message)}`);
  }
  refreshDiscovery();
  redirect(`/thesis/${positionId}`);
}
