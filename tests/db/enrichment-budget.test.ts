import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../../src/lib/db';
import {
  DAILY_FINANCIAL_ENRICHMENT_LIMIT,
  ensureFinancialSchema,
  enrichStoredCompanyFinancials,
} from '../../src/lib/company-financials';
import { insertCompany } from '../fixtures/company';
import { insertPriceSnapshot } from '../fixtures/price';
import {
  ago,
  insertEnrichmentStatus,
  insertFinancialFact,
  readEnrichmentStatus,
  resetFactKeys,
  tallinnDayStart,
} from '../fixtures/enrichment';
import { paddedCik, stubSecFetch, type SecTickerEntry } from '../fixtures/sec';
import { resetDb } from '../setup/reset';

// E-blokk: enrichment-budget, retry ja unavailable aken.
//
// Testitav loogika: src/lib/company-financials.ts
//   enrichStoredCompanyFinancials  :627-699
//   financialEnrichmentQueue       :544-583  (eligibility + retry + järjestus)
//   enrichmentAttemptsToday        :585-594  (Tallinna päeva eelarve)
//   saveEnrichmentAttempt          :596-621  (staatuse UPSERT)
//
// Slice 1 EI kata success-teed: see nõuab kehtivat CompanyFacts JSON-i ja on
// eraldi töö. Kõik siinsed tulemused on `unavailable` või `error`:
//   unavailable = ticker puudub SEC ticker-map'ist (:355-356 → null)
//   error       = ticker on map'is, aga companyfacts vastab non-ok (:364 viskab)

// ÜKS ticker-map kogu faili peale. `tickerMapCache` on mooduli tasemel ja
// 24-tunnise elueaga (:339-347), seega esimene päring cache'itakse protsessi
// eluajaks. Kui iga test defineeriks oma map'i, kasutaksid hilisemad testid
// vaikselt esimese oma. Seetõttu: kõik leitavad tickerid siin, ja üks
// teadlikult puuduv.
const TICKER_MAP: SecTickerEntry[] = [
  { ticker: 'AAA', cik: 100 },
  { ticker: 'BBB', cik: 200 },
  { ticker: 'CCC', cik: 300 },
  { ticker: 'DDD', cik: 400 },
  { ticker: 'EEE', cik: 500 },
  { ticker: 'FFF', cik: 600 },
];
const ABSENT_TICKER = 'ZZZZ';

// Fikseeritud ajatemplid, arvutatud ÜKS kord faili laadimisel. Kui iga kutse
// arvutaks oma templi, saaksid hiljem loodud ettevõtted värskema hinna ja
// `ORDER BY prices.latest_price_at DESC` (:577) muudaks järjestuse
// mitte-deterministlikuks.
const FRESH_AT = new Date(Date.now() - 86_400_000).toISOString();
const STALE_AT = new Date(Date.now() - 40 * 86_400_000).toISOString();

const USER_AGENT = 'stock-discovery-test/1.0 test@example.com';

let originalUserAgent: string | undefined;

async function seedCompany(
  ticker: string,
  options: { quoteType?: string | null; price?: 'fresh' | 'stale' | 'none' } = {},
): Promise<number> {
  const companyId = await insertCompany(ticker, { quoteType: options.quoteType ?? null });
  const price = options.price ?? 'fresh';
  if (price === 'fresh') await insertPriceSnapshot(companyId, 100, FRESH_AT);
  if (price === 'stale') await insertPriceSnapshot(companyId, 100, STALE_AT);
  return companyId;
}

async function countStatusRows(): Promise<number> {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM financial_enrichment_status');
  return rows[0].n;
}

beforeEach(async () => {
  // `financial_enrichment_status` kuulub `ensureFinancialSchema()`-le, mitte
  // `ensureSchema()`-le. Loome selle ENNE resetDb-d, et truncate kataks ka selle.
  await ensureFinancialSchema();
  await resetDb();
  resetFactKeys();
  originalUserAgent = process.env.SEC_USER_AGENT;
  process.env.SEC_USER_AGENT = USER_AGENT;
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalUserAgent === undefined) delete process.env.SEC_USER_AGENT;
  else process.env.SEC_USER_AGENT = originalUserAgent;
});

