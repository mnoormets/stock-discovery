import { redirect } from 'next/navigation';
import TickerSearch from '../TickerSearch';
import { normalizeTicker } from '@/lib/investment';

export default function SearchPage({ searchParams }: { searchParams: { ticker?: string } }) {
  const rawTicker = searchParams.ticker || '';
  const ticker = normalizeTicker(rawTicker);
  if (ticker) redirect(`/company/${encodeURIComponent(ticker)}`);

  return (
    <main className="wrap pageStack">
      <TickerSearch initialValue={rawTicker} />
      <section className="empty card">
        <h1>Ticker ei ole korrektses vormingus</h1>
        <p>Kasuta 1–10 tähte või numbrit. Lubatud on ka punkt ja sidekriips.</p>
      </section>
    </main>
  );
}
