import { NextResponse } from 'next/server';
import { runCollection } from '@/lib/collect';
import { refreshCandidateOutcomes } from '@/lib/discovery-validation';
import { collectDefaultBenchmarkPrice } from '@/lib/backtest';
import { enrichStoredCompanyFinancials } from '@/lib/company-financials';
import { enrichCompanyClassifications } from '@/lib/company-classification';
import { getRklbDiscoveryCandidates } from '@/lib/rklb-discovery';
import { RequiredDataQualitySnapshotError } from '@/lib/data-quality-snapshots';

export interface CollectRouteDependencies {
  runCollection: typeof runCollection;
  collectDefaultBenchmarkPrice: typeof collectDefaultBenchmarkPrice;
  enrichStoredCompanyFinancials: typeof enrichStoredCompanyFinancials;
  enrichCompanyClassifications: typeof enrichCompanyClassifications;
  getRklbDiscoveryCandidates: typeof getRklbDiscoveryCandidates;
  refreshCandidateOutcomes: typeof refreshCandidateOutcomes;
}

export const defaultDependencies: CollectRouteDependencies = {
  runCollection,
  collectDefaultBenchmarkPrice,
  enrichStoredCompanyFinancials,
  enrichCompanyClassifications,
  getRklbDiscoveryCandidates,
  refreshCandidateOutcomes,
};

export async function handleCollectRequest(
  req: Request,
  deps: CollectRouteDependencies = defaultDependencies,
) {
  try {
    const result = await deps.runCollection({ trigger: 'api' });
    const benchmarkCaptured = await deps.collectDefaultBenchmarkPrice();
    let financialEnrichment: Awaited<ReturnType<typeof enrichStoredCompanyFinancials>> | null = null;
    let financialEnrichmentError: string | null = null;
    try {
      financialEnrichment = await deps.enrichStoredCompanyFinancials();
    } catch (error) {
      financialEnrichmentError = (error as Error).message;
      console.error('Päevane SEC CompanyFactsi enrichment ebaõnnestus:', error);
    }

    // Sector/industry klassifikatsiooni enrichment. Ühe tickeri viga ei nurja
    // collecti. Kiirstart: /api/collect?classificationLimit=50 (või env
    // CLASSIFICATION_ENRICHMENT_LIMIT) katab väikese universumi korraga.
    const classificationLimitParam = Number(new URL(req.url).searchParams.get('classificationLimit'));
    const classificationLimitEnv = Number(process.env.CLASSIFICATION_ENRICHMENT_LIMIT);
    const classificationLimit = Number.isFinite(classificationLimitParam) && classificationLimitParam > 0
      ? classificationLimitParam
      : Number.isFinite(classificationLimitEnv) && classificationLimitEnv > 0
        ? classificationLimitEnv
        : undefined;
    let classificationEnrichment: Awaited<ReturnType<typeof enrichCompanyClassifications>> | null = null;
    let classificationEnrichmentError: string | null = null;
    try {
      classificationEnrichment = await deps.enrichCompanyClassifications(classificationLimit);
      console.log(
        `Sector/industry enrichment: proovitud ${classificationEnrichment.attempted}, `
        + `õnnestus ${classificationEnrichment.enriched}, ebaõnnestus ${classificationEnrichment.failed}, `
        + `puudu ${classificationEnrichment.unavailable}, veel katmata ${classificationEnrichment.remaining}.`,
      );
    } catch (error) {
      classificationEnrichmentError = (error as Error).message;
      console.error('Sector/industry klassifikatsiooni enrichment ebaõnnestus:', error);
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
      const discovery = await deps.getRklbDiscoveryCandidates({
        runType: 'rklb_daily',
        collectionRunId: result.collectionRunId,
      });
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
      // Canonical run'i kvaliteedisnapshot on audit trail'i kohustuslik osa.
      // Lase sellel outer catch'ini jõuda, et HTTP collect tagastaks 500 ja
      // scheduler näeks päris failure'it. Muud discovery vead jäävad senise
      // käitumise järgi dailyDiscovery alamstaatusse.
      if (error instanceof RequiredDataQualitySnapshotError) throw error;
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
    const outcomeUpdates = await deps.refreshCandidateOutcomes();
    return NextResponse.json({
      ok: true,
      ...result,
      benchmarkCaptured,
      financialEnrichment,
      financialEnrichmentError,
      classificationEnrichment,
      classificationEnrichmentError,
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
