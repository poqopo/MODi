import type { LucideIcon } from 'lucide-react-native'

export type DashboardTab = 'home' | 'projects' | 'my-projects'

export type ConnectedHealthApp = {
  id: string
  name: string
  description: string
  dataTypes: string[]
  status: '연동됨' | '연동 가능' | '확인 필요'
  icon: LucideIcon
}

export type ResearchRequest = {
  id: string
  title: string
  description: string
  organization: string
  category: 'insurance' | 'coaching' | 'care' | 'wellness'
  categoryLabel: string
  purposeLabel: string
  reward: string
  rewardValue: string
  escrowStatus: string
  requiredAgeRanges: string[]
  requiredConditionTags: string[]
  allowedUse: string
  retentionDays: number
  accessWindow: string
  expiresAt: string
  matchScore: number
  participants: string
  status: string
}

export type ParticipationRecord = ResearchRequest & {
  consentStatus: string
  consentDate: string
  accessStatus: string
  rewardStatus: string
  progressValue: number
}

export type SummaryMetric = {
  label: string
  value: string
  detail: string
  icon: LucideIcon
}
