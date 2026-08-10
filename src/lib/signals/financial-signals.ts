import type { BriefSource, SignalDetector } from './types';
import { asNumber, fact, formatCompact, formatPercent, inference } from './utils';

function latest(contextSources: BriefSource[], metric: string): BriefSource | undefined {
  return contextSources.find((source) => source.type === 'financial' && source.data.metric === metric && source.data.role === 'latest');
}

export const financialSignals: SignalDetector = (context) => {
  const whatChanged = [];
  const catalysts = [];
  const risks = [];
  const watchNext = [];

  for (const [metric, label] of [['revenue', 'Revenue'], ['net_income', 'Net income'], ['free_cash_flow', 'Free cash flow'], ['operating_cash_flow', 'Operating cash flow']] as const) {
    const source = latest(context.sources, metric);
    if (!source) continue;
    const value = asNumber(source.data.value);
    const yoy = asNumber(source.data.yearOverYearPercent);
    if (value == null) continue;
    whatChanged.push(fact(`${label} on ${formatCompact(value, source.data.unit)}${yoy == null ? '' : `, muutus ${formatPercent(yoy)} YoY`}.`, source.id, typeof source.data.previousSourceId === 'string' ? source.data.previousSourceId : undefined));
    if (metric === 'revenue' && yoy != null && yoy >= 10) catalysts.push(inference(`Revenue kasv ${formatPercent(yoy)} YoY toetab kasvusignaali; kontrolli ka marginaale ja kasvu kvaliteeti.`, source.id));
    if (metric === 'revenue' && yoy != null && yoy < 0) risks.push(inference(`Revenue langus ${formatPercent(yoy)} YoY on fundamentaalne riskisignaal.`, source.id));
    if ((metric === 'free_cash_flow' || metric === 'operating_cash_flow') && value < 0) risks.push(inference(`${label} on negatiivne; kontrolli rahakulu tempot ja rahastamisvajadust.`, source.id));
    if ((metric === 'free_cash_flow' || metric === 'operating_cash_flow') && value > 0 && yoy != null && yoy > 0) catalysts.push(inference(`${label} on positiivne ja paranes aastatagusega võrreldes.`, source.id));
  }

  const cash = latest(context.sources, 'cash');
  const debt = latest(context.sources, 'debt');
  const cashValue = asNumber(cash?.data.value);
  const debtValue = asNumber(debt?.data.value);
  if (cash && cashValue != null) whatChanged.push(fact(`Cash balance on ${formatCompact(cashValue, cash.data.unit)}.`, cash.id));
  if (debt && debtValue != null) whatChanged.push(fact(`SEC-i põhine debt on ${formatCompact(debtValue, debt.data.unit)}.`, debt.id));
  if (cash && debt && cashValue != null && debtValue != null) {
    if (cashValue >= debtValue) catalysts.push(inference('Raha ja ekvivalendid katavad SEC-is raporteeritud võla.', cash.id, debt.id));
    if (debtValue > cashValue * 2) risks.push(inference('SEC-is raporteeritud võlg ületab raha enam kui kaks korda; kontrolli tähtaegu ja intressikulu.', cash.id, debt.id));
  }

  const shares = latest(context.sources, 'shares_outstanding');
  const shareYoy = asNumber(shares?.data.yearOverYearPercent);
  if (shares && shareYoy != null && shareYoy >= 5) risks.push(inference(`Aktsiate arv kasvas ${formatPercent(shareYoy)} YoY, mis viitab võimalikule lahjendusele.`, shares.id));
  if (context.sources.some((source) => source.type === 'financial')) watchNext.push(fact('Jälgi järgmises filingus revenue kasvu, rahavoogu, cash/debt suhet ja aktsiate arvu muutust.', ...context.sources.filter((source) => source.type === 'financial' && source.data.role === 'latest').slice(0, 4).map((source) => source.id)));
  return { whatChanged, catalysts, risks, watchNext };
};
