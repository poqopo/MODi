alter table public.institution_wallets
  add column if not exists institution_name text,
  add column if not exists institution_slug text;

update public.institution_wallets wallets
set
  institution_name = institutions.name,
  institution_slug = institutions.slug
from public.institutions institutions
where institutions.id = wallets.institution_id
  and (wallets.institution_name is null or wallets.institution_slug is null);

drop policy if exists "institutions_insert_slush_wallet_registration" on public.institutions;
create policy "institutions_insert_slush_wallet_registration" on public.institutions
  for insert to anon, authenticated
  with check (true);

drop policy if exists "institution_wallets_insert_slush_wallet_registration" on public.institution_wallets;
create policy "institution_wallets_insert_slush_wallet_registration" on public.institution_wallets
  for insert to anon, authenticated
  with check (true);
