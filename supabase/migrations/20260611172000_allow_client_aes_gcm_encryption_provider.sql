alter table public.participant_submissions
  drop constraint if exists participant_submissions_encryption_provider_check;

alter table public.participant_submissions
  add constraint participant_submissions_encryption_provider_check
  check (encryption_provider in ('seal', 'client_aes_gcm'));
