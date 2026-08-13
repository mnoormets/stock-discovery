import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../../src/lib/db';
import {
  ensureFinancialSchema,
  enrichStoredCompanyFinancials,
} from '../../src/lib/company-financials';
import { insertCompany } from '../fixtures/company';
import { insertPriceSnapshot } from '../fixtures/price';
import { readEnrichmentStatus, resetFactKeys } from '../fixtures/enrichment';
import {
  companyFactsBody,
  durationUnit,
  instantUnit,
  minimalCashFacts,
  paddedCik,
  stubSecFetch,
  type SecTickerEntry,
} from '../fixtures/sec';
import { resetDb } from '../setup/reset';

// E9-plokk: enrichment SUCCESS-tee. Täiendab E-plokki (enrichment-budget),
// mis katab teadlikult ainult `unavailable` ja `error` teed.
//
// Testitav loogika: src/lib/company-financials.ts
//   extractDefinition / extractMetricPoints :232-287  (mis kvalifitseerub faktiks)
//   saveFacts                               :368-409  (companies upsert + facts INSERT)
//   refreshCompanyFinancialsUncached        :701-712  (ekstraktsioon → salvestus → readStored)
//   financialUniverseCoverage               :524-542  (coveredBefore/After)
//
// Võtmekäitumine, mida siin lukku pannakse: `saveFacts` jookseb ka TÜHJA
// punktimassiiviga, seega `sec_cik` kirjutatakse ka siis, kui ühtki fakti ei
// ekstraheeritud — ja `readStored` tagastab null → tulemus on `unavailable`.

// ÜKS ticker-map kogu faili peale: `tickerMapCache` on mooduli tasemel ja
// 24-tunnise elueaga, seega esimene päring cache'itakse protsessi eluajaks.
const TICKER_MAP: SecTickerEntry[] = [
  { ticker: 'AAA', cik: 100 },
  { ticker: 'BBB', cik: 200 },
];

const FRESH_AT = new Date(Date.now() - 86_400_000).toISOString();
const USER_AGENT = 'stock-discovery-test/1.0 test@example.com';

// `instantUnit()` vaikeväärtustest tuletatud ootused. Hoitakse siin, et
// fixture'i ja testi ootused ei saaks vaikselt lahku minna.
const CASH_TAG = 'CashAndCashEquivalentsAtCarryingValue';
const ACCESSION = '0000000000-26-000001';
// filingUrl (:221-223) teeb `Number(cik)` → juhtnullid kaovad, ja eemaldab
// accession-numbrist sidekriipsud.
const EXPECTED_SOURCE_URL = 'https://www.sec.gov/Archives/edgar/data/100/000000000026000001/';

let originalUserAgent: string | undefined;

async function seedCompany(ticker: string): Promise<number> {
  const companyId = await insertCompany(ticker);
  await insertPriceSnapshot(companyId, 100, FRESH_AT);
  return companyId;
}

function stubWithBody(body: unknown, cik = 100) {
  return stubSecFetch({
    tickerMap: TICKER_MAP,
    companyFacts: { [paddedCik(cik)]: { body } },
  });
}

async function readFacts(companyId: number) {
  const { rows } = await pool.query(
    `SELECT metric, value, unit,
            period_start::text AS period_start, period_end::text AS period_end,
            period_kind, fiscal_year, fiscal_period, form_type,
            filed_at::text AS filed_at, accession_number, taxonomy, tag,
            is_derived, source_url
     FROM financial_facts WHERE company_id = $1
     ORDER BY metric, period_end`,
    [companyId],
  );
  return rows;
}

async function readCompany(companyId: number) {
  const { rows } = await pool.query(
    'SELECT ticker, name, source, sec_cik FROM companies WHERE id = $1',
    [companyId],
  );
  return rows[0];
}

