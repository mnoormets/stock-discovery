import {
  PAPER_STRATEGY_COMMISSION_MAX_USD,
  PAPER_STRATEGY_COMMISSION_MIN_USD,
  PAPER_STRATEGY_COMMISSION_RATE,
  PAPER_STRATEGY_ORDER_NOTIONAL_USD,
  PAPER_STRATEGY_POLICY_VERSION,
} from './config';
import type { CandidatePriceContext } from './price-context';
import { isExpectedNewYorkRegularSession } from './price-observation';

export const PAPER_STRATEGY_SNAPSHOT_VERSION = 'paper-strategy-signal-v1';
export const PAPER_STRATEGY_EXECUTION_QUOTE_MAX_AGE_MS = 20 * 60 * 1000;

export const PAPER_STRATEGY_KEYS = ['all_picks_baseline', 'entry_aware'] as const;
export type PaperStrategyKey = (typeof PAPER_STRATEGY_KEYS)[number];
export type PaperStrategyEligibility = 'eligible' | 'skipped';
export type PaperBusinessState = 'strong' | 'mixed';
export type PaperMarketSetupState = 'not_overheated' | 'overheated' | 'unknown';
export type PaperFreshnessState = 'current_collection_confirmed' | 'not_current_collection';

export interface PaperSignalInput {
  ticker: string;
  canonicalIncluded: boolean;
  growthScore: number | null;
  healthScore: number | null;
  coverageScore: number;
  currentCollectionConfirmed: boolean;
  priceContext: CandidatePriceContext;
}

export interface PaperSignalEvaluation {
  version: typeof PAPER_STRATEGY_SNAPSHOT_VERSION;
  policyVersion: typeof PAPER_STRATEGY_POLICY_VERSION;
  strategy: PaperStrategyKey;
  eligibility: PaperStrategyEligibility;
  reasons: string[];
  businessState: PaperBusinessState;
  marketSetupState: PaperMarketSetupState;
  freshnessState: PaperFreshnessState;
  inputs: {
    ticker: string;
    growthScore: number | null;
    healthScore: number | null;
    coverageScore: number;
    currentCollectionConfirmed: boolean;
    priceContext: CandidatePriceContext;
  };
}

export interface PaperExecutionQuote {
  price: number | null;
  currency: string | null;
  marketState: string | null;
  marketTime: string | null;
}

export interface PaperExecutionQuoteAssessment {
  executable: boolean;
  reason: string | null;
}

export function derivePaperBusinessState(
  input: Pick<PaperSignalInput, 'growthScore' | 'healthScore' | 'coverageScore'>,
): PaperBusinessState {
  return input.growthScore != null
    && input.growthScore >= 65
    && input.healthScore != null
    && input.healthScore >= 65
    && input.coverageScore >= 70
    ? 'strong'
    : 'mixed';
}

export function derivePaperMarketSetupState(context: CandidatePriceContext): PaperMarketSetupState {
  if (context.historyStatus === 'insufficient') return 'unknown';
  return context.recentRunUp ? 'overheated' : 'not_overheated';
}

function baseEvaluation(input: PaperSignalInput, strategy: PaperStrategyKey): Omit<PaperSignalEvaluation, 'eligibility' | 'reasons'> {
  return {
    version: PAPER_STRATEGY_SNAPSHOT_VERSION,
    policyVersion: PAPER_STRATEGY_POLICY_VERSION,
    strategy,
    businessState: derivePaperBusinessState(input),
    marketSetupState: derivePaperMarketSetupState(input.priceContext),
    freshnessState: input.currentCollectionConfirmed
      ? 'current_collection_confirmed'
      : 'not_current_collection',
    inputs: {
      ticker: input.ticker.trim().toUpperCase(),
      growthScore: input.growthScore,
      healthScore: input.healthScore,
      coverageScore: input.coverageScore,
      currentCollectionConfirmed: input.currentCollectionConfirmed,
      priceContext: input.priceContext,
    },
  };
}

/**
 * Produces two transparent paper-policy decisions from one immutable canonical
 * decision. It never changes canonical inclusion and never places an order.
 */
export function evaluatePaperStrategies(input: PaperSignalInput): PaperSignalEvaluation[] {
  const baseline = baseEvaluation(input, 'all_picks_baseline');
  const entryAware = baseEvaluation(input, 'entry_aware');

  if (!input.canonicalIncluded) {
    const skipped = (base: typeof baseline): PaperSignalEvaluation => ({
      ...base,
      eligibility: 'skipped',
      reasons: ['Canonical decision did not include the company.'],
    });
    return [skipped(baseline), skipped(entryAware)];
  }

  const entryReasons: string[] = [];
  if (entryAware.businessState !== 'strong') {
    entryReasons.push('Business state is not strong: Growth >= 65, Health >= 65, and Coverage >= 70 are all required.');
  }
  if (!input.currentCollectionConfirmed) {
    entryReasons.push('The linked collection run did not confirm current market data for this ticker.');
  }
  if (entryAware.marketSetupState === 'unknown') {
    entryReasons.push('Stored price history is insufficient to assess recent run-up.');
  }
  if (entryAware.marketSetupState === 'overheated') {
    entryReasons.push(`Recent run-up is already elevated: ${input.priceContext.recentRunUpReasons.join('; ')}.`);
  }

  return [
    {
      ...baseline,
      eligibility: 'eligible',
      reasons: ['Baseline records every included canonical pick; execution still requires a fresh regular-session quote.'],
    },
    {
      ...entryAware,
      eligibility: entryReasons.length === 0 ? 'eligible' : 'skipped',
      reasons: entryReasons.length === 0
        ? ['Business thresholds, current collection confirmation, and the not-overheated price-history gate all pass.']
        : entryReasons,
    },
  ];
}

export function shouldFailDeferredPaperExecution(deferredOrders: number, now: Date): boolean {
  return deferredOrders > 0 && isExpectedNewYorkRegularSession(now);
}

export function paperCommissionUsd(grossUsd = PAPER_STRATEGY_ORDER_NOTIONAL_USD): number {
  if (!Number.isFinite(grossUsd) || grossUsd <= 0) return 0;
  const raw = grossUsd * PAPER_STRATEGY_COMMISSION_RATE;
  return Math.round(Math.min(
    PAPER_STRATEGY_COMMISSION_MAX_USD,
    Math.max(PAPER_STRATEGY_COMMISSION_MIN_USD, raw),
  ) * 100) / 100;
}

/** Fail closed: USD, REGULAR market state and a genuinely recent quote. */
export function assessPaperExecutionQuote(
  quote: PaperExecutionQuote,
  now: Date,
): PaperExecutionQuoteAssessment {
  if (quote.price == null || !Number.isFinite(quote.price) || quote.price <= 0) {
    return { executable: false, reason: 'Execution quote price is missing or invalid.' };
  }
  if (quote.currency !== 'USD') {
    return { executable: false, reason: 'V1 paper accounting only supports explicit USD quotes.' };
  }
  if (quote.marketState !== 'REGULAR') {
    return { executable: false, reason: 'US market is not in the regular trading session.' };
  }
  const marketTime = quote.marketTime == null ? NaN : new Date(quote.marketTime).getTime();
  const age = now.getTime() - marketTime;
  if (!Number.isFinite(marketTime) || age < -60_000 || age > PAPER_STRATEGY_EXECUTION_QUOTE_MAX_AGE_MS) {
    return { executable: false, reason: 'Execution quote timestamp is missing, in the future, or stale.' };
  }
  return { executable: true, reason: null };
}
