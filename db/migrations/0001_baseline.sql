-- DRAFT ONLY. Not applied automatically.
-- Do not run against production before duplicate/constraint audit.
--
-- ============================================================================
-- 0001_baseline — tänase liidetud sihtskeemi TÄIELIK kirjeldus
--                 (runtime ensure*-ahel  UNION  db/init.sql)
-- ============================================================================
--
-- GENEREERITUD, MITTE KÄSITSI KIRJUTATUD.
--   Allikas: ajutine andmebaas, millele rakendati JÄRJEST
--     1. db/init.sql
--     2. ensureSchema() + ensureFinancialSchema() + ensureResearchSchema()
--        + ensureScoreTrackingSchema() + ensureClassificationColumns()
--   seejärel pg_dump --schema-only ja teisendus idempotentseks DDL-iks.
--
-- STAATUS: seda faili ei kutsu ükski koodirada. Migratsioonimootorit ei ole.
--   ensureSchema() jääb esialgu tootmise skeemiteeks; migratsioonid on kõrval.
--
-- IDEMPOTENTSUS: kogu DDL on korduvalt ohutu.
--   CREATE TABLE / SEQUENCE / INDEX  -> IF NOT EXISTS
--   ADD CONSTRAINT                   -> valvatud DO-plokk (pg ei toeta
--                                       ADD CONSTRAINT IF NOT EXISTS)
--   Mittehävitav: ei ühtki DROP-i, tüübimuutust ega NOT NULL lisamist.
--
-- SISALDAB drifti mõlemat poolt:
--   init.sql-only  -> price_snapshots UNIQUE (company_id, captured_at),
--                     investment_theses status CHECK, 6 jõudlusindeksit
--   runtime-only   -> catalyst_events, catalyst_assessments,
--                     discovery_decisions catalyst-veerud
--
-- Mõõdud: 21 tabelit, 17 järjendit, 21 indeksit, 56 piirangut.
--
-- ============================================================================
-- OSA 1 — migratsiooni raamatupidamine (disain; tabelit veel kuskil ei ole)
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  version       TEXT PRIMARY KEY,
  applied_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  checksum      TEXT NOT NULL,
  execution_ms  INTEGER
);

