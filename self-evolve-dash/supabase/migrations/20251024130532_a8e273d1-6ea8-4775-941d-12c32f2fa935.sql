-- Fix function search path security issue
DROP FUNCTION IF EXISTS save_script_version() CASCADE;

CREATE OR REPLACE FUNCTION save_script_version()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.code != NEW.code THEN
    INSERT INTO script_versions (script_id, version, code, confidence_score, test_results)
    VALUES (OLD.id, OLD.version, OLD.code, OLD.confidence_score, OLD.test_results);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate the trigger
CREATE TRIGGER script_version_trigger
BEFORE UPDATE ON scripts
FOR EACH ROW
EXECUTE FUNCTION save_script_version();