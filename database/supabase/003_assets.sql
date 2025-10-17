-- YCode Assets Table
-- Stores references to uploaded files in Supabase Storage

CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    width INTEGER,
    height INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for filename searches
CREATE INDEX IF NOT EXISTS idx_assets_filename ON assets(filename);

-- Index for mime type filtering
CREATE INDEX IF NOT EXISTS idx_assets_mime_type ON assets(mime_type);

-- Enable Row Level Security
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- Public can read all assets (they're referenced in pages)
CREATE POLICY "Assets are viewable by everyone" 
    ON assets FOR SELECT 
    USING (TRUE);

-- Authenticated users can upload and manage assets
CREATE POLICY "Authenticated users can manage assets" 
    ON assets FOR ALL 
    USING (auth.role() = 'authenticated');


