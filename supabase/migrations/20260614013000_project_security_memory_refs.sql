alter table public.research_projects
  add column if not exists security_memory_blob_id text,
  add column if not exists security_memory_object_id text,
  add column if not exists security_memory_hash text,
  add column if not exists security_memory_version text,
  add column if not exists security_memory_updated_at timestamptz;

create index if not exists research_projects_security_memory_blob_idx
  on public.research_projects (security_memory_blob_id);
