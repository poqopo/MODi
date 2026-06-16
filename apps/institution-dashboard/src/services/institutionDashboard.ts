import { getSupabaseClient } from '@/lib/supabase'
import { createAndStorePolicyPack } from '@/services/policyPack'

export type ProjectStatus = 'draft' | 'reviewing' | 'recruiting' | 'closed'
export type ApplicantStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn'
export type SettlementStatus = 'pending' | 'settled' | 'failed'

export type DashboardProject = {
  id: string
  publicCode: string
  title: string
  purpose: string
  description: string
  status: ProjectStatus
  statusLabel: string
  targetParticipants: number
  targetLabel: string
  rewardCurrency: string
  rewardAmountPerParticipant: number
  rewardPoolTotal: number
  rewardPoolRemaining: number
  rewardPoolLabel: string
  accessPeriodDays: number
  dataScope: string[]
  policyPackBlobId: string | null
  policyPackHash: string | null
  policyPackObjectId: string | null
  policyPackVersion: string | null
  securityMemoryBlobId: string | null
  securityMemoryHash: string | null
  securityMemoryObjectId: string | null
  securityMemoryUpdatedAt: string | null
  securityMemoryVersion: string | null
  sealPolicyId: string | null
  researcherSuiAddress: string | null
  suiDataRequestId: string | null
  suiDataRequestTxDigest: string | null
  suiRegistryPackageId: string | null
  suiRewardEscrowId: string | null
}

export type DashboardApplicant = {
  id: string
  projectId: string
  applicantCode: string
  applicant: string
  score: number
  dataSentBytes: number
  dataSent: string
  lastSubmissionAt: string | null
  lastSync: string
  status: ApplicantStatus
}

export type DashboardSubmission = {
  id: string
  applicationId: string
  agentMemoryArtifacts: DashboardAgentMemoryArtifact[]
  agentMemoryManifestBlobId: string | null
  agentMemoryManifestHash: string | null
  date: string
  category: string
  period: string
  volume: string
  status: string
  walrusBlobId: string | null
  walrusDatasetObjectId: string | null
  walrusManifestHash: string | null
  walrusPublisherUrl: string | null
  walrusTxDigest: string | null
  privacyPolicyBlobId: string | null
  privacyPolicyHash: string | null
  privacyPolicyVersion: string | null
  sealPolicyId: string | null
  encryptionProvider: string | null
  encryptionMode: string | null
  sealIdentityHex: string | null
}

export type DashboardAgentMemoryArtifact = {
  blobId: string
  blobObjectId: string | null
  hash: string | null
  kind: string
  title: string
  txDigest: string | null
}

export type DashboardSettlement = {
  id: string
  projectId: string
  applicationId: string
  applicantCode: string
  applicant: string
  amount: number
  currency: string
  amountLabel: string
  status: SettlementStatus
  transactionHash: string | null
  transactionUrl: string | null
}

export type DashboardData = {
  institutionId: string | null
  projects: DashboardProject[]
  applicantsByProject: Record<string, DashboardApplicant[]>
  submissionsByApplicant: Record<string, DashboardSubmission[]>
  settlementsByProject: Record<string, DashboardSettlement[]>
}

export type CreateResearchProjectInput = {
  title: string
  purpose: string
  description: string
  targetParticipants: number
  rewardAmountPerParticipant: number
  rewardCurrency: string
  accessPeriodDays: number
  dataScope: string[]
  researcherSuiAddress?: string | null
  suiDataRequestId?: string | null
  suiDataRequestTxDigest?: string | null
  suiRegistryPackageId?: string | null
  suiRewardEscrowId?: string | null
}

export type FetchInstitutionDashboardOptions = {
  researcherSuiAddress?: string | null
}

export type SlushInstitutionProfile = {
  institutionId: string
  institutionName: string
  institutionSlug: string
  walletAddress: string
}

type InstitutionMembershipRow = {
  institution_id: string
}

type ProjectRow = {
  id: string
  public_code: string | null
  title: string
  purpose: string | null
  description: string | null
  status: ProjectStatus | string
  target_participants: number | null
  reward_currency: string | null
  reward_amount_per_participant: number | null
  reward_pool_total: number | null
  reward_pool_remaining: number | null
  access_period_days: number | null
  data_scope: string[] | null
  policy_pack_blob_id: string | null
  policy_pack_hash: string | null
  policy_pack_object_id: string | null
  policy_pack_version: string | null
  security_memory_blob_id: string | null
  security_memory_hash: string | null
  security_memory_object_id: string | null
  security_memory_updated_at: string | null
  security_memory_version: string | null
  seal_policy_id: string | null
  researcher_sui_address: string | null
  sui_data_request_id: string | null
  sui_data_request_tx_digest: string | null
  sui_registry_package_id: string | null
  sui_reward_escrow_id: string | null
}

