import {
  Banknote,
  ClipboardCheck,
  DatabaseZap,
  FileKey2,
  FlaskConical,
  HeartPulse,
  KeyRound,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'

export type Metric = {
  label: string
  value: string
  detail: string
}

export type Study = {
  id: string
  title: string
  status: string
  target: string
  applicants: number
  approved: number
  dataScope: string
  rewardPool: string
}

export type Capability = {
  title: string
  description: string
  icon: LucideIcon
  meta: string
}

export type Applicant = {
  code: string
  state: string
  score: number
  consent: string
}

export type PipelineEvent = {
  label: string
  detail: string
  icon: LucideIcon
}

export const metrics: Metric[] = [
  { label: '진행 중 요청', value: '8', detail: '이번 달 3건 신규 생성' },
  { label: '참여 신청', value: '1,284', detail: '검토 대기 96명' },
  { label: '안전 처리 데이터', value: '42', detail: 'Privacy Agent 통과율 99.2%' },
  { label: '보상 예치', value: '18.6K SUI', detail: 'RewardEscrow 기준' },
]

export const studies: Study[] = [
  {
    id: 'REQ-SUI-1029',
    title: 'Apple Health 활동/운동 리워드 검증',
    status: '모집중',
    target: '420명',
    applicants: 184,
    approved: 128,
    dataScope: '걸음, 운동 시간, VO2 max',
    rewardPool: '7,980 SUI',
  },
  {
    id: 'REQ-SUI-1034',
    title: '수면/마음챙김 회복 코칭 데이터',
    status: '심사중',
    target: '350명',
    applicants: 156,
    approved: 74,
    dataScope: '수면 구간, 마음챙김 세션',
    rewardPool: '5,600 SUI',
  },
  {
    id: 'REQ-SUI-1041',
    title: '심혈관 활력징후 회복 추세',
    status: '심사중',
    target: '300명',
    applicants: 121,
    approved: 61,
    dataScope: '심박, HRV, 산소포화도',
    rewardPool: '6,900 SUI',
  },
]

export const capabilities: Capability[] = [
  {
    title: '요청 정책 생성',
    description: '기업이 필요한 헬스케어 마이데이터 범위, 활용 목적, 보상 조건을 versioned policy pack으로 정의합니다.',
    icon: FlaskConical,
    meta: 'Policy builder',
  },
  {
    title: '참여 신청 관리',
    description: '사용자가 어떤 요청에 동의했고 어떤 상태까지 진행됐는지 확인한 뒤 데이터 제출 가능 상태를 관리합니다.',
    icon: Users,
    meta: 'Applicant queue',
  },
  {
    title: '안전 데이터 수신',
    description: '로컬 가명처리, Privacy Agent 검증, Walrus audit trail을 거친 encrypted dataset만 기관에서 내려받습니다.',
    icon: DatabaseZap,
    meta: 'Data operations',
  },
]

export const applicants: Applicant[] = [
  { code: 'A-2048', state: '승인 권장', score: 91, consent: '제공 동의 완료' },
  { code: 'A-2072', state: '추가 확인', score: 78, consent: '심혈관 범위 확인' },
  { code: 'A-2104', state: '보류', score: 63, consent: '보상 조건 미충족' },
]

export const pipelineEvents: PipelineEvent[] = [
  { label: 'PolicyPack', detail: '기관 요청사항 Walrus publish', icon: FileKey2 },
  { label: 'PrivacyCheck', detail: 'Agent 안전성 검증', icon: KeyRound },
  { label: 'DataAsset', detail: 'encrypted Walrus blob 참조', icon: DatabaseZap },
  { label: 'RewardPaid', detail: 'Sui event 기록', icon: Banknote },
]

export const trustSignals = [
  { label: '요청별 정책 적용', icon: ShieldCheck },
  { label: 'Agent 검증 기록', icon: ClipboardCheck },
  { label: '건강 데이터 범주화', icon: HeartPulse },
]
