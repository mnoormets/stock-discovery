import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchApeWisdom } from '../../src/lib/apewisdom';

// Reprodutseerib collection run'ide #4, #5 ja #6 nurjumise põhjuse.
//
// ApeWisdom teeb iga lehe kohta eraldi HTTP päringu ja tema edetabel on elav.
// Kui järjestus nihkub päringute vahel, lükkub lehepiiri lähedal olev ticker
// alla ja ilmub MÕLEMAL lehel. `collect.ts` teeb `apeRows.map()`-iga ühe
// `collection_run_items` kirje iga rea kohta, seega duplikaatne rida andis
// duplikaatse batch-kirje ja `recordCollectionRunItems` guard viskas:
//   "Collection run item batch sisaldab duplikaati: 5:OPEN."
//
// Päris mõõtmine 2026-08-19: 200 rida, 195 unikaalset
// (GLP 87 -> 101, EU 86 -> 102, MSS 85 -> 103, XYZ 84 -> 104, CDNL 83 -> 105).

interface StubRow {
  rank: number;
  ticker: string;
  mentions?: number;
  mentions_24h_ago?: number | null;
}

// Stub'ib ApeWisdomi lehed. Tundmatu URL viskab valjult, seega ükski test ei
// saa kogemata päris võrku puutuda.
function stubPages(pages: Record<number, StubRow[]>): { calls: string[] } {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (input: unknown): Promise<Response> => {
    const url = String(input);
    calls.push(url);
    const match = url.match(/\/page\/(\d+)$/);
    if (!match) throw new Error(`Testis tehti ootamatu võrgupäring: ${url}`);
    const rows = pages[Number(match[1])] ?? [];
    return new Response(JSON.stringify({
      results: rows.map((row) => ({
        rank: row.rank,
        ticker: row.ticker,
        name: `${row.ticker} Inc.`,
        mentions: row.mentions ?? 10,
        upvotes: 1,
        rank_24h_ago: null,
        mentions_24h_ago: row.mentions_24h_ago ?? null,
      })),
      pages: Object.keys(pages).length,
      count: Object.values(pages).reduce((sum, list) => sum + list.length, 0),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  return { calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchApeWisdom dedup', () => {
  it('sama ticker mõlemal lehel ei anna duplikaati (päris veatingimus)', async () => {
    const stub = stubPages({
      1: [{ rank: 1, ticker: 'AAA' }, { rank: 2, ticker: 'BBB' }, { rank: 3, ticker: 'OPEN' }],
      // Järjestus nihkus: OPEN lükkus lehele 2 ja ilmub teist korda.
      2: [{ rank: 4, ticker: 'OPEN' }, { rank: 5, ticker: 'CCC' }],
    });

    const result = await fetchApeWisdom(2);
    const tickers = result.rows.map((row) => row.ticker);

    expect(stub.calls).toHaveLength(2);
    expect(result.rawRowCount).toBe(5);
    expect(result.rows).toHaveLength(4);
    expect(new Set(tickers).size).toBe(tickers.length);
    expect(tickers).toEqual(['AAA', 'BBB', 'OPEN', 'CCC']);
  });

  it('esimene esinemine võidab: alles jääb lehe 1 rida', async () => {
    stubPages({
      1: [{ rank: 3, ticker: 'OPEN', mentions: 8 }],
      2: [{ rank: 101, ticker: 'OPEN', mentions: 99 }],
    });

    const result = await fetchApeWisdom(2);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].rank).toBe(3);
    expect(result.rows[0].mentions).toBe(8);
  });

  it('dedupib ka sama lehe sees korduva tickeri', async () => {
    stubPages({ 1: [{ rank: 1, ticker: 'DUP' }, { rank: 2, ticker: 'DUP' }] });

    const result = await fetchApeWisdom(1);

    expect(result.rawRowCount).toBe(2);
    expect(result.rows).toHaveLength(1);
  });

  it('normaliseerib enne dedupi: trim + uppercase kollapsuvad ühte võtmesse', async () => {
    stubPages({ 1: [{ rank: 1, ticker: 'open' }, { rank: 2, ticker: ' OPEN ' }] });

    const result = await fetchApeWisdom(1);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].ticker).toBe('OPEN');
  });

  it('duplikaadivaba sisend jääb puutumata ja rawRowCount võrdub ridade arvuga', async () => {
    stubPages({
      1: [{ rank: 1, ticker: 'AAA' }, { rank: 2, ticker: 'BBB' }],
      2: [{ rank: 3, ticker: 'CCC' }],
    });

    const result = await fetchApeWisdom(2);

    expect(result.rawRowCount).toBe(3);
    expect(result.rows).toHaveLength(3);
    expect(result.rawRowCount).toBe(result.rows.length);
  });
});
