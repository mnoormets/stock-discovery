import Link from 'next/link';
import { getMissedMoveAudits, type MissedMoveAudit, type PriorCoverage } from '@/lib/missed-moves';

export const dynamic = 'force-dynamic';

const coverageLabel: Record<PriorCoverage, string> = {
  included: 'oli uurimisnimekirjas',
  excluded: 'hinnati, jäi välja',
  radar_data_gap: 'radaris, andmelünk',
  universe_gap: 'universumi lünk',
};

function money(value: number, currency: string | null): string {
  if (!currency) return `${value.toLocaleString('et-EE', { maximumFractionDigits: 2 })} (valuuta puudu)`;
  return new Intl.NumberFormat('et-EE', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

function moveEvidence(row: MissedMoveAudit): string {
  const evidence = [
    row.intervalNews ? `${row.intervalNews} uudist` : null,
    row.intervalSecEvents ? `${row.intervalSecEvents} SEC sündmust` : null,
    row.intervalEarnings ? `${row.intervalEarnings} earnings-sündmust` : null,
  ].filter(Boolean);
  return evidence.length ? evidence.join(' · ') : 'olemasolevates allikates sündmust ei leitud';
}

export default async function MissedMovesPage() {
  let rows: MissedMoveAudit[] = [];
  let error = '';
  try { rows = await getMissedMoveAudits(); } catch (caught) { error = (caught as Error).message; }

  return (
    <main className="wrap pageStack">
      <section className="hero compact">
        <p className="eyebrow">POINT-IN-TIME AUDIT · NOT A PREDICTION</p>
        <h1>Suuremate liikumiste järelkontroll</h1>
        <p className="lead">Näitab vähemalt 8% liikumisi salvestatud päevasnapshotide vahel ja küsib: kas ticker oli enne liikumist canonical hinnangus, ainult sotsiaalradaris või üldse universumist väljas?</p>
      </section>
      <div className="notice">See vaade ei väida, et liikumine oli ette ennustatav. Sündmuste loendur kasutab ainult rakendusse selleks ajaks salvestatud Yahoo/SEC/earnings andmeid; null võib tähendada allikalünka.</div>
      {error && <div className="notice danger">Järelkontrolli ei õnnestunud laadida: {error}</div>}
      {!error && rows.length === 0 && <div className="empty card">Viimase 60 päeva salvestatud hinnapaarides pole vähemalt 8% liikumist. Audit hakkab täituma uute päevasnapshotidega.</div>}
      {rows.length > 0 && (
        <div className="tableWrap card scannerTable">
          <table>
            <thead><tr><th>Ticker</th><th>Liikumine</th><th>Enne → pärast</th><th>Katvus enne liikumist</th><th>Intervalli tõendid</th></tr></thead>
            <tbody>{rows.map((row) => (
              <tr key={`${row.ticker}-${row.observedDate}`}>
                <td><Link className="ticker" href={`/company/${encodeURIComponent(row.ticker)}`}>{row.ticker}</Link><div className="name">{row.name || 'Nimi puudub'}</div></td>
                <td><strong className={row.changePercent >= 0 ? 'positive' : 'negative'}>{row.changePercent >= 0 ? '+' : '−'}{Math.abs(row.changePercent).toLocaleString('et-EE', { maximumFractionDigits: 2 })}%</strong></td>
                <td>{money(row.previousPrice, row.currency)} → {money(row.observedPrice, row.currency)}<small>{row.previousDate} → {row.observedDate}</small></td>
                <td><span className="reviewLabel needs-review">{coverageLabel[row.priorCoverage]}</span>{row.exclusionReasons.length > 0 && <small>{row.exclusionReasons.join('; ')}</small>}</td>
                <td>{moveEvidence(row)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </main>
  );
}

