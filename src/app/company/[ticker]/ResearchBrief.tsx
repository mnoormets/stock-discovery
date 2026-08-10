'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BriefEvidenceItem, BriefSource, ResearchBriefState, StoredResearchBrief } from '@/lib/research-brief';

function dateTime(value: string): string {
  return new Intl.DateTimeFormat('et-EE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function SourceLinks({ ids, sources }: { ids: string[]; sources: BriefSource[] }) {
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  return (
    <span className="briefSources">
      {ids.map((id) => {
        const source = sourceMap.get(id);
        if (!source) return null;
        return source.url
          ? <a key={id} href={source.url} target="_blank" rel="noreferrer">{source.label}</a>
          : <span key={id}>{source.label}</span>;
      })}
    </span>
  );
}

function EvidenceList({ items, sources, empty }: { items: BriefEvidenceItem[]; sources: BriefSource[]; empty: string }) {
  if (items.length === 0) return <p className="muted">{empty}</p>;
  return (
    <div className="briefEvidenceList">
      {items.map((item, index) => (
        <article key={`${item.text}-${index}`}>
          <span className={`evidenceKind ${item.kind}`}>{item.kind === 'fact' ? 'Fakt' : 'Järeldus'}</span>
          <p>{item.text}</p>
          <SourceLinks ids={item.sourceIds} sources={sources} />
        </article>
      ))}
    </div>
  );
}

const impactLabels = {
  strengthened: 'Tees tugevnes',
  weakened: 'Tees nõrgenes',
  unchanged: 'Olulist muutust pole',
  unknown: 'Teesi mõju pole hinnatav',
};

const confidenceLabels = { high: 'Kõrge kindlus', medium: 'Keskmine kindlus', low: 'Madal kindlus' };

export default function ResearchBrief({ initialState }: { initialState: ResearchBriefState }) {
  const [brief, setBrief] = useState<StoredResearchBrief | null>(initialState.brief);
  const [stale, setStale] = useState(initialState.stale);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const generate = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/company/${encodeURIComponent(initialState.ticker)}/brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'AI kokkuvõtte loomine ebaõnnestus.');
      setBrief(data.brief);
      setStale(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'AI kokkuvõtte loomine ebaõnnestus.');
    } finally {
      setLoading(false);
    }
  }, [initialState.ticker]);

  useEffect(() => {
    if (started.current || !initialState.configured || !initialState.sufficient || (brief && !stale)) return;
    started.current = true;
    void generate(false);
  }, [brief, generate, initialState.configured, initialState.sufficient, stale]);

  return (
    <section className="card section researchBrief">
      <div className="sectionHeading">
        <div><p className="eyebrow">TASUTA · REEGLIPÕHINE · ALLIKATEGA</p><h2>Automaatne Research Brief</h2></div>
        {brief && <span className={`confidence ${brief.content.confidence}`}>{confidenceLabels[brief.content.confidence]}</span>}
      </div>

      {!initialState.sufficient && <div className="empty">{initialState.reason || 'Kokkuvõtte jaoks pole piisavalt värskeid andmeid.'}</div>}
      {loading && <div className="briefLoading"><span className="spinner" /> Koostan värsket kokkuvõtet…</div>}
      {error && <div className="notice danger">{error} Olemasolevad faktid ja ettevõtte vaade jäävad endiselt kasutatavaks.</div>}
      {stale && brief && <div className="notice">Näidatakse eelmist kokkuvõtet, kuni uute lähteandmete põhjal valmib värske versioon.</div>}

      {brief && (
        <>
          <div className="briefSummary">
            <p>{brief.content.summary}</p>
            <small>{brief.content.dataWindow} · tasuta reeglimootor · loodud {dateTime(brief.generatedAt)}</small>
          </div>
          <div className="briefGrid">
            <section><h3>Mis muutus?</h3><EvidenceList items={brief.content.whatChanged} sources={brief.sources} empty="Olulist uut muutust ei tuvastatud." /></section>
            <section><h3>Uued katalüsaatorid</h3><EvidenceList items={brief.content.catalysts} sources={brief.sources} empty="Uusi katalüsaatoreid ei tuvastatud." /></section>
            <section><h3>Uued riskid</h3><EvidenceList items={brief.content.risks} sources={brief.sources} empty="Uusi riske ei tuvastatud." /></section>
            <section><h3>Mida jälgida järgmisena?</h3><EvidenceList items={brief.content.watchNext} sources={brief.sources} empty="Konkreetseid tulevasi kontrollpunkte pole." /></section>
          </div>
          <div className="thesisImpact">
            <strong>{impactLabels[brief.content.thesisImpact]}</strong>
            <p><span className={`evidenceKind ${brief.content.thesisReason.kind}`}>{brief.content.thesisReason.kind === 'fact' ? 'Fakt' : 'Järeldus'}</span> {brief.content.thesisReason.text}</p>
            <SourceLinks ids={brief.content.thesisReason.sourceIds} sources={brief.sources} />
          </div>
          <p className="muted"><strong>Kindluse põhjendus:</strong> {brief.content.confidenceReason}</p>
        </>
      )}

      {initialState.configured && initialState.sufficient && (
        <div className="briefActions">
          <button className="secondary" type="button" disabled={loading} onClick={() => void generate(Boolean(brief))}>
            {brief ? 'Arvuta uuesti' : 'Koosta kokkuvõte'}
          </button>
          <small>Tasuta deterministlik kokkuvõte; mitte ostu- ega müügisoovitus.</small>
        </div>
      )}
    </section>
  );
}
