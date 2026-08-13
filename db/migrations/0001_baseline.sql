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
-- OSA 4 — VEERGUDE drifti sulgemine OLEMASOLEVATES andmebaasides (H1 fix)
-- ============================================================================
-- `CREATE TABLE IF NOT EXISTS` jätab OLEMASOLEVA tabeli keha tervikuna vahele.
-- Vanas driftivas baasis tähendaks see, et migratsioon raporteerib edu, aga
-- puuduvad veerud jäävad lisamata. Allolev sulgeb selle augu.
--
-- Kaetud: 213 veergu, mis on kas NULL-lubavad või DEFAULT-iga
--         (neid saab olemasolevasse ridadega tabelisse ohutult lisada).
--
-- EI ole kaetud: 87 veergu, mis on NOT NULL ILMA defaultita.
--   Neid EI SAA lisada tabelisse, kus on juba ridu, ilma väärtust valimata.
--   `npm run migrate -- --conformance` raporteerib need ja `--preflight`
--   annab NO-GO verdikti: selline baas vajab eraldi repair-migratsiooni.
--   Nimekiri:
--     alerts.kind
--     alerts.title
--     alerts.occurred_at
--     analyst_targets.company_id
--     analyst_targets.source
--     analyst_targets.data_hash
--     candidate_outcomes.decision_id
--     candidate_outcomes.horizon
--     candidate_outcomes.target_at
--     catalyst_assessments.catalyst_event_id
--     catalyst_assessments.assessment_version
--     catalyst_assessments.materiality
--     catalyst_assessments.direction
--     catalyst_assessments.novelty
--     catalyst_assessments.source_quality
--     catalyst_assessments.thesis_relevance
--     catalyst_assessments.mandate_relevance
--     catalyst_assessments.evidence_freshness
--     catalyst_assessments.evidence_status
--     catalyst_assessments.input_hash
--     catalyst_events.company_id
--     catalyst_events.event_kind
--     catalyst_events.source_kind
--     catalyst_events.source_ref
--     companies.ticker
--     company_score_snapshots.company_id
--     company_score_snapshots.scoring_version
--     company_score_snapshots.input_hash
--     company_score_snapshots.coverage_score
--     company_score_snapshots.payload
--     discovery_decisions.run_id
--     discovery_decisions.ticker
--     discovery_decisions.included
--     discovery_decisions.coverage_score
--     discovery_decisions.runway_status
--     discovery_decisions.runway_detail
--     discovery_decisions.catalyst_status
--     discovery_decisions.catalyst_detail
--     discovery_runs.decision_date
--     discovery_runs.model_version
--     discovery_runs.input_hash
--     discovery_runs.run_key
--     discovery_runs.rules
--     discovery_runs.universe
--     discovery_runs.evaluated_count
--     discovery_runs.included_count
--     earnings_events.company_id
--     earnings_events.event_at
--     earnings_events.source
--     financial_enrichment_status.company_id
--     financial_enrichment_status.status
--     financial_facts.company_id
--     financial_facts.metric
--     financial_facts.value
--     financial_facts.unit
--     financial_facts.period_end
--     financial_facts.period_kind
--     financial_facts.form_type
--     financial_facts.filed_at
--     financial_facts.accession_number
--     financial_facts.taxonomy
--     financial_facts.tag
--     financial_facts.source_url
--     financial_facts.fact_key
--     investment_theses.position_id
--     investment_theses.thesis
--     news_items.id
--     news_items.company_id
--     news_items.title
--     news_items.url
--     news_items.source
--     portfolio_positions.ticker
--     portfolio_positions.quantity
--     portfolio_positions.average_buy_price
--     price_snapshots.company_id
--     price_snapshots.source
--     research_briefs.company_id
--     research_briefs.input_hash
--     research_briefs.model
--     research_briefs.content
--     sec_events.id
--     sec_events.url
--     sec_suspensions.normalized
--     sec_suspensions.company
--     snapshots.capture_date
--     snapshots.ticker
--     thesis_change_events.position_id

