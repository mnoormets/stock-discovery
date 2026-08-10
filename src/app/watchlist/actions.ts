'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { addTickerToWatchlist, removeTickerFromWatchlist } from '@/lib/portfolio';

function refreshWatchlist() {
  revalidatePath('/watchlist');
  revalidatePath('/portfolio');
  revalidatePath('/daily');
}

export async function addWatchlistAction(formData: FormData) {
  const ticker = String(formData.get('ticker') || '');
  let inserted = false;
  try {
    inserted = await addTickerToWatchlist(ticker);
  } catch (error) {
    redirect(`/watchlist?error=${encodeURIComponent((error as Error).message)}`);
  }
  refreshWatchlist();
  redirect(`/watchlist?message=${encodeURIComponent(inserted ? `${ticker.toUpperCase()} lisatud Watchlisti.` : `${ticker.toUpperCase()} on juba jälgimisel või portfellis.`)}`);
}

export async function removeWatchlistAction(formData: FormData) {
  const id = Number(formData.get('id'));
  if (!Number.isInteger(id) || id <= 0) redirect('/watchlist?error=Vigane%20Watchlisti%20ID.');
  const removed = await removeTickerFromWatchlist(id);
  refreshWatchlist();
  redirect(`/watchlist?message=${encodeURIComponent(removed ? 'Ticker eemaldatud Watchlistist.' : 'Watchlisti kirjet ei leitud.')}`);
}
