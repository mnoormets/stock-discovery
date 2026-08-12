import { vi } from 'vitest';

// SEC võrgukihi stub. Seam on GLOBAALNE `fetch`, mitte mooduli piir:
// `getSecIdentity` ja `fetchCompanyFacts` on `company-financials.ts`-i
// privaatsed funktsioonid ja neid kutsutakse lokaalse sidumise kaudu, mida
// mooduli-mock ESM-is kinni ei püüa. `globalThis.fetch` katab kogu ahela ilma
// ühtki `src/` faili muutmata.
//
// Ükski test ei tee päris võrgupäringut: tundmatu URL viskab valjult erindi.

export interface SecTickerEntry {
  ticker: string;
  // Toores CIK ilma nullidega täitmist; `getSecIdentity` teeb
  // String(cik_str).padStart(10, '0').
  cik: number;
  title?: string;
}

export function paddedCik(cik: number): string {
  return String(cik).padStart(10, '0');
}

// `company_tickers.json` kuju: objekt indeksvõtmetega, mille väärtustel on
// `cik_str`, `ticker` ja `title` (company-financials.ts:346-349).
export function secTickerMap(entries: SecTickerEntry[]): Record<string, unknown> {
  return Object.fromEntries(entries.map((entry, index) => [
    String(index),
    { cik_str: entry.cik, ticker: entry.ticker, title: entry.title ?? `${entry.ticker} Inc.` },
  ]));
}

export interface CompanyFactsStub {
  status?: number;
  body?: unknown;
}

export interface SecStubOptions {
  tickerMap: SecTickerEntry[];
  tickerMapStatus?: number;
  // Võti on nullidega täidetud CIK, nagu URL-is.
  companyFacts?: Record<string, CompanyFactsStub>;
}

export interface SecStub {
  calls: string[];
  tickerMapCalls: () => number;
  companyFactsCalls: () => number;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function stubSecFetch(options: SecStubOptions): SecStub {
  const calls: string[] = [];
  const map = secTickerMap(options.tickerMap);

  vi.stubGlobal('fetch', async (input: unknown): Promise<Response> => {
    const url = typeof input === 'string' ? input : String((input as { url?: string })?.url ?? input);
    calls.push(url);

    if (url.includes('company_tickers.json')) {
      return json(options.tickerMapStatus ?? 200, map);
    }

    const match = url.match(/companyfacts\/CIK(\d+)\.json/);
    if (match) {
      const stub = options.companyFacts?.[match[1]];
      // Stub'imata CIK annab 404 → `fetchCompanyFacts` viskab (rida 364) →
      // enrichment-tulemus on `error`. See on Slice 1 vaikimisi veatee.
      if (!stub) return json(404, { error: 'companyfacts not stubbed' });
      return json(stub.status ?? 200, stub.body ?? {});
    }

    throw new Error(`Testis tehti ootamatu võrgupäring: ${url}`);
  });

  return {
    calls,
    tickerMapCalls: () => calls.filter((url) => url.includes('company_tickers.json')).length,
    companyFactsCalls: () => calls.filter((url) => url.includes('companyfacts')).length,
  };
}
