// Kõik "keeratavad nupud" ühes kohas, et oleks lihtne häälestada.

// Suured tuntud nimed, mille tahame ALATI välja filtreerida (must nimekiri).
// TÄHTIS: see on TURVAVÕRK. Peamine suurte nimede filter on dünaamiline
// turukapi-piir (Yahoo kaudu, vt MAX_MARKET_CAP). Kui Yahoo on maas / rate-limitib,
// pole turukappi teada ja suured nimed lipsaksid muidu läbi — see nimekiri katab
// levinuimad WSB mega-cap'id, et tööriist degradeeruks graatsiliselt.
export const BLACKLIST = new Set([
  // klassikalised mega-cap tech
  'NVDA', 'TSLA', 'MSFT', 'AAPL', 'AMZN', 'GOOGL', 'GOOG', 'META',
  'AMD', 'NFLX', 'INTC', 'AVGO', 'ORCL', 'IBM', 'MU', 'MRVL', 'TSM',
  'DELL', 'HPE', 'SMCI', 'NOW', 'CRM', 'ADBE', 'QCOM', 'TXN', 'CSCO',
  // indeksid / laiad ETF-id
  'SPY', 'QQQ', 'SPX', 'VOO', 'DIA', 'IWM', 'SMH', 'VIX', 'GLD', 'SLV',
  // hoob-ETF-id (2X/3X, Direxion/ProShares jne) — pole ettevõtted
  'SOXL', 'SOXS', 'TQQQ', 'SQQQ', 'UVXY', 'SVXY', 'USO', 'UCO', 'SCO',
  'KORU', 'SPXL', 'SPXS', 'SPXU', 'UPRO', 'SDS', 'SSO', 'UDOW', 'SDOW',
  'TNA', 'TZA', 'FAS', 'FAZ', 'TMF', 'TMV', 'UPRO', 'TECL', 'TECS',
  'LABU', 'LABD', 'YINN', 'YANG', 'NUGT', 'DUST', 'JNUG', 'JDST',
  'BOIL', 'KOLD', 'NVDL', 'TSLL', 'TSLQ', 'CONL', 'BITX', 'ETHU',
  'WEBL', 'WEBS', 'DPST', 'DRN', 'DRV', 'CURE', 'FNGU', 'FNGD', 'BULZ',
  // muud suured/tuntud
  'LLY', 'NVO', 'JPM', 'BAC', 'GM', 'F', 'BA', 'DIS', 'WMT', 'KO',
  'PFE', 'XOM', 'CVX', 'MSTR', 'HOOD', 'PLTR', 'COIN', 'BABA', 'UBER',
  // klassikalised meme-nimed, mis pole enam "tundmatud"
  'GME', 'AMC', 'BB', 'NOK',
]);

// Ülempiir turukapile: üle selle loeme "juba suureks/tuntuks" ($10 mld).
export const MAX_MARKET_CAP = 10_000_000_000;

// Tõendipõhine müralävi: 4 kuupäeva väikeses valimis lisas 5 → 3 keskmiselt
// ~24 sobivat tickerit päevas; 2026-08-16 oli erandlikult madala tähelepanuga päev.
export const MIN_MENTIONS = 3;

// Mitu top-kandidaati aruandesse / dashboardile.
export const TOP_N = 15;

// ApeWisdomi allikas (subreddit). "wallstreetbets" on suurim ja aktiivseim.
export const APEWISDOM_FILTER = 'wallstreetbets';

// Nimemuster hoob-ETF-ide / fondide tuvastamiseks, kui fundamentaalide
// isEtf/quoteType puudub (turvavõrk). Konservatiivne, et vältida valepositiive.
export function looksLikeFundOrEtf(name: string): boolean {
  if (!name) return false;
  return /\b(ETF|ETN|ETP)\b|\b[1-9]x\b|Direxion|ProShares|Leveraged|Ultra(Pro|Short)?|Bull\s*[1-9]?x|Bear\s*[1-9]?x|Index Fund|Trust ETF/i.test(
    name,
  );
}

// Kasvuringi fundamentaalpäringud (Yahoo + FMP varuvariant). Koos 20 recall-
// tickeriga on lagi 100; kaks täisjooksu + SPY on ~202 FMP päringut (< 250/päev).
export const FUND_LOOKUP_LIMIT = 80;

// Recall-ring: kasvu järgi top-80 seast välja jäänud, kuid absoluutse tähelepanu
// järgi tugevamad nimed. See sulgeb RDDT-laadse augu, kus mainimised langevad,
// aga ticker on endiselt radaris. Kogu Yahoo töö jääb rangelt piiratuks.
export const FUND_RECALL_LOOKUP_LIMIT = 20;

// ── Pump-and-dump / manipulatsiooni tuvastus ──────────────────────────────
// Järsu üleöö-piigi tunnused (kahtlane, MITTE hea):
export const SPIKE_GROWTH_THRESHOLD = 3.0;   // +300% ühe päevaga
export const SPIKE_LOW_BASE = 5;             // eelmine päev ≤ 5 mainimist (madal baas)
export const SPIKE_ABS_MENTIONS = 25;        // aga täna juba ≥ 25 (märkimisväärne absoluut)

// Likviidsuse / manipulatsiooniriski läved:
export const LOW_VOLUME_THRESHOLD = 100_000; // keskmine päevamaht aktsiates
export const MICRO_CAP_THRESHOLD = 50_000_000; // $50M — kasutatakse kui maht teadmata

// Skoori-trahvid (lahutatakse baasskoorist, lõpp klammerdatakse 0..100):
export const PENALTY_SEC = 60;       // SEC on kauplemise peatanud
export const PENALTY_SPIKE = 20;     // üliäge üleöö-hüpe
export const PENALTY_LOW_LIQ = 12;   // madal likviidsus / mikrokapp

// Mitmepäevase järjekindla tõusu boonus (eelistab aeglast kasvu piigile):
export const SUSTAIN_BONUS_MAX = 15;