ALTER TABLE alerts ADD COLUMN IF NOT EXISTS id bigint DEFAULT nextval('alerts_id_seq'::regclass) NOT NULL;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS company_id bigint;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS position_id bigint;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS severity text DEFAULT 'info'::text NOT NULL;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS detail text;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS dedupe_key text;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS payload jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE analyst_targets ADD COLUMN IF NOT EXISTS id bigint DEFAULT nextval('analyst_targets_id_seq'::regclass) NOT NULL;
ALTER TABLE analyst_targets ADD COLUMN IF NOT EXISTS captured_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE analyst_targets ADD COLUMN IF NOT EXISTS target_mean_price numeric;
ALTER TABLE analyst_targets ADD COLUMN IF NOT EXISTS target_high_price numeric;
ALTER TABLE analyst_targets ADD COLUMN IF NOT EXISTS target_low_price numeric;
ALTER TABLE analyst_targets ADD COLUMN IF NOT EXISTS recommendation_mean numeric;
ALTER TABLE analyst_targets ADD COLUMN IF NOT EXISTS recommendation_key text;
ALTER TABLE analyst_targets ADD COLUMN IF NOT EXISTS analyst_count integer;
ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS id bigint DEFAULT nextval('candidate_outcomes_id_seq'::regclass) NOT NULL;
ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'::text NOT NULL;
ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS observed_at timestamp with time zone;
ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS observed_price numeric;
ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS return_percent numeric;
ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS measured_at timestamp with time zone;
ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS benchmark_symbol text DEFAULT 'SPY'::text NOT NULL;
ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS benchmark_status text DEFAULT 'pending'::text NOT NULL;
ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS benchmark_start_at timestamp with time zone;
ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS benchmark_end_at timestamp with time zone;
ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS benchmark_price_start numeric;
ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS benchmark_price_end numeric;
ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS benchmark_return_percent numeric;
ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS excess_return_percent numeric;
ALTER TABLE candidate_outcomes ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE catalyst_assessments ADD COLUMN IF NOT EXISTS id bigint DEFAULT nextval('catalyst_assessments_id_seq'::regclass) NOT NULL;
ALTER TABLE catalyst_assessments ADD COLUMN IF NOT EXISTS materiality_basis text;
ALTER TABLE catalyst_assessments ADD COLUMN IF NOT EXISTS materiality_ratio numeric;
ALTER TABLE catalyst_assessments ADD COLUMN IF NOT EXISTS direction_basis text;
ALTER TABLE catalyst_assessments ADD COLUMN IF NOT EXISTS novelty_basis text;
ALTER TABLE catalyst_assessments ADD COLUMN IF NOT EXISTS prior_event_id bigint;
ALTER TABLE catalyst_assessments ADD COLUMN IF NOT EXISTS relevance_target text;
ALTER TABLE catalyst_assessments ADD COLUMN IF NOT EXISTS mandate_basis text;
ALTER TABLE catalyst_assessments ADD COLUMN IF NOT EXISTS assessed_by text DEFAULT 'rule'::text NOT NULL;
ALTER TABLE catalyst_assessments ADD COLUMN IF NOT EXISTS assessed_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE catalyst_assessments ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE catalyst_events ADD COLUMN IF NOT EXISTS id bigint DEFAULT nextval('catalyst_events_id_seq'::regclass) NOT NULL;
ALTER TABLE catalyst_events ADD COLUMN IF NOT EXISTS occurred_at timestamp with time zone;
ALTER TABLE catalyst_events ADD COLUMN IF NOT EXISTS headline text;
ALTER TABLE catalyst_events ADD COLUMN IF NOT EXISTS url text;
ALTER TABLE catalyst_events ADD COLUMN IF NOT EXISTS accession_number text;
ALTER TABLE catalyst_events ADD COLUMN IF NOT EXISTS form_type text;
ALTER TABLE catalyst_events ADD COLUMN IF NOT EXISTS linked_fact_ids jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE catalyst_events ADD COLUMN IF NOT EXISTS linked_period_end date;
ALTER TABLE catalyst_events ADD COLUMN IF NOT EXISTS linked_period_kind text;
ALTER TABLE catalyst_events ADD COLUMN IF NOT EXISTS first_seen_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE catalyst_events ADD COLUMN IF NOT EXISTS last_seen_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS id bigint DEFAULT nextval('companies_id_seq'::regclass) NOT NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS exchange text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS quote_type text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS currency text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sec_cik text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sector text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS industry text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS classification_source text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS classification_updated_at timestamp with time zone;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE company_score_snapshots ADD COLUMN IF NOT EXISTS id bigint DEFAULT nextval('company_score_snapshots_id_seq'::regclass) NOT NULL;
ALTER TABLE company_score_snapshots ADD COLUMN IF NOT EXISTS growth_score integer;
ALTER TABLE company_score_snapshots ADD COLUMN IF NOT EXISTS health_score integer;
ALTER TABLE company_score_snapshots ADD COLUMN IF NOT EXISTS calculated_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS id bigint DEFAULT nextval('discovery_decisions_id_seq'::regclass) NOT NULL;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS company_id bigint;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS candidate_rank integer;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS exclusion_reasons jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS growth_score integer;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS health_score integer;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS decision_price numeric;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS currency text;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS market_cap bigint;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS volume bigint;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS price_snapshot_id bigint;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS score_snapshot_id bigint;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS scoring_version text;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_type text;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_source_id text;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_url text;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_at timestamp with time zone;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS risks jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS unknowns jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS reasons jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS criteria jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS proof_questions jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector text;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS industry text;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector_group_type text;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector_growth_percentile numeric;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector_health_percentile numeric;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector_coverage_percentile numeric;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector_market_cap_percentile numeric;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector_comparable_count integer;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector_median_growth numeric;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector_median_health numeric;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS sector_median_coverage numeric;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS payload jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_assessment_version text;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_evidence_status text;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_evidence_tier integer;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_event_kind text;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_source_kind text;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_materiality text;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_materiality_ratio numeric;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_direction text;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_novelty text;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_thesis_relevance text;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_mandate_relevance text;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_evidence_freshness text;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_event_id bigint;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_linked_period_end date;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_next_scheduled_at timestamp with time zone;
ALTER TABLE discovery_runs ADD COLUMN IF NOT EXISTS id bigint DEFAULT nextval('discovery_runs_id_seq'::regclass) NOT NULL;
ALTER TABLE discovery_runs ADD COLUMN IF NOT EXISTS run_type text DEFAULT 'rklb'::text NOT NULL;
ALTER TABLE discovery_runs ADD COLUMN IF NOT EXISTS run_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE discovery_runs ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE earnings_events ADD COLUMN IF NOT EXISTS id bigint DEFAULT nextval('earnings_events_id_seq'::regclass) NOT NULL;
ALTER TABLE earnings_events ADD COLUMN IF NOT EXISTS timing text;
ALTER TABLE earnings_events ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE financial_enrichment_status ADD COLUMN IF NOT EXISTS last_attempt_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE financial_enrichment_status ADD COLUMN IF NOT EXISTS last_success_at timestamp with time zone;
ALTER TABLE financial_enrichment_status ADD COLUMN IF NOT EXISTS consecutive_failures integer DEFAULT 0 NOT NULL;
ALTER TABLE financial_enrichment_status ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE financial_enrichment_status ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE financial_facts ADD COLUMN IF NOT EXISTS id bigint DEFAULT nextval('financial_facts_id_seq'::regclass) NOT NULL;
ALTER TABLE financial_facts ADD COLUMN IF NOT EXISTS period_start date;
ALTER TABLE financial_facts ADD COLUMN IF NOT EXISTS fiscal_year integer;
ALTER TABLE financial_facts ADD COLUMN IF NOT EXISTS fiscal_period text;
ALTER TABLE financial_facts ADD COLUMN IF NOT EXISTS is_derived boolean DEFAULT false NOT NULL;
ALTER TABLE financial_facts ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE financial_facts ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS id bigint DEFAULT nextval('investment_theses_id_seq'::regclass) NOT NULL;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS business text;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS why_now text;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS moat text;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS mispricing text;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS catalyst text;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS invalidation text;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS twelve_month_checkpoint text;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS checkpoint_is_measurable boolean DEFAULT false NOT NULL;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS time_horizon text;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft'::text NOT NULL;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS version integer DEFAULT 1 NOT NULL;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS content_hash text;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS score_snapshot_id bigint;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS is_current boolean DEFAULT true NOT NULL;
ALTER TABLE investment_theses ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS publisher text;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS published_at timestamp with time zone;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS discovered_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE portfolio_positions ADD COLUMN IF NOT EXISTS id bigint DEFAULT nextval('portfolio_positions_id_seq'::regclass) NOT NULL;
ALTER TABLE portfolio_positions ADD COLUMN IF NOT EXISTS company_id bigint;
ALTER TABLE portfolio_positions ADD COLUMN IF NOT EXISTS status text DEFAULT 'active'::text NOT NULL;
ALTER TABLE portfolio_positions ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE portfolio_positions ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE portfolio_positions ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE price_snapshots ADD COLUMN IF NOT EXISTS id bigint DEFAULT nextval('price_snapshots_id_seq'::regclass) NOT NULL;
ALTER TABLE price_snapshots ADD COLUMN IF NOT EXISTS captured_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE price_snapshots ADD COLUMN IF NOT EXISTS price numeric;
ALTER TABLE price_snapshots ADD COLUMN IF NOT EXISTS previous_close numeric;
ALTER TABLE price_snapshots ADD COLUMN IF NOT EXISTS market_cap bigint;
ALTER TABLE price_snapshots ADD COLUMN IF NOT EXISTS volume bigint;
ALTER TABLE price_snapshots ADD COLUMN IF NOT EXISTS currency text;
ALTER TABLE research_briefs ADD COLUMN IF NOT EXISTS id bigint DEFAULT nextval('research_briefs_id_seq'::regclass) NOT NULL;
ALTER TABLE research_briefs ADD COLUMN IF NOT EXISTS source_count integer DEFAULT 0 NOT NULL;
ALTER TABLE research_briefs ADD COLUMN IF NOT EXISTS generated_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE sec_events ADD COLUMN IF NOT EXISTS company_id bigint;
ALTER TABLE sec_events ADD COLUMN IF NOT EXISTS form_type text;
ALTER TABLE sec_events ADD COLUMN IF NOT EXISTS filed_at date;
ALTER TABLE sec_events ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE sec_events ADD COLUMN IF NOT EXISTS source text DEFAULT 'sec'::text NOT NULL;
ALTER TABLE sec_events ADD COLUMN IF NOT EXISTS discovered_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE sec_suspensions ADD COLUMN IF NOT EXISTS link text;
ALTER TABLE sec_suspensions ADD COLUMN IF NOT EXISTS pub_date text;
ALTER TABLE sec_suspensions ADD COLUMN IF NOT EXISTS first_seen timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE sec_suspensions ADD COLUMN IF NOT EXISTS last_seen timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS id bigint DEFAULT nextval('snapshots_id_seq'::regclass) NOT NULL;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS captured_at timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS mentions integer DEFAULT 0 NOT NULL;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS mentions_prev integer;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS mention_growth numeric;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS upvotes integer;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS rank integer;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS rank_prev integer;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS sentiment text;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS sentiment_source text;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS sentiment_value numeric;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS market_cap bigint;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS price numeric;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS currency text;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS discovery_score numeric;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS is_new boolean DEFAULT false NOT NULL;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS volume bigint;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS fundamentals_source text;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS rising_days integer DEFAULT 0;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS sec_suspended boolean DEFAULT false;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS warnings text;
ALTER TABLE thesis_change_events ADD COLUMN IF NOT EXISTS id bigint DEFAULT nextval('thesis_change_events_id_seq'::regclass) NOT NULL;
ALTER TABLE thesis_change_events ADD COLUMN IF NOT EXISTS previous_thesis text;
ALTER TABLE thesis_change_events ADD COLUMN IF NOT EXISTS new_thesis text;
ALTER TABLE thesis_change_events ADD COLUMN IF NOT EXISTS change_reason text;
ALTER TABLE thesis_change_events ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now() NOT NULL;

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

