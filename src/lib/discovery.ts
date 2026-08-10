import type { ApeWisdomRow, TradestieRow, Fundamentals, Candidate } from './types';
import { normalizeCompanyName } from './sec';
import {
  BLACKLIST, MAX_MARKET_CAP, MIN_MENTIONS, looksLikeFundOrEtf,
  SPIKE_GROWTH_THRESHOLD, SPIKE_LOW_BASE, SPIKE_ABS_MENTIONS,
  LOW_VOLUME_THRESHOLD, MICRO_CAP_THRESHOLD,
  PENALTY_SEC, PENALTY_SPIKE, PENALTY_LOW_LIQ, SUSTAIN_BONUS_MAX,
} from './config';

// ─────────────────────────────────────────────────────────────────────────
//  AVASTAMISE LOOGIKA — tööriista süda.
//
//  Skoor 0..100 = BAASSKOOR miinus TRAHVID.
//
//  BAAS:
//    1) Mainimiste kasv (max 35) — kõver TIPUB mõõdukal kasvul (~+150%) ja
//       KAHANEB äärmuslike piikide juures (pump-hoiatus).
//    2) Mitmepäevane järjekindlus (max 15) — eelistab aeglast, 3-päevast tõusu.
//    3) Sentiment (max 25 Tradestie / 15 ApeWisdom-proxy).
//    4) Väiksem turukap (max 25).
//    5) Uudsuse boonus (max 5).
//
//  TRAHVID (lahutatakse, tickerit EI kustutata — märgitakse hoiatusega):
//    - SEC on kauplemise peatanud        -60
//    - üliäge üleöö-hüpe (võimalik pump)  -20
//    - madal likviidsus / mikrokapp       -12
// ─────────────────────────────────────────────────────────────────────────

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

// Sentiment: eelista Tradestie't; muidu ApeWisdomi upvote-suhe (nõrk proxy).
function deriveSentiment(ape: ApeWisdomRow, trade: TradestieRow | undefined): {
  label: 'Bullish' | 'Bearish' | 'Neutral';
  source: 'tradestie' | 'apewisdom';
  value: number; // -1..1
} {
  if (trade && trade.sentiment) {
    const isBull = trade.sentiment.toLowerCase().startsWith('bull');
    const mag = clamp(Math.abs(trade.sentiment_score), 0, 1);
    return { label: isBull ? 'Bullish' : 'Bearish', source: 'tradestie', value: isBull ? mag : -mag };
  }
  const ratio = ape.mentions > 0 ? ape.upvotes / ape.mentions : 0;
  const value = clamp(ratio / 5, 0, 1);
  return { label: value >= 0.3 ? 'Bullish' : 'Neutral', source: 'apewisdom', value };
}

// Mitu päeva järjest on mainimised tõusnud (täna + eelnevad DB-päevad).
function countRisingDays(today: number, prior: number[]): number {
  const seq = [today, ...prior]; // kõige värskem ees
  let rising = 0;
  for (let i = 0; i < seq.length - 1; i++) {
    if (seq[i] > seq[i + 1]) rising++;
    else break;
  }
  return rising;
}