beforeEach(async () => {
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

describe('E9.1 — success: enriched = 1', () => {
  it('tagastab completed ja loeb ettevõtte rikastatuks', async () => {
    stubWithBody(minimalCashFacts());
    await seedCompany('AAA');

    const result = await enrichStoredCompanyFinancials();

    expect(result.status).toBe('completed');
    expect(result.attempted).toBe(1);
    expect(result.enriched).toBe(1);
    expect(result.unavailable).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.attemptedTickers).toEqual(['AAA']);
    expect(result.unavailableTickers).toEqual([]);
    expect(result.failedTickers).toEqual([]);
  });

  it('salvestab enrichment-staatuse success ja nullib vealoenduri', async () => {
    stubWithBody(minimalCashFacts());
    const companyId = await seedCompany('AAA');

    await enrichStoredCompanyFinancials();

    const status = await readEnrichmentStatus(companyId);
    expect(status.status).toBe('success');
    expect(status.last_success_at).not.toBeNull();
    expect(status.consecutive_failures).toBe(0);
    expect(status.last_error).toBeNull();
  });

  it('kulutab päevaeelarvest täpselt ühe katse', async () => {
    stubWithBody(minimalCashFacts());
    await seedCompany('AAA');

    const result = await enrichStoredCompanyFinancials();

    expect(result.attemptedTodayBefore).toBe(0);
    expect(result.dailyRemaining).toBe(result.dailyLimit - 1);
  });
});

describe('E9.2 — financial_facts read tekivad', () => {
  it('loob täpselt ühe rea minimaalsest cash-faktist', async () => {
    stubWithBody(minimalCashFacts());
    const companyId = await seedCompany('AAA');

    await enrichStoredCompanyFinancials();

    const facts = await readFacts(companyId);
    expect(facts).toHaveLength(1);
  });

  it('kaardistab kõik SEC väljad õigesti financial_facts ridadesse', async () => {
    stubWithBody(minimalCashFacts());
    const companyId = await seedCompany('AAA');

    await enrichStoredCompanyFinancials();

    const [fact] = await readFacts(companyId);
    expect(fact.metric).toBe('cash');
    expect(Number(fact.value)).toBe(500);
    expect(fact.unit).toBe('USD');
    // `duration: false` → periodStart on alati null, ka kui `start` oleks antud.
    expect(fact.period_start).toBeNull();
    expect(fact.period_end).toBe('2025-12-31');
    expect(fact.period_kind).toBe('instant');
    expect(fact.form_type).toBe('10-K');
    expect(fact.filed_at).toBe('2026-02-01');
    expect(fact.accession_number).toBe(ACCESSION);
    expect(fact.taxonomy).toBe('us-gaap');
    expect(fact.tag).toBe(CASH_TAG);
    expect(fact.is_derived).toBe(false);
    expect(fact.source_url).toBe(EXPECTED_SOURCE_URL);
  });

  it('jätab fy/fp puudumisel fiscal-väljad NULL-iks', async () => {
    stubWithBody(minimalCashFacts());
    const companyId = await seedCompany('AAA');

    await enrichStoredCompanyFinancials();

    const [fact] = await readFacts(companyId);
    expect(fact.fiscal_year).toBeNull();
    expect(fact.fiscal_period).toBeNull();
  });

  it('salvestab duration-mõõdiku annual perioodina koos period_start-iga', async () => {
    stubWithBody(companyFactsBody({
      RevenueFromContractWithCustomerExcludingAssessedTax: { units: [durationUnit()] },
    }));
    const companyId = await seedCompany('AAA');

    await enrichStoredCompanyFinancials();

    const [fact] = await readFacts(companyId);
    expect(fact.metric).toBe('revenue');
    expect(fact.period_kind).toBe('annual');
    expect(fact.period_start).toBe('2025-01-01');
    expect(fact.period_end).toBe('2025-12-31');
  });

  it('on idempotentne: sama vastuse kordustöötlus ei loo duplikaatridu', async () => {
    stubWithBody(minimalCashFacts());
    const companyId = await seedCompany('AAA');

    await enrichStoredCompanyFinancials();
    // Teine jooks samale ettevõttele: eelmine katse jättis staatuse `success`,
    // seega järjekord ei paku teda enam — kutsume refreshi kaudu uuesti.
    const { refreshCompanyFinancials } = await import('../../src/lib/company-financials');
    await refreshCompanyFinancials('AAA');

    const facts = await readFacts(companyId);
    expect(facts).toHaveLength(1);
  });
});

describe('E9.3 — companies.sec_cik täidetakse', () => {
  it('kirjutab nullidega täidetud CIK-i tühjale väljale', async () => {
    stubWithBody(minimalCashFacts());
    const companyId = await seedCompany('AAA');
    expect((await readCompany(companyId)).sec_cik).toBeNull();

    await enrichStoredCompanyFinancials();

    expect((await readCompany(companyId)).sec_cik).toBe(paddedCik(100));
  });

  it('ei kirjuta üle olemasolevat nime ega allikat', async () => {
    stubWithBody(minimalCashFacts());
    const companyId = await seedCompany('AAA');

    await enrichStoredCompanyFinancials();

    const company = await readCompany(companyId);
    // `name` on COALESCE'itud (:376) ja `source` ei kuulu UPDATE hulka (:375-378).
    expect(company.name).toBe('AAA Inc.');
    expect(company.source).toBe('test');
  });
});

describe('E9.4 — coveredAfter > coveredBefore', () => {
  it('kasvatab katvust ühe võrra ühe ettevõtte universumis', async () => {
    stubWithBody(minimalCashFacts());
    await seedCompany('AAA');

    const result = await enrichStoredCompanyFinancials();

    // Universumi suurust kinnitatakse eraldi: ilma selleta läbiks test
    // valelikult ka siis, kui ettevõte üldse universumisse ei kuuluks (0 → 0).
    expect(result.financialUniverse).toBe(1);
    expect(result.coveredBefore).toBe(0);
    expect(result.coveredAfter).toBe(1);
  });
});

describe('E9.5 — 200 OK ilma ekstraheeritavate mõõdikuteta → unavailable', () => {
  const emptyBodies: Array<[string, unknown]> = [
    ['tühi objekt', {}],
    ['facts puudub sisu', { facts: {} }],
    ['taksonoomia ilma kontseptideta', { facts: { 'us-gaap': {} } }],
    ['õige tag, vale ühik', companyFactsBody({
      CashAndCashEquivalentsAtCarryingValue: { unit: 'EUR', units: [instantUnit()] },
    })],
    ['lubamatu vorm 8-K', minimalCashFacts({ form: '8-K' })],
    ['puuduv accession', minimalCashFacts({ accn: undefined })],
    ['vigane kuupäevaformaat', minimalCashFacts({ end: '2025-12' })],
    ['duration periood väljaspool 60-430 päeva akent', companyFactsBody({
      RevenueFromContractWithCustomerExcludingAssessedTax: {
        units: [durationUnit({ start: '2024-08-01', end: '2025-12-31' })],
      },
    })],
  ];

  it.each(emptyBodies)('%s → unavailable, mitte error', async (_label, body) => {
    stubWithBody(body);
    const companyId = await seedCompany('AAA');

    const result = await enrichStoredCompanyFinancials();

    expect(result.status).toBe('completed');
    expect(result.enriched).toBe(0);
    expect(result.unavailable).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.unavailableTickers).toEqual(['AAA']);
    expect(await readFacts(companyId)).toHaveLength(0);
  });

  it('salvestab staatuse unavailable ilma last_success_at-ita', async () => {
    stubWithBody({ facts: {} });
    const companyId = await seedCompany('AAA');

    await enrichStoredCompanyFinancials();

    const status = await readEnrichmentStatus(companyId);
    expect(status.status).toBe('unavailable');
    expect(status.last_success_at).toBeNull();
  });

  it('täidab sec_cik ka siis, kui ühtki fakti ei ekstraheeritud', async () => {
    stubWithBody({ facts: {} });
    const companyId = await seedCompany('AAA');

    await enrichStoredCompanyFinancials();

    // `saveFacts` jookseb ENNE `readStored`-i ja upsertib ettevõtte ka tühja
    // punktimassiiviga (:368-382). See on tahtlik käitumine, mitte kõrvalmõju.
    expect((await readCompany(companyId)).sec_cik).toBe(paddedCik(100));
  });

  it('ei kasvata katvust', async () => {
    stubWithBody({ facts: {} });
    await seedCompany('AAA');

    const result = await enrichStoredCompanyFinancials();

    expect(result.financialUniverse).toBe(1);
    expect(result.coveredBefore).toBe(0);
    expect(result.coveredAfter).toBe(0);
  });
});