type ApplicationRow = {
  id: string
  project_id: string
  applicant_code: string | null
  applicant_label: string | null
  match_score: number | null
  data_sent_bytes: number | null
  last_submission_at: string | null
  status: ApplicantStatus | string
}

type SubmissionRow = {
  id: string
  application_id: string
  submitted_at: string
  category: string | null
  period_start: string | null
  period_end: string | null
  volume_bytes: number | null
  validation_status: string | null
  walrus_blob_id: string | null
  walrus_dataset_object_id: string | null
  walrus_manifest_hash: string | null
  walrus_publisher_url: string | null
  walrus_tx_digest: string | null
  privacy_policy_blob_id: string | null
  privacy_policy_hash: string | null
  privacy_policy_version: string | null
  seal_policy_id: string | null
  encryption_provider: string | null
  encryption_mode: string | null
  seal_identity_hex: string | null
  metadata: unknown
}

type SettlementRow = {
  id: string
  project_id: string
  application_id: string
  amount: number | null
  currency: string | null
  status: SettlementStatus | string
  transaction_hash: string | null
  transaction_url: string | null
}

type InstitutionRow = {
  id: string
}

type InstitutionWalletProfileRow = {
  institution_id: string
  institution_name: string | null
  institution_slug: string | null
  wallet_address: string
}

const demoInstitutionStorageKey = 'modi_institution_login_id'

const dataFieldByScope: Record<string, { field_key: string; source: string; policy: string; is_enabled: boolean }> = {
  'VO2 max': { field_key: 'vo2_max', source: 'apple_health', policy: '정확 수치 제거 후 band만 허용', is_enabled: true },
  '걸음': { field_key: 'step_count', source: 'apple_health', policy: '일별 원본값 제거 후 월 단위 구간화', is_enabled: true },
  '수면 단계': { field_key: 'sleep_stage', source: 'wearable', policy: '단계별 비율만 허용하고 세션 원본 제거', is_enabled: true },
  '수면 시간': { field_key: 'sleep_duration', source: 'wearable', policy: '분 단위 원본값 제거 후 구간화', is_enabled: true },
  '수면 효율': { field_key: 'sleep_efficiency', source: 'wearable', policy: '정확 비율 제거 후 band만 허용', is_enabled: true },
  '심박수': { field_key: 'heart_rate', source: 'wearable', policy: '정확 bpm 제거 후 구간화', is_enabled: true },
  '안정시 심박수': { field_key: 'resting_heart_rate', source: 'wearable', policy: '정확 bpm 제거 후 band만 허용', is_enabled: true },
  '체중': { field_key: 'weight_band', source: 'health_profile', policy: '정확 체중 제거 후 구간화', is_enabled: true },
  '혈중 산소': { field_key: 'oxygen_saturation', source: 'wearable', policy: '정확 SpO2 제거 후 band만 허용', is_enabled: true },
  'HRV': { field_key: 'hrv_band', source: 'wearable', policy: '정확 수치 제거 후 회복 band만 허용', is_enabled: true },
  '기기 유형': { field_key: 'device_type', source: 'device', policy: '상세 모델명 제거 후 기기 범주만 허용', is_enabled: true },
  '기록 월': { field_key: 'recorded_month', source: 'system', policy: '일 단위 날짜 제거 후 월 단위만 허용', is_enabled: true },
  '운동 시간': { field_key: 'exercise_minutes', source: 'apple_health', policy: '분 단위 원본값 제거 후 구간화', is_enabled: true },
  '활동 에너지': { field_key: 'active_energy', source: 'apple_health', policy: '정확 kcal 제거 후 band만 허용', is_enabled: true },
}

const statusLabels: Record<ProjectStatus, string> = {
  draft: '초안',
  reviewing: '심사중',
  recruiting: '모집중',
  closed: '종료',
}

const verificationLabels: Record<string, string> = {
  verified: '검증 완료',
  policy_passed: '정책 통과',
  needs_review: '확인 필요',
  pending_review: '검증 대기',
  insufficient: '제출 부족',
}

const projectSelectColumns = [
  'id',
  'public_code',
  'title',
  'purpose',
  'description',
  'status',
  'target_participants',
  'reward_currency',
  'reward_amount_per_participant',
  'reward_pool_total',
  'reward_pool_remaining',
  'access_period_days',
  'data_scope',
  'policy_pack_blob_id',
  'policy_pack_object_id',
  'policy_pack_hash',
  'policy_pack_version',
  'security_memory_blob_id',
  'security_memory_object_id',
  'security_memory_hash',
  'security_memory_version',
  'security_memory_updated_at',
  'seal_policy_id',
  'researcher_sui_address',
  'sui_data_request_id',
  'sui_data_request_tx_digest',
  'sui_registry_package_id',
  'sui_reward_escrow_id',
].join(',')

