-- ══════════════════════════════════════════════════
-- Supabase Storage: Create "proofs" bucket
-- Run this in Supabase SQL Editor (one time only)
-- ══════════════════════════════════════════════════

-- Create a public bucket for expense proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('proofs', 'proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files to their own folder
CREATE POLICY "Users can upload proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow anyone to view proofs (public bucket)
CREATE POLICY "Anyone can view proofs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'proofs');

-- Allow users to delete their own proofs
CREATE POLICY "Users can delete own proofs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
