'use client';

import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';

export default function TickerSearch({ initialValue = '' }: { initialValue?: string }) {
  const router = useRouter();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ticker = String(form.get('ticker') || '').trim().toUpperCase();
    if (/^[A-Z0-9][A-Z0-9.-]{0,9}$/.test(ticker)) {
      router.push(`/company/${encodeURIComponent(ticker)}`);
    }
  }

  return (
    <form className="search" action="/search" method="get" onSubmit={submit}>
      <label htmlFor="ticker">Otsi ettevõtet tickeri järgi</label>
      <div className="searchRow">
        <input
          id="ticker"
          name="ticker"
          defaultValue={initialValue}
          placeholder="Näiteks AAPL, NVDA, RKLB või ASTS"
          maxLength={10}
          autoCapitalize="characters"
          required
        />
        <button className="primary" type="submit">Otsi</button>
      </div>
    </form>
  );
}
