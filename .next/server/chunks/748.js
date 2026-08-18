"use strict";exports.id=748,exports.ids=[748],exports.modules={5748:(e,T,t)=>{t.d(T,{$0:()=>l,Os:()=>c,P3:()=>L,QY:()=>d,RR:()=>p,Yq:()=>o,aj:()=>_,cR:()=>u,d_:()=>n,gH:()=>I,gi:()=>O,hx:()=>S,tj:()=>A,vF:()=>U});var E=t(5900),i=t(6005);let a=globalThis,n=a._pgPool??new E.Pool({connectionString:process.env.DATABASE_URL||"postgres://discovery:discovery@db:5432/discovery"});async function s(e,T){let{rows:t}=await e.query(`INSERT INTO companies
       (ticker, name, exchange, quote_type, currency, source, sector, industry,
        classification_source, classification_updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
             CASE WHEN $7::text IS NOT NULL OR $8::text IS NOT NULL THEN now() ELSE NULL END)
     ON CONFLICT (ticker) DO UPDATE SET
       name = COALESCE(EXCLUDED.name, companies.name),
       exchange = COALESCE(EXCLUDED.exchange, companies.exchange),
       quote_type = COALESCE(EXCLUDED.quote_type, companies.quote_type),
       currency = COALESCE(EXCLUDED.currency, companies.currency),
       sector = COALESCE(EXCLUDED.sector, companies.sector),
       industry = COALESCE(EXCLUDED.industry, companies.industry),
       classification_source = COALESCE(EXCLUDED.classification_source, companies.classification_source),
       classification_updated_at = CASE
         WHEN EXCLUDED.sector IS NOT NULL OR EXCLUDED.industry IS NOT NULL THEN now()
         ELSE companies.classification_updated_at END,
       source = EXCLUDED.source,
       updated_at = now()
     RETURNING id`,[T.ticker,T.name,T.exchange,T.quoteType,T.currency,T.source,T.sector||null,T.industry||null,T.classificationSource||null]);return Number(t[0].id)}async function r(e,T,t){await e.query("SELECT pg_advisory_xact_lock($1)",[T]),await e.query(`INSERT INTO price_snapshots
       (company_id, price, previous_close, market_cap, volume, currency, source)
     SELECT $1, $2, $3, $4, $5, $6, $7
     WHERE NOT EXISTS (
       SELECT 1 FROM price_snapshots
       WHERE company_id = $1
         AND captured_at >= now() - interval '5 minutes'
         AND price IS NOT DISTINCT FROM $2::numeric
         AND previous_close IS NOT DISTINCT FROM $3::numeric
         AND market_cap IS NOT DISTINCT FROM $4::bigint
         AND volume IS NOT DISTINCT FROM $5::bigint
         AND currency IS NOT DISTINCT FROM $6::text
         AND source = $7
     )`,[T,t.price,t.previousClose,t.marketCap,t.volume,t.currency,t.source])}async function c(e){let T=await n.connect();try{await T.query("BEGIN");let{quote:t}=e,E=await s(T,{ticker:t.ticker,name:t.name,exchange:t.exchange,quoteType:t.quoteType,currency:t.currency,source:"yahoo",sector:t.sector,industry:t.industry,classificationSource:t.classificationSource});for(let i of(await r(T,E,{price:t.price,previousClose:t.previousClose,marketCap:t.marketCap,volume:t.volume,currency:t.currency,source:"yahoo"}),e.news))await T.query(`INSERT INTO news_items
           (id, company_id, title, publisher, url, published_at, source)
         VALUES ($1, $2, $3, $4, $5, $6, 'yahoo')
         ON CONFLICT DO NOTHING`,[i.id,E,i.title,i.publisher,i.url,i.publishedAt]);for(let t of e.secFilings)await T.query(`INSERT INTO sec_events
           (id, company_id, form_type, filed_at, description, url, source)
         VALUES ($1, $2, $3, $4, $5, $6, 'sec')
         ON CONFLICT (id) DO UPDATE SET
           company_id = EXCLUDED.company_id,
           form_type = EXCLUDED.form_type,
           filed_at = EXCLUDED.filed_at,
           description = EXCLUDED.description,
           url = EXCLUDED.url`,[t.id,E,t.form,t.filedAt||null,t.description,t.url]);if(t.earningsAt&&(await T.query(`DELETE FROM earnings_events
         WHERE company_id = $1 AND source = 'yahoo'
           AND event_at >= now() AND event_at <> $2::timestamptz`,[E,t.earningsAt]),await T.query(`INSERT INTO earnings_events (company_id, event_at, source)
         VALUES ($1, $2, 'yahoo')
         ON CONFLICT (company_id, event_at, source)
         DO UPDATE SET updated_at = now()`,[E,t.earningsAt])),e.analystView){let t=e.analystView,a=(0,i.createHash)("sha256").update(JSON.stringify([t.targetMeanPrice,t.targetHighPrice,t.targetLowPrice,t.recommendationMean,t.recommendationKey,t.numberOfAnalystOpinions])).digest("hex");await T.query(`INSERT INTO analyst_targets
           (company_id, target_mean_price, target_high_price, target_low_price,
            recommendation_mean, recommendation_key, analyst_count, source, data_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'yahoo', $8)
         ON CONFLICT (company_id, data_hash) DO UPDATE SET captured_at = now()`,[E,t.targetMeanPrice,t.targetHighPrice,t.targetLowPrice,t.recommendationMean,t.recommendationKey,t.numberOfAnalystOpinions,a])}await T.query("COMMIT")}catch(e){throw await T.query("ROLLBACK"),e}finally{T.release()}}async function o(e){let T=new Map;if(0===e.length)return T;let t=await n.connect();try{for(let E of(await t.query("BEGIN"),e)){let e=E.fundamentalsSource||"collection",i=await s(t,{ticker:E.ticker,name:E.name||null,exchange:null,quoteType:null,currency:E.currency,source:e});T.set(E.ticker,i),(null!=E.price||null!=E.marketCap||null!=E.volume)&&await r(t,i,{price:E.price,previousClose:null,marketCap:E.marketCap,volume:E.volume,currency:E.currency,source:e})}return await t.query("COMMIT"),T}catch(e){throw await t.query("ROLLBACK"),e}finally{t.release()}}function N(e){return e.trim().toUpperCase()}async function L(e,T){let t=[...new Set([...e].map(N).filter(Boolean))],E=new Map;if(0===t.length)return E;let i=new Set(t),a=await n.connect();try{for(let e of(await a.query("BEGIN"),(await a.query(`SELECT id, upper(ticker) AS ticker
       FROM companies
       WHERE upper(ticker) = ANY($1::text[])
       ORDER BY id`,[t])).rows)){let T=String(e.ticker);E.has(T)||E.set(T,Number(e.id))}for(let e of T.values()){let T=N(e.ticker);if(!T||!i.has(T)||null==e.price&&null==e.marketCap&&null==e.volume)continue;let t=await s(a,{ticker:T,name:e.name||null,exchange:null,quoteType:e.isFund?"ETF":null,currency:e.currency||null,source:e.source||"collection"});await r(a,t,{price:e.price??null,previousClose:null,marketCap:e.marketCap??null,volume:e.volume??null,currency:e.currency||null,source:e.source||"collection"}),E.set(T,t)}return await a.query("COMMIT"),E}catch(e){throw await a.query("ROLLBACK"),e}finally{a.release()}}async function _(){await n.query(`
    CREATE TABLE IF NOT EXISTS collection_runs (
      id BIGSERIAL PRIMARY KEY,
      trigger TEXT NOT NULL DEFAULT 'direct',
      status TEXT NOT NULL DEFAULT 'running',
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      finished_at TIMESTAMPTZ,
      duration_ms BIGINT,
      metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
      error_name TEXT,
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT collection_runs_trigger_check CHECK (char_length(trigger) BETWEEN 1 AND 64),
      CONSTRAINT collection_runs_status_check CHECK (status IN ('running', 'success', 'failure')),
      CONSTRAINT collection_runs_metrics_object_check CHECK (jsonb_typeof(metrics) = 'object'),
      CONSTRAINT collection_runs_lifecycle_check CHECK (
        (status = 'running' AND finished_at IS NULL AND duration_ms IS NULL AND error_name IS NULL AND error_message IS NULL)
        OR (status = 'success' AND finished_at IS NOT NULL AND duration_ms >= 0 AND error_name IS NULL AND error_message IS NULL)
        OR (status = 'failure' AND finished_at IS NOT NULL AND duration_ms >= 0 AND error_message IS NOT NULL)
      )
    );
    CREATE INDEX IF NOT EXISTS idx_collection_runs_started
      ON collection_runs (started_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_collection_runs_status_started
      ON collection_runs (status, started_at DESC, id DESC);
    CREATE TABLE IF NOT EXISTS snapshots (
      id BIGSERIAL PRIMARY KEY,
      capture_date DATE NOT NULL,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      ticker TEXT NOT NULL,
      name TEXT,
      mentions INTEGER NOT NULL DEFAULT 0,
      mentions_prev INTEGER,
      mention_growth NUMERIC,
      upvotes INTEGER,
      rank INTEGER,
      rank_prev INTEGER,
      sentiment TEXT,
      sentiment_source TEXT,
      sentiment_value NUMERIC,
      market_cap BIGINT,
      price NUMERIC,
      currency TEXT,
      discovery_score NUMERIC,
      is_new BOOLEAN NOT NULL DEFAULT false,
      UNIQUE (capture_date, ticker)
    );
    ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS volume BIGINT;
    ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS fundamentals_source TEXT;
    ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS rising_days INTEGER DEFAULT 0;
    ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS sec_suspended BOOLEAN DEFAULT false;
    ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS warnings TEXT;

    CREATE TABLE IF NOT EXISTS sec_suspensions (
      normalized  TEXT PRIMARY KEY,   -- normaliseeritud firmanimi (sobitamiseks)
      company     TEXT NOT NULL,      -- originaalnimi feedist
      link        TEXT,
      pub_date    TEXT,
      first_seen  TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen   TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS companies (
      id BIGSERIAL PRIMARY KEY,
      ticker TEXT NOT NULL UNIQUE,
      name TEXT,
      exchange TEXT,
      quote_type TEXT,
      currency TEXT,
      source TEXT,
      sector TEXT,
      industry TEXT,
      classification_source TEXT,
      classification_updated_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS price_snapshots (
      id BIGSERIAL PRIMARY KEY,
      company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      price NUMERIC,
      previous_close NUMERIC,
      market_cap BIGINT,
      volume BIGINT,
      currency TEXT,
      source TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS news_items (
      id TEXT PRIMARY KEY,
      company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      publisher TEXT,
      summary TEXT,
      url TEXT NOT NULL,
      published_at TIMESTAMPTZ,
      source TEXT NOT NULL,
      discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (company_id, url)
    );
    CREATE TABLE IF NOT EXISTS sec_events (
      id TEXT PRIMARY KEY,
      company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
      form_type TEXT,
      filed_at DATE,
      description TEXT,
      url TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'sec',
      discovered_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS earnings_events (
      id BIGSERIAL PRIMARY KEY,
      company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      event_at TIMESTAMPTZ NOT NULL,
      timing TEXT,
      source TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (company_id, event_at, source)
    );
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
    CREATE TABLE IF NOT EXISTS company_score_snapshots (
      id BIGSERIAL PRIMARY KEY,
      company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      scoring_version TEXT NOT NULL,
      input_hash TEXT NOT NULL,
      growth_score INTEGER,
      health_score INTEGER,
      coverage_score INTEGER NOT NULL,
      payload JSONB NOT NULL,
      calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (company_id, scoring_version, input_hash)
    );
    CREATE INDEX IF NOT EXISTS idx_company_scores_company_time
      ON company_score_snapshots (company_id, calculated_at DESC, id DESC);
    CREATE TABLE IF NOT EXISTS analyst_targets (
      id BIGSERIAL PRIMARY KEY,
      company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      target_mean_price NUMERIC,
      target_high_price NUMERIC,
      target_low_price NUMERIC,
      recommendation_mean NUMERIC,
      recommendation_key TEXT,
      analyst_count INTEGER,
      source TEXT NOT NULL,
      data_hash TEXT NOT NULL,
      UNIQUE (company_id, data_hash)
    );
    CREATE INDEX IF NOT EXISTS idx_analyst_company_time
      ON analyst_targets (company_id, captured_at DESC);
    CREATE TABLE IF NOT EXISTS research_briefs (
      id BIGSERIAL PRIMARY KEY,
      company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      input_hash TEXT NOT NULL,
      model TEXT NOT NULL,
      content JSONB NOT NULL,
      source_count INTEGER NOT NULL DEFAULT 0,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (company_id, input_hash)
    );
    CREATE INDEX IF NOT EXISTS idx_research_briefs_company_time
      ON research_briefs (company_id, generated_at DESC);
    CREATE TABLE IF NOT EXISTS portfolio_positions (
      id BIGSERIAL PRIMARY KEY,
      company_id BIGINT REFERENCES companies(id) ON DELETE RESTRICT,
      ticker TEXT NOT NULL,
      quantity NUMERIC NOT NULL CHECK (quantity >= 0),
      average_buy_price NUMERIC NOT NULL CHECK (average_buy_price >= 0),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'watch', 'closed')),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS investment_theses (
      id BIGSERIAL PRIMARY KEY,
      position_id BIGINT NOT NULL REFERENCES portfolio_positions(id) ON DELETE CASCADE,
      thesis TEXT NOT NULL,
      business TEXT,
      why_now TEXT,
      moat TEXT,
      mispricing TEXT,
      catalyst TEXT,
      invalidation TEXT,
      twelve_month_checkpoint TEXT,
      checkpoint_is_measurable BOOLEAN NOT NULL DEFAULT false,
      time_horizon TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      version INTEGER NOT NULL DEFAULT 1,
      content_hash TEXT,
      score_snapshot_id BIGINT,
      is_current BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS sector TEXT;
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS industry TEXT;
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS classification_source TEXT;
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS classification_updated_at TIMESTAMPTZ;
    ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS business TEXT;
    ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS why_now TEXT;
    ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS moat TEXT;
    ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS mispricing TEXT;
    ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS catalyst TEXT;
    ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS invalidation TEXT;
    ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS twelve_month_checkpoint TEXT;
    ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS checkpoint_is_measurable BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
    ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS content_hash TEXT;
    ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS score_snapshot_id BIGINT;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_one_current_thesis
      ON investment_theses (position_id) WHERE is_current;
    CREATE INDEX IF NOT EXISTS idx_thesis_position_history
      ON investment_theses (position_id, version DESC, created_at DESC);
    CREATE TABLE IF NOT EXISTS thesis_change_events (
      id BIGSERIAL PRIMARY KEY,
      position_id BIGINT NOT NULL REFERENCES portfolio_positions(id) ON DELETE CASCADE,
      previous_thesis TEXT,
      new_thesis TEXT,
      change_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS alerts (
      id BIGSERIAL PRIMARY KEY,
      company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE,
      position_id BIGINT REFERENCES portfolio_positions(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      title TEXT NOT NULL,
      detail TEXT,
      source_url TEXT,
      occurred_at TIMESTAMPTZ NOT NULL,
      dedupe_key TEXT,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (company_id, kind, title, occurred_at)
    );
    ALTER TABLE alerts ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
    ALTER TABLE alerts ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_dedupe_key
      ON alerts (dedupe_key) WHERE dedupe_key IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_alerts_position_occurred
      ON alerts (position_id, occurred_at DESC, id DESC);
    CREATE TABLE IF NOT EXISTS discovery_runs (
      id BIGSERIAL PRIMARY KEY,
      run_type TEXT NOT NULL DEFAULT 'rklb',
      decision_date DATE NOT NULL,
      run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      model_version TEXT NOT NULL,
      input_hash TEXT NOT NULL,
      run_key TEXT NOT NULL UNIQUE,
      rules JSONB NOT NULL,
      universe JSONB NOT NULL,
      evaluated_count INTEGER NOT NULL,
      included_count INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_discovery_runs_time
      ON discovery_runs (run_at DESC, id DESC);
    CREATE TABLE IF NOT EXISTS discovery_decisions (
      id BIGSERIAL PRIMARY KEY,
      run_id BIGINT NOT NULL REFERENCES discovery_runs(id) ON DELETE CASCADE,
      company_id BIGINT REFERENCES companies(id) ON DELETE SET NULL,
      ticker TEXT NOT NULL,
      included BOOLEAN NOT NULL,
      candidate_rank INTEGER,
      exclusion_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
      growth_score INTEGER,
      health_score INTEGER,
      coverage_score INTEGER NOT NULL,
      decision_price NUMERIC,
      currency TEXT,
      market_cap BIGINT,
      volume BIGINT,
      price_snapshot_id BIGINT,
      score_snapshot_id BIGINT,
      scoring_version TEXT,
      runway_status TEXT NOT NULL,
      runway_detail TEXT NOT NULL,
      catalyst_status TEXT NOT NULL,
      catalyst_type TEXT,
      catalyst_source_id TEXT,
      catalyst_url TEXT,
      catalyst_at TIMESTAMPTZ,
      catalyst_detail TEXT NOT NULL,
      risks JSONB NOT NULL DEFAULT '[]'::jsonb,
      unknowns JSONB NOT NULL DEFAULT '[]'::jsonb,
      reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
      criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
      proof_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
      sector TEXT,
      industry TEXT,
      sector_group_type TEXT,
      sector_growth_percentile NUMERIC,
      sector_health_percentile NUMERIC,
      sector_coverage_percentile NUMERIC,
      sector_market_cap_percentile NUMERIC,
      sector_comparable_count INTEGER,
      sector_median_growth NUMERIC,
      sector_median_health NUMERIC,
      sector_median_coverage NUMERIC,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (run_id, ticker)
    );
    ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector TEXT;
    ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS industry TEXT;
    ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector_group_type TEXT;
    ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector_growth_percentile NUMERIC;
    ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector_health_percentile NUMERIC;
    ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector_coverage_percentile NUMERIC;
    ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector_market_cap_percentile NUMERIC;
    ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector_comparable_count INTEGER;
    ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector_median_growth NUMERIC;
    ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector_median_health NUMERIC;
    ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector_median_coverage NUMERIC;
    ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_assessment_version TEXT;
    ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_evidence_status TEXT;
    ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_evidence_tier INTEGER;
    ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_event_kind TEXT;
    ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_source_kind TEXT;
    ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_materiality TEXT;
    ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_materiality_ratio NUMERIC;
    ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_direction TEXT;
    ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_novelty TEXT;
    ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_thesis_relevance TEXT;
    ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_mandate_relevance TEXT;
    ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_evidence_freshness TEXT;
    ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_event_id BIGINT;
    ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_linked_period_end DATE;
    ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_next_scheduled_at TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS idx_discovery_decisions_ticker_time
      ON discovery_decisions (ticker, run_id DESC);
    CREATE INDEX IF NOT EXISTS idx_discovery_decisions_included
      ON discovery_decisions (included, run_id DESC);
    CREATE TABLE IF NOT EXISTS candidate_outcomes (
      id BIGSERIAL PRIMARY KEY,
      decision_id BIGINT NOT NULL REFERENCES discovery_decisions(id) ON DELETE CASCADE,
      horizon TEXT NOT NULL,
      target_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      observed_at TIMESTAMPTZ,
      observed_price NUMERIC,
      return_percent NUMERIC,
      measured_at TIMESTAMPTZ,
      benchmark_symbol TEXT NOT NULL DEFAULT 'SPY',
      benchmark_status TEXT NOT NULL DEFAULT 'pending',
      benchmark_start_at TIMESTAMPTZ,
      benchmark_end_at TIMESTAMPTZ,
      benchmark_price_start NUMERIC,
      benchmark_price_end NUMERIC,
      benchmark_return_percent NUMERIC,
      excess_return_percent NUMERIC,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (decision_id, horizon)
    );
    ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS benchmark_symbol TEXT NOT NULL DEFAULT 'SPY';
    ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS benchmark_status TEXT NOT NULL DEFAULT 'pending';
    ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS benchmark_start_at TIMESTAMPTZ;
    ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS benchmark_end_at TIMESTAMPTZ;
    ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS benchmark_price_start NUMERIC;
    ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS benchmark_price_end NUMERIC;
    ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS benchmark_return_percent NUMERIC;
    ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS excess_return_percent NUMERIC;
    CREATE INDEX IF NOT EXISTS idx_candidate_outcomes_status_target
      ON candidate_outcomes (status, target_at);
    CREATE TABLE IF NOT EXISTS catalyst_events (
      id BIGSERIAL PRIMARY KEY,
      company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      event_kind TEXT NOT NULL,
      source_kind TEXT NOT NULL,
      source_ref TEXT NOT NULL,
      occurred_at TIMESTAMPTZ,
      headline TEXT,
      url TEXT,
      accession_number TEXT,
      form_type TEXT,
      linked_fact_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      linked_period_end DATE,
      linked_period_kind TEXT,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (company_id, event_kind, source_ref)
    );
    CREATE INDEX IF NOT EXISTS idx_catalyst_events_company_time
      ON catalyst_events (company_id, occurred_at DESC, id DESC);
    CREATE TABLE IF NOT EXISTS catalyst_assessments (
      id BIGSERIAL PRIMARY KEY,
      catalyst_event_id BIGINT NOT NULL REFERENCES catalyst_events(id) ON DELETE CASCADE,
      assessment_version TEXT NOT NULL,
      materiality TEXT NOT NULL,
      materiality_basis TEXT,
      materiality_ratio NUMERIC,
      direction TEXT NOT NULL,
      direction_basis TEXT,
      novelty TEXT NOT NULL,
      novelty_basis TEXT,
      prior_event_id BIGINT REFERENCES catalyst_events(id) ON DELETE SET NULL,
      source_quality TEXT NOT NULL,
      thesis_relevance TEXT NOT NULL,
      relevance_target TEXT,
      mandate_relevance TEXT NOT NULL,
      mandate_basis TEXT,
      evidence_freshness TEXT NOT NULL,
      evidence_status TEXT NOT NULL,
      assessed_by TEXT NOT NULL DEFAULT 'rule',
      assessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      notes TEXT,
      input_hash TEXT NOT NULL,
      UNIQUE (catalyst_event_id, assessment_version, assessed_by, input_hash)
    );
    CREATE INDEX IF NOT EXISTS idx_catalyst_assessments_event
      ON catalyst_assessments (catalyst_event_id, assessed_at DESC, id DESC);
  `)}async function d(e){if(null==e.price&&null==e.marketCap&&null==e.volume)return;let T=await n.connect();try{await T.query("BEGIN");let t=await s(T,{ticker:e.ticker,name:e.name||null,exchange:null,quoteType:e.isFund?"ETF":null,currency:e.currency||null,source:e.source||"collection"});await r(T,t,{price:e.price??null,previousClose:null,marketCap:e.marketCap??null,volume:e.volume??null,currency:e.currency||null,source:e.source||"collection"}),await T.query("COMMIT")}catch(e){throw await T.query("ROLLBACK"),e}finally{T.release()}}async function I(e){let T=await n.query("SELECT id FROM companies WHERE ticker = $1",[e]);if(!T.rowCount)return null;let t=Number(T.rows[0].id),E=(await n.query(`SELECT id, price, captured_at
     FROM price_snapshots
     WHERE company_id = $1
     ORDER BY captured_at DESC, id DESC
     LIMIT 2`,[t])).rows.map(e=>({id:Number(e.id),price:null==e.price?null:Number(e.price),capturedAt:new Date(e.captured_at).toISOString()})),i=await n.query(`SELECT max(created_at) AS compared_at
     FROM alerts
     WHERE company_id = $1 AND dedupe_key LIKE 'daily:%'`,[t]),a=E[1]?.capturedAt||new Date(Date.now()-864e5).toISOString(),s=i.rows[0]?.compared_at?new Date(i.rows[0].compared_at).toISOString():a,r=!!(i.rows[0]?.compared_at&&E[0]&&new Date(i.rows[0].compared_at).getTime()>=new Date(E[0].capturedAt).getTime()),[c,o,N]=await Promise.all([n.query(`SELECT id, title, url, discovered_at
       FROM news_items
       WHERE company_id = $1 AND discovered_at > $2
       ORDER BY discovered_at ASC`,[t,s]),n.query(`SELECT id, form_type, description, url, filed_at, discovered_at
       FROM sec_events
       WHERE company_id = $1 AND discovered_at > $2
       ORDER BY discovered_at ASC`,[t,s]),n.query(`SELECT id, event_at
       FROM earnings_events
       WHERE company_id = $1 AND event_at >= now() AND event_at <= now() + interval '14 days'
         AND NOT EXISTS (
           SELECT 1 FROM alerts a
           WHERE a.dedupe_key = 'daily:earnings:' || $1::text || ':' || earnings_events.id::text
         )
       ORDER BY event_at ASC LIMIT 1`,[t])]);return{companyId:t,currentPrice:E[0]||null,previousPrice:E[1]||null,currentAlreadyCompared:r,newNews:c.rows.map(e=>({id:e.id,title:e.title,url:e.url,discoveredAt:new Date(e.discovered_at).toISOString()})),newSecEvents:o.rows.map(e=>({id:e.id,form:e.form_type||"SEC filing",description:e.description||null,url:e.url,filedAt:null!=e.filed_at?(()=>{let T=/^(\d{4}-\d{2}-\d{2})/.exec(String(e.filed_at));return T?T[1]:new Date(e.filed_at).toISOString().slice(0,10)})():null,discoveredAt:new Date(e.discovered_at).toISOString()})),upcomingEarnings:N.rowCount?{id:Number(N.rows[0].id),eventAt:new Date(N.rows[0].event_at).toISOString()}:null}}async function A(e){if(0===e.length)return 0;let T=await n.connect(),t=0;try{for(let E of(await T.query("BEGIN"),e)){let e=await T.query(`INSERT INTO alerts
           (company_id, position_id, kind, title, detail, source_url, occurred_at, dedupe_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING
         RETURNING id`,[E.companyId,E.positionId,E.kind,E.title,E.detail,E.sourceUrl,E.occurredAt,E.dedupeKey]);t+=e.rowCount||0}return await T.query("COMMIT"),t}catch(e){throw await T.query("ROLLBACK"),e}finally{T.release()}}async function u(e){if(0===e.length)return;let T=await n.connect();try{for(let t of(await T.query("BEGIN"),e))await T.query(`INSERT INTO sec_suspensions (normalized, company, link, pub_date)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (normalized) DO UPDATE SET last_seen = now()`,[t.normalized,t.company,t.link,t.pubDate]);await T.query("COMMIT")}catch(e){throw await T.query("ROLLBACK"),e}finally{T.release()}}async function O(){let{rows:e}=await n.query("SELECT normalized FROM sec_suspensions");return new Set(e.map(e=>e.normalized))}async function l(e,T,t=3){let E=new Map;if(0===T.length)return E;let{rows:i}=await n.query(`SELECT ticker, mentions FROM snapshots
      WHERE capture_date < $1 AND ticker = ANY($2)
      ORDER BY ticker, capture_date DESC`,[e,T]);for(let e of i){let T=E.get(e.ticker)??[];T.length<t&&(T.push(Number(e.mentions)),E.set(e.ticker,T))}return E}async function S(e,T){let t=await n.connect();try{for(let E of(await t.query("BEGIN"),await t.query("DELETE FROM snapshots WHERE capture_date = $1",[e]),T))await t.query(`INSERT INTO snapshots
          (capture_date, ticker, name, mentions, mentions_prev, mention_growth,
           upvotes, rank, rank_prev, sentiment, sentiment_source, sentiment_value,
           market_cap, price, currency, discovery_score, is_new,
           volume, fundamentals_source, rising_days, sec_suspended, warnings)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
                 $18,$19,$20,$21,$22)`,[e,E.ticker,E.name,E.mentions,E.mentionsPrev,E.mentionGrowth,E.upvotes,E.rank,E.rankPrev,E.sentiment,E.sentimentSource,E.sentimentValue,E.marketCap,E.price,E.currency,E.discoveryScore,E.isNew,E.volume,E.fundamentalsSource,E.risingDays,E.secSuspended,JSON.stringify(E.warnings??[])]);await t.query("COMMIT")}catch(e){throw await t.query("ROLLBACK"),e}finally{t.release()}}async function U(e,T){let{rows:t}=await n.query(`SELECT * FROM snapshots
      WHERE capture_date = $1
      ORDER BY discovery_score DESC
      LIMIT $2`,[e,T]);return t}async function p(){let{rows:e}=await n.query(`SELECT to_char(capture_date, 'YYYY-MM-DD') AS d
       FROM snapshots ORDER BY capture_date DESC LIMIT 1`);return e[0]?.d??null}a._pgPool||(a._pgPool=n)}};