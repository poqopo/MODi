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
  { label: '진행 중 연구', value: '8', detail: '이번 달 3건 신규 생성' },
  { label: '참여 신청', value: '1,284', detail: '검토 대기 96명' },
  { label: '데이터 세트', value: '42', detail: '정책 통과율 99.2%' },
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
    title: '연구 생성',
    description: '연구 목적, 대상 조건, 보상 예치, 데이터 스키마를 한 흐름으로 정의하고 공개 전 정책 검토를 실행합니다.',
    icon: FlaskConical,
    meta: 'Study builder',
  },
  {
    title: '참여 신청 관리',
    description: '신청자의 매칭 점수, 동의 상태, 제외 조건을 확인하고 승인/보류/반려 결정을 일괄 처리합니다.',
    icon: Users,
    meta: 'Applicant queue',
  },
  {
    title: '데이터 관리',
    description: 'Walrus 업로드, Seal 접근 권한, 데이터 제공 로그, 보상 지급 상태를 기관 기준으로 추적합니다.',
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
  { label: 'ConsentGrant', detail: '사용자 동의 범위 검증', icon: FileKey2 },
  { label: 'AccessGrant', detail: 'Seal policy 연결', icon: KeyRound },
  { label: 'DataAsset', detail: 'Walrus blob 참조 생성', icon: DatabaseZap },
  { label: 'RewardPaid', detail: 'Sui event 기록', icon: Banknote },
]

export const trustSignals = [
  { label: '민감정보 제거', icon: ShieldCheck },
  { label: '스키마 기반 검토', icon: ClipboardCheck },
  { label: '건강 데이터 범주화', icon: HeartPulse },
]
