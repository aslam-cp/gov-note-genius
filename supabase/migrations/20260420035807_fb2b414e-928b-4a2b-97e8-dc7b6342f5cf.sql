-- 1. Add owner to noting_cases
ALTER TABLE public.noting_cases ADD COLUMN IF NOT EXISTS owner_id uuid;

-- Drop old permissive policies
DROP POLICY IF EXISTS "anon delete cases" ON public.noting_cases;
DROP POLICY IF EXISTS "anon insert cases" ON public.noting_cases;
DROP POLICY IF EXISTS "anon read cases" ON public.noting_cases;
DROP POLICY IF EXISTS "anon update cases" ON public.noting_cases;

DROP POLICY IF EXISTS "anon delete docs" ON public.noting_documents;
DROP POLICY IF EXISTS "anon insert docs" ON public.noting_documents;
DROP POLICY IF EXISTS "anon read docs" ON public.noting_documents;
DROP POLICY IF EXISTS "anon update docs" ON public.noting_documents;

-- New owner-scoped policies for noting_cases
CREATE POLICY "Owner can view own cases" ON public.noting_cases
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owner can insert own cases" ON public.noting_cases
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner can update own cases" ON public.noting_cases
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owner can delete own cases" ON public.noting_cases
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- noting_documents: scoped by parent case ownership
CREATE POLICY "Owner can view own docs" ON public.noting_documents
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.noting_cases c WHERE c.id = noting_documents.case_id AND c.owner_id = auth.uid())
  );
CREATE POLICY "Owner can insert own docs" ON public.noting_documents
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.noting_cases c WHERE c.id = noting_documents.case_id AND c.owner_id = auth.uid())
  );
CREATE POLICY "Owner can update own docs" ON public.noting_documents
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.noting_cases c WHERE c.id = noting_documents.case_id AND c.owner_id = auth.uid())
  );
CREATE POLICY "Owner can delete own docs" ON public.noting_documents
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.noting_cases c WHERE c.id = noting_documents.case_id AND c.owner_id = auth.uid())
  );

-- 2. Rule Library
CREATE TABLE IF NOT EXISTS public.rule_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id uuid NOT NULL,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  reference_no text NOT NULL DEFAULT '',
  year int,
  summary text NOT NULL DEFAULT '',
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rule_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view rule library" ON public.rule_documents
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can upload rules" ON public.rule_documents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploader_id);
CREATE POLICY "Uploader can update own rules" ON public.rule_documents
  FOR UPDATE TO authenticated USING (auth.uid() = uploader_id);
CREATE POLICY "Uploader can delete own rules" ON public.rule_documents
  FOR DELETE TO authenticated USING (auth.uid() = uploader_id);

CREATE TRIGGER rule_documents_set_updated_at
  BEFORE UPDATE ON public.rule_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('rule-library', 'rule-library', false)
ON CONFLICT (id) DO NOTHING;

-- Tighten noting-docs to authenticated only (drop existing, add new)
DROP POLICY IF EXISTS "noting-docs anon select" ON storage.objects;
DROP POLICY IF EXISTS "noting-docs anon insert" ON storage.objects;
DROP POLICY IF EXISTS "noting-docs anon update" ON storage.objects;
DROP POLICY IF EXISTS "noting-docs anon delete" ON storage.objects;

CREATE POLICY "noting-docs auth select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'noting-docs');
CREATE POLICY "noting-docs auth insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'noting-docs');
CREATE POLICY "noting-docs auth update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'noting-docs');
CREATE POLICY "noting-docs auth delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'noting-docs');

-- rule-library bucket policies
CREATE POLICY "rule-library auth select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'rule-library');
CREATE POLICY "rule-library auth insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'rule-library');
CREATE POLICY "rule-library auth update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'rule-library');
CREATE POLICY "rule-library auth delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'rule-library');