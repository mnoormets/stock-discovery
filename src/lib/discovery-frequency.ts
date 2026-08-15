import { ensureSchema, pool } from './db';
import {
  CANONICAL_RUN_TYPE,
  DISCOVERY_MODEL_VERSION,
} from './discovery-validation';
import { toDateOnly } from './date-only';

// Discovery Frequency V1 (docs/DISCOVERY_FREQUENCY_PROVENANCE.md § 3).
//
// Frequency on persistence-signaal, mitte kvaliteedi- ega ostuskoor. Vaatlusühik
// on üks canonical otsus (model_version + Tallinn decision_date) kohta — mitte
// toored read ega leheavamised. Käsitsi scanneri (`rklb`) jooksud ei osale siin
// kunagi; ainult `rklb_daily` canonical run'id loevad. v1 ja v2 ei ole üks seeria,
// seega arvestus piirdub jooksva mudeliversiooniga.

export const FREQUENCY_WINDOWS = [5, 10, 20] as const;
// Persistence-tõlgendus on lubatud alles piisava canonical ajaloo korral
// (HANDOFF roadmap NEXT). Alla selle kuvame ausa loenduri, aga märgime, et
// järeldusi teha ei tohi.
export const FREQUENCY_MIN_CANONICAL_DAYS = 5;
// Timeline'i kuvaaken; ei mõjuta includedCount ega esimese/viimase kaasamise
// arvestust, mis kasutavad kogu canonical ajalugu.
export const FREQUENCY_TIMELINE_DAYS = 20;

export type DayStatus = 'included' | 'excluded' | 'absent';
export type PersistenceKind = 'single' | 'stale_evidence' | 'evolving_evidence';

export interface CanonicalDecisionInput {
  ticker: string;
  included: boolean;
  rank: number | null;
  growthScore: number | null;
  healthScore: number | null;
  coverageScore: number | null;
  catalystEvidenceTier: number | null;
  catalystEvidenceStatus: string | null;
  catalystLinkedPeriodEnd: string | null;
}

export interface CanonicalDay {
  decisionDate: string; // YYYY-MM-DD
  runId: number;
  decisions: CanonicalDecisionInput[];
}

export interface FrequencyTimelineEntry {
  decisionDate: string;
  status: DayStatus;
  rank: number | null;
}

export interface TickerFrequency {
  ticker: string;
  includedCount: number;
  evaluatedCount: number;
  includedByWindow: { window: number; included: number; canonicalDays: number }[];
  currentStreak: number;
  firstIncludedDate: string | null;
  lastIncludedDate: string | null;
  firstRank: number | null;
  lastRank: number | null;
  // Positiivne = liikunud #1 poole (paranes); negatiivne = langes; null = üks kaasamine.
  rankChange: number | null;
  persistence: PersistenceKind;
  timeline: FrequencyTimelineEntry[];
}

export interface DiscoveryFrequencyDashboard {
  modelVersion: string;
  runType: string;
  canonicalDayCount: number;
  latestDecisionDate: string | null;
  earliestDecisionDate: string | null;
  windows: number[];
  minCanonicalDays: number;
  readyForInterpretation: boolean;
  tickers: TickerFrequency[];
}

function evidenceFingerprint(decision: CanonicalDecisionInput): string {
  return [
    decision.growthScore,
    decision.healthScore,
    decision.coverageScore,
    decision.catalystEvidenceTier,
    decision.catalystEvidenceStatus,
    decision.catalystLinkedPeriodEnd,
  ]
    .map((value) => (value == null ? '' : String(value)))
    .join('|');
}

