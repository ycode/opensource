-- YCode Storage Bucket Setup
-- Creates a public storage bucket for assets

-- Create storage bucket for assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assets',
  'assets',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Note: RLS is already enabled on storage.objects by default in Supabase
-- We just need to create policies for our bucket

-- Drop policies if they exist (for re-running migration)
DROP POLICY IF EXISTS "Assets are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update assets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete assets" ON storage.objects;

-- Allow public read access to assets bucket
CREATE POLICY "Assets are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'assets');

-- Allow anyone to upload to assets bucket (for now, will add auth later)
CREATE POLICY "Anyone can upload assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'assets');

-- Allow anyone to update assets (for now, will add auth later)
CREATE POLICY "Anyone can update assets"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'assets')
  WITH CHECK (bucket_id = 'assets');

-- Allow anyone to delete assets (for now, will add auth later)
CREATE POLICY "Anyone can delete assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'assets');

