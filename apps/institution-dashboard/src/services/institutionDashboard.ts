import { getSupabaseClient } from '@/lib/supabase'

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
  date: string
  category: string
  period: string
  volume: string
  status: string
  walrusBlobId: string | null
  walrusManifestHash: string | null
  sealPolicyId: string | null
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
  walrus_manifest_hash: string | null
  seal_policy_id: string | null
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

const defaultDataFields = [
  { field_key: 'heart_rate', source: 'wearable', policy: '심박수 구간화', is_enabled: true },
  { field_key: 'sleep_duration', source: 'wearable', policy: '수면 시간 구간화', is_enabled: true },
  { field_key: 'activity_steps', source: 'apple_health', policy: '걸음 수 구간화', is_enabled: true },
  { field_key: 'mood_score', source: 'manual_entry', policy: '기분 점수 범주화', is_enabled: false },
]

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

export async function fetchInstitutionDashboard(): Promise<DashboardData> {
  const supabase = getSupabaseClient()

  const { data: memberships, error: membershipError } = await supabase
    .from('institution_members')
    .select('institution_id')
    .order('created_at', { ascending: true })

  if (membershipError) {
    throw membershipError
  }

  const institutionId = typedRows<InstitutionMembershipRow>(memberships)[0]?.institution_id ?? null

  if (!institutionId) {
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
    .select(
      [
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
      ].join(','),
    )
    .eq('institution_id', institutionId)
    .order('created_at', { ascending: false })

  if (projectError) {
    throw projectError
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
          'walrus_manifest_hash',
          'seal_policy_id',
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

export async function createResearchProject(input: CreateResearchProjectInput): Promise<string> {
  const supabase = getSupabaseClient()
  const institutionId = await getPrimaryInstitutionId()

  if (!institutionId) {
    throw new Error('기관 멤버십을 찾을 수 없습니다. institution_members에 현재 Auth 사용자를 연결해 주세요.')
  }

  const targetParticipants = Math.max(1, Math.trunc(input.targetParticipants || 1))
  const rewardAmount = Math.max(0, input.rewardAmountPerParticipant || 0)
  const rewardPoolTotal = targetParticipants * rewardAmount
  const publicCode = `REQ-${crypto.randomUUID().slice(0, 8).toUpperCase()}`

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
    })
    .select('id')
    .single()

  if (projectError) {
    throw projectError
  }

  const projectId = (project as { id: string }).id

  const { error: fieldError } = await supabase.from('project_data_fields').insert(
    defaultDataFields.map((field) => ({
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
    const submission: DashboardSubmission = {
      id: row.id,
      applicationId: row.application_id,
      date: formatDate(row.submitted_at),
      category: row.category ?? '데이터 제출',
      period: formatPeriod(row.period_start, row.period_end),
      volume: formatBytes(Number(row.volume_bytes ?? 0)),
      status: verificationLabels[row.validation_status ?? 'pending_review'] ?? '검증 대기',
      walrusBlobId: row.walrus_blob_id,
      walrusManifestHash: row.walrus_manifest_hash,
      sealPolicyId: row.seal_policy_id,
    }

    acc[row.application_id] = [...(acc[row.application_id] ?? []), submission]
    return acc
  }, {})
}

function typedRows<T>(rows: unknown): T[] {
  return Array.isArray(rows) ? (rows as T[]) : []
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
