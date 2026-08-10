import Link from 'next/link';
import { listPositions } from '@/lib/portfolio';
import { fetchCompanyResearch } from '@/lib/company-data';
import { saveCompanyResearch, getDailyHistory, saveDailyAlerts } from '@/lib/db';
import type { DailyAlertInput, DailyAlertKind } from '@/lib/db';
import type { CompanyResearch, PortfolioPosition } from '@/lib/investment';

export const dynamic = 'force-dynamic';

type ReviewLabel = 'needs review' | 'no major changes' | 'new catalyst' | 'new risk';

interface DailyCard {
  position: PortfolioPosition;
  research: CompanyResearch | null;
  label: ReviewLabel;
  reasons: string[];
}

const labelPriority: Record<ReviewLabel, number> = {
  'no major changes': 0,
  'needs review': 1,
  'new catalyst': 2,
  'new risk': 3,
};

function strongestLabel(labels: ReviewLabel[]): ReviewLabel {
  return labels.reduce((strongest, label) =>
    labelPriority[label] > labelPriority[strongest] ? label : strongest,
  'no major changes');
}

async function evaluate(position: PortfolioPosition, research: CompanyResearch | null): Promise<DailyCard> {
  if (!research) return { position, research, label: 'needs review', reasons: ['Turuandmeid ei õnnestunud laadida.'] };
  try {
    // Daily vajab kindlat praegust snapshot'i, et võrrelda kahte DB rida.
    await saveCompanyResearch(research);
    const history = await getDailyHistory(position.ticker);
    if (!history) return { position, research, label: 'needs review', reasons: ['Salvestatud hinnaajalugu puudub.'] };

    const reasons: string[] = [];
    const labels: ReviewLabel[] = [];
    const alerts: DailyAlertInput[] = [];
    const addAlert = (
      kind: DailyAlertKind,
      title: string,
      detail: string,
      sourceUrl: string | null,
      occurredAt: string,
      dedupeKey: string,
    ) => {
      labels.push(kind);
      reasons.push(detail);
      alerts.push({
        companyId: history.companyId,
        positionId: position.id,
        kind,
        title,
        detail,
        sourceUrl,
        occurredAt,
        dedupeKey,
      });
    };

    const current = history.currentPrice;
    const previous = history.previousPrice;
    const move = current?.price != null && previous?.price
      ? ((current.price - previous.price) / previous.price) * 100
      : null;
    if (move != null && Math.abs(move) >= 5) {
      const detail = `Hind muutus eelmise salvestatud snapshot'iga võrreldes ${move >= 0 ? '+' : ''}${move.toFixed(2)}%.`;
      addAlert(
        'needs review',
        `${position.ticker}: hinnamuutus ${move >= 0 ? '+' : ''}${move.toFixed(2)}%`,
        detail,
        null,
        current!.capturedAt,
        `daily:price:${history.companyId}:${current!.id}:${previous!.id}`,
      );
    }

    for (const item of history.newNews) {
      const isRisk = /investigation|lawsuit|offering|dilution|recall|bankrupt|bankruptcy|probe|warning|downgrade|bearish/i.test(item.title);
      const kind: DailyAlertKind = isRisk ? 'new risk' : 'needs review';
      addAlert(
        kind,
        `${position.ticker}: ${item.title}`,
        `${isRisk ? 'Uus võimaliku riskiga uudis' : 'Uus uudis'}: ${item.title}`,
        item.url,
        item.discoveredAt,
        `daily:news:${history.companyId}:${item.id}`,
      );
    }

    for (const event of history.newSecEvents) {
      const isRisk = ['S-1', 'S-3', 'NT 10-Q', 'NT 10-K'].includes(event.form);
      const kind: DailyAlertKind = isRisk ? 'new risk' : 'needs review';
      addAlert(
        kind,
        `${position.ticker}: uus SEC ${event.form} (${event.id})`,
        `Uus SEC dokument: ${event.form}${event.filedAt ? ` (${event.filedAt})` : ''}.`,
        event.url,
        event.discoveredAt,
        `daily:sec:${history.companyId}:${event.id}`,
      );
    }

    if (history.upcomingEarnings) {
      const eventAt = new Date(history.upcomingEarnings.eventAt);
      const days = Math.max(0, Math.ceil((eventAt.getTime() - Date.now()) / 86_400_000));
      addAlert(
        'new catalyst',
        `${position.ticker}: lähenev earnings`,
        `Tulemuste sündmus on ${days === 0 ? 'täna' : `${days} päeva pärast`} (${eventAt.toLocaleDateString('et-EE')}).`,
        null,
        history.upcomingEarnings.eventAt,
        `daily:earnings:${history.companyId}:${history.upcomingEarnings.id}`,
      );
    }

    if (alerts.length === 0) {
      const detail = 'Uute snapshot’ide ja sündmuste võrdluses ei tuvastatud suuremat muutust.';
      labels.push('no major changes');
      reasons.push(detail);
      if (!history.currentAlreadyCompared) {
        alerts.push({
          companyId: history.companyId,
          positionId: position.id,
          kind: 'no major changes',
          title: `${position.ticker}: suuremaid muutusi pole`,
          detail,
          sourceUrl: null,
          occurredAt: current?.capturedAt || new Date().toISOString(),
          dedupeKey: `daily:no-major:${history.companyId}:${current?.id || 0}:${previous?.id || 0}`,
        });
      }
    }

    await saveDailyAlerts(alerts);
    return { position, research, label: strongestLabel(labels), reasons };
  } catch (error) {
    console.error(`Daily Changes ${position.ticker} hindamine ebaõnnestus:`, error);
    return { position, research, label: 'needs review', reasons: ['Snapshot-ajaloo hindamine ebaõnnestus.'] };
  }
}

export default async function DailyPage() {
  let positions: PortfolioPosition[] = [];
  let dbError = '';
  try { positions = (await listPositions()).filter((position) => position.status !== 'closed').slice(0, 20); }
  catch (error) { dbError = (error as Error).message; }

  const results = await Promise.all(positions.map(async (position) =>
    evaluate(position, await fetchCompanyResearch(position.ticker)),
  ));

  return (
    <main className="wrap pageStack">
      <section className="hero compact"><p className="eyebrow">DAILY CHANGES MVP</p><h1>Mis vajab täna ülevaatust?</h1><p className="lead">Reeglipõhine muutuste kokkuvõte. See ei ole ostu- ega müügisoovitus.</p></section>
      {dbError && <div className="notice danger">Andmebaas pole saadaval: {dbError}</div>}
      {!dbError && positions.length === 0 && <div className="empty card">Aktiivseid või jälgitavaid positsioone pole. <Link href="/portfolio">Lisa portfelli esimene ticker.</Link></div>}
      <div className="dailyList">{results.map(({ position, research, label, reasons }) => (
        <article className="card dailyCard" key={position.id}>
          <div className="dailyTop"><div><Link className="ticker large" href={`/company/${position.ticker}`}>{position.ticker}</Link><span className="muted"> · {research?.quote.name || 'No data available yet'}</span></div><span className={`reviewLabel ${label.replaceAll(' ', '-')}`}>{label}</span></div>
          <ul>{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          <div className="dailyMeta"><span>Staatus: {position.status}</span><span>Ajahorisont: {position.timeHorizon || 'määramata'}</span><span>Tees: {position.thesis || 'No data available yet'}</span></div>
        </article>
      ))}</div>
      {positions.length >= 20 && <div className="notice">MVP piirab ühe vaate 20 aktiivse/jälgitava positsiooniga, et vältida massilist API kasutust.</div>}
    </main>
  );
}
