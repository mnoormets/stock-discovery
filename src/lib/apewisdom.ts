import type { ApeWisdomRow } from './types';
import { APEWISDOM_FILTER } from './config';

// ApeWisdom: tasuta, ilma võtmeta. Annab mainimised + mainimised 24h tagasi
// (see ongi meie peamine "tõusev tähelepanu" signaal) ja katab ~15 000 tickerit.
// Dokumentatsioon: https://apewisdom.io/api/
export async function fetchApeWisdom(pages = 1): Promise<ApeWisdomRow[]> {
  const rows: ApeWisdomRow[] = [];

  for (let page = 1; page <= pages; page++) {
    const url = `https://apewisdom.io/api/v1.0/filter/${APEWISDOM_FILTER}/page/${page}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'stock-discovery/0.1' } });
    if (!res.ok) {
      throw new Error(`ApeWisdom vastas ${res.status} (lk ${page})`);
    }
    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];

    for (const r of results) {
      rows.push({
        rank: Number(r.rank),
        ticker: String(r.ticker).toUpperCase().trim(),
        name: String(r.name ?? ''),
        mentions: Number(r.mentions ?? 0),
        upvotes: Number(r.upvotes ?? 0),
        rank_24h_ago: r.rank_24h_ago != null ? Number(r.rank_24h_ago) : null,
        mentions_24h_ago: r.mentions_24h_ago != null ? Number(r.mentions_24h_ago) : null,
      });
    }
  }

  return rows;
}
