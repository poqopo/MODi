alter table public.participant_submissions
  add column if not exists walrus_dataset_object_id text,
  add column if not exists walrus_manifest_blob_id text,
  add column if not exists walrus_manifest_object_id text,
  add column if not exists processing_receipt_blob_id text,
  add column if not exists processing_receipt_hash text,
  add column if not exists sui_data_asset_id text,
  add column if not exists sui_consent_grant_id text,
  add column if not exists schema_version text,
  add column if not exists processing_policy_version text,
  add column if not exists encryption_provider text not null default 'seal',
  add column if not exists encryption_mode text,
  add column if not exists seal_identity_hex text;

do $$
begin
  alter table public.participant_submissions
    add constraint participant_submissions_encryption_provider_check
    check (encryption_provider in ('seal'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.participant_submissions
    add constraint participant_submissions_seal_identity_hex_check
    check (seal_identity_hex is null or seal_identity_hex ~ '^[0-9a-f]{64}$');
exception
  when duplicate_object then null;
end $$;

create index if not exists participant_submissions_walrus_blob_idx
  on public.participant_submissions (walrus_blob_id);

create index if not exists participant_submissions_walrus_manifest_blob_idx
  on public.participant_submissions (walrus_manifest_blob_id);

create index if not exists participant_submissions_sui_data_asset_idx
  on public.participant_submissions (sui_data_asset_id);
