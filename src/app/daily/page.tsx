import Link from 'next/link';
import { listPositions } from '@/lib/portfolio';
import { fetchCompanyResearch } from '@/lib/company-data';
import type { CompanyResearch, PortfolioPosition } from '@/lib/investment';

export const dynamic = 'force-dynamic';

type ReviewLabel = 'needs review' | 'no major changes' | 'new catalyst' | 'new risk';

interface DailyCard {
  position: PortfolioPosition;
  research: CompanyResearch | null;
  label: ReviewLabel;
  reasons: string[];
}

function evaluate(position: PortfolioPosition, research: CompanyResearch | null): DailyCard {
  if (!research) return { position, research, label: 'needs review', reasons: ['Turuandmeid ei õnnestunud laadida.'] };
  const reasons: string[] = [];
  let label: ReviewLabel = 'no major changes';
  const now = Date.now();
  const day = 86_400_000;
  const move = research.quote.price != null && research.quote.previousClose
    ? ((research.quote.price - research.quote.previousClose) / research.quote.previousClose) * 100
    : null;

  if (move != null && Math.abs(move) >= 5) {
    label = 'needs review';
    reasons.push(`Hind liikus eelmise sulgemisega võrreldes ${move >= 0 ? '+' : ''}${move.toFixed(2)}%.`);
  }
  const recentRisk = research.news.find((item) => {
    const recent = item.publishedAt && now - new Date(item.publishedAt).getTime() < day;
    return recent && /investigation|lawsuit|offering|dilution|recall|bankrupt|probe/i.test(item.title);
  });
  if (recentRisk) {
    label = 'new risk';
    reasons.push(`Uus riskiga seotud pealkiri vajab kontrolli: ${recentRisk.title}`);
  }
  const earningsAt = research.quote.earningsAt ? new Date(research.quote.earningsAt).getTime() : null;
  if (label !== 'new risk' && earningsAt && earningsAt >= now && earningsAt - now <= 14 * day) {
    label = 'new catalyst';
    reasons.push(`Tulemuste sündmus on järgmise ${Math.ceil((earningsAt - now) / day)} päeva jooksul.`);
  }
  const recentSec = research.secFilings.find((filing) => now - new Date(filing.filedAt).getTime() < 3 * day);
  if (recentSec) {
    if (label === 'no major changes') label = 'needs review';
    reasons.push(`Uus SEC dokument: ${recentSec.form} (${recentSec.filedAt}).`);
  }
  const recentNews = research.news.filter((item) => item.publishedAt && now - new Date(item.publishedAt).getTime() < day);
  if (recentNews.length && reasons.length === 0) {
    label = 'needs review';
    reasons.push(`${recentNews.length} uut uudist viimase 24 tunni jooksul.`);
  }
  if (reasons.length === 0) reasons.push('Kontrollitud allikates ei tuvastatud suuremat muutust.');
  return { position, research, label, reasons };
}

export default async function DailyPage() {
  let positions: PortfolioPosition[] = [];
  let dbError = '';
  try { positions = (await listPositions()).filter((position) => position.status !== 'closed').slice(0, 20); }
  catch (error) { dbError = (error as Error).message; }

  const results = await Promise.all(positions.map(async (position) => evaluate(position, await fetchCompanyResearch(position.ticker))));

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
