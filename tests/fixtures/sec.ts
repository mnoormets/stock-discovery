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
  error?: Error;
}

// --- CompanyFacts KEHA ehitaja (success-path) ------------------------------
//
// Senised testid kasutasid ainult veeteid (404 / 500). Success-path vajab
// päris `facts.<taxonomy>.<Tag>.units.<unit>[]` struktuuri.
//
// Iga väli on TEADLIKULT valikuline, sest `extractDefinition` (company-financials.ts:247)
// jätab rea vahele, kui `val` / `end` / `filed` / `accn` / `form` / `periodKind`
// ei kvalifitseeru. E9.5 alamjuhtumid ehitatakse just väljade ÄRAJÄTMISEGA.
//
// NB: `val: null` EI ole "puuduv väärtus" — `Number(null) === 0` läbib filtri.
// Puuduva väärtuse simuleerimiseks jäta võti hoopis ära.
export interface FactUnitOptions {
  val?: unknown;
  start?: string;
  end?: string;
  filed?: string;
  accn?: unknown;
  form?: string;
  fy?: unknown;
  fp?: unknown;
}

export interface ConceptOptions {
  taxonomy?: 'us-gaap' | 'dei';
  unit?: string;
  units: FactUnitOptions[];
}

// Ehitab CompanyFacts keha kontseptide kaardist: tag -> ühikud.
// Näide: companyFactsBody({ CashAndCashEquivalentsAtCarryingValue: { units: [cashUnit()] } })
export function companyFactsBody(
  concepts: Record<string, ConceptOptions>,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const facts: Record<string, Record<string, unknown>> = {};
  for (const [tag, concept] of Object.entries(concepts)) {
    const taxonomy = concept.taxonomy ?? 'us-gaap';
    const unit = concept.unit ?? (taxonomy === 'dei' ? 'shares' : 'USD');
    facts[taxonomy] = facts[taxonomy] ?? {};
    facts[taxonomy][tag] = { units: { [unit]: concept.units } };
  }
  return { facts, ...overrides };
}

// Minimaalne kvalifitseeruv INSTANT kirje (`duration: false` -> periodKind on
// alati 'instant', seega `start` ei ole vajalik). Viis välja = üks salvestatav rida.
export function instantUnit(overrides: FactUnitOptions = {}): FactUnitOptions {
  return {
    val: 500,
    end: '2025-12-31',
    filed: '2026-02-01',
    accn: '0000000000-26-000001',
    form: '10-K',
    ...overrides,
  };
}

// Minimaalne kvalifitseeruv DURATION kirje. 2025-01-01 -> 2025-12-31 = 364
// päeva, mis on >= 300 ja <= 430, seega periodKind = 'annual'.
export function durationUnit(overrides: FactUnitOptions = {}): FactUnitOptions {
  return {
    val: 1_000,
    start: '2025-01-01',
    end: '2025-12-31',
    filed: '2026-02-01',
    accn: '0000000000-26-000001',
    form: '10-K',
    ...overrides,
  };
}

// Kõige lihtsam täielik success-keha: üks `cash` fakt -> üks financial_facts rida.
export function minimalCashFacts(unit: FactUnitOptions = {}): Record<string, unknown> {
  return companyFactsBody({
    CashAndCashEquivalentsAtCarryingValue: { units: [instantUnit(unit)] },
  });
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
      if (stub.error) throw stub.error;
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