export async function fetchInstitutionDashboard(options: FetchInstitutionDashboardOptions = {}): Promise<DashboardData> {
  const supabase = getSupabaseClient()
  const researcherSuiAddress = normalizeSuiAddress(options.researcherSuiAddress)

  if (researcherSuiAddress) {
    return fetchResearcherWalletDashboard(researcherSuiAddress)
  }

  const { data: memberships, error: membershipError } = await supabase
    .from('institution_members')
    .select('institution_id')
    .order('created_at', { ascending: true })

  if (membershipError) {
    const publicDashboard = await fetchPublicInstitutionDashboard()

    if (publicDashboard) {
      return publicDashboard
    }

    throw membershipError
  }

  const institutionId = typedRows<InstitutionMembershipRow>(memberships)[0]?.institution_id ?? null

  if (!institutionId) {
    const publicDashboard = await fetchPublicInstitutionDashboard()

    if (publicDashboard) {
      return publicDashboard
    }

    return {
      institutionId: null,
      projects: [],
      applicantsByProject: {},
      submissionsByApplicant: {},
      settlementsByProject: {},
    }
  }

  const { data: projectRows, error: projectError } = await supabase
    .from('research_projects')
    .select(projectSelectColumns)
    .eq('institution_id', institutionId)
    .order('created_at', { ascending: false })

  if (projectError) {
    throw projectError
  }

  const projects = typedRows<ProjectRow>(projectRows).map(mapProject)
  return fetchProjectRelatedDashboard(institutionId, projects)
}

async function fetchResearcherWalletDashboard(researcherSuiAddress: string): Promise<DashboardData> {
  const supabase = getSupabaseClient()
  const { data: projectRows, error: projectError } = await supabase
    .from('research_projects')
    .select(projectSelectColumns)
    .eq('researcher_sui_address', researcherSuiAddress)
    .order('created_at', { ascending: false })

  if (projectError) {
    throw projectError
  }

  return fetchProjectRelatedDashboard(`wallet:${researcherSuiAddress}`, typedRows<ProjectRow>(projectRows).map(mapProject))
}

async function fetchProjectRelatedDashboard(institutionId: string, projects: DashboardProject[]): Promise<DashboardData> {
  const supabase = getSupabaseClient()
  const projectIds = projects.map((project) => project.id)

  if (projectIds.length === 0) {
    return {
      institutionId,
      projects,
      applicantsByProject: {},
      submissionsByApplicant: {},
      settlementsByProject: {},
    }
  }

  const [{ data: applicationRows, error: applicationError }, { data: settlementRows, error: settlementError }] =
    await Promise.all([
      supabase
        .from('study_applications')
        .select(
          [
            'id',
            'project_id',
            'applicant_code',
            'applicant_label',
            'match_score',
            'data_sent_bytes',
            'last_submission_at',
            'status',
          ].join(','),
        )
        .in('project_id', projectIds)
        .order('created_at', { ascending: false }),
      supabase
        .from('reward_settlements')
        .select(
          [
            'id',
            'project_id',
            'application_id',
            'amount',
            'currency',
            'status',
            'transaction_hash',
            'transaction_url',
          ].join(','),
        )
        .in('project_id', projectIds)
        .order('created_at', { ascending: false }),
    ])

  if (applicationError) {
    throw applicationError
  }

  if (settlementError) {
    throw settlementError
  }

  const applications = typedRows<ApplicationRow>(applicationRows).map(mapApplication)
  const applicantsByProject = groupByProject(applications)
  const applicationIds = applications.map((application) => application.id)
  const applicationById = Object.fromEntries(applications.map((application) => [application.id, application]))

  let submissionsByApplicant: Record<string, DashboardSubmission[]> = {}

  if (applicationIds.length > 0) {
    const { data: submissionRows, error: submissionError } = await supabase
      .from('participant_submissions')
      .select(
        [
          'id',
          'application_id',
          'submitted_at',
          'category',
          'period_start',
          'period_end',
          'volume_bytes',
          'validation_status',
          'walrus_blob_id',
          'walrus_dataset_object_id',
          'walrus_manifest_hash',
          'walrus_publisher_url',
          'walrus_tx_digest',
          'privacy_policy_blob_id',
          'privacy_policy_hash',
          'privacy_policy_version',
          'seal_policy_id',
          'encryption_provider',
          'encryption_mode',
          'seal_identity_hex',
          'metadata',
        ].join(','),
      )
      .in('application_id', applicationIds)
      .order('submitted_at', { ascending: false })

    if (submissionError) {
      throw submissionError
    }

    submissionsByApplicant = groupSubmissions(typedRows<SubmissionRow>(submissionRows))
  }

  const settlements = typedRows<SettlementRow>(settlementRows).map((settlement) =>
    mapSettlement(settlement, applicationById[settlement.application_id]),
  )

  return {
    institutionId,
    projects,
    applicantsByProject,
    submissionsByApplicant,
    settlementsByProject: groupByProject(settlements),
  }
}

