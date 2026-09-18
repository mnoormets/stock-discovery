// Ühised tüübid kogu torujuhtme jaoks.

// ApeWisdomist tulev toorik
export interface ApeWisdomRow {
  rank: number;
  ticker: string;
  name: string;
  mentions: number;
  upvotes: number;
  rank_24h_ago: number | null;
  mentions_24h_ago: number | null;
}

// Tradestie'st tulev toorik
export interface TradestieRow {
  ticker: string;
  no_of_comments: number;
  sentiment: string;       // "Bullish" | "Bearish"
  sentiment_score: number; // nt 0.15
}

// Yahoo/FMP'st tulev fundamentaal
export interface Fundamentals {
  ticker: string;
  name?: string;
  marketCap?: number;
  price?: number;
  marketAt?: string | null;
  currency?: string;
  volume?: number;   // keskmine/viimane päevamaht (likviidsuse hindamiseks)
  isFund?: boolean;  // ETF / fond (isEtf / quoteType järgi) → filtreerime välja
  source?: 'yahoo' | 'fmp';
}

// Üks skooritud kandidaat, valmis DB-sse salvestamiseks
export interface Candidate {
  ticker: string;
  name: string;
  mentions: number;
  mentionsPrev: number | null;
  mentionGrowth: number | null;   // 1.8 = +180%
  upvotes: number;
  rank: number;
  rankPrev: number | null;
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  sentimentSource: 'tradestie' | 'apewisdom';
  sentimentValue: number;         // -1..1
  marketCap: number | null;
  price: number | null;
  marketAt?: string | null;
  currency: string | null;
  volume: number | null;
  fundamentalsSource: 'yahoo' | 'fmp' | null;
  discoveryScore: number;         // 0..100 (pärast trahve)
  isNew: boolean;
  risingDays: number;             // mitu päeva järjest mainimised tõusnud
  // Manipulatsiooni-hoiatused (näidatakse dashboardil + aruandes)
  secSuspended: boolean;
  warnings: string[];
  // skoori komponendid (läbipaistvuseks aruandes)
  parts: {
    growth: number;
    sustain: number;
    sentiment: number;
    cap: number;
    novelty: number;
    penalties: number;            // negatiivne summa
  };
}
