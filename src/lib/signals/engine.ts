import { disclosureSignals } from './disclosure-signals';
import { financialSignals } from './financial-signals';
import { marketSignals } from './market-signals';
import type { ResearchBriefContent, SignalContext, SignalDetector, ThesisImpact } from './types';
import { dataWindow, emptyBuckets, fact, formatPercent, inference, uniqueIds } from './utils';

const detectors: SignalDetector[] = [marketSignals, disclosureSignals, financialSignals];

export function buildSignalBrief(context: SignalContext): ResearchBriefContent {
  const combined = emptyBuckets();
  for (const detector of detectors) {
    const result = detector(context);
    combined.whatChanged.push(...(result.whatChanged || []));
    combined.catalysts.push(...(result.catalysts || []));
    combined.risks.push(...(result.risks || []));
    combined.watchNext.push(...(result.watchNext || []));
    if (result.priceMove != null) combined.priceMove = result.priceMove;
  }

  const thesis = context.sources.find((source) => source.type === 'thesis');
  let thesisImpact: ThesisImpact = 'unknown';
  let thesisReason = fact('Portfelli investeerimisteesi pole salvestatud, seega ei saa selle muutust hinnata.');
  if (thesis) {
    if (combined.risks.length > combined.catalysts.length) thesisImpact = 'weakened';
    else if (combined.catalysts.length > combined.risks.length) thesisImpact = 'strengthened';
    else thesisImpact = 'unchanged';
    const signalItems = thesisImpact === 'weakened' ? combined.risks : thesisImpact === 'strengthened' ? combined.catalysts : combined.whatChanged;
    thesisReason = inference(
      thesisImpact === 'weakened'
        ? 'Tuvastatud riskisignaale on rohkem kui positiivseid signaale; tees vajab ülevaatust, mitte automaatset muutmist.'
        : thesisImpact === 'strengthened'
          ? 'Positiivseid signaale on rohkem kui riskisignaale; kontrolli enne teesi muutmist algallikaid.'
          : 'Positiivsed ja negatiivsed signaalid ei anna teesi muutmiseks selget ülekaalu.',
      thesis.id,
      ...uniqueIds(signalItems),
    );
  }

  const categoryCount = new Set(context.sources.map((source) => source.type)).size;
  const priceCount = context.sources.filter((source) => source.type === 'price').length;
  const confidence = categoryCount >= 5 && priceCount >= 2 ? 'high' : categoryCount >= 3 ? 'medium' : 'low';
  const movement = combined.priceMove == null ? 'Hinnamuutuse võrdlus puudub.' : `Hinnamuutus on ${formatPercent(combined.priceMove)}.`;
  const financialLabel = context.sources.some((source) => source.type === 'financial') ? ' SEC finantsfaktid on analüüsi kaasatud.' : '';
  return {
    summary: `${context.companyName || context.ticker}: ${movement} Tuvastati ${combined.catalysts.length} võimalikku positiivset signaali ja ${combined.risks.length} võimalikku riskisignaali.${financialLabel} Kontrolli viidatud algallikaid enne otsuste tegemist.`,
    whatChanged: combined.whatChanged.slice(0, 10),
    catalysts: combined.catalysts.slice(0, 5),
    risks: combined.risks.slice(0, 5),
    thesisImpact,
    thesisReason,
    watchNext: combined.watchNext.slice(0, 6),
    confidence,
    confidenceReason: `${categoryCount} andmekategooriat ja ${context.sources.length} allikat. Uudiste hinnangud põhinevad ainult pealkirjadel ning on märgitud järeldustena.`,
    dataWindow: dataWindow(context.sources),
  };
}