function scoreCandidate(
  ape: ApeWisdomRow,
  sentimentValue: number,
  sentimentSource: 'tradestie' | 'apewisdom',
  fund: Fundamentals | undefined,
  priorMentions: number[],
  secSuspended: boolean,
) {
  const warnings: string[] = [];

  // Päevakasv (täna vs eile).
  const prev = ape.mentions_24h_ago ?? (priorMentions[0] ?? 0);
  const growth = prev > 0 ? (ape.mentions - prev) / prev : (ape.mentions > 0 ? 1 : 0);
  const risingDays = countRisingDays(ape.mentions, priorMentions);

  // 1) KASV — kõver tipuga ~+150%, kahaneb äärmuslike piikide juures.
  let growthPart: number;
  const g = Math.max(0, growth);
  if (g <= 1.5) growthPart = (g / 1.5) * 35;
  else growthPart = Math.max(0, 35 - (g - 1.5) * 10); // +350% → 15p, +500% → 0p

  // 2) JÄRJEKINDLUS — mitmepäevane tõus (aeglane > piik).
  let sustainPart = 0;
  if (risingDays >= 2) sustainPart = SUSTAIN_BONUS_MAX;
  else if (risingDays === 1) sustainPart = SUSTAIN_BONUS_MAX * 0.45;

  // 3) SENTIMENT.
  const sentNorm = clamp((sentimentValue + 1) / 2, 0, 1);
  const sentCap = sentimentSource === 'tradestie' ? 25 : 15;
  const sentimentPart = sentNorm * sentCap;

  // 4) TURUKAP — väiksem = kõrgem (log-skaala); tundmatu → neutraalne 12.
  let capPart = 12;
  if (fund?.marketCap && fund.marketCap > 0) {
    const lo = Math.log10(50_000_000);
    const hi = Math.log10(MAX_MARKET_CAP);
    const c = Math.log10(fund.marketCap);
    capPart = clamp((hi - c) / (hi - lo), 0, 1) * 25;
  }

  // 5) UUDSUS.
  const isNew = ape.rank_24h_ago == null || ape.rank_24h_ago === 0;
  const noveltyPart = isNew ? 5 : 0;

  // ── TRAHVID + HOIATUSED ──────────────────────────────────────────────
  let penalties = 0;

  // (a) SEC peatamine.
  if (secSuspended) {
    penalties += PENALTY_SEC;
    warnings.push('⚠️ SEC on selle kauplemise varem peatanud');
  }

  // (b) Üliäge üleöö-hüpe: kõrge % + madal baas + kõrge absoluut + pole mitmepäevast tuge.
  const spikeSuspicious =
    growth >= SPIKE_GROWTH_THRESHOLD &&
    prev <= SPIKE_LOW_BASE &&
    ape.mentions >= SPIKE_ABS_MENTIONS &&
    risingDays < 2;
  if (spikeSuspicious) {
    penalties += PENALTY_SPIKE;
    warnings.push('⚠️ Üliäge üleöö-hüpe madalalt baasilt (võimalik pump)');
  }

  // (c) Likviidsus: maht alla läve, või (kui maht teadmata) mikrokapp.
  const lowByVolume = fund?.volume != null && fund.volume < LOW_VOLUME_THRESHOLD;
  const lowByCap = fund?.volume == null && fund?.marketCap != null && fund.marketCap < MICRO_CAP_THRESHOLD;
  if (lowByVolume || lowByCap) {
    penalties += PENALTY_LOW_LIQ;
    warnings.push(
      lowByVolume
        ? '⚠️ Kõrge manipulatsioonirisk (madal kauplemismaht)'
        : '⚠️ Kõrge manipulatsioonirisk (mikrokapp, maht teadmata)',
    );
  }

  const base = growthPart + sustainPart + sentimentPart + capPart + noveltyPart;
  const total = clamp(base - penalties, 0, 100);

  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    growth, risingDays, isNew, secSuspended, warnings,
    total: r1(total),
    parts: {
      growth: r1(growthPart),
      sustain: r1(sustainPart),
      sentiment: r1(sentimentPart),
      cap: r1(capPart),
      novelty: noveltyPart,
      penalties: -penalties,
    },
  };
}

export function buildCandidates(
  apeRows: ApeWisdomRow[],
  tradestie: Map<string, TradestieRow>,
  fundamentals: Map<string, Fundamentals>,
  history: Map<string, number[]>,
  secNames: Set<string>,
): Candidate[] {
  const out: Candidate[] = [];

  for (const ape of apeRows) {
    if (BLACKLIST.has(ape.ticker)) continue;          // FILTER 1: tuntud nimed + hoob-ETF-id
    if (ape.mentions < MIN_MENTIONS) continue;        // FILTER 2: müralävi

    const fund = fundamentals.get(ape.ticker);
    if (fund?.marketCap && fund.marketCap > MAX_MARKET_CAP) continue; // FILTER 3: liiga suur

    // FILTER 4: ETF-id / fondid (pole ettevõtted). Tuvasta fundamentaali
    // isEtf/quoteType järgi, muidu nimemustri järgi (turvavõrk).
    const fundName = fund?.name || ape.name || '';
    if (fund?.isFund || looksLikeFundOrEtf(fundName)) continue;

    const sent = deriveSentiment(ape, tradestie.get(ape.ticker));

    // SEC sobitamine nime järgi (normaliseeritult).
    const nameForMatch = fund?.name || ape.name || '';
    const secSuspended = secNames.has(normalizeCompanyName(nameForMatch));

    const prior = history.get(ape.ticker) ?? [];
    const s = scoreCandidate(ape, sent.value, sent.source, fund, prior, secSuspended);

    out.push({
      ticker: ape.ticker,
      name: fund?.name || ape.name || ape.ticker,
      mentions: ape.mentions,
      mentionsPrev: ape.mentions_24h_ago,
      mentionGrowth: s.growth,
      upvotes: ape.upvotes,
      rank: ape.rank,
      rankPrev: ape.rank_24h_ago,
      sentiment: sent.label,
      sentimentSource: sent.source,
      sentimentValue: sent.value,
      marketCap: fund?.marketCap ?? null,
      price: fund?.price ?? null,
      currency: fund?.currency ?? null,
      volume: fund?.volume ?? null,
      fundamentalsSource: fund?.source ?? null,
      discoveryScore: s.total,
      isNew: s.isNew,
      risingDays: s.risingDays,
      secSuspended: s.secSuspended,
      warnings: s.warnings,
      parts: s.parts,
    });
  }

  out.sort((a, b) => b.discoveryScore - a.discoveryScore);
  return out;
}