describe('E1 — SEC_USER_AGENT värav', () => {
  it('ilma User-Agentita on tulemus disabled ja võrku ei puututa', async () => {
    delete process.env.SEC_USER_AGENT;
    const stub = stubSecFetch({ tickerMap: TICKER_MAP });
    await seedCompany('AAA');

    const result = await enrichStoredCompanyFinancials();

    expect(result.status).toBe('disabled');
    expect(result.attempted).toBe(0);
    expect(result.enriched).toBe(0);
    expect(result.dailyLimit).toBe(DAILY_FINANCIAL_ENRICHMENT_LIMIT);
    expect(result.dailyRemaining).toBe(DAILY_FINANCIAL_ENRICHMENT_LIMIT);
    expect(result.coveredBefore).toBe(result.coveredAfter);
    expect(await countStatusRows()).toBe(0);
    expect(stub.calls).toHaveLength(0);
  });

  it('User-Agentiga aga tühja universumiga on tulemus completed', async () => {
    stubSecFetch({ tickerMap: TICKER_MAP });
    const result = await enrichStoredCompanyFinancials();

    expect(result.status).toBe('completed');
    expect(result.attempted).toBe(0);
    expect(result.financialUniverse).toBe(0);
    expect(await countStatusRows()).toBe(0);
  });
});

describe('E2 — päevane eelarve ja Tallinna päevapiir', () => {
  it('vaikimisi päevalimiit on 5', async () => {
    stubSecFetch({ tickerMap: TICKER_MAP });
    const result = await enrichStoredCompanyFinancials();
    expect(result.dailyLimit).toBe(5);
    expect(DAILY_FINANCIAL_ENRICHMENT_LIMIT).toBe(5);
  });

  it('kuus kõlblikku ettevõtet annab täpselt viis katset', async () => {
    stubSecFetch({ tickerMap: TICKER_MAP });
    for (const ticker of ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF']) {
      await seedCompany(ticker);
    }

    const result = await enrichStoredCompanyFinancials();

    expect(result.attempted).toBe(5);
    expect(result.dailyRemaining).toBe(0);
    // Järjestus: kõik faktideta ja kunagi proovimata, hinnad identsed → ticker ASC.
    expect([...result.attemptedTickers].sort()).toEqual(['AAA', 'BBB', 'CCC', 'DDD', 'EEE']);
    expect(await countStatusRows()).toBe(5);
  });

  it('kolm tänast katset jätab eelarvest kaks alles', async () => {
    stubSecFetch({ tickerMap: TICKER_MAP });
    // Kolm juba täna proovitud ettevõtet, mis on universumist väljas (aegunud
    // hind), et nad ei konkureeriks queue's — eelarve loendur ei filtreeri
    // universumi järgi (:585-594).
    for (const ticker of ['DDD', 'EEE', 'FFF']) {
      const id = await seedCompany(ticker, { price: 'stale' });
      await insertEnrichmentStatus(id, { status: 'error', lastAttempt: tallinnDayStart('+1 minute') });
    }
    for (const ticker of ['AAA', 'BBB', 'CCC']) {
      await seedCompany(ticker);
    }

    const result = await enrichStoredCompanyFinancials();

    expect(result.attemptedTodayBefore).toBe(3);
    expect(result.attempted).toBe(2);
    expect(result.dailyRemaining).toBe(0);
  });

  it('viis tänast katset annab null katset ja null võrgupäringut', async () => {
    const stub = stubSecFetch({ tickerMap: TICKER_MAP });
    for (const ticker of ['BBB', 'CCC', 'DDD', 'EEE', 'FFF']) {
      const id = await seedCompany(ticker, { price: 'stale' });
      await insertEnrichmentStatus(id, { status: 'error', lastAttempt: tallinnDayStart('+1 minute') });
    }
    await seedCompany('AAA');

    const result = await enrichStoredCompanyFinancials();

    expect(result.attemptedTodayBefore).toBe(5);
    expect(result.attempted).toBe(0);
    expect(result.dailyRemaining).toBe(0);
    expect(stub.calls).toHaveLength(0);
  });

  it('EELMISE Tallinna päeva katsed ei kuluta tänast eelarvet', async () => {
    stubSecFetch({ tickerMap: TICKER_MAP });
    for (const ticker of ['BBB', 'CCC', 'DDD', 'EEE', 'FFF']) {
      const id = await seedCompany(ticker, { price: 'stale' });
      await insertEnrichmentStatus(id, { status: 'error', lastAttempt: tallinnDayStart('-1 hour') });
    }
    await seedCompany('AAA');

    const result = await enrichStoredCompanyFinancials();

    expect(result.attemptedTodayBefore).toBe(0);
    expect(result.attempted).toBe(1);
    expect(result.attemptedTickers).toEqual(['AAA']);
    expect(result.dailyRemaining).toBe(4);
  });

  it('TÄNASE Tallinna päeva katsed kuluvad eelarvest', async () => {
    stubSecFetch({ tickerMap: TICKER_MAP });
    const id = await seedCompany('BBB', { price: 'stale' });
    await insertEnrichmentStatus(id, { status: 'error', lastAttempt: tallinnDayStart('+1 minute') });
    await seedCompany('AAA');

    const result = await enrichStoredCompanyFinancials();

    expect(result.attemptedTodayBefore).toBe(1);
    expect(result.attempted).toBe(1);
    expect(result.dailyRemaining).toBe(3);
  });

  const clampCases: Array<[number, number]> = [
    [0, 5],
    [-3, 1],
    [100, 20],
    [2.9, 2],
  ];

  it.each(clampCases)('limiit %s klambritakse väärtusele %s', async (limit, expected) => {
    stubSecFetch({ tickerMap: TICKER_MAP });
    const result = await enrichStoredCompanyFinancials(limit);
    expect(result.dailyLimit).toBe(expected);
  });
});

