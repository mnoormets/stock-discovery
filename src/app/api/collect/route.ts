import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { runCollection } from '@/lib/collect';
import { refreshCandidateOutcomes } from '@/lib/discovery-validation';
import { collectDefaultBenchmarkPrice } from '@/lib/backtest';
import { enrichStoredCompanyFinancials } from '@/lib/company-financials';
import { getRklbDiscoveryCandidates } from '@/lib/rklb-discovery';

function isAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  const authorization = req.headers.get('authorization') || '';
  const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!expected || !supplied) return false;

  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runCollection();
    const benchmarkCaptured = await collectDefaultBenchmarkPrice();
    let financialEnrichment: Awaited<ReturnType<typeof enrichStoredCompanyFinancials>> | null = null;
    let financialEnrichmentError: string | null = null;
    try {
      financialEnrichment = await enrichStoredCompanyFinancials();
    } catch (error) {
      financialEnrichmentError = (error as Error).message;
      console.error('Päevane SEC CompanyFactsi enrichment ebaõnnestus:', error);
    }

    let dailyDiscovery: {
      ok: boolean;
      runId: number | null;
      reused: boolean;
      evaluatedCount: number;
      candidateCount: number;
      inputChangedAfterCanonicalSnapshot: boolean;
      error: string | null;
    };
    try {
      const discovery = await getRklbDiscoveryCandidates({ runType: 'rklb_daily' });
      dailyDiscovery = {
        ok: true,
        runId: discovery.runId,
        reused: discovery.runReused,
        evaluatedCount: discovery.recordedEvaluatedCompanies,
        candidateCount: discovery.recordedCandidateCount,
        inputChangedAfterCanonicalSnapshot: discovery.inputChangedAfterCanonicalSnapshot,
        error: null,
      };
    } catch (error) {
      const message = (error as Error).message;
      console.error('Päevane canonical discovery ebaõnnestus:', error);
      dailyDiscovery = {
        ok: false,
        runId: null,
        reused: false,
        evaluatedCount: 0,
        candidateCount: 0,
        inputChangedAfterCanonicalSnapshot: false,
        error: message,
      };
    }
    const outcomeUpdates = await refreshCandidateOutcomes();
    return NextResponse.json({
      ok: true,
      ...result,
      benchmarkCaptured,
      financialEnrichment,
      financialEnrichmentError,
      dailyDiscovery,
      outcomeUpdates,
    });
  } catch (err) {
    console.error('Kogumine ebaõnnestus:', err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}

export const dynamic = 'force-dynamic';
