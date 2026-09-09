export interface OutcomeResultInput {
  ticker: string;
  status: string;
  returnPercent: number | null;
  benchmarkStatus?: string | null;
  excessReturnPercent?: number | null;
}

export interface TickerOutcomeResult {
  ticker: string;
  returnPercent: number;
}

export interface OutcomeCohortSummary {
  decisionCount: number;
  distinctTickerCount: number;
  measuredDecisionCount: number;
  measuredTickerCount: number;
  pendingCount: number;
  missingCount: number;
  unavailableCount: number;
  benchmarkMeasuredDecisionCount: number;
  benchmarkMeasuredTickerCount: number;
  tickerReturns: TickerOutcomeResult[];
  tickerExcessReturns: TickerOutcomeResult[];
}

function tickerAverages(
  rows: OutcomeResultInput[],
  value: (row: OutcomeResultInput) => number | null | undefined,
): TickerOutcomeResult[] {
  const grouped = new Map<string, number[]>();
  for (const row of rows) {
    const current = value(row);
    if (current == null || !Number.isFinite(current)) continue;
    const ticker = String(row.ticker);
    grouped.set(ticker, [...(grouped.get(ticker) || []), current]);
  }
  return [...grouped.entries()]
    .map(([ticker, values]) => ({
      ticker,
      returnPercent: values.reduce((sum, item) => sum + item, 0) / values.length,
    }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
}

export function summarizeOutcomeCohort(rows: OutcomeResultInput[]): OutcomeCohortSummary {
  const measuredRows = rows.filter((row) => row.status === 'measured' && row.returnPercent != null);
  const benchmarkMeasuredRows = measuredRows.filter((row) =>
    row.benchmarkStatus === 'measured' && row.excessReturnPercent != null,
  );
  const tickerReturns = tickerAverages(measuredRows, (row) => row.returnPercent);
  const tickerExcessReturns = tickerAverages(benchmarkMeasuredRows, (row) => row.excessReturnPercent);

  return {
    decisionCount: rows.length,
    distinctTickerCount: new Set(rows.map((row) => String(row.ticker))).size,
    measuredDecisionCount: measuredRows.length,
    measuredTickerCount: tickerReturns.length,
    pendingCount: rows.filter((row) => row.status === 'pending').length,
    missingCount: rows.filter((row) => row.status === 'missing').length,
    unavailableCount: rows.filter((row) => row.status === 'unavailable').length,
    benchmarkMeasuredDecisionCount: benchmarkMeasuredRows.length,
    benchmarkMeasuredTickerCount: tickerExcessReturns.length,
    tickerReturns,
    tickerExcessReturns,
  };
}
