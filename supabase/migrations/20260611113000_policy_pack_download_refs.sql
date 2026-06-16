alter table public.research_projects
  add column if not exists policy_pack_blob_id text,
  add column if not exists policy_pack_object_id text,
  add column if not exists policy_pack_hash text,
  add column if not exists policy_pack_version text,
  add column if not exists policy_pack_tx_digest text,
  add column if not exists policy_pack_publisher_url text,
  add column if not exists policy_pack_created_at timestamptz,
  add column if not exists seal_policy_id text;

alter table public.participant_submissions
  add column if not exists walrus_publisher_url text,
  add column if not exists walrus_tx_digest text,
  add column if not exists privacy_policy_blob_id text,
  add column if not exists privacy_policy_hash text,
  add column if not exists privacy_policy_version text;

create index if not exists research_projects_policy_pack_blob_idx
  on public.research_projects (policy_pack_blob_id);

create index if not exists participant_submissions_privacy_policy_blob_idx
  on public.participant_submissions (privacy_policy_blob_id);
