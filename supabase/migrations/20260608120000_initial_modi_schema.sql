create extension if not exists pgcrypto;

do $$
begin
  create type public.app_user_kind as enum ('participant', 'institution_operator', 'admin');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.institution_role as enum ('owner', 'manager', 'reviewer');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.research_status as enum ('draft', 'reviewing', 'recruiting', 'closed');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.application_status as enum ('pending', 'approved', 'rejected', 'withdrawn');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.submission_status as enum ('pending_review', 'verified', 'policy_passed', 'needs_review', 'insufficient');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.settlement_status as enum ('pending', 'settled', 'failed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  user_kind public.app_user_kind not null default 'participant',
  sui_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.institution_members (
  institution_id uuid not null references public.institutions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.institution_role not null default 'manager',
  created_at timestamptz not null default now(),
  primary key (institution_id, user_id)
);

create table if not exists public.research_projects (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  public_code text not null unique,
  title text not null,
  purpose text not null,
  description text,
  status public.research_status not null default 'draft',
  target_participants integer not null check (target_participants > 0),
  reward_amount_per_participant numeric(12, 2) not null default 0,
  reward_currency text not null default 'USDC',
  reward_pool_total numeric(14, 2) not null default 0,
  reward_pool_remaining numeric(14, 2) not null default 0,
  access_period_days integer not null default 60 check (access_period_days > 0),
  data_scope text[] not null default '{}',
  recruitment_starts_at timestamptz,
  recruitment_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_age_ranges (
  project_id uuid not null references public.research_projects (id) on delete cascade,
  age_range text not null,
  created_at timestamptz not null default now(),
  primary key (project_id, age_range)
);

create table if not exists public.project_data_fields (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.research_projects (id) on delete cascade,
  field_key text not null,
  source text not null,
  policy text not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (project_id, field_key)
);

create table if not exists public.study_applications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.research_projects (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  applicant_code text not null,
  applicant_label text not null,
  status public.application_status not null default 'pending',
  match_score integer check (match_score between 0 and 100),
  data_sent_bytes bigint not null default 0 check (data_sent_bytes >= 0),
  last_submission_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, applicant_code)
);

create table if not exists public.consent_grants (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.study_applications (id) on delete cascade,
  project_id uuid not null references public.research_projects (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  scope text[] not null default '{}',
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.participant_submissions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.study_applications (id) on delete cascade,
  project_id uuid not null references public.research_projects (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  submitted_at timestamptz not null default now(),
  category text not null,
  period_start date,
  period_end date,
  volume_bytes bigint not null default 0 check (volume_bytes >= 0),
  validation_status public.submission_status not null default 'pending_review',
  walrus_blob_id text,
  walrus_manifest_hash text,
  seal_policy_id text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.access_grants (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references public.participant_submissions (id) on delete cascade,
  project_id uuid not null references public.research_projects (id) on delete cascade,
  institution_id uuid not null references public.institutions (id) on delete cascade,
  seal_policy_id text,
  status text not null default 'active',
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

create table if not exists public.reward_settlements (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.study_applications (id) on delete cascade,
  project_id uuid not null references public.research_projects (id) on delete cascade,
  amount numeric(12, 2) not null,
  currency text not null default 'USDC',
  status public.settlement_status not null default 'pending',
  transaction_hash text,
  transaction_url text,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.research_projects (id) on delete set null,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists research_projects_institution_id_idx on public.research_projects (institution_id);
create index if not exists research_projects_status_idx on public.research_projects (status);
create index if not exists study_applications_project_status_idx on public.study_applications (project_id, status);
create index if not exists study_applications_profile_idx on public.study_applications (profile_id);
create index if not exists participant_submissions_application_idx on public.participant_submissions (application_id);
create index if not exists participant_submissions_project_idx on public.participant_submissions (project_id);
create index if not exists reward_settlements_project_status_idx on public.reward_settlements (project_id, status);

create or replace function public.is_institution_member(target_institution_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.institution_members members
    where members.institution_id = target_institution_id
      and members.user_id = auth.uid()
  );
$$;

create or replace function public.is_project_member(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.research_projects projects
    join public.institution_members members on members.institution_id = projects.institution_id
    where projects.id = target_project_id
      and members.user_id = auth.uid()
  );
$$;

create or replace function public.create_institution_for_current_user(
  institution_name text,
  institution_slug text,
  institution_website_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_institution_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  insert into public.profiles (id, user_kind)
  values (auth.uid(), 'institution_operator')
  on conflict (id) do update set
    user_kind = 'institution_operator',
    updated_at = now();

  insert into public.institutions (name, slug, website_url)
  values (institution_name, institution_slug, institution_website_url)
  returning id into new_institution_id;

  insert into public.institution_members (institution_id, user_id, role)
  values (new_institution_id, auth.uid(), 'owner');

  return new_institution_id;
end;
$$;

revoke all on function public.create_institution_for_current_user(text, text, text) from public;
grant execute on function public.create_institution_for_current_user(text, text, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.institutions enable row level security;
alter table public.institution_members enable row level security;
alter table public.research_projects enable row level security;
alter table public.project_age_ranges enable row level security;
alter table public.project_data_fields enable row level security;
alter table public.study_applications enable row level security;
alter table public.consent_grants enable row level security;
alter table public.participant_submissions enable row level security;
alter table public.access_grants enable row level security;
alter table public.reward_settlements enable row level security;
alter table public.audit_events enable row level security;

create policy "profiles_select_self" on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy "profiles_insert_self" on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "institutions_select_members" on public.institutions
  for select to authenticated
  using (public.is_institution_member(id));

create policy "institutions_insert_authenticated" on public.institutions
  for insert to authenticated
  with check (true);

create policy "institutions_update_members" on public.institutions
  for update to authenticated
  using (public.is_institution_member(id))
  with check (public.is_institution_member(id));

create policy "institution_members_select_members" on public.institution_members
  for select to authenticated
  using (public.is_institution_member(institution_id) or user_id = auth.uid());

create policy "research_projects_select_recruiting_or_member" on public.research_projects
  for select to anon, authenticated
  using (status = 'recruiting' or public.is_project_member(id));

create policy "research_projects_insert_member" on public.research_projects
  for insert to authenticated
  with check (public.is_institution_member(institution_id));

create policy "research_projects_update_member" on public.research_projects
  for update to authenticated
  using (public.is_project_member(id))
  with check (public.is_institution_member(institution_id));

create policy "project_age_ranges_select_visible_project" on public.project_age_ranges
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.research_projects projects
      where projects.id = project_id
        and (projects.status = 'recruiting' or public.is_project_member(projects.id))
    )
  );

create policy "project_age_ranges_member_write" on public.project_age_ranges
  for all to authenticated
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

create policy "project_data_fields_select_visible_project" on public.project_data_fields
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.research_projects projects
      where projects.id = project_id
        and (projects.status = 'recruiting' or public.is_project_member(projects.id))
    )
  );

create policy "project_data_fields_member_write" on public.project_data_fields
  for all to authenticated
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

create policy "study_applications_select_owner_or_project_member" on public.study_applications
  for select to authenticated
  using (profile_id = auth.uid() or public.is_project_member(project_id));

create policy "study_applications_insert_owner" on public.study_applications
  for insert to authenticated
  with check (profile_id = auth.uid());

create policy "study_applications_update_owner_or_project_member" on public.study_applications
  for update to authenticated
  using (profile_id = auth.uid() or public.is_project_member(project_id))
  with check (profile_id = auth.uid() or public.is_project_member(project_id));

create policy "consent_grants_select_owner_or_project_member" on public.consent_grants
  for select to authenticated
  using (profile_id = auth.uid() or public.is_project_member(project_id));

create policy "consent_grants_insert_owner" on public.consent_grants
  for insert to authenticated
  with check (profile_id = auth.uid());

create policy "consent_grants_update_owner_or_project_member" on public.consent_grants
  for update to authenticated
  using (profile_id = auth.uid() or public.is_project_member(project_id))
  with check (profile_id = auth.uid() or public.is_project_member(project_id));

create policy "participant_submissions_select_owner_or_project_member" on public.participant_submissions
  for select to authenticated
  using (profile_id = auth.uid() or public.is_project_member(project_id));

create policy "participant_submissions_insert_owner" on public.participant_submissions
  for insert to authenticated
  with check (profile_id = auth.uid());

create policy "participant_submissions_update_owner_or_project_member" on public.participant_submissions
  for update to authenticated
  using (profile_id = auth.uid() or public.is_project_member(project_id))
  with check (profile_id = auth.uid() or public.is_project_member(project_id));

create policy "access_grants_select_project_member" on public.access_grants
  for select to authenticated
  using (public.is_project_member(project_id));

create policy "access_grants_member_write" on public.access_grants
  for all to authenticated
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

create policy "reward_settlements_select_owner_or_project_member" on public.reward_settlements
  for select to authenticated
  using (
    public.is_project_member(project_id)
    or exists (
      select 1 from public.study_applications applications
      where applications.id = application_id
        and applications.profile_id = auth.uid()
    )
  );

create policy "reward_settlements_member_write" on public.reward_settlements
  for all to authenticated
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

create policy "audit_events_select_project_member" on public.audit_events
  for select to authenticated
  using (project_id is null or public.is_project_member(project_id));

create policy "audit_events_insert_authenticated" on public.audit_events
  for insert to authenticated
  with check (actor_profile_id = auth.uid() or public.is_project_member(project_id));
