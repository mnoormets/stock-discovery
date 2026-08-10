import type { SignalDetector } from './types';
import { fact, inference } from './utils';

const POSITIVE_NEWS = /\b(beat|beats|approval|approved|award|awarded|contract|partnership|launch|record|raises|upgrade|upgraded|growth|expands|milestone|win|wins)\b/i;
const NEGATIVE_NEWS = /\b(miss|misses|downgrade|downgraded|lawsuit|investigation|offering|dilution|delay|delayed|cuts|cut|setback|recall|warning|falls|drops)\b/i;
const RISKY_FILING = /\b(S-1|S-3|424B|NT 10|NT 20|POS AM)\b|offering|prospectus|dilution|late filing|going concern/i;
const REVIEW_FILING = /\b(8-K|10-Q|10-K|20-F|6-K)\b/i;

export const disclosureSignals: SignalDetector = (context) => {
  const whatChanged = [];
  const catalysts = [];
  const risks = [];
  const watchNext = [];
  context.sources.filter((source) => source.type === 'sec').slice(0, 4).forEach((source) => {
    const form = String(source.data.form || 'SEC filing');
    const description = String(source.data.description || '');
    whatChanged.push(fact(`Uus ${form} filing on kättesaadav${source.occurredAt ? ` (${source.occurredAt.slice(0, 10)})` : ''}.`, source.id));
    if (RISKY_FILING.test(`${form} ${description}`)) {
      risks.push(inference(`${form} võib viidata kapitali kaasamisele, lahjendusele või muule kontrollimist vajavale riskile; loe algdokument läbi.`, source.id));
    } else if (REVIEW_FILING.test(form)) {
      watchNext.push(fact(`Loe ${form} algdokumendist läbi finantsnäitajad, juhised ja olulised sündmused.`, source.id));
    }
  });
  context.sources.filter((source) => source.type === 'news').forEach((source) => {
    const title = String(source.data.title || source.label);
    if (POSITIVE_NEWS.test(title) && catalysts.length < 4) catalysts.push(inference(`Uudise pealkiri „${title}” on võimalik positiivne signaal; pealkiri üksi ei kinnita mõju.`, source.id));
    if (NEGATIVE_NEWS.test(title) && risks.length < 4) risks.push(inference(`Uudise pealkiri „${title}” on võimalik riskisignaal; kontrolli artikli sisu ja algallikat.`, source.id));
  });
  return { whatChanged, catalysts, risks, watchNext };
};
