
-- Add city_hub, industry, delivery_points columns to leads
ALTER TABLE leads ADD COLUMN city_hub text NULL;
ALTER TABLE leads ADD COLUMN industry text NULL;
ALTER TABLE leads ADD COLUMN delivery_points text NULL;

-- SOP Wiki table
CREATE TABLE sop_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sop_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view SOPs" ON sop_articles FOR SELECT USING (true);
CREATE POLICY "Authenticated can create SOPs" ON sop_articles FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated can update SOPs" ON sop_articles FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete SOPs" ON sop_articles FOR DELETE USING (true);

CREATE TRIGGER update_sop_articles_updated_at
  BEFORE UPDATE ON sop_articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
