import type { ApeWisdomRow } from './types';
import { APEWISDOM_FILTER } from './config';

export interface ApeWisdomFetch {
  // Duplikaadivabad read: iga ticker esineb täpselt üks kord, esimene
  // esinemine võidab.
  rows: ApeWisdomRow[];
  // Mitu toorest rida provider tagastas ENNE dedupi. Hoitakse eraldi, et
  // `scanned` metrika tähendus ("mitu rida allikast läbi vaadati") ei muutuks
  // vaikselt, kui dedup ridu eemaldab.
  rawRowCount: number;
}

// ApeWisdom: tasuta, ilma võtmeta. Annab mainimised + mainimised 24h tagasi
// (see ongi meie peamine "tõusev tähelepanu" signaal) ja katab ~15 000 tickerit.
// Dokumentatsioon: https://apewisdom.io/api/
//
// DEDUP, miks see siin on: iga lehe kohta tehakse eraldi HTTP päring ja
// ApeWisdomi edetabel on elav. Kui järjestus nihkub päringute vahel, lükkub
// lehepiiri lähedal olev ticker alla ja ilmub MÕLEMAL lehel. Mõõdetud
// 2026-08-19: 200 rida, 195 unikaalset (GLP rank 87 -> 101, EU 86 -> 102,
// MSS 85 -> 103, XYZ 84 -> 104, CDNL 83 -> 105). See nurjas collection run'id
// #4, #5 ja #6 duplikaadi-guardi taga (`collection-run-items.ts`).
//
// Dedup tehakse ÜKS kord lõpus, mitte lehe kaupa, seega tagastus on
// garanteeritult duplikaadivaba sõltumata lehtede arvust ja sellest, kuidas
// allika järjestus päringute vahel nihkus.
export async function fetchApeWisdom(pages = 1): Promise<ApeWisdomFetch> {
  const raw: ApeWisdomRow[] = [];

  for (let page = 1; page <= pages; page++) {
    const url = `https://apewisdom.io/api/v1.0/filter/${APEWISDOM_FILTER}/page/${page}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'stock-discovery/0.1' } });
    if (!res.ok) {
      throw new Error(`ApeWisdom vastas ${res.status} (lk ${page})`);
    }
    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];

    for (const r of results) {
      raw.push({
        rank: Number(r.rank),
        // Normaliseeritud juba siin: trim + uppercase, sama moodi nagu
        // `collection-run-items.ts` normalize(). Seega on `ticker` allpool
        // otse dedupi võtmena kasutatav.
        ticker: String(r.ticker).toUpperCase().trim(),
        name: String(r.name ?? ''),
        mentions: Number(r.mentions ?? 0),
        upvotes: Number(r.upvotes ?? 0),
        rank_24h_ago: r.rank_24h_ago != null ? Number(r.rank_24h_ago) : null,
        mentions_24h_ago: r.mentions_24h_ago != null ? Number(r.mentions_24h_ago) : null,
      });
    }
  }

  const seen = new Set<string>();
  const rows: ApeWisdomRow[] = [];
  for (const row of raw) {
    if (seen.has(row.ticker)) continue;
    seen.add(row.ticker);
    rows.push(row);
  }

  return { rows, rawRowCount: raw.length };
}
