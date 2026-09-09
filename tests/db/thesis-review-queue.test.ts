import { beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../../src/lib/db';
import { getThesisReviewQueue } from '../../src/lib/thesis-review-queue';
import { insertCompany } from '../fixtures/company';
import { insertPriceSnapshot } from '../fixtures/price';
import { resetDb } from '../setup/reset';

const NOW = new Date('2026-09-09T12:00:00.000Z');

beforeEach(resetDb);

async function insertThesisFixture(options: { withAssumptions?: boolean } = {}) {
  const companyId = await insertCompany('QUEUE', { name: 'Queue Research Inc.' });
  const decisionPriceId = await insertPriceSnapshot(companyId, 10, '2026-09-01T20:00:00.000Z');
  await pool.query(`UPDATE price_snapshots SET currency = 'USD', market_at = captured_at WHERE id = $1`, [decisionPriceId]);
  const latestPriceId = await insertPriceSnapshot(companyId, 12, '2026-09-08T20:00:00.000Z');
  await pool.query(`UPDATE price_snapshots SET currency = 'USD', market_at = captured_at WHERE id = $1`, [latestPriceId]);
  const position = await pool.query(
    `INSERT INTO portfolio_positions (company_id, ticker, quantity, average_buy_price, status)
     VALUES ($1, 'QUEUE', 0, 0, 'watch') RETURNING id`,
    [companyId],
  );
  const positionId = Number(position.rows[0].id);
  const value = options.withAssumptions ? 'Recorded hypothesis' : null;
  await pool.query(
    `INSERT INTO investment_theses
       (position_id, thesis, status, version, is_current, created_at,
        revenue_assumption, margin_assumption, cash_flow_assumption,
        dilution_assumption, valuation_assumption, downside_scenario,
        reverse_valuation_question, next_review_trigger, valuation_price_snapshot_id)
     VALUES ($1, 'Queue thesis', 'researching', 3, true, '2026-09-05T10:00:00.000Z',
             $2, $2, $2, $2, $2, $2, $2, $2, $3)`,
    [positionId, value, decisionPriceId],
  );
  return { companyId, positionId };
}

describe('thesis review queue', () => {
  it('returns an empty read-only queue when no current thesis exists', async () => {
    const before = await pool.query(`SELECT count(*)::int AS count FROM investment_theses`);
    const queue = await getThesisReviewQueue(NOW);
    const after = await pool.query(`SELECT count(*)::int AS count FROM investment_theses`);

    expect(queue).toEqual({ items: [], dueCount: 0 });
    expect(after.rows[0].count).toBe(before.rows[0].count);
  });

  it('shows decision/current price context and waits for a future earnings event', async () => {
    const fixture = await insertThesisFixture({ withAssumptions: true });
    await pool.query(
      `INSERT INTO earnings_events (company_id, event_at, source)
       VALUES ($1, '2026-11-01T12:00:00.000Z', 'test')`,
      [fixture.companyId],
    );

    const queue = await getThesisReviewQueue(NOW);

    expect(queue.dueCount).toBe(0);
    expect(queue.items[0]).toMatchObject({
      ticker: 'QUEUE', thesisVersion: 3, state: 'awaiting_evidence',
      decisionPrice: 10, latestPrice: 12,
      nextEarningsAt: '2026-11-01T12:00:00.000Z',
    });
    expect(queue.items[0].priceChangePercent).toBeCloseTo(20);
    expect(queue.items[0].assumptions).toHaveLength(8);
    expect(queue.items[0].assumptions.every((item) => item.state === 'awaiting_evidence')).toBe(true);
  });

  it('marks a thesis due when a new financial filing is stored after the thesis', async () => {
    const fixture = await insertThesisFixture({ withAssumptions: true });
    await pool.query(
      `INSERT INTO financial_facts
       (company_id, metric, value, unit, period_end, period_kind, form_type,
        filed_at, accession_number, taxonomy, tag, source_url, fact_key, created_at)
       VALUES ($1, 'revenue', 120, 'USD', '2026-06-30', 'quarter', '10-Q',
               '2026-09-07', '0000000000-26-000001', 'us-gaap', 'Revenue',
               'https://www.sec.gov/example', 'queue-new-filing', '2026-09-07T08:00:00.000Z')`,
      [fixture.companyId],
    );

    const queue = await getThesisReviewQueue(NOW);

    expect(queue.dueCount).toBe(1);
    expect(queue.items[0].state).toBe('review_due');
    expect(queue.items[0].dueEvidence).toEqual([
      expect.objectContaining({ kind: 'financial_filing', label: '10-Q 2026-09-07' }),
    ]);
    expect(queue.items[0].assumptions.every((item) => item.state === 'review_due')).toBe(true);
  });

  it('uses only assessed decisive/supporting SEC events and labels missing assumptions', async () => {
    const fixture = await insertThesisFixture();
    const events = await pool.query(
      `INSERT INTO catalyst_events
       (company_id, event_kind, source_kind, source_ref, occurred_at, headline, url, first_seen_at)
       VALUES
       ($1, 'sec_filing', 'primary_sec', 'relevant', '2026-09-08T08:00:00Z', 'Material filing', 'https://www.sec.gov/relevant', '2026-09-08T08:00:00Z'),
       ($1, 'sec_filing', 'primary_sec', 'routine', '2026-09-08T09:00:00Z', 'Routine filing', 'https://www.sec.gov/routine', '2026-09-08T09:00:00Z')
       RETURNING id, source_ref`,
      [fixture.companyId],
    );
    const relevant = events.rows.find((row) => row.source_ref === 'relevant').id;
    const routine = events.rows.find((row) => row.source_ref === 'routine').id;
    for (const [eventId, relevance] of [[relevant, 'decisive'], [routine, 'not_relevant']]) {
      await pool.query(
        `INSERT INTO catalyst_assessments
         (catalyst_event_id, assessment_version, materiality, direction, novelty,
          source_quality, thesis_relevance, mandate_relevance, evidence_freshness,
          evidence_status, input_hash)
         VALUES ($1, 'catalyst-evidence-v2', 'quantified_major', 'improving', 'new_information',
                 'primary_sec', $2, 'fits', 'fresh', 'material_new_evidence', $3)`,
        [eventId, relevance, `hash-${eventId}`],
      );
    }

    const queue = await getThesisReviewQueue(NOW);

    expect(queue.items[0].state).toBe('review_due');
    expect(queue.items[0].dueEvidence).toEqual([
      expect.objectContaining({ kind: 'sec_event', label: 'Material filing' }),
    ]);
    expect(queue.items[0].assumptions.every((item) => item.state === 'missing')).toBe(true);
  });

  it('marks a passed results date due when no newer filing is stored', async () => {
    const fixture = await insertThesisFixture({ withAssumptions: true });
    await pool.query(
      `INSERT INTO earnings_events (company_id, event_at, source)
       VALUES ($1, '2026-09-08T12:00:00.000Z', 'test')`,
      [fixture.companyId],
    );

    const queue = await getThesisReviewQueue(NOW);

    expect(queue.items[0].state).toBe('review_due');
    expect(queue.items[0].dueEvidence[0]).toMatchObject({ kind: 'earnings_date_passed' });
  });

  it('keeps the current version reviewed when no newer evidence or schedule exists', async () => {
    await insertThesisFixture({ withAssumptions: true });

    const queue = await getThesisReviewQueue(NOW);

    expect(queue.dueCount).toBe(0);
    expect(queue.items[0].state).toBe('reviewed');
    expect(queue.items[0].assumptions.every((item) => item.state === 'reviewed')).toBe(true);
  });
});
