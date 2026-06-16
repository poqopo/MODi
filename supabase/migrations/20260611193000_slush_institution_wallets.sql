create table if not exists public.institution_wallets (
  institution_id uuid not null references public.institutions (id) on delete cascade,
  wallet_address text not null,
  role public.institution_role not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (institution_id, wallet_address),
  constraint institution_wallets_wallet_address_check check (wallet_address ~ '^0x[0-9a-fA-F]{64}$')
);

create unique index if not exists institution_wallets_wallet_address_key
  on public.institution_wallets (wallet_address);

create index if not exists institution_wallets_institution_id_idx
  on public.institution_wallets (institution_id);

alter table public.institution_wallets enable row level security;

drop policy if exists "institution_wallets_select_public_registered" on public.institution_wallets;
create policy "institution_wallets_select_public_registered" on public.institution_wallets
  for select to anon, authenticated
  using (true);
