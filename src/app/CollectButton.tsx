'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Käsitsi kogumise nupp. Kutsub /api/collect ja värskendab lehe.
export default function CollectButton() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const router = useRouter();

  async function run() {
    setLoading(true);
    setStatus('Kogun andmeid (ApeWisdom + Tradestie + Yahoo)…');
    try {
      const res = await fetch('/api/collect', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setStatus(`Valmis: skännisin ${data.scanned}, leidsin ${data.candidates} kandidaati.`);
        router.refresh();
      } else {
        setStatus(`Viga: ${data.error}`);
      }
    } catch (e) {
      setStatus(`Viga: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bar">
      <button className="primary" onClick={run} disabled={loading}>
        {loading ? 'Kogun…' : '▶ Kogu andmed nüüd'}
      </button>
      {status && <span className="status">{status}</span>}
    </div>
  );
}
