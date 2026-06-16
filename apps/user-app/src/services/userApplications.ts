import type { ResearchRequest } from '../types/dashboard'
import { getSupabaseClient, isSupabaseConfigured } from './supabase'

export type UserApplicationStatus = 'pending' | 'approved'

export type UserResearchApplication = {
  applicationId: string
  dataSentBytes: number
  lastSubmissionAt: string | null
  projectId: string
  status: UserApplicationStatus
}

type UserApplicationResponseRow = {
  applicationId?: unknown
  dataSentBytes?: unknown
  lastSubmissionAt?: unknown
  projectPublicCode?: unknown
  status?: unknown
}

type UserApplicationListResponse = {
  applications?: unknown
}

type JoinResearchProjectInput = {
  loginId: string
  request: ResearchRequest
}

export async function fetchUserResearchApplications(loginId: string): Promise<UserResearchApplication[]> {
  if (!isSupabaseConfigured) {
    return []
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase.functions.invoke('list-user-applications', {
    body: {
      participantLoginId: loginId,
    },
  })

  if (error) {
    throw error
  }

  const response = data as UserApplicationListResponse
  return typedRows<UserApplicationResponseRow>(response.applications).map(mapUserApplication).filter(isUserResearchApplication)
}

export async function joinResearchProject({ loginId, request }: JoinResearchProjectInput): Promise<UserResearchApplication> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase 설정이 필요합니다.')
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase.functions.invoke('join-research-project', {
    body: {
      projectPublicCode: request.id,
      participantLoginId: loginId,
      participantLabel: getParticipantLabel(loginId),
    },
  })

  if (error) {
    throw error
  }

  const response = data as {
    applicationId?: unknown
    projectPublicCode?: unknown
    status?: unknown
  }

  return {
    applicationId: readText(response.applicationId),
    dataSentBytes: 0,
    lastSubmissionAt: null,
    projectId: readText(response.projectPublicCode) || request.id,
    status: normalizeApplicationStatus(response.status),
  }
}

function mapUserApplication(row: UserApplicationResponseRow): UserResearchApplication {
  return {
    applicationId: readText(row.applicationId),
    dataSentBytes: readNonNegativeNumber(row.dataSentBytes),
    lastSubmissionAt: readNullableText(row.lastSubmissionAt),
    projectId: readText(row.projectPublicCode),
    status: normalizeApplicationStatus(row.status),
  }
}

function isUserResearchApplication(application: UserResearchApplication) {
  return Boolean(application.applicationId && application.projectId)
}

function getParticipantLabel(loginId: string) {
  if (loginId === 'user-a2048') {
    return '30대 활동 데이터 신청자'
  }

  if (loginId === 'user-a2128') {
    return '30대 수면 회복 참여자'
  }

  if (loginId === 'han-demo-risk') {
    return 'Seogwipo wearable cohort participant'
  }

  return `${loginId} 사용자`
}

function normalizeApplicationStatus(value: unknown): UserApplicationStatus {
  return value === 'approved' ? 'approved' : 'pending'
}

function readText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function readNullableText(value: unknown) {
  return typeof value === 'string' ? value : null
}

function readNonNegativeNumber(value: unknown) {
  const numberValue = typeof value === 'number' || typeof value === 'string' ? Number(value) : 0
  return Number.isFinite(numberValue) ? Math.max(0, numberValue) : 0
}

function typedRows<T>(rows: unknown): T[] {
  return Array.isArray(rows) ? (rows as T[]) : []
}