async function fetchPublicInstitutionDashboard(): Promise<DashboardData | null> {
  const institutionSlug = getStoredDemoInstitutionSlug()

  if (!institutionSlug) {
    return null
  }

  const supabase = getSupabaseClient()
  const { data: institutionRows, error: institutionError } = await supabase
    .from('institutions')
    .select('id')
    .eq('slug', institutionSlug)
    .limit(1)

  if (institutionError) {
    return null
  }

  const institutionId = typedRows<InstitutionRow>(institutionRows)[0]?.id

  if (!institutionId) {
    return null
  }

  const { data: projectRows, error: projectError } = await supabase
    .from('research_projects')
    .select(projectSelectColumns)
    .eq('institution_id', institutionId)
    .eq('status', 'recruiting')
    .order('created_at', { ascending: false })

  if (projectError) {
    return null
  }

  const projects = typedRows<ProjectRow>(projectRows).map(mapProject)
  const projectIds = projects.map((project) => project.id)

  if (projectIds.length === 0) {
    return {
      institutionId,
      projects,
      applicantsByProject: {},
      submissionsByApplicant: {},
      settlementsByProject: {},
    }
  }

  const { data: applicationRows, error: applicationError } = await supabase
    .from('study_applications')
    .select(
      [
        'id',
        'project_id',
        'applicant_code',
        'applicant_label',
        'match_score',
        'data_sent_bytes',
        'last_submission_at',
        'status',
      ].join(','),
    )
    .in('project_id', projectIds)
    .order('created_at', { ascending: false })

  if (applicationError) {
    return {
      institutionId,
      projects,
      applicantsByProject: {},
      submissionsByApplicant: {},
      settlementsByProject: {},
    }
  }

  const applications = typedRows<ApplicationRow>(applicationRows).map(mapApplication)
  const applicationIds = applications.map((application) => application.id)
  let submissionsByApplicant: Record<string, DashboardSubmission[]> = {}

  if (applicationIds.length > 0) {
    const { data: submissionRows, error: submissionError } = await supabase
      .from('participant_submissions')
      .select(
        [
          'id',
          'application_id',
          'submitted_at',
          'category',
          'period_start',
          'period_end',
          'volume_bytes',
          'validation_status',
          'walrus_blob_id',
          'walrus_dataset_object_id',
          'walrus_manifest_hash',
          'walrus_publisher_url',
          'walrus_tx_digest',
          'privacy_policy_blob_id',
          'privacy_policy_hash',
          'privacy_policy_version',
          'seal_policy_id',
          'encryption_provider',
          'encryption_mode',
          'seal_identity_hex',
          'metadata',
        ].join(','),
      )
      .in('application_id', applicationIds)
      .order('submitted_at', { ascending: false })

    if (!submissionError) {
      submissionsByApplicant = groupSubmissions(typedRows<SubmissionRow>(submissionRows))
    }
  }

  return {
    institutionId,
    projects,
    applicantsByProject: groupByProject(applications),
    submissionsByApplicant,
    settlementsByProject: {},
  }
}

export async function resolveSlushInstitution(walletAddress: string): Promise<SlushInstitutionProfile | null> {
  const normalizedWalletAddress = normalizeSuiAddress(walletAddress)

  if (!normalizedWalletAddress) {
    throw new Error('유효한 Slush 지갑 주소가 필요합니다.')
  }

  try {
    return await invokeSlushInstitutionFunction({ walletAddress: normalizedWalletAddress })
  } catch {
    return resolveDirectSlushInstitution(normalizedWalletAddress)
  }
}

export async function registerSlushInstitution(input: {
  institutionName: string
  walletAddress: string
  websiteUrl?: string
}): Promise<SlushInstitutionProfile> {
  const normalizedWalletAddress = normalizeSuiAddress(input.walletAddress)

  if (!normalizedWalletAddress) {
    throw new Error('유효한 Slush 지갑 주소가 필요합니다.')
  }

  let profile: SlushInstitutionProfile | null

  try {
    profile = await invokeSlushInstitutionFunction({
      ...input,
      walletAddress: normalizedWalletAddress,
    })
  } catch {
    profile = await registerDirectSlushInstitution({
      ...input,
      walletAddress: normalizedWalletAddress,
    })
  }

  if (!profile) {
    profile = await registerDirectSlushInstitution({
      ...input,
      walletAddress: normalizedWalletAddress,
    })
  }

  return profile
}