describe('E3 — universumi filtrid', () => {
  it('SPY jäetakse välja', async () => {
    stubSecFetch({ tickerMap: TICKER_MAP });
    await seedCompany('SPY');
    const result = await enrichStoredCompanyFinancials();
    expect(result.attempted).toBe(0);
    expect(result.financialUniverse).toBe(0);
  });

  it('ETF jäetakse välja', async () => {
    stubSecFetch({ tickerMap: TICKER_MAP });
    await seedCompany('AAA', { quoteType: 'ETF' });
    const result = await enrichStoredCompanyFinancials();
    expect(result.attempted).toBe(0);
    expect(result.financialUniverse).toBe(0);
  });

  it('üle 30 päeva vanune hind jätab ettevõtte universumist välja', async () => {
    stubSecFetch({ tickerMap: TICKER_MAP });
    await seedCompany('AAA', { price: 'stale' });
    const result = await enrichStoredCompanyFinancials();
    expect(result.attempted).toBe(0);
    expect(result.financialUniverse).toBe(0);
  });

  it('hinnasnapshotita ettevõte jäetakse välja', async () => {
    stubSecFetch({ tickerMap: TICKER_MAP });
    await seedCompany('AAA', { price: 'none' });
    const result = await enrichStoredCompanyFinancials();
    expect(result.attempted).toBe(0);
  });

  it('värske hind ja faktide puudumine teeb ettevõtte kõlblikuks', async () => {
    stubSecFetch({ tickerMap: TICKER_MAP });
    await seedCompany('AAA');
    const result = await enrichStoredCompanyFinancials();
    expect(result.attempted).toBe(1);
    expect(result.financialUniverse).toBe(1);
  });
});

describe('E4 — error retry, 1 päev', () => {
  it('kaks tundi tagasi ebaõnnestunut ei proovita uuesti', async () => {
    stubSecFetch({ tickerMap: TICKER_MAP });
    const id = await seedCompany('AAA');
    await insertEnrichmentStatus(id, { status: 'error', lastAttempt: ago('2 hours') });

    const result = await enrichStoredCompanyFinancials();
    expect(result.attempted).toBe(0);
  });

  it('25 tundi tagasi ebaõnnestunut proovitakse uuesti', async () => {
    stubSecFetch({ tickerMap: TICKER_MAP });
    const id = await seedCompany('AAA');
    await insertEnrichmentStatus(id, { status: 'error', lastAttempt: ago('25 hours') });

    const result = await enrichStoredCompanyFinancials();
    expect(result.attempted).toBe(1);
    expect(result.failed).toBe(1);
  });

  it('consecutive_failures kasvab järjestikuse veaga', async () => {
    stubSecFetch({ tickerMap: TICKER_MAP });
    const id = await seedCompany('AAA');
    await insertEnrichmentStatus(id, {
      status: 'error',
      lastAttempt: ago('25 hours'),
      consecutiveFailures: 1,
    });

    await enrichStoredCompanyFinancials();

    const status = await readEnrichmentStatus(id);
    expect(status.status).toBe('error');
    expect(status.consecutive_failures).toBe(2);
  });

  it('last_error salvestab SEC vastuse staatuse', async () => {
    stubSecFetch({
      tickerMap: TICKER_MAP,
      companyFacts: { [paddedCik(100)]: { status: 500 } },
    });
    const id = await seedCompany('AAA');

    const result = await enrichStoredCompanyFinancials();

    expect(result.failed).toBe(1);
    const status = await readEnrichmentStatus(id);
    expect(status.status).toBe('error');
    expect(String(status.last_error)).toContain('500');
  });

  it('last_error truncates to 500 Unicode characters without splitting a surrogate pair', async () => {
    const longMessage = `${'A'.repeat(499)}🚀TAIL`;
    stubSecFetch({
      tickerMap: TICKER_MAP,
      companyFacts: { [paddedCik(100)]: { error: new Error(longMessage) } },
    });
    const id = await seedCompany('AAA');

    const result = await enrichStoredCompanyFinancials();

    expect(result.failed).toBe(1);
    const status = await readEnrichmentStatus(id);
    const stored = String(status.last_error);
    expect(Array.from(stored)).toHaveLength(500);
    expect(stored).toBe(`${'A'.repeat(499)}🚀`);
    expect(stored.endsWith('🚀')).toBe(true);
    expect(stored).not.toContain('TAIL');
  });
});

