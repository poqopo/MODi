import type { LucideIcon } from 'lucide-react-native'

export type DashboardTab = 'home' | 'projects' | 'my-projects'

export type ConnectedHealthApp = {
  id: string
  name: string
  description: string
  dataTypes: string[]
  status: 'Connected' | 'Available' | 'Needs Review'
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
  policyPackBlobId?: string | null
  policyPackHash?: string | null
  policyPackObjectId?: string | null
  policyPackVersion?: string | null
  securityMemoryBlobId?: string | null
  securityMemoryHash?: string | null
  securityMemoryObjectId?: string | null
  securityMemoryUpdatedAt?: string | null
  securityMemoryVersion?: string | null
  sealPolicyId?: string | null
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
