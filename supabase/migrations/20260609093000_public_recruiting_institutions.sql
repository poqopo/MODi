create policy "institutions_select_recruiting_project_orgs" on public.institutions
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.research_projects projects
      where projects.institution_id = institutions.id
        and projects.status = 'recruiting'
    )
  );
