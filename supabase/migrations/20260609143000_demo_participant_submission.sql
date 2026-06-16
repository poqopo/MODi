create policy "study_applications_select_public_demo_recruiting" on public.study_applications
  for select to anon, authenticated
  using (
    profile_id is null
    and exists (
      select 1
      from public.research_projects projects
      where projects.id = study_applications.project_id
        and projects.status = 'recruiting'
    )
  );

create policy "participant_submissions_select_public_demo_recruiting" on public.participant_submissions
  for select to anon, authenticated
  using (
    profile_id is null
    and exists (
      select 1
      from public.research_projects projects
      where projects.id = participant_submissions.project_id
        and projects.status = 'recruiting'
    )
  );
