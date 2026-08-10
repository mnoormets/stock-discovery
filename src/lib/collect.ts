import { fetchApeWisdom } from './apewisdom';
import { fetchTradestie } from './tradestie';
import { fetchFundamentals } from './yahoo';
import { fetchFmpFundamentals } from './fmp';
import { fetchSecSuspensions } from './sec';
import { buildCandidates } from './discovery';
import {
  saveSnapshot, saveCollectedCompanies, ensureSchema, upsertSecSuspensions,
  getSecSuspendedSet, getMentionHistory,
} from './db';
import { BLACKLIST, MIN_MENTIONS, TOP_N, FUND_LOOKUP_LIMIT } from './config';
import type { Fundamentals } from './types';

// Tänase kuupäev "YYYY-MM-DD" (lokaalne, ilma UTC-nihketa).
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function runCollection() {
  const captureDate = today();

  // 0) Veendu, et skeem on uuendatud (uued veerud/tabelid olemasolevas DB-s).
  await ensureSchema();

  // 1) Andmed sisse: ApeWisdom (kasv) + Tradestie (sentiment) + SEC (peatamised).
  const [apeRows, tradestie, secItems] = await Promise.all([
    fetchApeWisdom(2),
    fetchTradestie().catch((e) => {
      console.warn('Tradestie ebaõnnestus, kasutan ApeWisdomi proxy-sentimenti:', e.message);
      return new Map();
    }),
    fetchSecSuspensions().catch((e) => {
      console.warn('SEC feed ebaõnnestus (jätkan ilma):', e.message);
      return [];
    }),
  ]);

  // Salvesta SEC peatamised (akumuleerub) ja loe seni nähtud nimed.
  await upsertSecSuspensions(secItems);
  const secNames = await getSecSuspendedSet();

  // 2) Eelfilter enne kalleid fundamentaal-kutseid.
  const preFiltered = apeRows.filter(
    (r) => !BLACKLIST.has(r.ticker) && r.mentions >= MIN_MENTIONS,
  );

  // 3) Vali top-kandidaadid fundamentaalide jaoks (kasvu-eelskoori järgi).
  const growthOf = (r: typeof preFiltered[number]) => {
    const prev = r.mentions_24h_ago ?? 0;
    return prev > 0 ? (r.mentions - prev) / prev : (r.mentions > 0 ? 1 : 0);
  };
  const lookupTickers = [...preFiltered]
    .sort((a, b) => growthOf(b) - growthOf(a))
    .slice(0, FUND_LOOKUP_LIMIT)
    .map((r) => r.ticker);

  // 4a) Proovi Yahoo esimesena.
  const fundamentals = await fetchFundamentals(lookupTickers);

  // 4b) FMP VARUVARIANT: tickeritele, kus Yahoo turukappi ei andnud (429/tühi).
  const apiKey = process.env.FMP_API_KEY || '';
  const missing = lookupTickers.filter((t) => !fundamentals.get(t)?.marketCap);
  if (apiKey && missing.length > 0) {
    console.log(`Yahoo puudu ${missing.length} tickeril → proovin FMP varuvarianti.`);
    const fmp = await fetchFmpFundamentals(missing, apiKey);
    for (const [k, v] of fmp) {
      const ex = fundamentals.get(k);
      // Täida ainult puuduvad väljad; ära kirjuta Yahoo andmeid üle.
      const merged: Fundamentals = {
        ticker: k,
        name: ex?.name ?? v.name,
        marketCap: ex?.marketCap ?? v.marketCap,
        price: ex?.price ?? v.price,
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

  // Live-tabelite kirjutamine ei tohi kogumise vastust blokeerida ega nurjata.
  void saveCollectedCompanies(candidates).catch((error) => {
    console.error('Kogutud ettevõtete live-andmete salvestamine ebaõnnestus:', error);
  });

  return {
    captureDate,
    scanned: apeRows.length,
    candidates: candidates.length,
    secSuspensionsTracked: secNames.size,
    flagged: candidates.filter((c) => c.warnings.length > 0).length,
    top: candidates.slice(0, TOP_N),
  };
}
