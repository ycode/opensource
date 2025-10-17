-- YCode Settings Table
-- Stores global site settings and configuration

CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for key lookups
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- Enable Row Level Security
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Public can read certain settings (like site name, theme, etc.)
CREATE POLICY "Public settings are viewable by everyone" 
    ON settings FOR SELECT 
    USING (
        key IN ('site_name', 'site_description', 'theme', 'logo_url')
    );

-- Authenticated users can manage all settings
CREATE POLICY "Authenticated users can manage settings" 
    ON settings FOR ALL 
    USING (auth.role() = 'authenticated');

-- Insert default settings
INSERT INTO settings (key, value) VALUES
    ('site_name', '"YCode Site"'::jsonb),
    ('site_description', '"Built with YCode"'::jsonb),
    ('ycode_version', '"0.1.0"'::jsonb)
ON CONFLICT (key) DO NOTHING;


