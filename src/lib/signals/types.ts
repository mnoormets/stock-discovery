export type BriefItemKind = 'fact' | 'inference';
export type ThesisImpact = 'strengthened' | 'weakened' | 'unchanged' | 'unknown';
export type BriefConfidence = 'high' | 'medium' | 'low';

export interface BriefEvidenceItem {
  text: string;
  kind: BriefItemKind;
  sourceIds: string[];
}

export interface BriefSource {
  id: string;
  type: 'price' | 'news' | 'sec' | 'earnings' | 'analyst' | 'thesis' | 'financial';
  label: string;
  url: string | null;
  occurredAt: string | null;
  data: Record<string, unknown>;
}

export interface ResearchBriefContent {
  summary: string;
  whatChanged: BriefEvidenceItem[];
  catalysts: BriefEvidenceItem[];
  risks: BriefEvidenceItem[];
  thesisImpact: ThesisImpact;
  thesisReason: BriefEvidenceItem;
  watchNext: BriefEvidenceItem[];
  confidence: BriefConfidence;
  confidenceReason: string;
  dataWindow: string;
}

export interface SignalContext {
  ticker: string;
  companyName: string | null;
  sources: BriefSource[];
}

export interface SignalBuckets {
  whatChanged: BriefEvidenceItem[];
  catalysts: BriefEvidenceItem[];
  risks: BriefEvidenceItem[];
  watchNext: BriefEvidenceItem[];
  priceMove: number | null;
}

export type SignalDetector = (context: SignalContext) => Partial<SignalBuckets>;
