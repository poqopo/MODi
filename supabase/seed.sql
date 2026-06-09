insert into public.institutions (id, name, slug, website_url)
values
  ('11111111-1111-4111-8111-111111111111', 'Sui Active Insurance', 'sui-active-insurance', 'https://modi.example/institutions/sui-active-insurance')
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  website_url = excluded.website_url;

insert into public.research_projects (
  id,
  institution_id,
  public_code,
  title,
  purpose,
  description,
  status,
  target_participants,
  reward_amount_per_participant,
  reward_currency,
  reward_pool_total,
  reward_pool_remaining,
  access_period_days,
  data_scope
)
values
  (
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    'REQ-SUI-1029',
    'Apple Health 활동/운동 리워드 검증',
    '예방 리워드 산정',
    '걸음 수, 이동 거리, 운동 시간, 활동 에너지, VO2 max를 범주화해 리워드 산정 정확도를 검증합니다.',
    'recruiting',
    420,
    19,
    'USDC',
    7980,
    4280,
    60,
    array['걸음', '운동 시간', 'VO2 max']
  )
on conflict (id) do update set
  title = excluded.title,
  purpose = excluded.purpose,
  description = excluded.description,
  status = excluded.status,
  target_participants = excluded.target_participants,
  reward_amount_per_participant = excluded.reward_amount_per_participant,
  reward_currency = excluded.reward_currency,
  reward_pool_total = excluded.reward_pool_total,
  reward_pool_remaining = excluded.reward_pool_remaining,
  access_period_days = excluded.access_period_days,
  data_scope = excluded.data_scope;

insert into public.project_age_ranges (project_id, age_range)
values
  ('22222222-2222-4222-8222-222222222222', '20-29'),
  ('22222222-2222-4222-8222-222222222222', '30-39')
on conflict (project_id, age_range) do nothing;

insert into public.project_data_fields (project_id, field_key, source, policy, is_enabled)
values
  ('22222222-2222-4222-8222-222222222222', 'ageRange', 'Profile', '연령대만 저장', true),
  ('22222222-2222-4222-8222-222222222222', 'activityBand', 'Apple Health', '걸음/운동 시간 구간화', true),
  ('22222222-2222-4222-8222-222222222222', 'vo2MaxBand', 'Apple Health', '정확 수치 제거', true),
  ('22222222-2222-4222-8222-222222222222', 'sleepRecoveryBand', 'Wearable', '수면 단계 범주화', false),
  ('22222222-2222-4222-8222-222222222222', 'recordedMonth', 'System', '월 단위 시간', true)
on conflict (project_id, field_key) do update set
  source = excluded.source,
  policy = excluded.policy,
  is_enabled = excluded.is_enabled;

insert into public.study_applications (
  id,
  project_id,
  applicant_code,
  applicant_label,
  status,
  match_score,
  data_sent_bytes,
  last_submission_at
)
values
  ('33333333-3333-4333-8333-333333333001', '22222222-2222-4222-8222-222222222222', 'A-2048', '30대 활동 데이터 신청자', 'pending', 91, 2800000000, now() - interval '2 hours'),
  ('33333333-3333-4333-8333-333333333002', '22222222-2222-4222-8222-222222222222', 'A-2072', '20대 러닝 데이터 신청자', 'pending', 78, 1100000000, now() - interval '1 day'),
  ('33333333-3333-4333-8333-333333333003', '22222222-2222-4222-8222-222222222222', 'A-2104', '40대 웨어러블 신청자', 'rejected', 63, 400000000, now() - interval '3 days'),
  ('33333333-3333-4333-8333-333333333004', '22222222-2222-4222-8222-222222222222', 'A-2128', '30대 수면 회복 신청자', 'approved', 86, 3600000000, now()),
  ('33333333-3333-4333-8333-333333333005', '22222222-2222-4222-8222-222222222222', 'A-2185', '50대 심혈관 신청자', 'approved', 83, 2200000000, now() - interval '5 hours'),
  ('33333333-3333-4333-8333-333333333006', '22222222-2222-4222-8222-222222222222', 'A-2219', '20대 활동 리워드 신청자', 'pending', 74, 900000000, now() - interval '2 days')
on conflict (project_id, applicant_code) do update set
  applicant_label = excluded.applicant_label,
  status = excluded.status,
  match_score = excluded.match_score,
  data_sent_bytes = excluded.data_sent_bytes,
  last_submission_at = excluded.last_submission_at;

insert into public.participant_submissions (
  application_id,
  project_id,
  submitted_at,
  category,
  period_start,
  period_end,
  volume_bytes,
  validation_status,
  walrus_blob_id,
  walrus_manifest_hash,
  seal_policy_id
)
values
  ('33333333-3333-4333-8333-333333333001', '22222222-2222-4222-8222-222222222222', '2026-06-08 00:00:00+00', '활동 데이터', '2026-06-01', '2026-06-07', 1200000000, 'verified', 'walrus-blob-a2048-001', 'manifest-a2048-001', 'seal-policy-active-reward'),
  ('33333333-3333-4333-8333-333333333001', '22222222-2222-4222-8222-222222222222', '2026-06-01 00:00:00+00', '운동 세션', '2026-05-25', '2026-05-31', 900000000, 'verified', 'walrus-blob-a2048-002', 'manifest-a2048-002', 'seal-policy-active-reward'),
  ('33333333-3333-4333-8333-333333333004', '22222222-2222-4222-8222-222222222222', '2026-06-08 00:00:00+00', '수면 회복', '2026-06-01', '2026-06-07', 1500000000, 'verified', 'walrus-blob-a2128-001', 'manifest-a2128-001', 'seal-policy-active-reward'),
  ('33333333-3333-4333-8333-333333333005', '22222222-2222-4222-8222-222222222222', '2026-06-08 00:00:00+00', '심혈관 요약', '2026-06-01', '2026-06-07', 800000000, 'policy_passed', 'walrus-blob-a2185-001', 'manifest-a2185-001', 'seal-policy-active-reward')
on conflict do nothing;

insert into public.reward_settlements (
  application_id,
  project_id,
  amount,
  currency,
  status,
  transaction_hash,
  transaction_url,
  settled_at
)
values
  ('33333333-3333-4333-8333-333333333001', '22222222-2222-4222-8222-222222222222', 19, 'USDC', 'settled', '0x7b8c9f2a4d19', 'https://suiexplorer.com/txblock/0x7b8c9f2a4d19', now() - interval '1 day'),
  ('33333333-3333-4333-8333-333333333002', '22222222-2222-4222-8222-222222222222', 19, 'USDC', 'pending', null, null, null),
  ('33333333-3333-4333-8333-333333333004', '22222222-2222-4222-8222-222222222222', 19, 'USDC', 'settled', '0x4e21a9d6c803', 'https://suiexplorer.com/txblock/0x4e21a9d6c803', now() - interval '2 days'),
  ('33333333-3333-4333-8333-333333333005', '22222222-2222-4222-8222-222222222222', 19, 'USDC', 'pending', null, null, null)
on conflict do nothing;
