import type { SignalDetector } from './types';
import { asNumber, fact, formatPercent, formatPrice, inference } from './utils';

function daysUntil(value: string): number {
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000));
}

export const marketSignals: SignalDetector = (context) => {
  const whatChanged = [];
  const catalysts = [];
  const risks = [];
  const watchNext = [];
  const prices = context.sources.filter((source) => source.type === 'price');
  const latestPrice = asNumber(prices[0]?.data.price);
  const previousPrice = asNumber(prices[1]?.data.price) ?? asNumber(prices[0]?.data.previousClose);
  let priceMove: number | null = null;

  if (latestPrice != null && previousPrice != null && previousPrice !== 0) {
    priceMove = ((latestPrice - previousPrice) / previousPrice) * 100;
    const priceIds = prices[1] ? [prices[0].id, prices[1].id] : [prices[0].id];
    whatChanged.push(fact(`${context.ticker} viimane hind on ${formatPrice(latestPrice, prices[0].data.currency)}; muutus võrreldes eelmise võrdluspunktiga on ${formatPercent(priceMove)}.`, ...priceIds));
    if (priceMove >= 5) catalysts.push(inference('Üle +5% hinnaliikumine on tugev tähelepanusignaal, kuid ei tõesta fundamentaalset paranemist.', ...priceIds));
    if (priceMove <= -5) risks.push(inference('Alla −5% hinnaliikumine vajab põhjuse kontrollimist uudistest ja filingutest.', ...priceIds));
  } else if (latestPrice != null) {
    whatChanged.push(fact(`${context.ticker} viimane salvestatud hind on ${formatPrice(latestPrice, prices[0].data.currency)}; varasem võrdluspunkt puudub.`, prices[0].id));
  }

  const earnings = context.sources.find((source) => source.type === 'earnings');
  if (earnings?.occurredAt) {
    const days = daysUntil(earnings.occurredAt);
    whatChanged.push(fact(`Järgmine earnings-sündmus on ${days === 0 ? 'täna' : `${days} päeva pärast`}.`, earnings.id));
    watchNext.push(fact("Kontrolli earnings'i järel käivet, marginaale, juhiseid ja juhtkonna kommentaare.", earnings.id));
  }

  const analyst = context.sources.find((source) => source.type === 'analyst');
  const meanTarget = asNumber(analyst?.data.targetMeanPrice);
  if (analyst && meanTarget != null && latestPrice != null && latestPrice !== 0) {
    const upside = ((meanTarget - latestPrice) / latestPrice) * 100;
    whatChanged.push(fact(`Analüütikute keskmine hinnasiht on ${formatPrice(meanTarget, prices[0]?.data.currency)}, ehk ${formatPercent(upside)} praegusest hinnast.`, analyst.id, prices[0]?.id));
    if (upside >= 10) catalysts.push(inference('Keskmine hinnasiht on praegusest hinnast vähemalt 10% kõrgem, kuid konsensus ei garanteeri tootlust.', analyst.id, prices[0]?.id));
    if (upside <= -10) risks.push(inference('Keskmine hinnasiht on praegusest hinnast vähemalt 10% madalam, mis on täiendav kontrollisignaal.', analyst.id, prices[0]?.id));
  }
  return { whatChanged, catalysts, risks, watchNext, priceMove };
};