export async function createResearchProject(input: CreateResearchProjectInput): Promise<string> {
  const supabase = getSupabaseClient()
  const researcherSuiAddress = normalizeSuiAddress(input.researcherSuiAddress)
  const slushInstitution = researcherSuiAddress ? await resolveSlushInstitution(researcherSuiAddress) : null
  const institutionSlug = slushInstitution?.institutionSlug ?? getStoredDemoInstitutionSlug()

  debugInstitutionDashboard('createResearchProject:resolved institution', {
    institutionSlug,
    researcherSuiAddress,
    suiDataRequestId: input.suiDataRequestId,
    suiDataRequestTxDigest: input.suiDataRequestTxDigest,
  })

  if (researcherSuiAddress && !institutionSlug) {
    throw new Error('기관 등록이 필요합니다. Slush 지갑에 연결할 기관명을 먼저 등록해 주세요.')
  }

  if (institutionSlug) {
    debugInstitutionDashboard('createResearchProject:invoke edge function', {
      institutionSlug,
      researcherSuiAddress,
    })
    const { data, error } = await supabase.functions.invoke('create-research-project', {
      body: {
        ...input,
        researcherSuiAddress,
        institutionSlug,
      },
    })

    if (error) {
      debugInstitutionDashboard('createResearchProject:edge function error', error)
      throw error
    }

    debugInstitutionDashboard('createResearchProject:edge function result', data)
    return (data as { projectId: string }).projectId
  }

  const institutionId = await getPrimaryInstitutionId()

  if (!institutionId) {
    throw new Error('기관 멤버십을 찾을 수 없습니다. institution_members에 현재 Auth 사용자를 연결해 주세요.')
  }

  const targetParticipants = Math.max(1, Math.trunc(input.targetParticipants || 1))
  const rewardAmount = Math.max(0, input.rewardAmountPerParticipant || 0)
  const rewardPoolTotal = targetParticipants * rewardAmount
  const publicCode = `REQ-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
  const policyPackUpload = await createAndStorePolicyPack({
    input: {
      ...input,
      researcherSuiAddress,
      accessPeriodDays: Math.max(1, Math.trunc(input.accessPeriodDays || 1)),
      dataScope: input.dataScope.length > 0 ? input.dataScope : ['웨어러블 데이터'],
      rewardAmountPerParticipant: rewardAmount,
      rewardCurrency: input.rewardCurrency.trim() || 'USDC',
      targetParticipants,
    },
    publicCode,
  })

  const { data: project, error: projectError } = await supabase
    .from('research_projects')
    .insert({
      institution_id: institutionId,
      public_code: publicCode,
      title: input.title.trim(),
      purpose: input.purpose.trim(),
      description: input.description.trim(),
      status: 'recruiting',
      target_participants: targetParticipants,
      reward_currency: input.rewardCurrency.trim() || 'USDC',
      reward_amount_per_participant: rewardAmount,
      reward_pool_total: rewardPoolTotal,
      reward_pool_remaining: rewardPoolTotal,
      access_period_days: Math.max(1, Math.trunc(input.accessPeriodDays || 1)),
      data_scope: input.dataScope.length > 0 ? input.dataScope : ['웨어러블 데이터'],
      policy_pack_blob_id: policyPackUpload.blobId,
      policy_pack_object_id: policyPackUpload.blobObjectId,
      policy_pack_hash: policyPackUpload.hash,
      policy_pack_version: policyPackUpload.policyPack.policyVersion,
      policy_pack_tx_digest: policyPackUpload.txDigest,
      policy_pack_publisher_url: policyPackUpload.publisherUrl,
      policy_pack_created_at: new Date().toISOString(),
      seal_policy_id: policyPackUpload.policyPack.seal.sealPolicyId,
      researcher_sui_address: researcherSuiAddress,
      sui_data_request_id: normalizeSuiObjectId(input.suiDataRequestId),
      sui_data_request_tx_digest: input.suiDataRequestTxDigest?.trim() || null,
      sui_registry_package_id: normalizeSuiObjectId(input.suiRegistryPackageId) ?? policyPackUpload.policyPack.seal.packageId,
      sui_reward_escrow_id: normalizeSuiObjectId(input.suiRewardEscrowId),
    })
    .select('id')
    .single()

  if (projectError) {
    throw projectError
  }

  const projectId = (project as { id: string }).id

  const { error: fieldError } = await supabase.from('project_data_fields').insert(
    buildProjectDataFields(input.dataScope).map((field) => ({
      project_id: projectId,
      ...field,
    })),
  )

  if (fieldError) {
    throw fieldError
  }

  return projectId
}

export async function createInstitutionForCurrentUser(input: { name: string; slug: string; websiteUrl?: string }) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.rpc('create_institution_for_current_user', {
    institution_name: input.name.trim(),
    institution_slug: input.slug.trim(),
    institution_website_url: input.websiteUrl?.trim() || null,
  })

  if (error) {
    throw error
  }

  return data as string
}

export async function updateApplicationStatus(applicationId: string, status: Extract<ApplicantStatus, 'approved' | 'rejected'>) {
  const supabase = getSupabaseClient()
  const institutionSlug = getStoredDemoInstitutionSlug()

  if (institutionSlug) {
    const { error } = await supabase.functions.invoke('review-study-application', {
      body: {
        applicationId,
        institutionSlug,
        status,
      },
    })

    if (error) {
      throw error
    }

    return
  }

  const { error } = await supabase
    .from('study_applications')
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq('id', applicationId)

  if (error) {
    throw error
  }
}

export async function markSettlementSettled(settlementId: string) {
  const supabase = getSupabaseClient()
  const transactionHash = `manual-${settlementId.slice(0, 8)}`
  const transactionUrl = `https://suivision.xyz/txblock/${transactionHash}`

  const { error } = await supabase
    .from('reward_settlements')
    .update({
      status: 'settled',
      settled_at: new Date().toISOString(),
      transaction_hash: transactionHash,
      transaction_url: transactionUrl,
    })
    .eq('id', settlementId)

  if (error) {
    throw error
  }

  return { transactionHash, transactionUrl }
}

