/**
 * Schema for the safety section. Every statement is idempotent so it can run
 * at each server start; add new tables/columns with IF NOT EXISTS.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location_id text NOT NULL,
  role text NOT NULL DEFAULT 'crew',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS asset_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  category text NOT NULL,
  detailed_interval_days int,
  sort int NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS checklists (
  asset_type_id uuid NOT NULL REFERENCES asset_types(id) ON DELETE CASCADE,
  kind text NOT NULL,
  items jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (asset_type_id, kind)
);

CREATE SEQUENCE IF NOT EXISTS asset_code_seq;

CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  type_id uuid NOT NULL REFERENCES asset_types(id),
  location_id text NOT NULL,
  serial text,
  manufacturer text,
  model text,
  manufactured_on date,
  in_service_on date,
  retire_on date,
  status text NOT NULL DEFAULT 'in_service',
  holder_person_id uuid REFERENCES people(id),
  holder_vehicle_id uuid REFERENCES assets(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Inspections are a permanent record: the app never updates or deletes them.
CREATE TABLE IF NOT EXISTS inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES assets(id),
  kind text NOT NULL,
  person_id uuid REFERENCES people(id),
  person_name text NOT NULL,
  result text NOT NULL,
  results jsonb NOT NULL,
  notes text,
  odometer int,
  ai_flagged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inspections_asset_idx ON inspections (asset_id, created_at DESC);

CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES assets(id),
  inspection_id uuid REFERENCES inspections(id),
  kind text NOT NULL,
  mime text NOT NULL,
  data bytea NOT NULL,
  ai jsonb,
  created_by uuid REFERENCES people(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS photos_asset_idx ON photos (asset_id, created_at DESC);

CREATE TABLE IF NOT EXISTS faults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES assets(id),
  inspection_id uuid REFERENCES inspections(id),
  item_label text NOT NULL,
  note text NOT NULL DEFAULT '',
  critical boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_by_name text,
  resolved_note text,
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS faults_asset_idx ON faults (asset_id, status);

CREATE TABLE IF NOT EXISTS asset_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES assets(id),
  kind text NOT NULL,
  detail text NOT NULL,
  person_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS asset_events_asset_idx ON asset_events (asset_id, created_at DESC);
`;
