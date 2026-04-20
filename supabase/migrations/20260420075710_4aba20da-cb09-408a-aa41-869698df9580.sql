-- Knowledge bases (named collections, multi-membership via tags)
CREATE TABLE public.knowledge_bases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_shared boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.knowledge_bases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view kbs" ON public.knowledge_bases FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert kbs" ON public.knowledge_bases FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner update kbs" ON public.knowledge_bases FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "owner delete kbs" ON public.knowledge_bases FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER kb_updated BEFORE UPDATE ON public.knowledge_bases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Many-to-many: rule_documents <-> knowledge_bases
CREATE TABLE public.rule_document_kbs (
  rule_document_id uuid NOT NULL REFERENCES public.rule_documents(id) ON DELETE CASCADE,
  knowledge_base_id uuid NOT NULL REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rule_document_id, knowledge_base_id)
);
ALTER TABLE public.rule_document_kbs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view rdkb" ON public.rule_document_kbs FOR SELECT TO authenticated USING (true);
CREATE POLICY "uploader manage rdkb insert" ON public.rule_document_kbs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.rule_documents r WHERE r.id = rule_document_id AND r.uploader_id = auth.uid()));
CREATE POLICY "uploader manage rdkb delete" ON public.rule_document_kbs FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.rule_documents r WHERE r.id = rule_document_id AND r.uploader_id = auth.uid()));

-- Track which KBs are applied per case
ALTER TABLE public.noting_cases ADD COLUMN applied_kb_ids uuid[] NOT NULL DEFAULT '{}';

CREATE INDEX idx_rdkb_kb ON public.rule_document_kbs(knowledge_base_id);
CREATE INDEX idx_rdkb_rd ON public.rule_document_kbs(rule_document_id);