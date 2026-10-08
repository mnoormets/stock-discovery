import { collectNasdaqListings } from './nasdaq-listings';
import { collectMarketRadar } from './market-radar';
import { fetchApeWisdom } from './apewisdom';
import { fetchTradestie } from './tradestie';
import { fetchFundamentals } from './yahoo';
import { fetchFmpFundamentals } from './fmp';
import { fetchSecSuspensions } from './sec';
import { buildCandidates } from './discovery';
import {
  saveSnapshot, saveCollectedCompanies, ensureSchema, upsertSecSuspensions,
  getSecSuspendedSet, getMentionHistory, resolveCollectionCompanyIds,
} from './db';
import {
  BLACKLIST,
  MIN_MENTIONS,
  TOP_N,
  FUND_LOOKUP_LIMIT,
  FUND_RECALL_LOOKUP_LIMIT,
} from './config';
import type { ApeWisdomRow, Fundamentals } from './types';
import {
  COLLECTION_METRICS_VERSION,
  executeCollectionRun,
  type CollectionRunMetrics,
} from './collection-runs';
import {
  recordCollectionRunItems,
  resolveLookupBucket,
  type CollectionRunItemInput,
} from './collection-run-items';
import { INSIDER_CARD_EVIDENCE_VERSION, selectNotableInsiderIssuers } from './insider-discovery';

