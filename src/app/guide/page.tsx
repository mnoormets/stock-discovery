import Link from 'next/link';

export const dynamic = 'force-static';

const steps = [
  ['1', 'Daily Changes', 'Alusta päevast: vaata, milline aktiivne või jälgitav ticker vajab uue info tõttu ülevaatust.', '/daily'],
  ['2', 'Watchlist', 'Kontrolli olulisi score-muutusi, muutuvaid komponente ja uurimisideid.', '/watchlist'],
  ['3', 'Ettevõtte faktivaade', 'Otsi avalehel ticker ning kontrolli SEC finantsid, uudised, earnings, skooride põhjused ja algallikad.', '/'],
  ['4', 'Leia järgmine RKLB', 'Kasuta läbipaistvat preset’it 0–5 põhjendatud kandidaadi leidmiseks.', '/scanner?preset=rklb'],
  ['5', 'Thesis Builder', 'Lisa kandidaat Watchlisti, sõnasta hüpoteesid, invalidation ja 12 kuu mõõdetav kontrollpunkt.', '/watchlist'],
];

export default function GuidePage() {
  return (
    <main className="wrap pageStack">
      <section className="hero compact"><p className="eyebrow">USER GUIDE</p><h1>Kuidas Stock Discoveryt kasutada?</h1><p className="lead">Rakendus aitab uurimist struktureerida. See ei anna ostu- ega müügisoovitusi.</p></section>
      <section className="guideSteps">{steps.map(([number, title, detail, href]) => (
        <article className="card guideStep" key={number}><span>{number}</span><div><h2>{title}</h2><p>{detail}</p><Link href={href}>Ava vaade →</Link></div></article>
      ))}</section>
      <section className="card section"><h2>Neli reeglit</h2><ol className="guideRules"><li>Kõrge skoor tähendab „uuri lähemalt”, mitte „osta”.</li><li>Kontrolli Coverage Score’i ja algallikaid enne järeldust.</li><li>Moat, mispricing ja „miks praegu?” on kasutaja tõendatavad hüpoteesid.</li><li>`ready` tees vajab mõõdetavat invalidation-tingimust ja 12 kuu kontrollpunkti.</li></ol></section>
      <section className="card section"><h2>Mida rakendus veel ei tee?</h2><p>IPO/Nasdaq uute noteeringute radar ja salvestatud discovery-ajaloost varasem turu rekonstrueerimine on eraldi tulevased etapid. Puuduvat sector/industry infot ei oletata ning alla viie võrreldava ettevõtte korral percentile&apos;i ei näidata.</p><p className="muted">Täielik kasutajajuhend asub repos failis <code>docs/USER_GUIDE.md</code>.</p></section>
    </main>
  );
}
