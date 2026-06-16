alter table public.research_projects
  add column if not exists researcher_sui_address text,
  add column if not exists sui_data_request_id text,
  add column if not exists sui_data_request_tx_digest text,
  add column if not exists sui_registry_package_id text;

do $$
begin
  alter table public.research_projects
    add constraint research_projects_researcher_sui_address_check
    check (researcher_sui_address is null or researcher_sui_address ~ '^0x[0-9a-fA-F]{64}$');
exception
  when duplicate_object then null;
end $$;

create index if not exists research_projects_researcher_sui_address_idx
  on public.research_projects (researcher_sui_address);

create index if not exists research_projects_sui_data_request_idx
  on public.research_projects (sui_data_request_id);