async function getPrimaryInstitutionId() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('institution_members')
    .select('institution_id')
    .order('created_at', { ascending: true })
    .limit(1)

  if (error) {
    throw error
  }

  return typedRows<InstitutionMembershipRow>(data)[0]?.institution_id ?? null
}

function mapProject(row: ProjectRow): DashboardProject {
  const status = normalizeProjectStatus(row.status)
  const rewardCurrency = row.reward_currency ?? 'USDC'
  const rewardPoolRemaining = Number(row.reward_pool_remaining ?? 0)
  const rewardPoolTotal = Number(row.reward_pool_total ?? 0)
  const targetParticipants = Number(row.target_participants ?? 0)

  return {
    id: row.id,
    publicCode: row.public_code ?? row.id.slice(0, 8).toUpperCase(),
    title: row.title,
    purpose: row.purpose ?? '',
    description: row.description ?? '',
    status,
    statusLabel: statusLabels[status],
    targetParticipants,
    targetLabel: `${targetParticipants.toLocaleString('ko-KR')}명`,
    rewardCurrency,
    rewardAmountPerParticipant: Number(row.reward_amount_per_participant ?? 0),
    rewardPoolTotal,
    rewardPoolRemaining,
    rewardPoolLabel: `${formatNumber(rewardPoolRemaining)} ${rewardCurrency}`,
    accessPeriodDays: Number(row.access_period_days ?? 0),
    dataScope: row.data_scope ?? [],
    policyPackBlobId: row.policy_pack_blob_id,
    policyPackHash: row.policy_pack_hash,
    policyPackObjectId: row.policy_pack_object_id,
    policyPackVersion: row.policy_pack_version,
    securityMemoryBlobId: row.security_memory_blob_id,
    securityMemoryHash: row.security_memory_hash,
    securityMemoryObjectId: row.security_memory_object_id,
    securityMemoryUpdatedAt: row.security_memory_updated_at,
    securityMemoryVersion: row.security_memory_version,
    sealPolicyId: row.seal_policy_id,
    researcherSuiAddress: row.researcher_sui_address,
    suiDataRequestId: row.sui_data_request_id,
    suiDataRequestTxDigest: row.sui_data_request_tx_digest,
    suiRegistryPackageId: row.sui_registry_package_id,
    suiRewardEscrowId: row.sui_reward_escrow_id,
  }
}

function mapApplication(row: ApplicationRow): DashboardApplicant {
  return {
    id: row.id,
    projectId: row.project_id,
    applicantCode: row.applicant_code ?? row.id.slice(0, 8).toUpperCase(),
    applicant: row.applicant_label ?? '익명 참여자',
    score: Number(row.match_score ?? 0),
    dataSentBytes: Number(row.data_sent_bytes ?? 0),
    dataSent: formatBytes(Number(row.data_sent_bytes ?? 0)),
    lastSubmissionAt: row.last_submission_at,
    lastSync: formatRelativeDate(row.last_submission_at),
    status: normalizeApplicantStatus(row.status),
  }
}

function mapSettlement(row: SettlementRow, application?: DashboardApplicant): DashboardSettlement {
  const currency = row.currency ?? 'USDC'
  const amount = Number(row.amount ?? 0)

  return {
    id: row.id,
    projectId: row.project_id,
    applicationId: row.application_id,
    applicantCode: application?.applicantCode ?? row.application_id.slice(0, 8).toUpperCase(),
    applicant: application?.applicant ?? '익명 참여자',
    amount,
    currency,
    amountLabel: `${formatNumber(amount)} ${currency}`,
    status: normalizeSettlementStatus(row.status),
    transactionHash: row.transaction_hash,
    transactionUrl: row.transaction_url,
  }
}

function groupByProject<T extends { projectId: string }>(rows: T[]) {
  return rows.reduce<Record<string, T[]>>((acc, row) => {
    acc[row.projectId] = [...(acc[row.projectId] ?? []), row]
    return acc
  }, {})
}

