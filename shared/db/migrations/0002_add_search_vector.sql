-- Add search_vector column for full-text search on mos.nodes
ALTER TABLE mos.nodes ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_nodes_search ON mos.nodes USING gin (search_vector);

-- Function to auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION mos.update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.content, '') || ' ' ||
    COALESCE(NEW.summary, ''));
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_nodes_search_vector
  BEFORE INSERT OR UPDATE ON mos.nodes
  FOR EACH ROW EXECUTE FUNCTION mos.update_search_vector();

-- Backfill existing rows
UPDATE mos.nodes SET search_vector = to_tsvector('english',
  COALESCE(title, '') || ' ' ||
  COALESCE(content, '') || ' ' ||
  COALESCE(summary, ''));
