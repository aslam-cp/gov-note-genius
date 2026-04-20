create table public.noting_cases (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  subject text not null default 'Untitled Case',
  reference text not null default '',
  context_summary text not null default '',
  noting_type text not null default 'approve',
  custom_instruction text not null default '',
  analysis jsonb,
  noting_text text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index noting_cases_session_idx on public.noting_cases (session_id, created_at desc);

create table public.noting_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.noting_cases(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  extracted_text text,
  created_at timestamptz not null default now()
);

create index noting_documents_case_idx on public.noting_documents (case_id);

alter table public.noting_cases enable row level security;
alter table public.noting_documents enable row level security;

create policy "anon read cases" on public.noting_cases for select using (true);
create policy "anon insert cases" on public.noting_cases for insert with check (true);
create policy "anon update cases" on public.noting_cases for update using (true);
create policy "anon delete cases" on public.noting_cases for delete using (true);

create policy "anon read docs" on public.noting_documents for select using (true);
create policy "anon insert docs" on public.noting_documents for insert with check (true);
create policy "anon update docs" on public.noting_documents for update using (true);
create policy "anon delete docs" on public.noting_documents for delete using (true);

create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end; $$;

create trigger noting_cases_updated_at
  before update on public.noting_cases
  for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public)
values ('noting-docs', 'noting-docs', true)
on conflict (id) do nothing;

create policy "public read noting-docs"
  on storage.objects for select
  using (bucket_id = 'noting-docs');

create policy "anon upload noting-docs"
  on storage.objects for insert
  with check (bucket_id = 'noting-docs');

create policy "anon update noting-docs"
  on storage.objects for update
  using (bucket_id = 'noting-docs');

create policy "anon delete noting-docs"
  on storage.objects for delete
  using (bucket_id = 'noting-docs');