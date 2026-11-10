CREATE TABLE research_protocols (
 strategy_id TEXT NOT NULL, version INTEGER NOT NULL CHECK(version>0),
 definition JSONB NOT NULL CHECK(jsonb_typeof(definition)='object'),
 engine_manifest JSONB NOT NULL CHECK(jsonb_typeof(engine_manifest)='object'),
 version_hash TEXT NOT NULL CHECK(version_hash ~ '^[a-f0-9]{64}$'),
 registered_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(strategy_id,version), UNIQUE(strategy_id,version,version_hash)
);
CREATE TABLE research_universes (
 collection_run_id BIGINT PRIMARY KEY REFERENCES collection_runs(id) ON DELETE RESTRICT,
 frozen_at TIMESTAMPTZ NOT NULL, inventory_status TEXT NOT NULL CHECK(inventory_status IN ('complete_inventory','partial_inventory')),
 source_hash TEXT NOT NULL CHECK(source_hash ~ '^[a-f0-9]{64}$'),
 member_count INTEGER NOT NULL CHECK(member_count>=0),
 inputs JSONB NOT NULL CHECK(jsonb_typeof(inputs)='object'),
 CHECK(member_count=jsonb_array_length(inputs->'members'))
);
CREATE TABLE research_strategy_snapshots (
 collection_run_id BIGINT NOT NULL REFERENCES research_universes(collection_run_id) ON DELETE RESTRICT,
 strategy_id TEXT NOT NULL, version INTEGER NOT NULL, version_hash TEXT NOT NULL,
 snapshot_hash TEXT NOT NULL CHECK(snapshot_hash ~ '^[a-f0-9]{64}$'),
 rows JSONB NOT NULL CHECK(jsonb_typeof(rows)='array'),
 PRIMARY KEY(collection_run_id,strategy_id,version),
 FOREIGN KEY(strategy_id,version,version_hash) REFERENCES research_protocols(strategy_id,version,version_hash) ON DELETE RESTRICT
);
CREATE TABLE research_outcome_audits (
 id BIGSERIAL PRIMARY KEY,
 collection_run_id BIGINT NOT NULL REFERENCES research_universes(collection_run_id) ON DELETE RESTRICT,
 as_of TIMESTAMPTZ NOT NULL, recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 audit_hash TEXT NOT NULL CHECK(audit_hash ~ '^[a-f0-9]{64}$'),
 report JSONB NOT NULL CHECK(jsonb_typeof(report)='object'),
 UNIQUE(collection_run_id,as_of)
);
CREATE FUNCTION reject_research_measurement_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'research measurement evidence is append-only'; END;
$$;
CREATE TRIGGER research_protocols_immutable BEFORE UPDATE OR DELETE ON research_protocols FOR EACH ROW EXECUTE FUNCTION reject_research_measurement_mutation();
CREATE TRIGGER research_universes_immutable BEFORE UPDATE OR DELETE ON research_universes FOR EACH ROW EXECUTE FUNCTION reject_research_measurement_mutation();
CREATE TRIGGER research_strategy_snapshots_immutable BEFORE UPDATE OR DELETE ON research_strategy_snapshots FOR EACH ROW EXECUTE FUNCTION reject_research_measurement_mutation();
CREATE TRIGGER research_outcome_audits_immutable BEFORE UPDATE OR DELETE ON research_outcome_audits FOR EACH ROW EXECUTE FUNCTION reject_research_measurement_mutation();
