import type { BriefEvidenceItem, BriefSource, SignalBuckets } from './types';

export function asNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function fact(text: string, ...sourceIds: Array<string | undefined>): BriefEvidenceItem {
  return { text, kind: 'fact', sourceIds: sourceIds.filter((id): id is string => Boolean(id)) };
}

export function inference(text: string, ...sourceIds: Array<string | undefined>): BriefEvidenceItem {
  return { text, kind: 'inference', sourceIds: sourceIds.filter((id): id is string => Boolean(id)) };
}

export function emptyBuckets(): SignalBuckets {
  return { whatChanged: [], catalysts: [], risks: [], watchNext: [], priceMove: null };
}

export function formatPercent(value: number): string {
  if (Math.abs(value) < 0.05) return '0%';
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toLocaleString('et-EE', { maximumFractionDigits: 1 })}%`;
}

export function formatPrice(value: number, currency: unknown): string {
  return `${value.toLocaleString('et-EE', { maximumFractionDigits: 2 })} ${typeof currency === 'string' ? currency : ''}`.trim();
}

export function formatCompact(value: number, unit: unknown): string {
  const formatted = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
  return unit === 'USD' ? `$${formatted}` : `${formatted} ${typeof unit === 'string' ? unit : ''}`.trim();
}

export function uniqueIds(items: BriefEvidenceItem[], fallback: string[] = []): string[] {
  const ids = items.flatMap((item) => item.sourceIds);
  return [...new Set(ids.length ? ids : fallback)].slice(0, 6);
}

export function dataWindow(sources: BriefSource[]): string {
  const dates = sources.map((source) => source.occurredAt).filter((value): value is string => Boolean(value)).sort();
  if (dates.length === 0) return 'Rakenduses olevad viimased andmed';
  const first = dates[0].slice(0, 10);
  const last = dates[dates.length - 1].slice(0, 10);
  return first === last ? `Andmed kuupäevaga ${last}` : `Andmeaken ${first}–${last}`;
}
