-- YCode Page Versions Table
-- Stores draft and published versions of pages with layers as JSONB

CREATE TABLE IF NOT EXISTS page_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    layers JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for page lookups
CREATE INDEX IF NOT EXISTS idx_page_versions_page_id ON page_versions(page_id);

-- Index for published versions
CREATE INDEX IF NOT EXISTS idx_page_versions_published ON page_versions(page_id, is_published);

-- Index for JSONB queries (if needed later)
CREATE INDEX IF NOT EXISTS idx_page_versions_layers ON page_versions USING GIN (layers);

-- Enable Row Level Security
ALTER TABLE page_versions ENABLE ROW LEVEL SECURITY;

-- Public can read published versions only
CREATE POLICY "Public can view published versions" 
    ON page_versions FOR SELECT 
    USING (
        is_published = TRUE 
        AND EXISTS (
            SELECT 1 FROM pages 
            WHERE pages.id = page_versions.page_id 
            AND pages.status = 'published'
        )
    );

-- Authenticated users can do everything
CREATE POLICY "Authenticated users can manage versions" 
    ON page_versions FOR ALL 
    USING (auth.role() = 'authenticated');

-- Add foreign key constraint for published_version_id in pages table
ALTER TABLE pages 
    ADD CONSTRAINT fk_pages_published_version 
    FOREIGN KEY (published_version_id) 
    REFERENCES page_versions(id) 
    ON DELETE SET NULL;


