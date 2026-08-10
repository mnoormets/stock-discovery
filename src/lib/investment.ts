export type PositionStatus = 'active' | 'watch' | 'closed';

export interface CompanyQuote {
  ticker: string;
  name: string | null;
  exchange: string | null;
  quoteType: string | null;
  price: number | null;
  previousClose: number | null;
  marketCap: number | null;
  volume: number | null;
  currency: string | null;
  earningsAt: string | null;
}

export interface NewsItem {
  id: string;
  title: string;
  publisher: string | null;
  url: string;
  publishedAt: string | null;
}

export interface SecFiling {
  id: string;
  form: string;
  filedAt: string;
  description: string | null;
  url: string;
}

export interface AnalystView {
  targetMeanPrice: number | null;
  targetHighPrice: number | null;
  targetLowPrice: number | null;
  recommendationMean: number | null;
  recommendationKey: string | null;
  numberOfAnalystOpinions: number | null;
}

export interface CompanyResearch {
  quote: CompanyQuote;
  analystView: AnalystView | null;
  news: NewsItem[];
  secFilings: SecFiling[];
  warnings: string[];
}

export interface PortfolioPosition {
  id: number;
  ticker: string;
  quantity: number;
  averageBuyPrice: number;
  status: PositionStatus;
  notes: string;
  thesis: string;
  timeHorizon: string;
  updatedAt: string;
}

export function normalizeTicker(value: string): string | null {
  const ticker = value.trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9.-]{0,9}$/.test(ticker) ? ticker : null;
}
