import type { ResearchRequest } from '../types/dashboard'
import { getSupabaseClient, isSupabaseConfigured } from './supabase'

type ProjectCategory = ResearchRequest['category']

type RecruitingProjectRow = {
  id: string
  public_code: string | null
  title: string
  purpose: string | null
  description: string | null
  target_participants: number | null
  reward_amount_per_participant: number | null
  reward_currency: string | null
  access_period_days: number | null
  data_scope: string[] | null
  recruitment_ends_at: string | null
  institutions: { name: string | null } | null
  project_age_ranges: Array<{ age_range: string | null }> | null
  project_data_fields: Array<{ field_key: string | null; is_enabled: boolean | null }> | null
}

export async function fetchRecruitingResearchRequests(): Promise<ResearchRequest[]> {
  if (!isSupabaseConfigured) {
    return []
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('research_projects')
    .select(
      [
        'id',
        'public_code',
        'title',
        'purpose',
        'description',
        'target_participants',
        'reward_amount_per_participant',
        'reward_currency',
        'access_period_days',
        'data_scope',
        'recruitment_ends_at',
        'institutions(name)',
        'project_age_ranges(age_range)',
        'project_data_fields(field_key,is_enabled)',
      ].join(','),
    )
    .eq('status', 'recruiting')
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return typedRows<RecruitingProjectRow>(data).map(mapRecruitingProject)
}

function mapRecruitingProject(row: RecruitingProjectRow): ResearchRequest {
  const publicCode = row.public_code ?? row.id
  const dataScope = row.data_scope ?? []
  const dataFieldKeys = (row.project_data_fields ?? [])
    .filter((field) => field.is_enabled !== false)
    .map((field) => field.field_key)
    .filter((fieldKey): fieldKey is string => Boolean(fieldKey))
  const requiredConditionTags = dataFieldKeys.length > 0 ? dataFieldKeys : dataScope
  const rewardAmount = Number(row.reward_amount_per_participant ?? 0)
  const rewardCurrency = row.reward_currency ?? 'USDC'
  const category = inferCategory(row.purpose, row.title, dataScope)

  return {
    id: publicCode,
    title: row.title,
    description: row.description ?? `${row.title} 참여자를 모집합니다.`,
    organization: row.institutions?.name ?? 'MODi Research Network',
    category,
    categoryLabel: getCategoryLabel(category),
    purposeLabel: row.purpose ?? '건강 데이터 연구',
    reward: `${formatNumber(rewardAmount)} ${rewardCurrency}`,
    rewardValue: rewardAmount.toFixed(2),
    escrowStatus: rewardAmount > 0 ? 'RewardEscrow 예치 완료' : 'RewardEscrow 준비 중',
    requiredAgeRanges: getAgeRanges(row.project_age_ranges),
    requiredConditionTags: requiredConditionTags.length > 0 ? requiredConditionTags : ['health_record'],
    allowedUse: inferAllowedUse(row.purpose, category),
    retentionDays: Number(row.access_period_days ?? 60),
    accessWindow: `${Math.min(Number(row.access_period_days ?? 60), 14)}일`,
    expiresAt: formatDate(row.recruitment_ends_at),
    matchScore: inferMatchScore(category),
    participants: `${Number(row.target_participants ?? 0).toLocaleString('ko-KR')}명 모집`,
    status: '승인 가능',
  }
}

function getAgeRanges(rows: RecruitingProjectRow['project_age_ranges']) {
  const ranges = (rows ?? []).map((row) => row.age_range).filter((range): range is string => Boolean(range))
  return ranges.length > 0 ? ranges : ['20-29', '30-39']
}

function inferCategory(purpose: string | null, title: string, dataScope: string[]): ProjectCategory {
  const text = `${purpose ?? ''} ${title} ${dataScope.join(' ')}`.toLowerCase()

  if (text.includes('수면') || text.includes('코칭') || text.includes('sleep')) {
    return 'coaching'
  }

  if (text.includes('심혈관') || text.includes('병원') || text.includes('care') || text.includes('hrv')) {
    return 'care'
  }

  if (text.includes('리워드') || text.includes('보험') || text.includes('reward') || text.includes('insurance')) {
    return 'insurance'
  }

  return 'wellness'
}

function inferAllowedUse(purpose: string | null, category: ProjectCategory) {
  if (category === 'insurance') {
    return 'reward_validation'
  }

  if (category === 'coaching') {
    return 'personalized_coaching'
  }

  if (category === 'care') {
    return 'remote_monitoring'
  }

  if ((purpose ?? '').includes('집계')) {
    return 'aggregate_research'
  }

  return 'aggregate_research'
}

function getCategoryLabel(category: ProjectCategory) {
  if (category === 'insurance') {
    return '보험 리워드'
  }

  if (category === 'coaching') {
    return '건강 코칭'
  }

  if (category === 'care') {
    return '병원 모니터링'
  }

  return '기업 웰니스'
}

function inferMatchScore(category: ProjectCategory) {
  if (category === 'insurance') {
    return 91
  }

  if (category === 'coaching') {
    return 86
  }

  if (category === 'care') {
    return 72
  }

  return 79
}

function formatDate(value: string | null) {
  if (!value) {
    return '상시 모집'
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

function formatNumber(value: number) {
  return value.toLocaleString('ko-KR', { maximumFractionDigits: value >= 10 ? 0 : 2 })
}

function typedRows<T>(rows: unknown): T[] {
  return Array.isArray(rows) ? (rows as T[]) : []
}
