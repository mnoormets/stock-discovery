"use strict";exports.id=453,exports.ids=[453],exports.modules={2453:(e,t,a)=>{a.d(t,{C6:()=>s,K6:()=>x,_O:()=>U,oW:()=>h,t$:()=>R});var n=a(6005),i=a(5748),r=a(1013);let s=175,o=new Set(["10-Q","10-K","20-F","40-F"]),c=new Map,u=new Map,l=null,d=null,p=[{metric:"revenue",taxonomy:"us-gaap",unit:"USD",duration:!0,tags:["RevenueFromContractWithCustomerExcludingAssessedTax","Revenues","SalesRevenueNet"]},{metric:"net_income",taxonomy:"us-gaap",unit:"USD",duration:!0,tags:["NetIncomeLoss","ProfitLoss"]},{metric:"operating_cash_flow",taxonomy:"us-gaap",unit:"USD",duration:!0,tags:["NetCashProvidedByUsedInOperatingActivities"]},{metric:"capital_expenditure",taxonomy:"us-gaap",unit:"USD",duration:!0,tags:["PaymentsToAcquirePropertyPlantAndEquipment","PaymentsForAdditionsToPropertyPlantAndEquipment"]},{metric:"cash",taxonomy:"us-gaap",unit:"USD",duration:!1,tags:["CashAndCashEquivalentsAtCarryingValue","CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"]},{metric:"shares_outstanding",taxonomy:"dei",unit:"shares",duration:!1,tags:["EntityCommonStockSharesOutstanding"],fallbacks:[{taxonomy:"us-gaap",tags:["CommonStockSharesOutstanding"]}]}],f=["LongTermDebtAndFinanceLeaseObligations","LongTermDebt"],E=["LongTermDebtAndFinanceLeaseObligationsCurrent","LongTermDebtCurrent"],m=["LongTermDebtAndFinanceLeaseObligationsNoncurrent","LongTermDebtNoncurrent"];function _(){return d||(d=i.d_.query(`
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS sec_cik TEXT;
      CREATE TABLE IF NOT EXISTS financial_facts (
        id BIGSERIAL PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        metric TEXT NOT NULL,
        value NUMERIC NOT NULL,
        unit TEXT NOT NULL,
        period_start DATE,
        period_end DATE NOT NULL,
        period_kind TEXT NOT NULL,
        fiscal_year INTEGER,
        fiscal_period TEXT,
        form_type TEXT NOT NULL,
        filed_at DATE NOT NULL,
        accession_number TEXT NOT NULL,
        taxonomy TEXT NOT NULL,
        tag TEXT NOT NULL,
        is_derived BOOLEAN NOT NULL DEFAULT false,
        source_url TEXT NOT NULL,
        fact_key TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (company_id, fact_key)
      );
      CREATE INDEX IF NOT EXISTS idx_financial_facts_company_metric_period
        ON financial_facts (company_id, metric, period_end DESC, filed_at DESC);
      CREATE TABLE IF NOT EXISTS financial_enrichment_status (
        company_id BIGINT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_success_at TIMESTAMPTZ,
        consecutive_failures INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_financial_enrichment_retry
        ON financial_enrichment_status (status, last_attempt_at);
    `).then(()=>void 0).catch(e=>{throw d=null,e})),d}function T(e){return"string"==typeof e&&/^\d{4}-\d{2}-\d{2}$/.test(e)?e:null}function N(e,t){return Math.round((new Date(`${t}T00:00:00Z`).getTime()-new Date(`${e}T00:00:00Z`).getTime())/864e5)}function y(e,t,a){let n=e.facts?.[a.taxonomy]||{},i=a.tags.find(e=>Array.isArray(n[e]?.units?.[a.unit]));if(!i)return[];let r=n[i]?.units?.[a.unit]||[],s=new Map;for(let e of r){let n=function(e){let t=Number(e);return Number.isFinite(t)?t:null}(e.val),r=T(e.end),c=T(e.start),u=T(e.filed),l="string"==typeof e.accn?e.accn:null,d="string"==typeof e.form?e.form:"",p=function(e,t){if(!t)return"instant";if(!e.start||!e.end)return null;let a=N(e.start,e.end);return a<60||a>430?null:a<=120?"quarter":a>=300?"annual":"ytd"}(e,a.duration);if(null==n||!r||!u||!l||!p||!o.has(d))continue;let f={id:null,metric:a.metric,value:n,unit:a.unit,periodStart:a.duration?c:null,periodEnd:r,periodKind:p,fiscalYear:Number.isInteger(e.fy)?Number(e.fy):null,fiscalPeriod:"string"==typeof e.fp?e.fp:null,form:d,filedAt:u,accessionNumber:l,taxonomy:a.taxonomy,tag:i,derived:!1,sourceUrl:`https://www.sec.gov/Archives/edgar/data/${Number(t)}/${l.replace(/-/g,"")}/`},E=`${f.periodStart||""}:${r}:${p}:${d}`,m=s.get(E);(!m||`${u}:${l}`>`${m.filedAt}:${m.accessionNumber}`)&&s.set(E,f)}return[...s.values()].sort((e,t)=>`${t.periodEnd}:${t.filedAt}`.localeCompare(`${e.periodEnd}:${e.filedAt}`)).slice(0,30)}function S(e,t,a){return y(e,t,{metric:"debt",taxonomy:"us-gaap",unit:"USD",duration:!1,tags:a})}async function L(e){let t=process.env.SEC_USER_AGENT;if(!t)return null;if(!l||l.expires<Date.now()){let e=await fetch("https://www.sec.gov/files/company_tickers.json",{headers:{"User-Agent":t,Accept:"application/json"},signal:AbortSignal.timeout(1e4),next:{revalidate:86400}});if(!e.ok)throw Error(`SEC ticker mapping vastas ${e.status}.`);l={expires:Date.now()+864e5,rows:Object.values(await e.json())}}let a=l.rows.find(t=>String(t.ticker).toUpperCase()===e);return a?{cik:String(a.cik_str).padStart(10,"0"),name:a.title||null}:null}async function A(e){let t=process.env.SEC_USER_AGENT;if(!t)return null;let a=await L(e);if(!a)return null;let n=await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${a.cik}.json`,{headers:{"User-Agent":t,Accept:"application/json"},signal:AbortSignal.timeout(1e4),cache:"no-store"});if(!n.ok)throw Error(`SEC CompanyFacts vastas ${n.status}.`);return{identity:a,facts:await n.json()}}async function D(e,t,a){let r=await i.d_.connect();try{await r.query("BEGIN");let i=await r.query(`INSERT INTO companies (ticker, name, source, sec_cik)
       VALUES ($1, $2, 'sec-companyfacts', $3)
       ON CONFLICT (ticker) DO UPDATE SET
         name = COALESCE(companies.name, EXCLUDED.name),
         sec_cik = EXCLUDED.sec_cik,
         updated_at = now()
       RETURNING id`,[e,t.name,t.cik]),s=Number(i.rows[0].id);for(let e of a)await r.query(`INSERT INTO financial_facts
           (company_id, metric, value, unit, period_start, period_end, period_kind,
            fiscal_year, fiscal_period, form_type, filed_at, accession_number,
            taxonomy, tag, is_derived, source_url, fact_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT (company_id, fact_key) DO UPDATE SET
           value = EXCLUDED.value,
           filed_at = EXCLUDED.filed_at,
           source_url = EXCLUDED.source_url,
           updated_at = now()`,[s,e.metric,e.value,e.unit,e.periodStart,e.periodEnd,e.periodKind,e.fiscalYear,e.fiscalPeriod,e.form,e.filedAt,e.accessionNumber,e.taxonomy,e.tag,e.derived,e.sourceUrl,(0,n.createHash)("sha256").update(JSON.stringify([e.metric,e.periodStart,e.periodEnd,e.periodKind,e.accessionNumber,e.tag,e.value,e.unit])).digest("hex")]);await r.query("COMMIT")}catch(e){throw await r.query("ROLLBACK"),e}finally{r.release()}}function v(e,t,a,n){let i=n.map(e=>({id:Number(e.id),metric:e.metric,value:Number(e.value),unit:e.unit,periodStart:e.period_start||null,periodEnd:e.period_end,periodKind:e.period_kind,fiscalYear:null==e.fiscal_year?null:Number(e.fiscal_year),fiscalPeriod:e.fiscal_period||null,form:e.form_type,filedAt:e.filed_at,accessionNumber:e.accession_number,taxonomy:e.taxonomy,tag:e.tag,derived:!!e.is_derived,sourceUrl:e.source_url})),r={};for(let e of[...new Set(i.map(e=>e.metric))]){let t=i.filter(t=>t.metric===e),a=function(e,t){let a=[...t].sort((e,t)=>`${t.periodEnd}:${t.filedAt}`.localeCompare(`${e.periodEnd}:${e.filedAt}`));return"revenue"===e||"net_income"===e?a.find(e=>"quarter"===e.periodKind)||a.find(e=>"annual"===e.periodKind)||a[0]||null:a[0]||null}(e,t);if(!a)continue;let n=function(e,t){let a=new Date(`${t.periodEnd}T00:00:00Z`).getTime(),n=t.periodStart?N(t.periodStart,t.periodEnd):0;return e.filter(e=>e.periodKind===t.periodKind).map(e=>({point:e,dayGap:Math.abs((a-new Date(`${e.periodEnd}T00:00:00Z`).getTime())/864e5-365),durationGap:t.periodStart&&e.periodStart?Math.abs(N(e.periodStart,e.periodEnd)-n):0})).filter(({dayGap:e,durationGap:t})=>e<=70&&t<=20).sort((e,t)=>e.dayGap+e.durationGap-(t.dayGap+t.durationGap))[0]?.point||null}(t.filter(e=>e!==a),a);r[e]={latest:a,previousComparable:n,yearOverYearPercent:n&&0!==n.value?(a.value-n.value)/Math.abs(n.value)*100:null}}return{ticker:e,cik:t,companyName:a,refreshedAt:n.map(e=>e.updated_at).filter(Boolean).sort().at(-1)||null,metrics:r}}async function w(e){await _();let t=await i.d_.query("SELECT id, name, sec_cik FROM companies WHERE ticker = $1",[e]);if(!t.rowCount)return null;let a=t.rows[0],n=await i.d_.query(`SELECT id, metric, value, unit, to_char(period_start, 'YYYY-MM-DD') AS period_start,
            to_char(period_end, 'YYYY-MM-DD') AS period_end, period_kind, fiscal_year,
            fiscal_period, form_type, to_char(filed_at, 'YYYY-MM-DD') AS filed_at,
            accession_number, taxonomy, tag, is_derived, source_url, updated_at
     FROM financial_facts WHERE company_id = $1
     ORDER BY period_end DESC, filed_at DESC`,[a.id]);return n.rowCount?v(e,a.sec_cik||"",a.name||null,n.rows):null}async function h(){await _();let e=await i.d_.query(`SELECT c.id AS company_id, c.ticker, c.name, c.sec_cik,
            f.id, f.metric, f.value, f.unit,
            to_char(f.period_start, 'YYYY-MM-DD') AS period_start,
            to_char(f.period_end, 'YYYY-MM-DD') AS period_end,
            f.period_kind, f.fiscal_year, f.fiscal_period, f.form_type,
            to_char(f.filed_at, 'YYYY-MM-DD') AS filed_at,
            f.accession_number, f.taxonomy, f.tag, f.is_derived,
            f.source_url, f.updated_at
     FROM companies c
     JOIN financial_facts f ON f.company_id = c.id
     ORDER BY c.id, f.period_end DESC, f.filed_at DESC`),t=new Map;for(let a of e.rows){let e=Number(a.company_id),n=t.get(e)||[];n.push(a),t.set(e,n)}return[...t.values()].map(e=>v(e[0].ticker,e[0].sec_cik||"",e[0].name||null,e))}async function g(){let e=await i.d_.query(`SELECT count(*)::int AS universe,
            count(*) FILTER (
              WHERE EXISTS (SELECT 1 FROM financial_facts f WHERE f.company_id = c.id)
            )::int AS covered
     FROM companies c
     WHERE c.ticker <> 'SPY'
       AND c.quote_type IS DISTINCT FROM 'ETF'
       AND EXISTS (
         SELECT 1 FROM price_snapshots p
         WHERE p.company_id = c.id AND p.captured_at >= now() - interval '30 days'
       )`);return{universe:Number(e.rows[0]?.universe||0),covered:Number(e.rows[0]?.covered||0)}}async function C(e){return(await i.d_.query(`SELECT c.id AS company_id, c.ticker
     FROM companies c
     JOIN LATERAL (
       SELECT max(p.captured_at) AS latest_price_at
       FROM price_snapshots p WHERE p.company_id = c.id
     ) prices ON true
     LEFT JOIN LATERAL (
       SELECT max(f.updated_at) AS facts_updated_at
       FROM financial_facts f WHERE f.company_id = c.id
     ) facts ON true
     LEFT JOIN financial_enrichment_status enrichment ON enrichment.company_id = c.id
     WHERE c.ticker <> 'SPY'
       AND c.quote_type IS DISTINCT FROM 'ETF'
       AND prices.latest_price_at >= now() - interval '30 days'
       AND (
         (
           facts.facts_updated_at IS NULL
           AND (
             enrichment.last_attempt_at IS NULL
             OR (enrichment.status = 'error' AND enrichment.last_attempt_at < now() - interval '1 day')
             OR (enrichment.status = 'unavailable' AND enrichment.last_attempt_at < now() - interval '30 days')
           )
         )
         OR (
           facts.facts_updated_at < now() - interval '7 days'
           AND (enrichment.last_attempt_at IS NULL OR enrichment.last_attempt_at < now() - interval '1 day')
         )
       )
     ORDER BY (facts.facts_updated_at IS NULL) DESC,
              (enrichment.last_attempt_at IS NULL) DESC,
              enrichment.last_attempt_at ASC NULLS FIRST,
              prices.latest_price_at DESC,
              c.ticker
     LIMIT $1`,[e])).rows.map(e=>({companyId:Number(e.company_id),ticker:String(e.ticker)}))}async function O(){let e=await i.d_.query(`SELECT count(*)::int AS attempts
     FROM financial_enrichment_status
     WHERE last_attempt_at >= (
       date_trunc('day', now() AT TIME ZONE 'Europe/Tallinn') AT TIME ZONE 'Europe/Tallinn'
     )`);return Number(e.rows[0]?.attempts||0)}async function $(e,t,a){await i.d_.query(`INSERT INTO financial_enrichment_status
       (company_id, status, last_attempt_at, last_success_at, consecutive_failures, last_error)
     VALUES ($1, $2, now(), CASE WHEN $2 = 'success' THEN now() ELSE NULL END,
             CASE WHEN $2 = 'error' THEN 1 ELSE 0 END, $3)
     ON CONFLICT (company_id) DO UPDATE SET
       status = EXCLUDED.status,
       last_attempt_at = now(),
       last_success_at = CASE
         WHEN EXCLUDED.status = 'success' THEN now()
         ELSE financial_enrichment_status.last_success_at
       END,
       consecutive_failures = CASE
         WHEN EXCLUDED.status = 'error' THEN financial_enrichment_status.consecutive_failures + 1
         ELSE 0
       END,
       last_error = EXCLUDED.last_error,
       updated_at = now()`,[e,t,function(e,t=500){return e?[...e].slice(0,t).join(""):null}(a)])}async function U(e=5){await _();let t=Math.max(1,Math.min(20,Math.trunc(e)||5)),a=await g();if(!process.env.SEC_USER_AGENT)return{status:"disabled",financialUniverse:a.universe,coveredBefore:a.covered,coveredAfter:a.covered,attempted:0,enriched:0,unavailable:0,failed:0,dailyLimit:t,attemptedTodayBefore:0,dailyRemaining:t,attemptedTickers:[],unavailableTickers:[],failedTickers:[]};let n=await O(),i=Math.max(0,t-n),r=i>0?await C(i):[],o=[],c=[],u=[],l=0;for(let[e,t]of r.entries()){o.push(t.ticker);try{await b(t.ticker)?(l+=1,await $(t.companyId,"success",null)):(c.push(t.ticker),await $(t.companyId,"unavailable","SEC CompanyFacts ei andnud skooritavat finantsajalugu."))}catch(a){u.push(t.ticker);let e=a.message||"Tundmatu SEC enrichment viga.";console.error(`Ettev\xf5tte ${t.ticker} p\xe4evane SEC enrichment eba\xf5nnestus:`,e),await $(t.companyId,"error",e).catch(e=>{console.error(`Ettev\xf5tte ${t.ticker} enrichment staatuse salvestamine eba\xf5nnestus:`,e)})}e<r.length-1&&await function(e){return new Promise(t=>setTimeout(t,e))}(s)}let d=await g();return{status:"completed",financialUniverse:d.universe,coveredBefore:a.covered,coveredAfter:d.covered,attempted:o.length,enriched:l,unavailable:c.length,failed:u.length,dailyLimit:t,attemptedTodayBefore:n,dailyRemaining:Math.max(0,t-n-o.length),attemptedTickers:o,unavailableTickers:c,failedTickers:u}}async function I(e){let t=(0,r.L)(e);if(!t)return null;await _();let a=await A(t);if(!a)return null;let n=p.flatMap(e=>(function(e,t,a){let n=y(e,t,a);if(n.length>0)return n;for(let n of a.fallbacks||[]){let i=y(e,t,{...a,taxonomy:n.taxonomy,tags:n.tags});if(i.length>0)return i}return[]})(a.facts,a.identity.cik,e)),i=n.filter(e=>"operating_cash_flow"===e.metric),s=n.filter(e=>"capital_expenditure"===e.metric),o=[...n,...function(e,t){let a=S(e,t,f);if(a.length)return a;let n=S(e,t,E),i=S(e,t,m),r=new Map(n.map(e=>[e.periodEnd,e]));return i.flatMap(e=>{let t=r.get(e.periodEnd);return t?[{...e,value:e.value+t.value,accessionNumber:e.accessionNumber===t.accessionNumber?e.accessionNumber:`${e.accessionNumber}+${t.accessionNumber}`,tag:`${t.tag}+${e.tag}`,derived:!0,sourceUrl:e.sourceUrl}]:[]})}(a.facts,a.identity.cik),...function(e,t){let a=new Map(t.map(e=>[`${e.periodStart}:${e.periodEnd}:${e.periodKind}`,e]));return e.flatMap(e=>{let t=a.get(`${e.periodStart}:${e.periodEnd}:${e.periodKind}`);return t?[{...e,metric:"free_cash_flow",value:e.value-Math.abs(t.value),accessionNumber:e.accessionNumber===t.accessionNumber?e.accessionNumber:`${e.accessionNumber}+${t.accessionNumber}`,tag:`${e.tag}-${t.tag}`,derived:!0}]:[]})}(i,s)];return await D(t,a.identity,o),w(t)}function b(e){let t=(0,r.L)(e);if(!t)return Promise.resolve(null);let a=u.get(t);if(a)return a;let n=I(t).finally(()=>u.delete(t));return u.set(t,n),n}async function R(e){let t=(0,r.L)(e);if(!t)return null;let a=c.get(t);if(a&&a.expires>Date.now())return a.value;let n=await w(t).catch(e=>(console.error(`Ettev\xf5tte ${t} SEC finantsfaktide lugemine eba\xf5nnestus:`,e),null));if(n)return c.set(t,{expires:Date.now()+216e5,value:n}),(!n.refreshedAt||Date.now()-new Date(n.refreshedAt).getTime()>=216e5)&&b(t).then(e=>{c.set(t,{expires:Date.now()+216e5,value:e})}).catch(e=>console.error(`Ettev\xf5tte ${t} SEC CompanyFactsi taustav\xe4rskendus eba\xf5nnestus:`,e)),n;try{let e=await b(t);return c.set(t,{expires:Date.now()+216e5,value:e}),e}catch(e){return console.error(`Ettev\xf5tte ${t} SEC CompanyFactsi p\xe4ring eba\xf5nnestus:`,e),null}}async function x(e){let t=(0,r.L)(e);if(!t)return null;let a=c.get(t);if(a&&a.expires>Date.now())return a.value;let n=await w(t).catch(e=>(console.error(`Ettev\xf5tte ${t} SEC finantsfaktide DB-lugemine eba\xf5nnestus:`,e),null));return n?c.set(t,{expires:Date.now()+216e5,value:n}):c.delete(t),(!n?.refreshedAt||Date.now()-new Date(n.refreshedAt).getTime()>=216e5)&&b(t).then(e=>{c.set(t,{expires:Date.now()+216e5,value:e})}).catch(e=>console.error(`Ettev\xf5tte ${t} SEC CompanyFactsi taustav\xe4rskendus eba\xf5nnestus:`,e)),n}},1013:(e,t,a)=>{a.d(t,{L:()=>n});function n(e){let t=e.trim().toUpperCase();return/^[A-Z0-9][A-Z0-9.-]{0,9}$/.test(t)?t:null}}};