-- MUKTI-SETU PostgreSQL schema (migration path for the mock-persistence demo)
-- Applied automatically by backend/app/db/repository.py when DATABASE_URL is set.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Prisoner master record
CREATE TABLE IF NOT EXISTS prisoners (
  id TEXT PRIMARY KEY,
  prison_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  gender TEXT,
  age INTEGER CHECK (age > 0),
  prison_name TEXT NOT NULL,
  district TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case records with flexible JSONB source facts
CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  prisoner_id TEXT NOT NULL REFERENCES prisoners(id),
  fir_number TEXT NOT NULL,
  court TEXT NOT NULL,
  sections JSONB NOT NULL DEFAULT '[]',
  custody_start DATE NOT NULL,
  maximum_sentence_years NUMERIC(5,2),
  first_time_offender BOOLEAN,
  multiple_pending_cases BOOLEAN,
  punishable_by_death_or_life BOOLEAN,
  source_facts JSONB NOT NULL DEFAULT '{}',
  documents JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cases ADD COLUMN IF NOT EXISTS documents JSONB NOT NULL DEFAULT '[]';

-- Rule engine results (full Proof Card data as JSONB)
CREATE TABLE IF NOT EXISTS decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id TEXT NOT NULL REFERENCES cases(id),
  rule_version TEXT NOT NULL,
  decision JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log of workflow actions
CREATE TABLE IF NOT EXISTS workflow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id TEXT NOT NULL REFERENCES cases(id),
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  actor_role TEXT,
  note TEXT NOT NULL DEFAULT '',
  previous_event_hash TEXT,
  event_hash TEXT UNIQUE,
  signature TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE workflow_events ADD COLUMN IF NOT EXISTS actor_role TEXT;
ALTER TABLE workflow_events ADD COLUMN IF NOT EXISTS previous_event_hash TEXT;
ALTER TABLE workflow_events ADD COLUMN IF NOT EXISTS event_hash TEXT UNIQUE;
ALTER TABLE workflow_events ADD COLUMN IF NOT EXISTS signature TEXT;

CREATE OR REPLACE FUNCTION deny_workflow_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'workflow audit events are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS workflow_events_append_only ON workflow_events;
CREATE TRIGGER workflow_events_append_only
  BEFORE UPDATE OR DELETE ON workflow_events
  FOR EACH ROW EXECUTE FUNCTION deny_workflow_event_mutation();

-- Four-Eye Review workflow state (Officer -> Lawyer -> Judge)
CREATE TABLE IF NOT EXISTS review_workflow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id TEXT NOT NULL REFERENCES cases(id),
  current_level INTEGER NOT NULL DEFAULT 1,
  level1_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  level1_reviewer VARCHAR(255),
  level1_timestamp TIMESTAMPTZ,
  level2_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  level2_reviewer VARCHAR(255),
  level2_timestamp TIMESTAMPTZ,
  level3_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  level3_reviewer VARCHAR(255),
  level3_timestamp TIMESTAMPTZ,
  final_decision VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Truth Discovery reconciliation audit log
CREATE TABLE IF NOT EXISTS truth_discovery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id TEXT NOT NULL REFERENCES cases(id),
  field_name TEXT NOT NULL,
  resolved_value TEXT,
  resolved_source TEXT,
  confidence NUMERIC(4,3),
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cases_prisoner ON cases(prisoner_id);
CREATE INDEX IF NOT EXISTS idx_workflow_case ON workflow_events(case_id, created_at);
CREATE INDEX IF NOT EXISTS idx_truth_case ON truth_discovery_log(case_id, field_name);