function groupSubmissions(rows: SubmissionRow[]) {
  return rows.reduce<Record<string, DashboardSubmission[]>>((acc, row) => {
    const agentMemory = readAgentMemoryMetadata(row.metadata)
    const submission: DashboardSubmission = {
      id: row.id,
      applicationId: row.application_id,
      agentMemoryArtifacts: agentMemory.artifacts,
      agentMemoryManifestBlobId: agentMemory.manifestBlobId,
      agentMemoryManifestHash: agentMemory.manifestHash,
      date: formatDate(row.submitted_at),
      category: row.category ?? '데이터 제출',
      period: formatPeriod(row.period_start, row.period_end),
      volume: formatBytes(Number(row.volume_bytes ?? 0)),
      status: verificationLabels[row.validation_status ?? 'pending_review'] ?? '검증 대기',
      walrusBlobId: row.walrus_blob_id,
      walrusDatasetObjectId: row.walrus_dataset_object_id,
      walrusManifestHash: row.walrus_manifest_hash,
      walrusPublisherUrl: row.walrus_publisher_url,
      walrusTxDigest: row.walrus_tx_digest,
      privacyPolicyBlobId: row.privacy_policy_blob_id,
      privacyPolicyHash: row.privacy_policy_hash,
      privacyPolicyVersion: row.privacy_policy_version,
      sealPolicyId: row.seal_policy_id,
      encryptionProvider: row.encryption_provider,
      encryptionMode: row.encryption_mode,
      sealIdentityHex: row.seal_identity_hex,
    }

    acc[row.application_id] = [...(acc[row.application_id] ?? []), submission]
    return acc
  }, {})
}

function readAgentMemoryMetadata(metadata: unknown) {
  const root = asRecord(metadata)
  const agentMemory = asRecord(root?.agent_memory)
  const workflow = asRecord(agentMemory?.workflow)
  const artifacts = Array.isArray(agentMemory?.artifacts)
    ? agentMemory.artifacts.map(readAgentMemoryArtifact).filter((artifact): artifact is DashboardAgentMemoryArtifact => Boolean(artifact))
    : []

  return {
    artifacts,
    manifestBlobId: readText(workflow?.manifestBlobId),
    manifestHash: readText(workflow?.manifestHash),
  }
}

function readAgentMemoryArtifact(value: unknown): DashboardAgentMemoryArtifact | null {
  const artifact = asRecord(value)
  const blobId = readText(artifact?.blobId)
  const kind = readText(artifact?.kind)

  if (!blobId || !kind) {
    return null
  }

  return {
    blobId,
    blobObjectId: readText(artifact?.blobObjectId),
    hash: readText(artifact?.hash),
    kind,
    title: readText(artifact?.title) ?? formatAgentMemoryKind(kind),
    txDigest: readText(artifact?.txDigest),
  }
}

function formatAgentMemoryKind(kind: string) {
  if (kind === 'pseudonymization_plan') return 'Local Pseudonymization Plan'
  if (kind === 'privacy_verification_receipt') return 'Security Agent Verification Receipt'
  if (kind === 'security_memory') return 'Security Agent Learned Risk Memory'
  if (kind === 'agent_workflow_manifest') return 'MODi Agent Workflow Memory'
  return kind
}

function typedRows<T>(rows: unknown): T[] {
  return Array.isArray(rows) ? (rows as T[]) : []
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function readText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function buildProjectDataFields(dataScope: string[]) {
  const fields = dataScope.map((scope) => dataFieldByScope[scope] ?? {
    field_key: normalizeFieldKey(scope),
    source: 'user_health_data',
    policy: '직접 식별자와 정확한 원본값 제거',
    is_enabled: true,
  })

  return fields.length > 0 ? fields : [
    {
      field_key: 'health_record',
      source: 'user_health_data',
      policy: '직접 식별자와 정확한 원본값 제거',
      is_enabled: true,
    },
  ]
}

function normalizeFieldKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, '_').replace(/^_+|_+$/g, '')
}

function getStoredDemoInstitutionSlug() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage.getItem(demoInstitutionStorageKey)
}

async function invokeSlushInstitutionFunction(input: {
  institutionName?: string
  walletAddress: string
  websiteUrl?: string
}): Promise<SlushInstitutionProfile | null> {
  const supabase = getSupabaseClient()
  const walletAddress = normalizeSuiAddress(input.walletAddress)

  if (!walletAddress) {
    throw new Error('유효한 Slush 지갑 주소가 필요합니다.')
  }

  const { data, error } = await supabase.functions.invoke('register-slush-institution', {
    body: {
      institutionName: input.institutionName?.trim() || undefined,
      walletAddress,
      websiteUrl: input.websiteUrl?.trim() || undefined,
    },
  })

  if (error) {
    throw error
  }

  const response = data as {
    institution?: Partial<SlushInstitutionProfile> | null
    registered?: boolean
  } | null
  const institution = response?.institution

  if (!response?.registered || !institution) {
    return null
  }

  if (
    typeof institution.institutionId !== 'string' ||
    typeof institution.institutionName !== 'string' ||
    typeof institution.institutionSlug !== 'string' ||
    typeof institution.walletAddress !== 'string'
  ) {
    throw new Error('기관 등록 응답 형식이 올바르지 않습니다.')
  }

  return {
    institutionId: institution.institutionId,
    institutionName: institution.institutionName,
    institutionSlug: institution.institutionSlug,
    walletAddress: institution.walletAddress,
  }
}