describe('E5 — unavailable aken, 30 päeva', () => {
  it('kaks päeva tagasi unavailable ei muutu kõlblikuks (1-päevane reegel ei kehti)', async () => {
    stubSecFetch({ tickerMap: TICKER_MAP });
    const id = await seedCompany('AAA');
    await insertEnrichmentStatus(id, { status: 'unavailable', lastAttempt: ago('2 days') });

    const result = await enrichStoredCompanyFinancials();
    expect(result.attempted).toBe(0);
  });

  it('29 päeva tagasi unavailable ei ole veel kõlblik', async () => {
    stubSecFetch({ tickerMap: TICKER_MAP });
    const id = await seedCompany('AAA');
    await insertEnrichmentStatus(id, { status: 'unavailable', lastAttempt: ago('29 days') });

    const result = await enrichStoredCompanyFinancials();
    expect(result.attempted).toBe(0);
  });

  it('31 päeva tagasi unavailable on jälle kõlblik', async () => {
    stubSecFetch({ tickerMap: TICKER_MAP });
    const id = await seedCompany('AAA');
    await insertEnrichmentStatus(id, { status: 'unavailable', lastAttempt: ago('31 days') });

    const result = await enrichStoredCompanyFinancials();
    expect(result.attempted).toBe(1);
  });

  it('unavailable tulemus säilitab varasema last_success_at ja nullib vealoenduri', async () => {
    stubSecFetch({ tickerMap: TICKER_MAP });
    // SEC ticker-map'ist puuduv ticker → refresh tagastab null → unavailable.
    const id = await seedCompany(ABSENT_TICKER);
    await insertEnrichmentStatus(id, {
      status: 'error',
      lastAttempt: ago('31 days'),
      lastSuccess: ago('40 days'),
      consecutiveFailures: 3,
    });
    const before = await readEnrichmentStatus(id);

    const result = await enrichStoredCompanyFinancials();

    expect(result.unavailable).toBe(1);
    const after = await readEnrichmentStatus(id);
    expect(after.status).toBe('unavailable');
    expect(after.consecutive_failures).toBe(0);
    expect(new Date(after.last_success_at).toISOString())
      .toBe(new Date(before.last_success_at).toISOString());
  });
});

describe('E6 — stale-facts haru, 7 päeva', () => {
  it('kolm päeva vanad faktid ei tee ettevõtet kõlblikuks', async () => {
    stubSecFetch({ tickerMap: TICKER_MAP });
    const id = await seedCompany('AAA');
    await insertFinancialFact(id, { updatedAt: ago('3 days') });
    await insertEnrichmentStatus(id, { status: 'success', lastAttempt: ago('2 days') });

    const result = await enrichStoredCompanyFinancials();
    expect(result.attempted).toBe(0);
  });

  it('kaheksa päeva vanad faktid teevad ettevõtte kõlblikuks', async () => {
    stubSecFetch({ tickerMap: TICKER_MAP });
    const id = await seedCompany('AAA');
    await insertFinancialFact(id, { updatedAt: ago('8 days') });
    await insertEnrichmentStatus(id, { status: 'success', lastAttempt: ago('2 days') });

    const result = await enrichStoredCompanyFinancials();
    expect(result.attempted).toBe(1);
  });

  it('1-päevane cooldown kehtib ka stale-facts harule', async () => {
    stubSecFetch({ tickerMap: TICKER_MAP });
    const id = await seedCompany('AAA');
    await insertFinancialFact(id, { updatedAt: ago('8 days') });
    await insertEnrichmentStatus(id, { status: 'success', lastAttempt: ago('2 hours') });

    const result = await enrichStoredCompanyFinancials();
    expect(result.attempted).toBe(0);
  });

  it('ASÜMMEETRIA: stale faktidega unavailable proovitakse juba päeva pärast', async () => {
    // Teine OR-haru (:569-572) EI kontrolli `status`-t, seega 30-päevane
    // unavailable aken kehtib ainult faktideta ettevõtetele. Faktidega
    // ettevõttel piisab 1-päevasest cooldown'ist.
    stubSecFetch({ tickerMap: TICKER_MAP });
    const id = await seedCompany('AAA');
    await insertFinancialFact(id, { updatedAt: ago('8 days') });
    await insertEnrichmentStatus(id, { status: 'unavailable', lastAttempt: ago('2 days') });

    const result = await enrichStoredCompanyFinancials();
    expect(result.attempted).toBe(1);
  });
});

