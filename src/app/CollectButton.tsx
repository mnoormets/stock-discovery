'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CollectButton() {
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const router = useRouter();

  async function run() {
    if (!secret) {
      setStatus('Sisesta CRON_SECRET. Seda ei salvestata brauserisse.');
      return;
    }
    setLoading(true);
    setStatus('Kogun radari andmeid…');
    try {
      const res = await fetch('/api/collect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}` },
      });
      const data = await res.json();
      setSecret('');
      if (res.ok && data.ok) {
        const enrichment = data.financialEnrichment;
        const enrichmentText = enrichment
          ? ` SEC katvus ${enrichment.coveredAfter}/${enrichment.financialUniverse} (+${Math.max(0, enrichment.coveredAfter - enrichment.coveredBefore)}).`
          : ' SEC enrichment ebaõnnestus.';
        const discovery = data.dailyDiscovery;
        const discoveryText = discovery?.ok
          ? ` Daily discovery: ${discovery.evaluatedCount} hinnatud, ${discovery.candidateCount} kandidaati${discovery.reused ? ` (tänane run taaskasutatud${discovery.inputChangedAfterCanonicalSnapshot ? '; hilisem sisend muutus' : ''})` : ''}.`
          : ' Daily discovery ebaõnnestus.';
        setStatus(`Valmis: skännitud ${data.scanned}, radarikandidaate ${data.candidates}.${enrichmentText}${discoveryText}`);
        router.refresh();
      } else {
        setStatus(res.status === 401 ? 'Vale või puuduv CRON_SECRET.' : `Viga: ${data.error}`);
      }
    } catch (error) {
      setStatus(`Viga: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="collectBox">
      <label>
        <span>Manuaalne radari värskendus</span>
        <input
          type="password"
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          placeholder="CRON_SECRET"
          autoComplete="off"
        />
      </label>
      <button className="primary" onClick={run} disabled={loading}>
        {loading ? 'Kogun…' : 'Kogu andmed'}
      </button>
      {status && <span className="status">{status}</span>}
    </div>
  );
}