async function resolveDirectSlushInstitution(walletAddress: string): Promise<SlushInstitutionProfile | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('institution_wallets')
    .select('institution_id,institution_name,institution_slug,wallet_address')
    .eq('wallet_address', walletAddress)
    .maybeSingle<InstitutionWalletProfileRow>()

  if (error) {
    throw error
  }

  if (!data?.institution_name || !data.institution_slug) {
    return null
  }

  return {
    institutionId: data.institution_id,
    institutionName: data.institution_name,
    institutionSlug: data.institution_slug,
    walletAddress: data.wallet_address,
  }
}

async function registerDirectSlushInstitution(input: {
  institutionName: string
  walletAddress: string
  websiteUrl?: string
}): Promise<SlushInstitutionProfile> {
  const existing = await resolveDirectSlushInstitution(input.walletAddress)

  if (existing) {
    return existing
  }

  const supabase = getSupabaseClient()
  const institutionName = input.institutionName.trim()

  if (!institutionName) {
    throw new Error('기관명을 입력해 주세요.')
  }

  const institutionId = crypto.randomUUID()
  const institutionSlug = `${slugifyInstitutionName(institutionName) || 'institution'}-${input.walletAddress.slice(-8)}`

  const { error: institutionError } = await supabase.from('institutions').insert({
    id: institutionId,
    name: institutionName,
    slug: institutionSlug,
    website_url: input.websiteUrl?.trim() || null,
  })

  if (institutionError) {
    throw institutionError
  }

  const { error: walletError } = await supabase.from('institution_wallets').insert({
    institution_id: institutionId,
    institution_name: institutionName,
    institution_slug: institutionSlug,
    role: 'owner',
    wallet_address: input.walletAddress,
  })

  if (walletError) {
    const registered = await resolveDirectSlushInstitution(input.walletAddress)

    if (registered) {
      return registered
    }

    throw walletError
  }

  return {
    institutionId,
    institutionName,
    institutionSlug,
    walletAddress: input.walletAddress,
  }
}

function slugifyInstitutionName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function normalizeProjectStatus(status: string): ProjectStatus {
  if (status === 'reviewing' || status === 'recruiting' || status === 'closed') {
    return status
  }

  return 'draft'
}

function normalizeApplicantStatus(status: string): ApplicantStatus {
  if (status === 'approved' || status === 'rejected' || status === 'withdrawn') {
    return status
  }

  return 'pending'
}

function normalizeSettlementStatus(status: string): SettlementStatus {
  if (status === 'settled' || status === 'failed') {
    return status
  }

  return 'pending'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(new Date(value))
}

function formatPeriod(start: string | null, end: string | null) {
  if (!start && !end) {
    return '기간 미지정'
  }

  if (start && end) {
    return `${formatDateOnly(start)}-${formatDateOnly(end)}`
  }

  return formatDateOnly(start ?? end ?? '')
}

function formatDateOnly(value: string) {
  if (!value) {
    return '기간 미지정'
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
  }).format(new Date(value))
}

function formatRelativeDate(value: string | null) {
  if (!value) {
    return '제출 없음'
  }

  const diffMs = Date.now() - new Date(value).getTime()
  const minutes = Math.max(1, Math.floor(diffMs / 60_000))

  if (minutes < 60) {
    return `${minutes}분 전`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}시간 전`
  }

  return `${Math.floor(hours / 24)}일 전`
}

function formatBytes(bytes: number) {
  if (bytes <= 0) {
    return '0 MB'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toLocaleString('ko-KR', { maximumFractionDigits: value >= 10 ? 0 : 1 })} ${units[unitIndex]}`
}

function formatNumber(value: number) {
  return value.toLocaleString('ko-KR', { maximumFractionDigits: value >= 10 ? 0 : 2 })
}

function normalizeSuiAddress(value: string | null | undefined) {
  const text = value?.trim().toLowerCase()
  return text && /^0x[0-9a-f]{64}$/.test(text) ? text : null
}

function normalizeSuiObjectId(value: string | null | undefined) {
  const text = value?.trim().toLowerCase()
  return text && /^0x[0-9a-f]{1,64}$/.test(text) ? text : null
}

function debugInstitutionDashboard(label: string, payload: unknown) {
  if (import.meta.env.DEV) {
    console.info(`[MODi institution dashboard] ${label}`, payload)
  }
}
