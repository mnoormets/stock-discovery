import type { ArticleScan } from '@/lib/article-evidence';
export default function ArticleContents({scan}:{scan?:ArticleScan}) {
  return <section id="article-contents"><h3>Article content evidence</h3>
    <p>Public article bodies are read separately from headlines. Extracted statements are unverified source claims, not forecasts or recommendations. This rule-based reader does not yet compare numeric consensus, establish event materiality or change stock selection or paper trades.</p>
    {!scan?<p>No article-content capture in this collection. Earlier collections remain unchanged.</p>:<>
      <p>{scan.version} · captured {scan.observedAt} · {scan.attempted} new attempts / 10 per collection · {scan.cached} cached · {scan.deferred} deferred · {scan.candidateCount} search observations. Status metadata covers the search set; up to 60 recent bodies retained here, with earlier text preserved in its original collection. Article text is capped at 40,000 characters. Reprints are flagged, not independent confirmation.</p>
      <p>Access restrictions, robots rules, unreadable pages and publication-time gaps stay visible. No scripts, sign-in, paywall bypass or paid sources.</p>
      {scan.articles.map(a=><details key={a.id}><summary>{a.tickers.join(', ')||'Issuer unresolved'} · {a.title} · {a.status}{a.reason?' — '+a.reason:''}</summary>
        <p><a href={a.resolvedURL??a.sourceURL} target="_blank" rel="noreferrer">Article source</a> · read {a.fetchedAt} · article publication {a.publishedAt??'Unknown'} · update {a.modifiedAt??'Unknown'}. Search publication is separate and never substituted for the article metadata.</p>
        {a.status==='extracted'&&<>
          <p>Body retained here: {a.text?'Yes':'Earlier collection only'}. Extracted {a.textLength} characters{a.truncated?' (stored/analysed first 40,000; remaining text not analysed)':''} · SHA256 {a.sha256} · {a.duplicateOf?'Same extracted content as '+a.duplicateOf:'No exact content duplicate found; source independence remains unverified'}.</p>
          <ul>{a.claims.map((c,i)=><li key={i}>{c.topic} · {c.role} · {c.expectation} · reported quantities: {c.numbers.join('; ')||'None extracted'}</li>)}</ul>
          {a.claims[0]&&<p>Source excerpt: “{a.claims[0].sentence.split(/\s+/).slice(0,24).join(' ')}…”</p>}
          {!a.claims.length&&<p>No supported event statement extracted. This does not establish that the article has no useful information.</p>}
        </>}
      </details>)}
    </>}
  </section>;
}
