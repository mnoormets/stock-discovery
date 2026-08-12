import type {
  CompanyFinancialSummary,
  FinancialMetric,
  FinancialMetricSummary,
  FinancialPoint,
} from '../../src/lib/company-financials';

// Puhtad fixture'id score-loogika jaoks. Andmebaasi EI puudutata:
// `calculateCompanyScores` impordib ainult tüüpe (company-scores.ts:1), seega
// kogu B-blokk on DB-vaba.

let nextId = 1;

export function resetFixtureIds(): void {
  nextId = 1;
}

export function makePoint(
  metric: FinancialMetric,
  value: number,
  overrides: Partial<FinancialPoint> = {},
): FinancialPoint {
  const id = nextId++;
  return {
    id,
    metric,
    value,
    unit: 'USD',
    periodStart: '2025-01-01',
    periodEnd: '2025-12-31',
    periodKind: 'annual',
    fiscalYear: 2025,
    fiscalPeriod: 'FY',
    form: '10-K',
    filedAt: '2026-02-01',
    accessionNumber: `0000000000-26-${String(id).padStart(6, '0')}`,
    taxonomy: 'us-gaap',
    tag: metric,
    derived: false,
    sourceUrl: 'https://www.sec.gov/test',
    ...overrides,
  };
}

export interface MetricSpec {
  value: number;
  // `yearOverYearPercent` on see, mida growth-komponendid päriselt loevad.
  // Jäetakse teadlikult eraldi juhitavaks, et piirväärtusi saaks täpselt testida.
  yoy?: number | null;
  previousValue?: number | null;
  latest?: Partial<FinancialPoint>;
}

export function makeMetric(metric: FinancialMetric, spec: MetricSpec): FinancialMetricSummary {
  return {
    latest: makePoint(metric, spec.value, spec.latest),
    previousComparable: spec.previousValue == null
      ? null
      : makePoint(metric, spec.previousValue, { periodEnd: '2024-12-31', fiscalYear: 2024 }),
    yearOverYearPercent: spec.yoy === undefined ? null : spec.yoy,
  };
}

export function makeFinancials(
  specs: Partial<Record<FinancialMetric, MetricSpec>>,
  overrides: Partial<CompanyFinancialSummary> = {},
): CompanyFinancialSummary {
  const metrics: CompanyFinancialSummary['metrics'] = {};
  // Võtmete lisamise järjekord = objekti võtmete järjekord. B2 kasutab seda
  // teadlikult, et tõestada: skoor ei sõltu mõõdikute loendamisjärjekorrast.
  for (const key of Object.keys(specs) as FinancialMetric[]) {
    const spec = specs[key];
    if (spec) metrics[key] = makeMetric(key, spec);
  }
  return {
    ticker: 'TEST',
    cik: '0000000000',
    companyName: 'Test Company Inc.',
    refreshedAt: '2026-08-12T00:00:00.000Z',
    metrics,
    ...overrides,
  };
}

// Täielik tervislik profiil: kõik 4 growth- ja kõik 5 health-komponenti olemas.
export function fullyCoveredFinancials(): CompanyFinancialSummary {
  return makeFinancials({
    revenue: { value: 1_000, yoy: 0, previousValue: 1_000 },
    net_income: { value: 100, yoy: 0, previousValue: 100 },
    operating_cash_flow: { value: 200, yoy: 0, previousValue: 200 },
    free_cash_flow: { value: 150, yoy: 0, previousValue: 150 },
    cash: { value: 500, latest: { periodKind: 'instant' } },
    debt: { value: 250, latest: { periodKind: 'instant' } },
    shares_outstanding: { value: 1_000_000, yoy: 0, previousValue: 1_000_000 },
  });
}
