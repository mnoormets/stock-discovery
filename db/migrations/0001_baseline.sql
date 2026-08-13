-- DRAFT ONLY. Not applied automatically.
-- Do not run against production before duplicate/constraint audit.
--
-- ============================================================================
-- 0001_baseline — tänase liidetud sihtseisu mustand (runtime ∪ db/init.sql)
-- ============================================================================
--
-- STAATUS: MUSTAND, MITTE VALMIS. Vt "OSA 3 — TODO" allpool.
--   * Seda faili ei kutsu ükski koodirada. Migratsioonimootorit ei ole olemas.
--   * `ensureSchema()` jääb esialgu tootmise skeemiteeks.
--   * Enne rakendamist on KOHUSTUSLIK jooksutada `npm run schema:diff`, mis
--     raporteerib `price_snapshots` duplikaadid ja `investment_theses` vigased
--     staatused. UNIQUE ja CHECK EBAÕNNESTUVAD, kui rikkumisi on juba andmes.
--
-- Kogu fail on mõeldud ühe transaktsioonina (BEGIN/COMMIT lisab mootor või
-- rakendaja käsitsi). Kogu DDL on mittehävitav: ei ühtki DROP-i, ei ühtki
-- tüübimuutust, ei ühtki NOT NULL lisamist olemasolevale veerule.


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
-- OSA 2 — KAHESUUNALISE DRIFTI SULGEMINE  (mõõdetud 2026-08-13)
-- ============================================================================
-- See osa on faili kõige väärtuslikum ja täielikult verifitseeritud sisu:
-- need objektid on olemas AINULT ühel poolel ja puuduvad teisel.

-- ---------------------------------------------------------------------------
-- 2a. Objektid, mida `db/init.sql` loob, aga runtime `ensureSchema()` EI loo.
--     Tagajärg täna: testibaas (ehitatud ensureSchema()-st) on tootmisest
--     NÕRGEM — nendes puuduvad allolevad andmeterviklikkuse piirangud.
-- ---------------------------------------------------------------------------

-- HOIATUS: nõuab eelnevat duplikaadi-auditit (`npm run schema:diff`).
-- PostgreSQL ei toeta ADD CONSTRAINT IF NOT EXISTS -> valvatud DO-plokk.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'price_snapshots_company_id_captured_at_key'
  ) THEN
    ALTER TABLE price_snapshots
      ADD CONSTRAINT price_snapshots_company_id_captured_at_key
      UNIQUE (company_id, captured_at);
  END IF;
END $$;

-- HOIATUS: nõuab eelnevat staatuse-validatsiooni (`npm run schema:diff`).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'investment_theses'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
  ) THEN
    ALTER TABLE investment_theses
      ADD CONSTRAINT investment_theses_status_check
      CHECK (status IN ('draft', 'researching', 'ready', 'rejected'));
  END IF;
END $$;

-- Kuus jõudlusindeksit, mida runtime ei loo.
CREATE INDEX IF NOT EXISTS idx_news_company_time
  ON news_items (company_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_positions_status
  ON portfolio_positions (status, ticker);
CREATE INDEX IF NOT EXISTS idx_price_company_time
  ON price_snapshots (company_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_sec_company_time
  ON sec_events (company_id, filed_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_date
  ON snapshots (capture_date);
CREATE INDEX IF NOT EXISTS idx_snapshots_score
  ON snapshots (capture_date, discovery_score DESC);

-- ---------------------------------------------------------------------------
-- 2b. Objektid, mida runtime loob, aga `db/init.sql` EI loo.
--     Tagajärg täna: puhtalt init.sql-ist ehitatud baas jääb ilma
--     catalyst-kihita, kuni rakendus esimest korda käivitub.
--     Allolev on struktuuri VIIDE — täpsed definitsioonid tuleb üle kanda
--     `src/lib/db.ts` `ensureSchema()`-st (vt OSA 3).
-- ---------------------------------------------------------------------------

-- TODO(0001): kanna üle täpne definitsioon src/lib/db.ts ensureSchema()-st.
--   catalyst_events         — 15 veergu; UNIQUE (company_id, event_kind, source_ref);
--                             FK company_id -> companies(id) ON DELETE CASCADE
--   catalyst_assessments    — 22 veergu; UNIQUE (catalyst_event_id, assessment_version,
--                             assessed_by, input_hash);
--                             FK catalyst_event_id -> catalyst_events(id) ON DELETE CASCADE;
--                             FK prior_event_id    -> catalyst_events(id) ON DELETE SET NULL
--
-- discovery_decisions: 15 catalyst-veergu, mis tekivad ainult runtime'is.
-- Need on ohutult idempotentsed ja loetletud siin täielikult:
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_assessment_version  TEXT;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_evidence_status     TEXT;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_evidence_tier       INTEGER;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_event_kind          TEXT;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_source_kind         TEXT;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_materiality         TEXT;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_materiality_ratio   NUMERIC;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_direction           TEXT;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_novelty             TEXT;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_thesis_relevance    TEXT;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_mandate_relevance   TEXT;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_evidence_freshness  TEXT;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_event_id            BIGINT;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_linked_period_end   DATE;
ALTER TABLE discovery_decisions ADD COLUMN IF NOT EXISTS catalyst_next_scheduled_at   TIMESTAMPTZ;


-- ============================================================================
-- OSA 3 — TODO: SEE FAIL EI OLE VEEL TÄIELIK BASELINE
-- ============================================================================
--
-- Täielik baseline peab kirjeldama kõik 21 tabelit / ~300 veergu nii, et
-- TÜHJALT andmebaasilt saaks ainult migratsioonidega tootmisidentse skeemi.
-- Praegu on üle kantud ainult drifti sulgemine (OSA 2).
--
-- Üle kandmata (praegu loob need `ensureSchema()` / `db/init.sql`):
--   [ ] companies, price_snapshots, news_items, sec_events, earnings_events,
--       snapshots, sec_suspensions, alerts
--   [ ] portfolio_positions, investment_theses, thesis_change_events
--   [ ] financial_facts                    (KAKS omanikku: db.ts + company-financials.ts)
--   [ ] financial_enrichment_status        (init.sql + company-financials.ts)
--   [ ] company_score_snapshots            (KAKS omanikku: db.ts + score-tracking.ts)
--   [ ] analyst_targets, research_briefs   (KAKS omanikku: db.ts + company-research-store.ts)
--   [ ] discovery_runs, discovery_decisions (baastabelid), candidate_outcomes
--   [ ] catalyst_events, catalyst_assessments (täpsed definitsioonid, vt OSA 2b)
--   [ ] companies klassifikatsiooniveerud: sector, industry, classification_source,
--       classification_updated_at (KAKS omanikku: company-research-store.ts +
--       company-classification.ts — sama neli veergu kahes kohas)
--
-- Soovitatud järgmine samm: genereeri need definitsioonid ühest tõeallikast
-- (nt puhtalt migratsioonidest ehitatud DB vs praegune, `npm run schema:diff`
-- võrdlusrežiimis), mitte käsitsi ümber kirjutades.
