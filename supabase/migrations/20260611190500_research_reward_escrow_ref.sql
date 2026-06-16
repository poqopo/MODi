alter table public.research_projects
  add column if not exists sui_reward_escrow_id text;

create index if not exists research_projects_sui_reward_escrow_idx
  on public.research_projects (sui_reward_escrow_id);