describe('E7 — queue järjekord', () => {
  it('faktideta ettevõte on stale-faktidega ettevõttest eespool', async () => {
    stubSecFetch({ tickerMap: TICKER_MAP });
    const withStaleFacts = await seedCompany('AAA');
    await insertFinancialFact(withStaleFacts, { updatedAt: ago('8 days') });
    await insertEnrichmentStatus(withStaleFacts, { status: 'success', lastAttempt: ago('2 days') });
    await seedCompany('BBB');

    const result = await enrichStoredCompanyFinancials(1);
    expect(result.attemptedTickers).toEqual(['BBB']);
  });

  it('kunagi proovimata on varem proovitust eespool', async () => {
    stubSecFetch({ tickerMap: TICKER_MAP });
    const tried = await seedCompany('AAA');
    await insertEnrichmentStatus(tried, { status: 'error', lastAttempt: ago('25 hours') });
    await seedCompany('BBB');

    const result = await enrichStoredCompanyFinancials(1);
    expect(result.attemptedTickers).toEqual(['BBB']);
  });

  it('varem proovitute seast valitakse vanim katse', async () => {
    stubSecFetch({ tickerMap: TICKER_MAP });
    const recent = await seedCompany('AAA');
    await insertEnrichmentStatus(recent, { status: 'error', lastAttempt: ago('25 hours') });
    const oldest = await seedCompany('BBB');
    await insertEnrichmentStatus(oldest, { status: 'error', lastAttempt: ago('40 days') });

    const result = await enrichStoredCompanyFinancials(1);
    expect(result.attemptedTickers).toEqual(['BBB']);
  });
});

describe('E8 — tulemuse kuju ja veataluvus', () => {
  it('segapartii loendab unavailable ja failed eraldi', async () => {
    stubSecFetch({ tickerMap: TICKER_MAP });
    await seedCompany('AAA');
    await seedCompany(ABSENT_TICKER);

    const result = await enrichStoredCompanyFinancials();

    expect(result.attempted).toBe(2);
    expect(result.enriched).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.unavailable).toBe(1);
    expect(result.failedTickers).toEqual(['AAA']);
    expect(result.unavailableTickers).toEqual([ABSENT_TICKER]);
    expect([...result.attemptedTickers].sort()).toEqual(['AAA', ABSENT_TICKER]);
  });

  it('ühe tickeri viga ei nurja kogu jooksu', async () => {
    stubSecFetch({
      tickerMap: TICKER_MAP,
      companyFacts: { [paddedCik(100)]: { status: 500 } },
    });
    const failing = await seedCompany('AAA');
    const other = await seedCompany(ABSENT_TICKER);

    const result = await enrichStoredCompanyFinancials();

    expect(result.attempted).toBe(2);
    // Mõlemad said staatuserea: jooks ei katkenud esimese vea peale.
    expect(await countStatusRows()).toBe(2);
    expect((await readEnrichmentStatus(failing)).status).toBe('error');
    expect((await readEnrichmentStatus(other)).status).toBe('unavailable');
  });

  it('katvuse loendurid kajastavad universumi päringut', async () => {
    stubSecFetch({ tickerMap: TICKER_MAP });
    await seedCompany('AAA');
    await seedCompany('BBB');
    const covered = await seedCompany('CCC');
    // Värsked faktid → kaetud, aga mitte kõlblik (alla 7 päeva).
    await insertFinancialFact(covered, { updatedAt: ago('3 days') });

    const result = await enrichStoredCompanyFinancials();

    expect(result.financialUniverse).toBe(3);
    expect(result.coveredBefore).toBe(1);
    // Slice 1-s ei ole ühtki success-teed, seega katvus ei kasva.
    expect(result.coveredAfter).toBe(1);
    expect(result.attempted).toBe(2);
  });
});
