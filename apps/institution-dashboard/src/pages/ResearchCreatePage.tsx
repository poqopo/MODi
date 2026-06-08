import {
  ChevronDown,
  DatabaseZap,
  FileText,
  Layers3,
  Plus,
  SlidersHorizontal,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { studies, type Study } from '@/data/landing'

type ProjectMenuItem = {
  key: Exclude<ProjectView, 'home'>
  label: string
  detail: string
  icon: LucideIcon
}

type ProjectView = 'home' | 'participants' | 'datasets' | 'settlements'

type Project = Study & {
  mode: 'active' | 'draft'
}

type ApplicantDecision = '승인' | '거절'
type ApplicantStatus = 'pending' | 'approved' | 'rejected'
type SettlementStatus = 'settled' | 'pending'

type ApplicantRecord = {
  id: string
  applicant: string
  consent: string
  score: number
  dataSent: string
  activity: number
  lastSync: string
  status: ApplicantStatus
}

type SubmissionRecord = {
  date: string
  category: string
  period: string
  volume: string
  status: string
}

const draftProject: Project = {
  id: 'REQ-DRAFT-1062',
  title: 'Apple Health 활동/운동 리워드 검증 데이터',
  status: '심사중',
  target: '420명',
  applicants: 0,
  approved: 0,
  dataScope: '걸음, 운동 시간, VO2 max',
  rewardPool: '7,980 SUI',
  mode: 'draft',
}

const projectMenus: ProjectMenuItem[] = [
  { key: 'participants', label: '참여자 관리', detail: '신청자/참여자 관리', icon: Users },
  { key: 'datasets', label: '데이터 세트', detail: 'Walrus/Seal 접근', icon: DatabaseZap },
  { key: 'settlements', label: '보상/정산', detail: 'RewardEscrow 지급', icon: Wallet },
]

const schemaRows = [
  { field: 'ageRange', source: 'Profile', policy: '연령대만 저장', enabled: true },
  { field: 'activityBand', source: 'Apple Health', policy: '걸음/운동 시간 구간화', enabled: true },
  { field: 'vo2MaxBand', source: 'Apple Health', policy: '정확 수치 제거', enabled: true },
  { field: 'sleepRecoveryBand', source: 'Wearable', policy: '수면 단계 범주화', enabled: false },
  { field: 'recordedMonth', source: 'System', policy: '월 단위 시간', enabled: true },
]

const dataCategories = ['걸음', '운동 시간', '활동 에너지', 'VO2 max', '기기 유형', '기록 월']
const ageRanges = ['20-29', '30-39', '40-49', '50-59']
const applicantDecisions: ApplicantDecision[] = ['승인', '거절']

const applicantRows: ApplicantRecord[] = [
  {
    id: 'A-2048',
    applicant: '30대 활동 데이터 신청자',
    consent: '활동/운동 동의 완료',
    score: 91,
    dataSent: '2.8 GB',
    activity: 94,
    lastSync: '2시간 전',
    status: 'pending',
  },
  {
    id: 'A-2072',
    applicant: '20대 러닝 데이터 신청자',
    consent: 'VO2 max 범위 확인 필요',
    score: 78,
    dataSent: '1.1 GB',
    activity: 72,
    lastSync: '1일 전',
    status: 'pending',
  },
  {
    id: 'A-2104',
    applicant: '40대 웨어러블 신청자',
    consent: '보상 조건 미충족',
    score: 63,
    dataSent: '0.4 GB',
    activity: 38,
    lastSync: '3일 전',
    status: 'rejected',
  },
  {
    id: 'A-2128',
    applicant: '30대 수면 회복 신청자',
    consent: '필수 동의 완료',
    score: 86,
    dataSent: '3.6 GB',
    activity: 88,
    lastSync: '오늘',
    status: 'approved',
  },
  {
    id: 'A-2185',
    applicant: '50대 심혈관 신청자',
    consent: '심박/HRV 제공 동의 완료',
    score: 83,
    dataSent: '2.2 GB',
    activity: 81,
    lastSync: '5시간 전',
    status: 'approved',
  },
  {
    id: 'A-2219',
    applicant: '20대 활동 리워드 신청자',
    consent: '기기 유형 확인 필요',
    score: 74,
    dataSent: '0.9 GB',
    activity: 66,
    lastSync: '2일 전',
    status: 'pending',
  },
]

const settlementRows: Array<{
  id: string
  applicant: string
  amount: string
  status: SettlementStatus
  transactionHash?: string
}> = [
  {
    id: 'A-2048',
    applicant: '30대 활동 데이터 신청자',
    amount: '19 SUI',
    status: 'settled',
    transactionHash: '0x7b8c9f2a4d19',
  },
  { id: 'A-2072', applicant: '20대 러닝 데이터 신청자', amount: '19 SUI', status: 'pending' },
  {
    id: 'A-2128',
    applicant: '30대 수면 회복 신청자',
    amount: '19 SUI',
    status: 'settled',
    transactionHash: '0x4e21a9d6c803',
  },
  { id: 'A-2185', applicant: '50대 심혈관 신청자', amount: '19 SUI', status: 'pending' },
]

const submissionRowsByApplicant: Record<string, SubmissionRecord[]> = {
  'A-2048': [
    { date: '2026-06-08', category: '활동 데이터', period: '2026.06.01-06.07', volume: '1.2 GB', status: '검증 완료' },
    { date: '2026-06-01', category: '운동 세션', period: '2026.05.25-05.31', volume: '0.9 GB', status: '검증 완료' },
    { date: '2026-05-24', category: 'VO2 max 구간', period: '2026.05.18-05.24', volume: '0.7 GB', status: '정책 통과' },
  ],
  'A-2072': [
    { date: '2026-06-07', category: '러닝 세션', period: '2026.06.01-06.07', volume: '0.6 GB', status: '확인 필요' },
    { date: '2026-05-31', category: '활동 데이터', period: '2026.05.25-05.31', volume: '0.5 GB', status: '검증 완료' },
  ],
  'A-2104': [
    { date: '2026-06-04', category: '웨어러블 요약', period: '2026.05.29-06.04', volume: '0.4 GB', status: '제출 부족' },
  ],
  'A-2128': [
    { date: '2026-06-08', category: '수면 회복', period: '2026.06.01-06.07', volume: '1.5 GB', status: '검증 완료' },
    { date: '2026-06-01', category: '활동 데이터', period: '2026.05.25-05.31', volume: '1.1 GB', status: '검증 완료' },
    { date: '2026-05-24', category: '심박 요약', period: '2026.05.18-05.24', volume: '1.0 GB', status: '정책 통과' },
  ],
  'A-2185': [
    { date: '2026-06-08', category: '심혈관 요약', period: '2026.06.01-06.07', volume: '0.8 GB', status: '검증 완료' },
    { date: '2026-06-01', category: 'HRV 구간', period: '2026.05.25-05.31', volume: '0.7 GB', status: '검증 완료' },
    { date: '2026-05-24', category: '산소포화도', period: '2026.05.18-05.24', volume: '0.7 GB', status: '정책 통과' },
  ],
  'A-2219': [
    { date: '2026-06-06', category: '활동 데이터', period: '2026.06.01-06.06', volume: '0.5 GB', status: '확인 필요' },
    { date: '2026-05-30', category: '기기 요약', period: '2026.05.25-05.30', volume: '0.4 GB', status: '검증 완료' },
  ],
}

export function ResearchCreatePage() {
  const projects: Project[] = studies.map((study) => ({ ...study, mode: 'active' as const }))
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0].id)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [activeProjectView, setActiveProjectView] = useState<ProjectView>('home')
  const [applicantStatuses, setApplicantStatuses] = useState<Record<string, ApplicantStatus>>(() =>
    Object.fromEntries(applicantRows.map((row) => [row.id, row.status])),
  )
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0]
  const applicantRecords = applicantRows.map((row) => ({ ...row, status: applicantStatuses[row.id] ?? row.status }))

  const handleApplicantReview = (applicantId: string, decision: ApplicantDecision) => {
    setApplicantStatuses((current) => ({
      ...current,
      [applicantId]: decision === '승인' ? 'approved' : 'rejected',
    }))
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-canvas-soft">
      <div className="container py-6 lg:py-8">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <ResearchSidebar
            activeProjectView={activeProjectView}
            isCreatingProject={isCreatingProject}
            projects={projects}
            selectedProjectId={selectedProjectId}
            onAddProject={() => {
              setActiveProjectView('home')
              setIsCreatingProject(true)
            }}
            onSelectMenu={(view) => setActiveProjectView(view)}
            onSelectProject={(projectId) => {
              setSelectedProjectId(projectId)
              setActiveProjectView('home')
              setIsCreatingProject(false)
            }}
          />

          <div className="min-w-0 space-y-5">
            {isCreatingProject ? (
              <ProjectCreateForm />
            ) : (
              <ProjectWorkspace
                applicantRecords={applicantRecords}
                selectedProject={selectedProject}
                selectedView={activeProjectView}
                onReviewApplicant={handleApplicantReview}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ResearchSidebar({
  activeProjectView,
  isCreatingProject,
  projects,
  selectedProjectId,
  onAddProject,
  onSelectMenu,
  onSelectProject,
}: {
  activeProjectView: ProjectView
  isCreatingProject: boolean
  projects: Project[]
  selectedProjectId: string
  onAddProject: () => void
  onSelectMenu: (view: Exclude<ProjectView, 'home'>) => void
  onSelectProject: (projectId: string) => void
}) {
  return (
    <aside className="flex min-w-0 flex-col rounded-lg bg-brand-dark p-4 text-white shadow-dashboard lg:sticky lg:top-20 lg:h-[calc(100vh-96px)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">진행 프로젝트</p>
          <p className="mt-1 text-xs text-white/55">Project workspace</p>
        </div>
        <Badge variant="dark">{projects.length}개</Badge>
      </div>

      <nav className="mt-5 max-h-[520px] flex-1 space-y-2 overflow-y-auto pr-1 lg:max-h-none" aria-label="Project navigation">
        {projects.map((project) => {
          const isSelected = !isCreatingProject && selectedProjectId === project.id
          const isExpanded = isSelected

          return (
            <div
              key={project.id}
              className={`rounded-md border transition-colors ${
                isSelected ? 'border-white/20 bg-white text-ink' : 'border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.1]'
              }`}
            >
              <button
                className="flex w-full items-start justify-between gap-3 p-3 text-left"
                type="button"
                onClick={() => onSelectProject(project.id)}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{project.title}</span>
                  <span className={`tabular mt-1 block text-xs ${isSelected ? 'text-ink-mute' : 'text-white/50'}`}>{project.id}</span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-1 text-xs ${
                    isSelected ? 'bg-[#b9b9f9] text-[#4434d4]' : 'bg-white/10 text-white/70'
                  }`}
                >
                  {project.status}
                </span>
                <ChevronDown
                  className={`mt-0.5 h-4 w-4 shrink-0 transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  } ${isSelected ? 'text-ink-mute' : 'text-white/50'}`}
                />
              </button>

              {isExpanded ? (
                <div className="mx-2 mb-2 space-y-1 rounded-md border border-border bg-canvas-soft p-2">
                  {projectMenus.map((item) => {
                    const Icon = item.icon
                    const isActiveMenu = activeProjectView === item.key

                    return (
                      <button
                        key={item.label}
                        className={`flex w-full items-center rounded-md px-2.5 py-2 text-left text-xs transition-colors ${
                          isActiveMenu ? 'bg-white text-ink' : 'text-ink-secondary hover:bg-white'
                        }`}
                        type="button"
                        onClick={() => onSelectMenu(item.key)}
                      >
                        <Icon className="mr-2.5 h-3.5 w-3.5" />
                        <span>
                          <span className="block font-medium">{item.label}</span>
                          <span className="text-ink-mute">{item.detail}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )
        })}
      </nav>

      <div className="mt-5 border-t border-white/10 pt-4">
        <Button
          className={`w-full ${
            isCreatingProject ? 'bg-white text-ink hover:bg-canvas-soft' : 'border-white/15 bg-transparent text-white hover:bg-white/10'
          }`}
          type="button"
          variant="outline"
          onClick={onAddProject}
        >
          <Plus className="mr-2 h-4 w-4" />
          프로젝트 추가하기
        </Button>
      </div>
    </aside>
  )
}

function ProjectCreateForm() {
  return (
    <div className="min-w-0 space-y-5">
      <BasicInfoCard selectedProject={draftProject} />
      <EligibilityCard />
      <DataSchemaCard />
    </div>
  )
}

function ProjectWorkspace({
  applicantRecords,
  onReviewApplicant,
  selectedProject,
  selectedView,
}: {
  applicantRecords: ApplicantRecord[]
  onReviewApplicant: (applicantId: string, decision: ApplicantDecision) => void
  selectedProject: Project
  selectedView: ProjectView
}) {
  const [selectedSubmissionApplicantId, setSelectedSubmissionApplicantId] = useState<string | null>(null)
  const selectedSubmissionApplicant =
    applicantRecords.find((record) => record.id === selectedSubmissionApplicantId) ?? null

  let content: ReactNode

  if (selectedView === 'participants') {
    content = (
      <ParticipantManagementView
        applicantRecords={applicantRecords}
        onOpenSubmission={setSelectedSubmissionApplicantId}
        onReviewApplicant={onReviewApplicant}
      />
    )
  } else if (selectedView === 'datasets') {
    content = <ProjectDataSetCard selectedProject={selectedProject} />
  } else if (selectedView === 'settlements') {
    content = <SettlementCard key={`${selectedProject.id}-settlement`} selectedProject={selectedProject} />
  } else {
    content = (
      <div className="min-w-0 space-y-5">
        <ProjectSummaryCard applicantRecords={applicantRecords} selectedProject={selectedProject} />
        <RecentApplicantsCard
          applicantRecords={applicantRecords}
          onOpenSubmission={setSelectedSubmissionApplicantId}
          onReviewApplicant={onReviewApplicant}
        />
        <ProjectDataSetCard selectedProject={selectedProject} />
        <SettlementCard key={`${selectedProject.id}-settlement`} selectedProject={selectedProject} />
      </div>
    )
  }

  return (
    <>
      {content}
      <SubmissionHistoryModal applicant={selectedSubmissionApplicant} onClose={() => setSelectedSubmissionApplicantId(null)} />
    </>
  )
}

function ProjectSummaryCard({ applicantRecords, selectedProject }: { applicantRecords: ApplicantRecord[]; selectedProject: Project }) {
  const pendingCount = applicantRecords.filter((record) => record.status === 'pending').length
  const participants = applicantRecords.filter((record) => record.status === 'approved')
  const averageActivity =
    participants.length > 0 ? Math.round(participants.reduce((sum, record) => sum + record.activity, 0) / participants.length) : 0
  const statusReadyCount = pendingCount > 0 ? `${pendingCount}건 확인` : '정상'
  const remainingUsdc = selectedProject.status === '모집중' ? '4,280 USDC' : '6,500 USDC'

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-ink-mute">전체 참여자</p>
          <p className="tabular mt-2 text-2xl font-light text-ink">{participants.length}명</p>
          <p className="mt-1 text-xs text-ink-mute">목표 {selectedProject.target}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-ink-mute">참여자의 활성도</p>
          <p className="tabular mt-2 text-2xl font-light text-ink">{averageActivity}%</p>
          <p className="mt-1 text-xs text-ink-mute">최근 7일 제출 기준</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-ink-mute">남은 USDC양</p>
          <p className="tabular mt-2 text-2xl font-light text-ink">{remainingUsdc}</p>
          <p className="mt-1 text-xs text-ink-mute">정산 가능 잔액</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-ink-mute">상태 체크</p>
          <p className="mt-2 text-2xl font-light text-ink">{statusReadyCount}</p>
          <p className="mt-1 text-xs text-ink-mute">{selectedProject.status}</p>
        </CardContent>
      </Card>
    </div>
  )
}

function RecentApplicantsCard({
  applicantRecords,
  onOpenSubmission,
  onReviewApplicant,
}: {
  applicantRecords: ApplicantRecord[]
  onOpenSubmission: (applicantId: string) => void
  onReviewApplicant: (applicantId: string, decision: ApplicantDecision) => void
}) {
  const recentApplicants = applicantRecords.filter((record) => record.status === 'pending').slice(0, 4)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>최근 신청자</CardTitle>
            <CardDescription>신규 신청자만 빠르게 승인하거나 거절합니다</CardDescription>
          </div>
          <Users className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        {recentApplicants.length === 0 ? (
          <div className="rounded-md border border-border bg-canvas-soft px-4 py-8 text-center text-sm text-ink-mute">
            검토할 최근 신청자가 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-ink-mute">
                <tr className="border-b border-border">
                  <th className="py-3 pr-5 font-medium">신청자</th>
                  <th className="py-3 pr-5 font-medium">매칭 점수</th>
                  <th className="py-3 pr-5 font-medium">최근 제출</th>
                  <th className="py-3 text-right font-medium">승인 여부</th>
                </tr>
              </thead>
              <tbody>
                {recentApplicants.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-canvas-soft"
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenSubmission(row.id)}
                    onKeyDown={(event) => handleRowOpenKeyDown(event, () => onOpenSubmission(row.id))}
                  >
                    <td className="py-3 pr-5">
                      <span className="block font-medium text-ink">{row.applicant}</span>
                      <span className="tabular mt-1 block text-xs text-ink-mute">{row.id}</span>
                    </td>
                    <td className="tabular py-3 pr-5 font-medium text-ink">{row.score}</td>
                    <td className="py-3 pr-5 text-ink-secondary">{row.lastSync}</td>
                    <td className="py-3">
                      <DecisionButtonGroup
                        align="end"
                        options={applicantDecisions}
                        onChange={(decision) => onReviewApplicant(row.id, decision)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ParticipantManagementView({
  applicantRecords,
  onOpenSubmission,
  onReviewApplicant,
}: {
  applicantRecords: ApplicantRecord[]
  onOpenSubmission: (applicantId: string) => void
  onReviewApplicant: (applicantId: string, decision: ApplicantDecision) => void
}) {
  const pendingApplicants = applicantRecords.filter((record) => record.status === 'pending')
  const participants = applicantRecords.filter((record) => record.status === 'approved')
  const totalDataSent = participants.reduce((sum, record) => sum + Number.parseFloat(record.dataSent), 0).toFixed(1)

  return (
    <div className="min-w-0 space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <MiniStat label="신청자" value={`${pendingApplicants.length}명`} />
        <MiniStat label="참여자" value={`${participants.length}명`} />
        <MiniStat label="누적 제출량" value={`${totalDataSent} GB`} />
      </div>
      <ParticipantTableSection
        actionLabel="승인 여부"
        onOpenSubmission={onOpenSubmission}
        rows={pendingApplicants}
        title="신청자"
        onReviewApplicant={onReviewApplicant}
      />
      <ParticipantTableSection onOpenSubmission={onOpenSubmission} rows={participants} title="참여자" />
    </div>
  )
}

function ParticipantTableSection({
  actionLabel,
  onOpenSubmission,
  onReviewApplicant,
  rows,
  title,
}: {
  actionLabel?: string
  onOpenSubmission: (applicantId: string) => void
  onReviewApplicant?: (applicantId: string, decision: ApplicantDecision) => void
  rows: ApplicantRecord[]
  title: string
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>대상자를 클릭하면 제출 기록을 확인할 수 있습니다</CardDescription>
          </div>
          <Badge variant="outline">{rows.length}명</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="rounded-md border border-border bg-canvas-soft px-4 py-8 text-center text-sm text-ink-mute">표시할 대상이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs text-ink-mute">
                <tr className="border-b border-border">
                  <th className="py-3 pr-5 font-medium">대상자</th>
                  <th className="py-3 pr-5 font-medium">데이터 전송량</th>
                  <th className="py-3 pr-5 font-medium">최근 제출</th>
                  <th className="py-3 text-right font-medium">{actionLabel ?? '상태'}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-canvas-soft"
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenSubmission(row.id)}
                    onKeyDown={(event) => handleRowOpenKeyDown(event, () => onOpenSubmission(row.id))}
                  >
                    <td className="py-3 pr-5">
                      <span className="block font-medium text-ink">{row.applicant}</span>
                      <span className="tabular mt-1 block text-xs text-ink-mute">{row.id}</span>
                    </td>
                    <td className="tabular py-3 pr-5 font-medium text-ink">{row.dataSent}</td>
                    <td className="py-3 pr-5 text-ink-secondary">{row.lastSync}</td>
                    <td className="py-3">
                      {onReviewApplicant ? (
                        <DecisionButtonGroup
                          align="end"
                          options={applicantDecisions}
                          onChange={(decision) => onReviewApplicant(row.id, decision)}
                        />
                      ) : (
                        <div className="flex justify-end">
                          <StatusBadge status={row.status} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SubmissionHistoryModal({ applicant, onClose }: { applicant: ApplicantRecord | null; onClose: () => void }) {
  if (!applicant) {
    return null
  }

  const submissions = submissionRowsByApplicant[applicant.id] ?? []

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      role="dialog"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-lg border border-border bg-white shadow-dashboard"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">제출 기록</p>
            <p className="mt-1 truncate text-xs text-ink-mute">
              {applicant.applicant} · {applicant.id}
            </p>
          </div>
          <Button aria-label="모달 닫기" size="icon" type="button" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-4 overflow-y-auto p-5">
          <div className="rounded-md border border-border bg-canvas-soft p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Sui Walrus</Badge>
              <Badge variant="outline">접근 연동 예정</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-ink-secondary">
              이 제출 기록 영역은 향후 Walrus에 저장된 연구 데이터 자산과 연결되어, 기관이 승인된 범위 안에서 데이터 접근 상태와
              제공 이력을 확인하는 진입점으로 사용됩니다.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniStat label="총 제출량" value={applicant.dataSent} />
            <MiniStat label="최근 제출" value={applicant.lastSync} />
            <MiniStat label="제출 건수" value={`${submissions.length}건`} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="text-xs text-ink-mute">
                <tr className="border-b border-border">
                  <th className="py-3 pr-5 font-medium">제출일</th>
                  <th className="py-3 pr-5 font-medium">데이터 종류</th>
                  <th className="py-3 pr-5 font-medium">대상 기간</th>
                  <th className="py-3 pr-5 font-medium">용량</th>
                  <th className="py-3 text-right font-medium">검증 상태</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => (
                  <tr key={`${submission.date}-${submission.category}`} className="border-b border-border last:border-0">
                    <td className="tabular py-3 pr-5 font-medium text-ink">{submission.date}</td>
                    <td className="py-3 pr-5 text-ink-secondary">{submission.category}</td>
                    <td className="tabular py-3 pr-5 text-ink-secondary">{submission.period}</td>
                    <td className="tabular py-3 pr-5 font-medium text-ink">{submission.volume}</td>
                    <td className="py-3 text-right">
                      <Badge variant={submission.status.includes('완료') || submission.status.includes('통과') ? 'secondary' : 'outline'}>
                        {submission.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProjectDataSetCard({ selectedProject }: { selectedProject: Project }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>데이터 세트</CardTitle>
            <CardDescription>수집 범위와 접근 정책</CardDescription>
          </div>
          <DatabaseZap className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {selectedProject.dataScope.split(', ').map((scope) => (
          <div key={scope} className="flex items-center justify-between gap-3 rounded-md border border-border bg-canvas-soft px-3 py-2">
            <span className="text-sm font-medium text-ink">{scope}</span>
            <Badge variant="outline">Seal policy</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function SettlementCard({ selectedProject }: { selectedProject: Project }) {
  const [settlementStatuses, setSettlementStatuses] = useState<Record<string, SettlementStatus>>(() =>
    Object.fromEntries(settlementRows.map((row) => [row.id, row.status])),
  )
  const settledCount = Object.values(settlementStatuses).filter((status) => status === 'settled').length
  const pendingCount = Object.values(settlementStatuses).filter((status) => status === 'pending').length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>보상/정산</CardTitle>
            <CardDescription>RewardEscrow 지급 현황</CardDescription>
          </div>
          <Wallet className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md bg-brand-dark p-4 text-white">
            <p className="text-xs text-white/60">예치 보상</p>
            <p className="tabular mt-2 text-2xl font-light">{selectedProject.rewardPool}</p>
          </div>
          <MiniStat label="정산 완료" value={`${settledCount}건`} />
          <MiniStat label="정산 대기" value={`${pendingCount}건`} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs text-ink-mute">
              <tr className="border-b border-border">
                <th className="py-3 pr-5 font-medium">대상자</th>
                <th className="py-3 pr-5 font-medium">보상액</th>
                <th className="py-3 pr-5 font-medium">정산 상태</th>
                <th className="py-3 text-right font-medium">액션</th>
              </tr>
            </thead>
            <tbody>
              {settlementRows.map((row) => {
                const status = settlementStatuses[row.id] ?? row.status
                const transactionHash = row.transactionHash ?? `0xsettle${row.id.replace(/[^0-9]/g, '')}`

                return (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="py-3 pr-5">
                      <p className="font-medium text-ink">{row.applicant}</p>
                      <p className="tabular mt-1 text-xs text-ink-mute">{row.id}</p>
                    </td>
                    <td className="tabular py-3 pr-5 font-medium text-ink">{row.amount}</td>
                    <td className="py-3 pr-5">
                      <Badge variant={status === 'settled' ? 'secondary' : 'outline'}>
                        {status === 'settled' ? '정산 완료' : '정산 대기'}
                      </Badge>
                    </td>
                    <td className="py-3 text-right">
                      {status === 'settled' ? (
                        <a
                          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                          href={`https://suiexplorer.com/txblock/${transactionHash}`}
                          rel="noreferrer"
                          target="_blank"
                        >
                          트랜잭션 확인
                        </a>
                      ) : (
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => setSettlementStatuses((current) => ({ ...current, [row.id]: 'settled' }))}
                        >
                          정산하기
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function DecisionButtonGroup<T extends string>({
  align = 'start',
  onChange,
  options,
  value,
}: {
  align?: 'start' | 'end'
  onChange: (value: T) => void
  options: T[]
  value?: T
}) {
  return (
    <div className={`flex gap-1.5 ${align === 'end' ? 'justify-end' : 'justify-start'}`}>
      {options.map((option) => {
        const isSelected = option === value

        return (
          <button
            key={option}
            className={`min-w-14 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              isSelected ? 'border-brand-dark bg-brand-dark text-white' : 'border-border bg-white text-ink-secondary hover:bg-canvas-soft'
            }`}
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onChange(option)
            }}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}

function handleRowOpenKeyDown(event: React.KeyboardEvent<HTMLTableRowElement>, onOpen: () => void) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return
  }

  event.preventDefault()
  onOpen()
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-white px-3 py-3">
      <p className="text-xs text-ink-mute">{label}</p>
      <p className="tabular mt-1 text-lg font-medium text-ink">{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: ApplicantStatus }) {
  if (status === 'approved') {
    return <Badge variant="secondary">참여 중</Badge>
  }

  if (status === 'rejected') {
    return <Badge variant="outline">거절</Badge>
  }

  return <Badge variant="outline">신청</Badge>
}

function BasicInfoCard({ selectedProject }: { selectedProject: Project }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>기본 정보</CardTitle>
            <CardDescription>연구 카드와 사용자 앱 모집 목록에 표시되는 값</CardDescription>
          </div>
          <FileText className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="연구명">
            <input className={inputClassName} defaultValue={selectedProject.title} />
          </Field>
          <Field label="기관명">
            <input className={inputClassName} defaultValue="Sui Active Insurance" />
          </Field>
          <Field className="md:col-span-2" label="연구 목적">
            <input className={inputClassName} defaultValue="예방 리워드 산정" />
          </Field>
          <Field className="md:col-span-2" label="연구 설명">
            <textarea
              className={`${inputClassName} min-h-28 resize-none leading-6`}
              defaultValue="걸음 수, 이동 거리, 운동 시간, 활동 에너지, VO2 max를 범주화해 리워드 산정 정확도를 검증합니다."
            />
          </Field>
        </div>
      </CardContent>
    </Card>
  )
}

function EligibilityCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>참여 조건</CardTitle>
            <CardDescription>모집 대상, 보상, 데이터 접근 기간</CardDescription>
          </div>
          <SlidersHorizontal className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="목표 인원">
            <input className={inputClassName} defaultValue="420" inputMode="numeric" />
          </Field>
          <Field label="1인 보상">
            <input className={inputClassName} defaultValue="19 SUI" />
          </Field>
          <Field label="접근 기간">
            <input className={inputClassName} defaultValue="60일" />
          </Field>
        </div>

        <div>
          <p className="text-sm font-medium text-ink">연령대</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ageRanges.map((range, index) => (
              <button
                key={range}
                className={`rounded-full border px-3 py-2 text-sm transition-colors ${
                  index < 2 ? 'border-primary bg-[#f6f4ff] text-primary' : 'border-border bg-white text-ink-secondary'
                }`}
                type="button"
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-ink">요청 데이터</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {dataCategories.map((category) => (
              <span key={category} className="rounded-full border border-border bg-white px-3 py-2 text-sm text-ink-secondary">
                {category}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function DataSchemaCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>데이터 스키마</CardTitle>
            <CardDescription>사용자 앱에서 제공되는 필드와 기관 접근 정책</CardDescription>
          </div>
          <Layers3 className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-ink-mute">
              <tr className="border-b border-border">
                <th className="py-3 font-medium">필드</th>
                <th className="py-3 font-medium">소스</th>
                <th className="py-3 font-medium">정책</th>
                <th className="py-3 text-right font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {schemaRows.map((row) => (
                <tr key={row.field} className="border-b border-border last:border-0">
                  <td className="tabular py-3 pr-5 font-medium text-ink">{row.field}</td>
                  <td className="py-3 pr-5 text-ink-secondary">{row.source}</td>
                  <td className="py-3 pr-5 text-ink-secondary">{row.policy}</td>
                  <td className="py-3 text-right">
                    <Badge variant={row.enabled ? 'secondary' : 'outline'}>{row.enabled ? '포함' : '제외'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function Field({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <label className={className}>
      <span className="mb-2 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  )
}

const inputClassName =
  'min-h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-mute focus:border-primary focus:ring-2 focus:ring-primary/10'