-- ============================================================================
-- OSA 2 — liidetud skeem (generisatud)
-- ============================================================================
CREATE TABLE IF NOT EXISTS alerts (
    id bigint NOT NULL,
    company_id bigint,
    position_id bigint,
    kind text NOT NULL,
    severity text DEFAULT 'info'::text NOT NULL,
    title text NOT NULL,
    detail text,
    source_url text,
    occurred_at timestamp with time zone NOT NULL,
    dedupe_key text,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS alerts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE alerts_id_seq OWNED BY alerts.id;

CREATE TABLE IF NOT EXISTS analyst_targets (
    id bigint NOT NULL,
    company_id bigint NOT NULL,
    captured_at timestamp with time zone DEFAULT now() NOT NULL,
    target_mean_price numeric,
    target_high_price numeric,
    target_low_price numeric,
    recommendation_mean numeric,
    recommendation_key text,
    analyst_count integer,
    source text NOT NULL,
    data_hash text NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS analyst_targets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE analyst_targets_id_seq OWNED BY analyst_targets.id;

CREATE TABLE IF NOT EXISTS candidate_outcomes (
    id bigint NOT NULL,
    decision_id bigint NOT NULL,
    horizon text NOT NULL,
    target_at timestamp with time zone NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    observed_at timestamp with time zone,
    observed_price numeric,
    return_percent numeric,
    measured_at timestamp with time zone,
    benchmark_symbol text DEFAULT 'SPY'::text NOT NULL,
    benchmark_status text DEFAULT 'pending'::text NOT NULL,
    benchmark_start_at timestamp with time zone,
    benchmark_end_at timestamp with time zone,
    benchmark_price_start numeric,
    benchmark_price_end numeric,
    benchmark_return_percent numeric,
    excess_return_percent numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS candidate_outcomes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE candidate_outcomes_id_seq OWNED BY candidate_outcomes.id;

CREATE TABLE IF NOT EXISTS catalyst_assessments (
    id bigint NOT NULL,
    catalyst_event_id bigint NOT NULL,
    assessment_version text NOT NULL,
    materiality text NOT NULL,
    materiality_basis text,
    materiality_ratio numeric,
    direction text NOT NULL,
    direction_basis text,
    novelty text NOT NULL,
    novelty_basis text,
    prior_event_id bigint,
    source_quality text NOT NULL,
    thesis_relevance text NOT NULL,
    relevance_target text,
    mandate_relevance text NOT NULL,
    mandate_basis text,
    evidence_freshness text NOT NULL,
    evidence_status text NOT NULL,
    assessed_by text DEFAULT 'rule'::text NOT NULL,
    assessed_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    input_hash text NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS catalyst_assessments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE catalyst_assessments_id_seq OWNED BY catalyst_assessments.id;

CREATE TABLE IF NOT EXISTS catalyst_events (
    id bigint NOT NULL,
    company_id bigint NOT NULL,
    event_kind text NOT NULL,
    source_kind text NOT NULL,
    source_ref text NOT NULL,
    occurred_at timestamp with time zone,
    headline text,
    url text,
    accession_number text,
    form_type text,
    linked_fact_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    linked_period_end date,
    linked_period_kind text,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS catalyst_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE catalyst_events_id_seq OWNED BY catalyst_events.id;

CREATE TABLE IF NOT EXISTS companies (
    id bigint NOT NULL,
    ticker text NOT NULL,
    name text,
    exchange text,
    quote_type text,
    currency text,
    source text,
    sec_cik text,
    sector text,
    industry text,
    classification_source text,
    classification_updated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS companies_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE companies_id_seq OWNED BY companies.id;

CREATE TABLE IF NOT EXISTS company_score_snapshots (
    id bigint NOT NULL,
    company_id bigint NOT NULL,
    scoring_version text NOT NULL,
    input_hash text NOT NULL,
    growth_score integer,
    health_score integer,
    coverage_score integer NOT NULL,
    payload jsonb NOT NULL,
    calculated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS company_score_snapshots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE company_score_snapshots_id_seq OWNED BY company_score_snapshots.id;

CREATE TABLE IF NOT EXISTS discovery_decisions (
    id bigint NOT NULL,
    run_id bigint NOT NULL,
    company_id bigint,
    ticker text NOT NULL,
    included boolean NOT NULL,
    candidate_rank integer,
    exclusion_reasons jsonb DEFAULT '[]'::jsonb NOT NULL,
    growth_score integer,
    health_score integer,
    coverage_score integer NOT NULL,
    decision_price numeric,
    currency text,
    market_cap bigint,
    volume bigint,
    price_snapshot_id bigint,
    score_snapshot_id bigint,
    scoring_version text,
    runway_status text NOT NULL,
    runway_detail text NOT NULL,
    catalyst_status text NOT NULL,
    catalyst_type text,
    catalyst_source_id text,
    catalyst_url text,
    catalyst_at timestamp with time zone,
    catalyst_detail text NOT NULL,
    risks jsonb DEFAULT '[]'::jsonb NOT NULL,
    unknowns jsonb DEFAULT '[]'::jsonb NOT NULL,
    reasons jsonb DEFAULT '[]'::jsonb NOT NULL,
    criteria jsonb DEFAULT '[]'::jsonb NOT NULL,
    proof_questions jsonb DEFAULT '[]'::jsonb NOT NULL,
    sector text,
    industry text,
    sector_group_type text,
    sector_growth_percentile numeric,
    sector_health_percentile numeric,
    sector_coverage_percentile numeric,
    sector_market_cap_percentile numeric,
    sector_comparable_count integer,
    sector_median_growth numeric,
    sector_median_health numeric,
    sector_median_coverage numeric,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    catalyst_assessment_version text,
    catalyst_evidence_status text,
    catalyst_evidence_tier integer,
    catalyst_event_kind text,
    catalyst_source_kind text,
    catalyst_materiality text,
    catalyst_materiality_ratio numeric,
    catalyst_direction text,
    catalyst_novelty text,
    catalyst_thesis_relevance text,
    catalyst_mandate_relevance text,
    catalyst_evidence_freshness text,
    catalyst_event_id bigint,
    catalyst_linked_period_end date,
    catalyst_next_scheduled_at timestamp with time zone
);

CREATE SEQUENCE IF NOT EXISTS discovery_decisions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE discovery_decisions_id_seq OWNED BY discovery_decisions.id;

CREATE TABLE IF NOT EXISTS discovery_runs (
    id bigint NOT NULL,
    run_type text DEFAULT 'rklb'::text NOT NULL,
    decision_date date NOT NULL,
    run_at timestamp with time zone DEFAULT now() NOT NULL,
    model_version text NOT NULL,
    input_hash text NOT NULL,
    run_key text NOT NULL,
    rules jsonb NOT NULL,
    universe jsonb NOT NULL,
    evaluated_count integer NOT NULL,
    included_count integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS discovery_runs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE discovery_runs_id_seq OWNED BY discovery_runs.id;

CREATE TABLE IF NOT EXISTS earnings_events (
    id bigint NOT NULL,
    company_id bigint NOT NULL,
    event_at timestamp with time zone NOT NULL,
    timing text,
    source text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS earnings_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE earnings_events_id_seq OWNED BY earnings_events.id;

CREATE TABLE IF NOT EXISTS financial_enrichment_status (
    company_id bigint NOT NULL,
    status text NOT NULL,
    last_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    last_success_at timestamp with time zone,
    consecutive_failures integer DEFAULT 0 NOT NULL,
    last_error text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS financial_facts (
    id bigint NOT NULL,
    company_id bigint NOT NULL,
    metric text NOT NULL,
    value numeric NOT NULL,
    unit text NOT NULL,
    period_start date,
    period_end date NOT NULL,
    period_kind text NOT NULL,
    fiscal_year integer,
    fiscal_period text,
    form_type text NOT NULL,
    filed_at date NOT NULL,
    accession_number text NOT NULL,
    taxonomy text NOT NULL,
    tag text NOT NULL,
    is_derived boolean DEFAULT false NOT NULL,
    source_url text NOT NULL,
    fact_key text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS financial_facts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE financial_facts_id_seq OWNED BY financial_facts.id;

CREATE TABLE IF NOT EXISTS investment_theses (
    id bigint NOT NULL,
    position_id bigint NOT NULL,
    thesis text NOT NULL,
    business text,
    why_now text,
    moat text,
    mispricing text,
    catalyst text,
    invalidation text,
    twelve_month_checkpoint text,
    checkpoint_is_measurable boolean DEFAULT false NOT NULL,
    time_horizon text,
    status text DEFAULT 'draft'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    content_hash text,
    score_snapshot_id bigint,
    is_current boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT investment_theses_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'researching'::text, 'ready'::text, 'rejected'::text])))
);

CREATE SEQUENCE IF NOT EXISTS investment_theses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE investment_theses_id_seq OWNED BY investment_theses.id;

CREATE TABLE IF NOT EXISTS news_items (
    id text NOT NULL,
    company_id bigint NOT NULL,
    title text NOT NULL,
    publisher text,
    summary text,
    url text NOT NULL,
    published_at timestamp with time zone,
    source text NOT NULL,
    discovered_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS portfolio_positions (
    id bigint NOT NULL,
    company_id bigint,
    ticker text NOT NULL,
    quantity numeric NOT NULL,
    average_buy_price numeric NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT portfolio_positions_average_buy_price_check CHECK ((average_buy_price >= (0)::numeric)),
    CONSTRAINT portfolio_positions_quantity_check CHECK ((quantity >= (0)::numeric)),
    CONSTRAINT portfolio_positions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'watch'::text, 'closed'::text])))
);

CREATE SEQUENCE IF NOT EXISTS portfolio_positions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE portfolio_positions_id_seq OWNED BY portfolio_positions.id;

CREATE TABLE IF NOT EXISTS price_snapshots (
    id bigint NOT NULL,
    company_id bigint NOT NULL,
    captured_at timestamp with time zone DEFAULT now() NOT NULL,
    price numeric,
    previous_close numeric,
    market_cap bigint,
    volume bigint,
    currency text,
    source text NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS price_snapshots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE price_snapshots_id_seq OWNED BY price_snapshots.id;

CREATE TABLE IF NOT EXISTS research_briefs (
    id bigint NOT NULL,
    company_id bigint NOT NULL,
    input_hash text NOT NULL,
    model text NOT NULL,
    content jsonb NOT NULL,
    source_count integer DEFAULT 0 NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS research_briefs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE research_briefs_id_seq OWNED BY research_briefs.id;

CREATE TABLE IF NOT EXISTS sec_events (
    id text NOT NULL,
    company_id bigint,
    form_type text,
    filed_at date,
    description text,
    url text NOT NULL,
    source text DEFAULT 'sec'::text NOT NULL,
    discovered_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS sec_suspensions (
    normalized text NOT NULL,
    company text NOT NULL,
    link text,
    pub_date text,
    first_seen timestamp with time zone DEFAULT now() NOT NULL,
    last_seen timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshots (
    id bigint NOT NULL,
    capture_date date NOT NULL,
    captured_at timestamp with time zone DEFAULT now() NOT NULL,
    ticker text NOT NULL,
    name text,
    mentions integer DEFAULT 0 NOT NULL,
    mentions_prev integer,
    mention_growth numeric,
    upvotes integer,
    rank integer,
    rank_prev integer,
    sentiment text,
    sentiment_source text,
    sentiment_value numeric,
    market_cap bigint,
    price numeric,
    currency text,
    discovery_score numeric,
    is_new boolean DEFAULT false NOT NULL,
    volume bigint,
    fundamentals_source text,
    rising_days integer DEFAULT 0,
    sec_suspended boolean DEFAULT false,
    warnings text
);

CREATE SEQUENCE IF NOT EXISTS snapshots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE snapshots_id_seq OWNED BY snapshots.id;

CREATE TABLE IF NOT EXISTS thesis_change_events (
    id bigint NOT NULL,
    position_id bigint NOT NULL,
    previous_thesis text,
    new_thesis text,
    change_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS thesis_change_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE thesis_change_events_id_seq OWNED BY thesis_change_events.id;

ALTER TABLE ONLY alerts ALTER COLUMN id SET DEFAULT nextval('alerts_id_seq'::regclass);

ALTER TABLE ONLY analyst_targets ALTER COLUMN id SET DEFAULT nextval('analyst_targets_id_seq'::regclass);

ALTER TABLE ONLY candidate_outcomes ALTER COLUMN id SET DEFAULT nextval('candidate_outcomes_id_seq'::regclass);

ALTER TABLE ONLY catalyst_assessments ALTER COLUMN id SET DEFAULT nextval('catalyst_assessments_id_seq'::regclass);

ALTER TABLE ONLY catalyst_events ALTER COLUMN id SET DEFAULT nextval('catalyst_events_id_seq'::regclass);

ALTER TABLE ONLY companies ALTER COLUMN id SET DEFAULT nextval('companies_id_seq'::regclass);

ALTER TABLE ONLY company_score_snapshots ALTER COLUMN id SET DEFAULT nextval('company_score_snapshots_id_seq'::regclass);

ALTER TABLE ONLY discovery_decisions ALTER COLUMN id SET DEFAULT nextval('discovery_decisions_id_seq'::regclass);

ALTER TABLE ONLY discovery_runs ALTER COLUMN id SET DEFAULT nextval('discovery_runs_id_seq'::regclass);

ALTER TABLE ONLY earnings_events ALTER COLUMN id SET DEFAULT nextval('earnings_events_id_seq'::regclass);

ALTER TABLE ONLY financial_facts ALTER COLUMN id SET DEFAULT nextval('financial_facts_id_seq'::regclass);

ALTER TABLE ONLY investment_theses ALTER COLUMN id SET DEFAULT nextval('investment_theses_id_seq'::regclass);

ALTER TABLE ONLY portfolio_positions ALTER COLUMN id SET DEFAULT nextval('portfolio_positions_id_seq'::regclass);

ALTER TABLE ONLY price_snapshots ALTER COLUMN id SET DEFAULT nextval('price_snapshots_id_seq'::regclass);

ALTER TABLE ONLY research_briefs ALTER COLUMN id SET DEFAULT nextval('research_briefs_id_seq'::regclass);

ALTER TABLE ONLY snapshots ALTER COLUMN id SET DEFAULT nextval('snapshots_id_seq'::regclass);

ALTER TABLE ONLY thesis_change_events ALTER COLUMN id SET DEFAULT nextval('thesis_change_events_id_seq'::regclass);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alerts_company_id_kind_title_occurred_at_key' AND conrelid = to_regclass('alerts')) THEN
    ALTER TABLE alerts ADD CONSTRAINT alerts_company_id_kind_title_occurred_at_key UNIQUE (company_id, kind, title, occurred_at);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alerts_pkey' AND conrelid = to_regclass('alerts')) THEN
    ALTER TABLE alerts ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'analyst_targets_company_id_data_hash_key' AND conrelid = to_regclass('analyst_targets')) THEN
    ALTER TABLE analyst_targets ADD CONSTRAINT analyst_targets_company_id_data_hash_key UNIQUE (company_id, data_hash);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'analyst_targets_pkey' AND conrelid = to_regclass('analyst_targets')) THEN
    ALTER TABLE analyst_targets ADD CONSTRAINT analyst_targets_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'candidate_outcomes_decision_id_horizon_key' AND conrelid = to_regclass('candidate_outcomes')) THEN
    ALTER TABLE candidate_outcomes ADD CONSTRAINT candidate_outcomes_decision_id_horizon_key UNIQUE (decision_id, horizon);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'candidate_outcomes_pkey' AND conrelid = to_regclass('candidate_outcomes')) THEN
    ALTER TABLE candidate_outcomes ADD CONSTRAINT candidate_outcomes_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalyst_assessments_catalyst_event_id_assessment_version_a_key' AND conrelid = to_regclass('catalyst_assessments')) THEN
    ALTER TABLE catalyst_assessments ADD CONSTRAINT catalyst_assessments_catalyst_event_id_assessment_version_a_key UNIQUE (catalyst_event_id, assessment_version, assessed_by, input_hash);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalyst_assessments_pkey' AND conrelid = to_regclass('catalyst_assessments')) THEN
    ALTER TABLE catalyst_assessments ADD CONSTRAINT catalyst_assessments_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalyst_events_company_id_event_kind_source_ref_key' AND conrelid = to_regclass('catalyst_events')) THEN
    ALTER TABLE catalyst_events ADD CONSTRAINT catalyst_events_company_id_event_kind_source_ref_key UNIQUE (company_id, event_kind, source_ref);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalyst_events_pkey' AND conrelid = to_regclass('catalyst_events')) THEN
    ALTER TABLE catalyst_events ADD CONSTRAINT catalyst_events_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_pkey' AND conrelid = to_regclass('companies')) THEN
    ALTER TABLE companies ADD CONSTRAINT companies_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_ticker_key' AND conrelid = to_regclass('companies')) THEN
    ALTER TABLE companies ADD CONSTRAINT companies_ticker_key UNIQUE (ticker);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_score_snapshots_company_id_scoring_version_input_ha_key' AND conrelid = to_regclass('company_score_snapshots')) THEN
    ALTER TABLE company_score_snapshots ADD CONSTRAINT company_score_snapshots_company_id_scoring_version_input_ha_key UNIQUE (company_id, scoring_version, input_hash);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_score_snapshots_pkey' AND conrelid = to_regclass('company_score_snapshots')) THEN
    ALTER TABLE company_score_snapshots ADD CONSTRAINT company_score_snapshots_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discovery_decisions_pkey' AND conrelid = to_regclass('discovery_decisions')) THEN
    ALTER TABLE discovery_decisions ADD CONSTRAINT discovery_decisions_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discovery_decisions_run_id_ticker_key' AND conrelid = to_regclass('discovery_decisions')) THEN
    ALTER TABLE discovery_decisions ADD CONSTRAINT discovery_decisions_run_id_ticker_key UNIQUE (run_id, ticker);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discovery_runs_pkey' AND conrelid = to_regclass('discovery_runs')) THEN
    ALTER TABLE discovery_runs ADD CONSTRAINT discovery_runs_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discovery_runs_run_key_key' AND conrelid = to_regclass('discovery_runs')) THEN
    ALTER TABLE discovery_runs ADD CONSTRAINT discovery_runs_run_key_key UNIQUE (run_key);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'earnings_events_company_id_event_at_source_key' AND conrelid = to_regclass('earnings_events')) THEN
    ALTER TABLE earnings_events ADD CONSTRAINT earnings_events_company_id_event_at_source_key UNIQUE (company_id, event_at, source);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'earnings_events_pkey' AND conrelid = to_regclass('earnings_events')) THEN
    ALTER TABLE earnings_events ADD CONSTRAINT earnings_events_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'financial_enrichment_status_pkey' AND conrelid = to_regclass('financial_enrichment_status')) THEN
    ALTER TABLE financial_enrichment_status ADD CONSTRAINT financial_enrichment_status_pkey PRIMARY KEY (company_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'financial_facts_company_id_fact_key_key' AND conrelid = to_regclass('financial_facts')) THEN
    ALTER TABLE financial_facts ADD CONSTRAINT financial_facts_company_id_fact_key_key UNIQUE (company_id, fact_key);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'financial_facts_pkey' AND conrelid = to_regclass('financial_facts')) THEN
    ALTER TABLE financial_facts ADD CONSTRAINT financial_facts_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'investment_theses_pkey' AND conrelid = to_regclass('investment_theses')) THEN
    ALTER TABLE investment_theses ADD CONSTRAINT investment_theses_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'news_items_company_id_url_key' AND conrelid = to_regclass('news_items')) THEN
    ALTER TABLE news_items ADD CONSTRAINT news_items_company_id_url_key UNIQUE (company_id, url);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'news_items_pkey' AND conrelid = to_regclass('news_items')) THEN
    ALTER TABLE news_items ADD CONSTRAINT news_items_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'portfolio_positions_pkey' AND conrelid = to_regclass('portfolio_positions')) THEN
    ALTER TABLE portfolio_positions ADD CONSTRAINT portfolio_positions_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_snapshots_company_id_captured_at_key' AND conrelid = to_regclass('price_snapshots')) THEN
    ALTER TABLE price_snapshots ADD CONSTRAINT price_snapshots_company_id_captured_at_key UNIQUE (company_id, captured_at);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_snapshots_pkey' AND conrelid = to_regclass('price_snapshots')) THEN
    ALTER TABLE price_snapshots ADD CONSTRAINT price_snapshots_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'research_briefs_company_id_input_hash_key' AND conrelid = to_regclass('research_briefs')) THEN
    ALTER TABLE research_briefs ADD CONSTRAINT research_briefs_company_id_input_hash_key UNIQUE (company_id, input_hash);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'research_briefs_pkey' AND conrelid = to_regclass('research_briefs')) THEN
    ALTER TABLE research_briefs ADD CONSTRAINT research_briefs_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sec_events_pkey' AND conrelid = to_regclass('sec_events')) THEN
    ALTER TABLE sec_events ADD CONSTRAINT sec_events_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sec_suspensions_pkey' AND conrelid = to_regclass('sec_suspensions')) THEN
    ALTER TABLE sec_suspensions ADD CONSTRAINT sec_suspensions_pkey PRIMARY KEY (normalized);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'snapshots_capture_date_ticker_key' AND conrelid = to_regclass('snapshots')) THEN
    ALTER TABLE snapshots ADD CONSTRAINT snapshots_capture_date_ticker_key UNIQUE (capture_date, ticker);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'snapshots_pkey' AND conrelid = to_regclass('snapshots')) THEN
    ALTER TABLE snapshots ADD CONSTRAINT snapshots_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'thesis_change_events_pkey' AND conrelid = to_regclass('thesis_change_events')) THEN
    ALTER TABLE thesis_change_events ADD CONSTRAINT thesis_change_events_pkey PRIMARY KEY (id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_dedupe_key ON alerts USING btree (dedupe_key) WHERE (dedupe_key IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_alerts_position_occurred ON alerts USING btree (position_id, occurred_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_analyst_company_time ON analyst_targets USING btree (company_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_candidate_outcomes_status_target ON candidate_outcomes USING btree (status, target_at);

CREATE INDEX IF NOT EXISTS idx_catalyst_assessments_event ON catalyst_assessments USING btree (catalyst_event_id, assessed_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_catalyst_events_company_time ON catalyst_events USING btree (company_id, occurred_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_company_scores_company_time ON company_score_snapshots USING btree (company_id, calculated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_discovery_decisions_included ON discovery_decisions USING btree (included, run_id DESC);

CREATE INDEX IF NOT EXISTS idx_discovery_decisions_ticker_time ON discovery_decisions USING btree (ticker, run_id DESC);

CREATE INDEX IF NOT EXISTS idx_discovery_runs_time ON discovery_runs USING btree (run_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_financial_enrichment_retry ON financial_enrichment_status USING btree (status, last_attempt_at);

CREATE INDEX IF NOT EXISTS idx_financial_facts_company_metric_period ON financial_facts USING btree (company_id, metric, period_end DESC, filed_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_company_time ON news_items USING btree (company_id, published_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_current_thesis ON investment_theses USING btree (position_id) WHERE is_current;

CREATE INDEX IF NOT EXISTS idx_positions_status ON portfolio_positions USING btree (status, ticker);

CREATE INDEX IF NOT EXISTS idx_price_company_time ON price_snapshots USING btree (company_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_research_briefs_company_time ON research_briefs USING btree (company_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_sec_company_time ON sec_events USING btree (company_id, filed_at DESC);

CREATE INDEX IF NOT EXISTS idx_snapshots_date ON snapshots USING btree (capture_date);

CREATE INDEX IF NOT EXISTS idx_snapshots_score ON snapshots USING btree (capture_date, discovery_score DESC);

CREATE INDEX IF NOT EXISTS idx_thesis_position_history ON investment_theses USING btree (position_id, version DESC, created_at DESC);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alerts_company_id_fkey' AND conrelid = to_regclass('alerts')) THEN
    ALTER TABLE alerts ADD CONSTRAINT alerts_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alerts_position_id_fkey' AND conrelid = to_regclass('alerts')) THEN
    ALTER TABLE alerts ADD CONSTRAINT alerts_position_id_fkey FOREIGN KEY (position_id) REFERENCES portfolio_positions(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'analyst_targets_company_id_fkey' AND conrelid = to_regclass('analyst_targets')) THEN
    ALTER TABLE analyst_targets ADD CONSTRAINT analyst_targets_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'candidate_outcomes_decision_id_fkey' AND conrelid = to_regclass('candidate_outcomes')) THEN
    ALTER TABLE candidate_outcomes ADD CONSTRAINT candidate_outcomes_decision_id_fkey FOREIGN KEY (decision_id) REFERENCES discovery_decisions(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalyst_assessments_catalyst_event_id_fkey' AND conrelid = to_regclass('catalyst_assessments')) THEN
    ALTER TABLE catalyst_assessments ADD CONSTRAINT catalyst_assessments_catalyst_event_id_fkey FOREIGN KEY (catalyst_event_id) REFERENCES catalyst_events(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalyst_assessments_prior_event_id_fkey' AND conrelid = to_regclass('catalyst_assessments')) THEN
    ALTER TABLE catalyst_assessments ADD CONSTRAINT catalyst_assessments_prior_event_id_fkey FOREIGN KEY (prior_event_id) REFERENCES catalyst_events(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalyst_events_company_id_fkey' AND conrelid = to_regclass('catalyst_events')) THEN
    ALTER TABLE catalyst_events ADD CONSTRAINT catalyst_events_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'company_score_snapshots_company_id_fkey' AND conrelid = to_regclass('company_score_snapshots')) THEN
    ALTER TABLE company_score_snapshots ADD CONSTRAINT company_score_snapshots_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discovery_decisions_company_id_fkey' AND conrelid = to_regclass('discovery_decisions')) THEN
    ALTER TABLE discovery_decisions ADD CONSTRAINT discovery_decisions_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discovery_decisions_run_id_fkey' AND conrelid = to_regclass('discovery_decisions')) THEN
    ALTER TABLE discovery_decisions ADD CONSTRAINT discovery_decisions_run_id_fkey FOREIGN KEY (run_id) REFERENCES discovery_runs(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'earnings_events_company_id_fkey' AND conrelid = to_regclass('earnings_events')) THEN
    ALTER TABLE earnings_events ADD CONSTRAINT earnings_events_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'financial_enrichment_status_company_id_fkey' AND conrelid = to_regclass('financial_enrichment_status')) THEN
    ALTER TABLE financial_enrichment_status ADD CONSTRAINT financial_enrichment_status_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'financial_facts_company_id_fkey' AND conrelid = to_regclass('financial_facts')) THEN
    ALTER TABLE financial_facts ADD CONSTRAINT financial_facts_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'investment_theses_position_id_fkey' AND conrelid = to_regclass('investment_theses')) THEN
    ALTER TABLE investment_theses ADD CONSTRAINT investment_theses_position_id_fkey FOREIGN KEY (position_id) REFERENCES portfolio_positions(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'news_items_company_id_fkey' AND conrelid = to_regclass('news_items')) THEN
    ALTER TABLE news_items ADD CONSTRAINT news_items_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'portfolio_positions_company_id_fkey' AND conrelid = to_regclass('portfolio_positions')) THEN
    ALTER TABLE portfolio_positions ADD CONSTRAINT portfolio_positions_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'price_snapshots_company_id_fkey' AND conrelid = to_regclass('price_snapshots')) THEN
    ALTER TABLE price_snapshots ADD CONSTRAINT price_snapshots_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'research_briefs_company_id_fkey' AND conrelid = to_regclass('research_briefs')) THEN
    ALTER TABLE research_briefs ADD CONSTRAINT research_briefs_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sec_events_company_id_fkey' AND conrelid = to_regclass('sec_events')) THEN
    ALTER TABLE sec_events ADD CONSTRAINT sec_events_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'thesis_change_events_position_id_fkey' AND conrelid = to_regclass('thesis_change_events')) THEN
    ALTER TABLE thesis_change_events ADD CONSTRAINT thesis_change_events_position_id_fkey FOREIGN KEY (position_id) REFERENCES portfolio_positions(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- OSA 3 — CHECK-piirangute drifti sulgemine OLEMASOLEVATES andmebaasides
-- ============================================================================
-- pg_dump kirjutab CHECK-piirangud INLINE `CREATE TABLE` sisse. Kui tabel on
-- juba olemas, jätab `CREATE TABLE IF NOT EXISTS` kogu keha vahele — seega
-- inline CHECK EI jõuaks olemasolevasse baasi ja drift jääks sulgemata.
-- (Täpselt see on tänase `discovery` baasi olukord: `investment_theses`
-- status CHECK puudub.) Allolev kordab need valvatud DO-plokkidena.
--
-- HOIATUS: CHECK ebaõnnestub, kui andmes on juba rikkuvaid ridu.
-- Jooksuta enne `npm run schema:diff` — see raporteerib vigased staatused.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'investment_theses_status_check' AND conrelid = to_regclass('investment_theses')) THEN
    ALTER TABLE investment_theses ADD CONSTRAINT investment_theses_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'researching'::text, 'ready'::text, 'rejected'::text])));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'portfolio_positions_status_check' AND conrelid = to_regclass('portfolio_positions')) THEN
    ALTER TABLE portfolio_positions ADD CONSTRAINT portfolio_positions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'watch'::text, 'closed'::text])));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'portfolio_positions_quantity_check' AND conrelid = to_regclass('portfolio_positions')) THEN
    ALTER TABLE portfolio_positions ADD CONSTRAINT portfolio_positions_quantity_check CHECK ((quantity >= (0)::numeric));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'portfolio_positions_average_buy_price_check' AND conrelid = to_regclass('portfolio_positions')) THEN
    ALTER TABLE portfolio_positions ADD CONSTRAINT portfolio_positions_average_buy_price_check CHECK ((average_buy_price >= (0)::numeric));
  END IF;
END $$;

-- ============================================================================
-- KNOWN SOURCE / STATUS
-- ============================================================================
-- known source:            generated from runtime ∪ init.sql schema diff
--                          (db/init.sql + ensure*-ahel -> pg_dump -> idempotent DDL)
-- generated at:            2026-08-13
-- covers:                  21 tables, 17 sequences, 21 indexes, 56 constraints
-- not production-applied:  this file has never been executed against any
--                          production or development database
-- requires preflight:      run `npm run schema:diff` BEFORE any real use.
--                          UNIQUE (price_snapshots) and CHECK (investment_theses)
--                          FAIL if violating rows already exist.
-- engine status:           no migration runner exists yet; nothing reads this file
-- ============================================================================

