-- YCode Pages Table
-- Stores page metadata and references to published versions

CREATE TABLE IF NOT EXISTS pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',
    published_version_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast slug lookups
CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages(slug);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_pages_status ON pages(status);

-- Enable Row Level Security
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- Public can read published pages
CREATE POLICY "Public pages are viewable by everyone" 
    ON pages FOR SELECT 
    USING (status = 'published');

-- Authenticated users can do everything
CREATE POLICY "Authenticated users can manage pages" 
    ON pages FOR ALL 
    USING (auth.role() = 'authenticated');