// Puhas, testitav tuum. Ei tee DB-päringut ega eelda välist olekut, et
// deterministlik QA saaks käitumist tõestada.
export function computeDiscoveryFrequency(
  days: CanonicalDay[],
  options: { windows?: readonly number[]; minCanonicalDays?: number; timelineDays?: number } = {},
): DiscoveryFrequencyDashboard {
  const windows = [...(options.windows ?? FREQUENCY_WINDOWS)];
  const minCanonicalDays = options.minCanonicalDays ?? FREQUENCY_MIN_CANONICAL_DAYS;
  const timelineDays = options.timelineDays ?? FREQUENCY_TIMELINE_DAYS;

  // Üks canonical vaatlus decision_date kohta. Kui sama kuupäeva kohta on mitu
  // run'i (ei tohiks idempotentsuse tõttu juhtuda), hoiame suurima runId.
  const byDate = new Map<string, CanonicalDay>();
  for (const day of days) {
    const existing = byDate.get(day.decisionDate);
    if (!existing || day.runId > existing.runId) byDate.set(day.decisionDate, day);
  }
  const orderedDays = [...byDate.values()].sort((a, b) => a.decisionDate.localeCompare(b.decisionDate));
  const canonicalDayCount = orderedDays.length;

  // Ticker → (decisionDate → decision)
  const perTicker = new Map<string, Map<string, CanonicalDecisionInput>>();
  for (const day of orderedDays) {
    for (const decision of day.decisions) {
      if (!perTicker.has(decision.ticker)) perTicker.set(decision.ticker, new Map());
      perTicker.get(decision.ticker)!.set(day.decisionDate, decision);
    }
  }

  const tickers: TickerFrequency[] = [];
  for (const [ticker, dateMap] of perTicker) {
    const includedDates = orderedDays
      .filter((day) => dateMap.get(day.decisionDate)?.included)
      .map((day) => day.decisionDate);
    if (includedDates.length === 0) continue; // ainult vähemalt korra kaasatud kandidaadid

    const evaluatedCount = orderedDays.filter((day) => dateMap.has(day.decisionDate)).length;

    const includedByWindow = windows.map((window) => {
      const recent = orderedDays.slice(-window);
      const included = recent.filter((day) => dateMap.get(day.decisionDate)?.included).length;
      return { window, included, canonicalDays: recent.length };
    });

    // Streak: järjestikused kõige värskemad canonical päevad, mil kaasatud.
    // Katkeb esimesel mitte-kaasatud päeval (nii excluded kui absent).
    let currentStreak = 0;
    for (let i = orderedDays.length - 1; i >= 0; i -= 1) {
      if (dateMap.get(orderedDays[i].decisionDate)?.included) currentStreak += 1;
      else break;
    }

    const firstIncludedDate = includedDates[0];
    const lastIncludedDate = includedDates[includedDates.length - 1];
    const firstRank = dateMap.get(firstIncludedDate)?.rank ?? null;
    const lastRank = dateMap.get(lastIncludedDate)?.rank ?? null;
    const rankChange =
      includedDates.length >= 2 && firstRank != null && lastRank != null ? firstRank - lastRank : null;

    let persistence: PersistenceKind;
    if (includedDates.length < 2) {
      persistence = 'single';
    } else {
      const fingerprints = new Set(
        includedDates.map((date) => evidenceFingerprint(dateMap.get(date)!)),
      );
      persistence = fingerprints.size === 1 ? 'stale_evidence' : 'evolving_evidence';
    }

    const timeline: FrequencyTimelineEntry[] = orderedDays.slice(-timelineDays).map((day) => {
      const decision = dateMap.get(day.decisionDate);
      const status: DayStatus = decision ? (decision.included ? 'included' : 'excluded') : 'absent';
      return { decisionDate: day.decisionDate, status, rank: decision?.rank ?? null };
    });

    tickers.push({
      ticker,
      includedCount: includedDates.length,
      evaluatedCount,
      includedByWindow,
      currentStreak,
      firstIncludedDate,
      lastIncludedDate,
      firstRank,
      lastRank,
      rankChange,
      persistence,
      timeline,
    });
  }

  // Järjestus on leksikograafiline persistence-signaal, mitte koondskoor:
  // rohkem kaasamisi, siis pikem streak, siis ticker.
  tickers.sort(
    (a, b) =>
      b.includedCount - a.includedCount ||
      b.currentStreak - a.currentStreak ||
      a.ticker.localeCompare(b.ticker),
  );

  return {
    modelVersion: DISCOVERY_MODEL_VERSION,
    runType: CANONICAL_RUN_TYPE,
    canonicalDayCount,
    latestDecisionDate: canonicalDayCount ? orderedDays[canonicalDayCount - 1].decisionDate : null,
    earliestDecisionDate: canonicalDayCount ? orderedDays[0].decisionDate : null,
    windows,
    minCanonicalDays,
    readyForInterpretation: canonicalDayCount >= minCanonicalDays,
    tickers,
  };
}

export async function getDiscoveryFrequencyDashboard(): Promise<DiscoveryFrequencyDashboard> {
  await ensureSchema();
  // Üks canonical run decision_date kohta (viimane võidab), ainult jooksev
  // mudeliversioon. Käsitsi `rklb` jooksud jäetakse välja run_type filtriga.
  const runRows = await pool.query(
    `SELECT DISTINCT ON (r.decision_date) r.id, r.decision_date
     FROM discovery_runs r
     WHERE r.run_type = $1 AND r.model_version = $2
     ORDER BY r.decision_date ASC, r.run_at DESC, r.id DESC`,
    [CANONICAL_RUN_TYPE, DISCOVERY_MODEL_VERSION],
  );
  const runIds = runRows.rows.map((row) => Number(row.id));
  if (runIds.length === 0) return computeDiscoveryFrequency([]);

  const decisionRows = await pool.query(
    `SELECT run_id, ticker, included, candidate_rank,
            growth_score, health_score, coverage_score,
            catalyst_evidence_tier, catalyst_evidence_status, catalyst_linked_period_end
     FROM discovery_decisions
     WHERE run_id = ANY($1::bigint[])`,
    [runIds],
  );

  const decisionsByRun = new Map<number, CanonicalDecisionInput[]>();
  for (const row of decisionRows.rows) {
    const runId = Number(row.run_id);
    if (!decisionsByRun.has(runId)) decisionsByRun.set(runId, []);
    decisionsByRun.get(runId)!.push({
      ticker: String(row.ticker),
      included: Boolean(row.included),
      rank: row.candidate_rank == null ? null : Number(row.candidate_rank),
      growthScore: row.growth_score == null ? null : Number(row.growth_score),
      healthScore: row.health_score == null ? null : Number(row.health_score),
      coverageScore: row.coverage_score == null ? null : Number(row.coverage_score),
      catalystEvidenceTier: row.catalyst_evidence_tier == null ? null : Number(row.catalyst_evidence_tier),
      catalystEvidenceStatus: row.catalyst_evidence_status || null,
      catalystLinkedPeriodEnd: row.catalyst_linked_period_end
        ? toDateOnly(row.catalyst_linked_period_end)
        : null,
    });
  }

  const days: CanonicalDay[] = runRows.rows.map((row) => ({
    decisionDate: toDateOnly(row.decision_date),
    runId: Number(row.id),
    decisions: decisionsByRun.get(Number(row.id)) ?? [],
  }));

  return computeDiscoveryFrequency(days);
}