// Tänase kuupäev "YYYY-MM-DD" Europe/Tallinn ajavööndis.
function today(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Tallinn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function selectFundamentalLookupTickers(rows: ApeWisdomRow[]): {
  growthTickers: string[];
  recallTickers: string[];
  lookupTickers: string[];
} {
  const growthOf = (row: ApeWisdomRow) => {
    const prev = row.mentions_24h_ago ?? 0;
    return prev > 0 ? (row.mentions - prev) / prev : (row.mentions > 0 ? 1 : 0);
  };
  const growthTickers = [...rows]
    .sort((a, b) => growthOf(b) - growthOf(a) || b.mentions - a.mentions || a.ticker.localeCompare(b.ticker))
    .slice(0, FUND_LOOKUP_LIMIT)
    .map((row) => row.ticker);
  const growthSet = new Set(growthTickers);
  const recallTickers = [...rows]
    .filter((row) => !growthSet.has(row.ticker))
    .sort((a, b) => b.mentions - a.mentions || a.rank - b.rank || a.ticker.localeCompare(b.ticker))
    .slice(0, FUND_RECALL_LOOKUP_LIMIT)
    .map((row) => row.ticker);
  return { growthTickers, recallTickers, lookupTickers: [...growthTickers, ...recallTickers] };
}

export function mergeFundamentalLookupTickers(socialTickers: string[], insiderTickers: string[]): string[] {
  return [...new Set([...socialTickers, ...insiderTickers])];
}

async function collectCore(collectionRunId: number) {
  const captureDate = today();
  let tradestieFallback = false;
  let secFallback = false;

  // 1) Andmed sisse: ApeWisdom (kasv) + Tradestie (sentiment) + SEC (peatamised).
  const [ape, tradestie, secItems] = await Promise.all([
    fetchApeWisdom(2),
    fetchTradestie().catch((e) => {
      tradestieFallback = true;
      console.warn('Tradestie ebaõnnestus, kasutan ApeWisdomi proxy-sentimenti:', e.message);
      return new Map();
    }),
    fetchSecSuspensions().catch((e) => {
      secFallback = true;
      console.warn('SEC feed ebaõnnestus (jätkan ilma):', e.message);
      return [];
    }),
  ]);

  // `fetchApeWisdom` tagastab duplikaadivabad read; `rawRowCount` säilitab
  // toore ridade arvu, et `scanned` metrika tähendus ei muutuks.
  const apeRows = ape.rows;

  // Salvesta SEC peatamised (akumuleerub) ja loe seni nähtud nimed.
  await upsertSecSuspensions(secItems);
  const secNames = await getSecSuspendedSet();

  // 2) Eelfilter enne kalleid fundamentaal-kutseid.
  const preFiltered = apeRows.filter(
    (r) => !BLACKLIST.has(r.ticker) && r.mentions >= MIN_MENTIONS,
  );

  // 3) Vali nii kasvu- kui recall-ring fundamentaalide jaoks.
  const socialSelection = selectFundamentalLookupTickers(preFiltered);
  const { growthTickers, recallTickers } = socialSelection;
  const insiderSelection = await selectNotableInsiderIssuers(captureDate);
  const insiderTickers = insiderSelection.selectedIssuers.map((issuer) => issuer.ticker);
  const lookupTickers = mergeFundamentalLookupTickers(socialSelection.lookupTickers, insiderTickers);

  // 4a) Proovi Yahoo esimesena.
  const fundamentals = await fetchFundamentals(lookupTickers);
  const yahooFundamentals = fundamentals.size;
  let fmpFundamentals = 0;

  // 4b) FMP VARUVARIANT: tickeritele, kus Yahoo turukappi ei andnud (429/tühi).
  const apiKey = process.env.FMP_API_KEY || '';
  const missing = lookupTickers.filter((t) => !fundamentals.get(t)?.marketCap);
  if (apiKey && missing.length > 0) {
    console.log(`Yahoo puudu ${missing.length} tickeril → proovin FMP varuvarianti.`);
    const fmp = await fetchFmpFundamentals(missing, apiKey);
    fmpFundamentals = fmp.size;
    for (const [k, v] of fmp) {
      const ex = fundamentals.get(k);
      // Täida ainult puuduvad väljad; ära kirjuta Yahoo andmeid üle.
      const merged: Fundamentals = {
        ticker: k,
        name: ex?.name ?? v.name,
        marketCap: ex?.marketCap ?? v.marketCap,
        price: ex?.price ?? v.price,
        marketAt: ex?.price != null ? ex.marketAt : v.marketAt,
        currency: ex?.currency ?? v.currency,
        volume: ex?.volume ?? v.volume,
        source: ex?.marketCap ? ex.source : v.source, // kummast tuli turukap
      };
      fundamentals.set(k, merged);
    }
  } else if (!apiKey && missing.length > 0) {
    console.log(`FMP_API_KEY puudub → ${missing.length} tickerit jääb turukapita.`);
  }

  // 5) Mainimiste ajalugu (mitmepäevase järjekindluse jaoks).
  const history = await getMentionHistory(captureDate, preFiltered.map((r) => r.ticker), 3);

  // 6) Skoori (avastamise loogika + pump-trahvid).
  const candidates = buildCandidates(preFiltered, tradestie, fundamentals, history, secNames);

  // 7) Salvesta päevane snapshot.
  await saveSnapshot(captureDate, candidates);

  // Salvesta enne päevast enrichment/discovery faasi, kuid ära nurja kogu
  // collection'it, kui lokaalne live-tabelite kirjutus ebaõnnestub.
  let liveDataSaved = true;
  let savedCompanyIds = new Map<string, number>();
  await saveCollectedCompanies(candidates).then((ids) => {
    savedCompanyIds = ids;
  }).catch((error) => {
    liveDataSaved = false;
    console.error('Kogutud ettevõtete live-andmete salvestamine ebaõnnestus:', error);
  });

  // Company identity provenance is not the same as candidate selection. A
  // provider-resolved ticker may be filtered out later, and an unselected radar
  // ticker may already have a companies row from an earlier workflow.
  const companyIdByTicker = await resolveCollectionCompanyIds(
    mergeFundamentalLookupTickers(apeRows.map((row) => row.ticker), insiderTickers),
    fundamentals,
  );
  for (const [ticker, companyId] of savedCompanyIds) companyIdByTicker.set(ticker, companyId);

  // Ticker-level provenance is part of the collection audit trail. Record every
  // radar row, including rows that never reached the paid/limited lookup ring.
  // Failure is fatal to this collection run: a successful aggregate ledger row
  // without its ticker evidence would be misleading.
  const preFilteredSet = new Set(preFiltered.map((row) => row.ticker));
  const growthSet = new Set(growthTickers);
  const recallSet = new Set(recallTickers);
  const insiderSet = new Set(insiderTickers);
  const growthRank = new Map(growthTickers.map((ticker, index) => [ticker, index + 1]));
  const recallRank = new Map(recallTickers.map((ticker, index) => [ticker, index + 1]));
  const insiderByTicker = new Map(insiderSelection.selectedIssuers.map((issuer) => [issuer.ticker, issuer]));
  const candidateByTicker = new Map(candidates.map((candidate) => [candidate.ticker, candidate]));
  const recallCandidateSet = new Set([...preFiltered]
    .sort((a, b) => b.mentions - a.mentions || a.rank - b.rank || a.ticker.localeCompare(b.ticker))
    .slice(0, FUND_RECALL_LOOKUP_LIMIT)
    .map((row) => row.ticker));
  const apeByTicker = new Map(apeRows.map((row) => [row.ticker, row]));
  const observedTickers = mergeFundamentalLookupTickers(apeRows.map((row) => row.ticker), insiderTickers);
  const items: CollectionRunItemInput[] = observedTickers.map((ticker) => {
    const row = apeByTicker.get(ticker);
    const insider = insiderByTicker.get(ticker);
    const bucket = resolveLookupBucket(ticker, growthSet, recallSet, insiderSet);
    const selected = bucket === 'growth' || bucket === 'recall' || bucket === 'insider';
    const fundamental = selected ? fundamentals.get(ticker) : undefined;
    const found = Boolean(fundamental && (
      fundamental.price != null || fundamental.marketCap != null || fundamental.volume != null
    ));
    const candidate = candidateByTicker.get(ticker);
    let skipReason: string | null = null;
    const socialBucket = bucket === 'growth' || bucket === 'recall';
    if (bucket === 'not_selected' || (socialBucket && found && !candidate)) skipReason = 'filtered_out';
    else if (selected && !found) skipReason = 'no_market_data';
    else if (selected && fundamental?.price == null) skipReason = 'missing_price';
    else if (selected && fundamental?.marketCap == null) skipReason = 'missing_market_cap';
    const previous = row?.mentions_24h_ago ?? null;
    const mentionGrowthPercent = !row || previous == null
      ? null
      : previous > 0
        ? ((row.mentions - previous) / previous) * 100
        : row.mentions > 0 ? 100 : 0;
    return {
      collectionRunId,
      ticker,
      firstSeenAt: row ? null : insider?.latestAcceptedAt ?? null,
      lookupBucket: bucket,
      selectedForMarketData: selected,
      marketDataAttempted: selected,
      marketDataFound: found,
      marketDataSource: selected ? (found ? fundamental?.source || 'unknown' : 'none') : null,
      mentionCount: row?.mentions ?? null,
      previousMentionCount: previous,
      mentionGrowthPercent,
      attentionRank: row?.rank ?? null,
      growthRank: growthRank.get(ticker) ?? null,
      recallRank: recallRank.get(ticker) ?? null,
      insiderRank: insider?.insiderRank ?? null,
      companyId: companyIdByTicker.get(ticker) ?? null,
      skipReason,
      rawSignal: {
        source: row ? 'apewisdom' : 'sec-form4',
        passedPreFilter: row ? preFilteredSet.has(ticker) : null,
        selectionPaths: {
          growth: growthSet.has(ticker),
          recallCandidate: recallCandidateSet.has(ticker),
          insider: insiderSet.has(ticker),
        },
        insider: insider ? {
          evidenceVersion: INSIDER_CARD_EVIDENCE_VERSION,
          policyVersion: insiderSelection.policyVersion,
          sourceFiledDate: insiderSelection.sourceFiledDate,
          issuerCik: insider.issuerCik,
          issuerName: insider.issuerName,
          maxDerivedNotional: insider.maxDerivedNotional,
          totalDerivedNotional: insider.totalDerivedNotional,
          roles: {
            director: insider.hasDirector,
            officer: insider.hasOfficer,
            tenPercentOwner: insider.hasTenPercentOwner,
          },
          transactions: insider.transactions,
        } : null,
      },
      warnings: candidate?.warnings ?? [],
    };
  });
  await recordCollectionRunItems(items);

  const nasdaqListings = await collectNasdaqListings();
  const marketRadar = await collectMarketRadar();

  return {
    marketRadar,
    nasdaqListings,
    captureDate,
    scanned: ape.rawRowCount,
    candidates: candidates.length,
    marketDataLookup: {
      growth: growthTickers.length,
      recall: recallTickers.length,
      insider: insiderTickers.filter((ticker) => !growthSet.has(ticker) && !recallSet.has(ticker)).length,
      total: lookupTickers.length,
    },
    insiderSignal: {
      policyVersion: insiderSelection.policyVersion,
      sourceFiledDate: insiderSelection.sourceFiledDate,
      sourceAgeDays: insiderSelection.sourceAgeDays,
      stale: insiderSelection.stale,
      eligibleIssuers: insiderSelection.eligibleIssuerCount,
      selectedIssuers: insiderSelection.selectedIssuers.length,
      overlapWithSocial: insiderTickers.filter((ticker) => growthSet.has(ticker) || recallSet.has(ticker)).length,
    },
    secSuspensionsTracked: secNames.size,
    flagged: candidates.filter((c) => c.warnings.length > 0).length,
    liveDataSaved,
    providers: {
      apewisdomRows: ape.rawRowCount,
      apewisdomUniqueRows: apeRows.length,
      tradestieRows: tradestie.size,
      tradestieFallback,
      secSuspensionsFetched: secItems.length,
      secFallback,
      yahooFundamentals,
      fmpRequested: apiKey ? missing.length : 0,
      fmpFundamentals,
    },
    top: candidates.slice(0, TOP_N),
  };
}

export interface RunCollectionOptions {
  trigger?: string;
}

function collectionMetrics(result: Awaited<ReturnType<typeof collectCore>>): CollectionRunMetrics {
  return {
    schemaVersion: COLLECTION_METRICS_VERSION,
    captureDate: result.captureDate,
    scanned: result.scanned,
    candidates: result.candidates,
    flagged: result.flagged,
    secSuspensionsTracked: result.secSuspensionsTracked,
    liveDataSaved: result.liveDataSaved,
    marketDataLookup: result.marketDataLookup,
    insiderSignal: result.insiderSignal,
    providers: result.providers,
    marketRadar: result.marketRadar,
    nasdaqListings: result.nasdaqListings,
  };
}

export async function runCollection(options: RunCollectionOptions = {}) {
  // Ledger kuulub põhikogumise lifecycle'i ümber. Skeem peab enne alustamist
  // olemas olema; pärast running-kirjet lõpeb iga püütav tee success/failure'iga.
  await ensureSchema();
  const execution = await executeCollectionRun({
    trigger: options.trigger || 'direct',
    initialMetrics: { schemaVersion: COLLECTION_METRICS_VERSION },
    operation: (run) => collectCore(run.id),
    successMetrics: collectionMetrics,
  });
  return { ...execution.result, collectionRunId: execution.run.id };
}
