import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { runCollection } from '@/lib/collect';
import { refreshCandidateOutcomes } from '@/lib/discovery-validation';
import { collectDefaultBenchmarkPrice } from '@/lib/backtest';
import { enrichStoredCompanyFinancials } from '@/lib/company-financials';
import { enrichCompanyClassifications } from '@/lib/company-classification';
import { getRklbDiscoveryCandidates } from '@/lib/rklb-discovery';
import { RequiredDataQualitySnapshotError } from '@/lib/data-quality-snapshots';
import { pool } from '@/lib/db';
import { collectTrackedPrices } from '@/lib/price-tracking';
import { releaseCollectionLock, tryAcquireCollectionLock } from '@/lib/collection-lock';

export interface CollectRouteDependencies {
  collectTrackedPrices: typeof collectTrackedPrices;
  runCollection: typeof runCollection;
  refreshCandidateOutcomes: typeof refreshCandidateOutcomes;
  collectDefaultBenchmarkPrice: typeof collectDefaultBenchmarkPrice;
  enrichStoredCompanyFinancials: typeof enrichStoredCompanyFinancials;
  enrichCompanyClassifications: typeof enrichCompanyClassifications;
  getRklbDiscoveryCandidates: typeof getRklbDiscoveryCandidates;
}

const defaultDependencies: CollectRouteDependencies = {
  collectTrackedPrices,
  runCollection,
  refreshCandidateOutcomes,
  collectDefaultBenchmarkPrice,
  enrichStoredCompanyFinancials,
  enrichCompanyClassifications,
  getRklbDiscoveryCandidates,
};

function isAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  const authorization = req.headers.get('authorization') || '';
  const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!expected || !supplied) return false;

  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function handleCollectRequest(
  req: Request,
  dependencies: CollectRouteDependencies = defaultDependencies,
) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const client = await pool.connect();
  let locked = false;
  try {
    locked = await tryAcquireCollectionLock(client);
    if (!locked) {
      return NextResponse.json(
        { ok: false, error: 'A collection run is already in progress.' },
        { status: 409 },
      );
    }

    const result = await dependencies.runCollection({ trigger: 'api' });
    const benchmarkCaptured = await dependencies.collectDefaultBenchmarkPrice();
    let financialEnrichment: Awaited<ReturnType<typeof enrichStoredCompanyFinancials>> | null = null;
    let financialEnrichmentError: string | null = null;
    try {
      financialEnrichment = await dependencies.enrichStoredCompanyFinancials();
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
      classificationEnrichment = await dependencies.enrichCompanyClassifications(classificationLimit);
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
      const discovery = await dependencies.getRklbDiscoveryCandidates({
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
    const priceTracking = await dependencies.collectTrackedPrices();
    const outcomeUpdates = await dependencies.refreshCandidateOutcomes();
    const trackingComplete = !(priceTracking.failed || priceTracking.missing || priceTracking.invalid || priceTracking.stale || priceTracking.deferred);
    return NextResponse.json({
      ok: trackingComplete,
      ...result,
      benchmarkCaptured,
      financialEnrichment,
      financialEnrichmentError,
      classificationEnrichment,
      classificationEnrichmentError,
      dailyDiscovery,
      outcomeUpdates,
      priceTracking,
    }, { status: trackingComplete ? 200 : 503 });
  } catch (err) {
    console.error('Kogumine ebaõnnestus:', err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  } finally {
    if (locked) {
      await releaseCollectionLock(client).catch((error) => {
        console.error('Collection advisory locki vabastamine ebaõnnestus:', error);
      });
    }
    client.release();
  }
}
