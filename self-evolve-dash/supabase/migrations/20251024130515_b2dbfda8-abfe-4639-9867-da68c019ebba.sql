-- Add script versioning and confidence tracking
ALTER TABLE scripts
ADD COLUMN IF NOT EXISTS confidence_score integer DEFAULT 50 CHECK (confidence_score >= 0 AND confidence_score <= 100),
ADD COLUMN IF NOT EXISTS test_results jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS parent_version_id uuid REFERENCES scripts(id),
ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;

-- Create script_versions table for rollback capability
CREATE TABLE IF NOT EXISTS script_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  version text NOT NULL,
  code text NOT NULL,
  confidence_score integer DEFAULT 50,
  test_results jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE script_versions ENABLE ROW LEVEL SECURITY;

-- RLS policies for script_versions
CREATE POLICY "Allow public read access to script_versions"
ON script_versions FOR SELECT
USING (true);

CREATE POLICY "Allow public insert to script_versions"
ON script_versions FOR INSERT
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_script_versions_script_id ON script_versions(script_id);
CREATE INDEX IF NOT EXISTS idx_scripts_confidence ON scripts(confidence_score);
CREATE INDEX IF NOT EXISTS idx_scripts_archived ON scripts(is_archived);

-- Add trigger to save version history
CREATE OR REPLACE FUNCTION save_script_version()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.code != NEW.code THEN
    INSERT INTO script_versions (script_id, version, code, confidence_score, test_results)
    VALUES (OLD.id, OLD.version, OLD.code, OLD.confidence_score, OLD.test_results);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER script_version_trigger
BEFORE UPDATE ON scripts
FOR EACH ROW
EXECUTE FUNCTION save_script_version();