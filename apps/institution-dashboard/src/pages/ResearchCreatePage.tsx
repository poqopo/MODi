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
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  createInstitutionForCurrentUser,
  createResearchProject,
  fetchInstitutionDashboard,
  markSettlementSettled,
  updateApplicationStatus,
  type ApplicantStatus,
  type CreateResearchProjectInput,
  type DashboardApplicant,
  type DashboardData,
  type DashboardProject,
  type DashboardSettlement,
  type DashboardSubmission,
  type SettlementStatus,
} from '@/services/institutionDashboard'

type ProjectMenuItem = {
  key: Exclude<ProjectView, 'home'>
  label: string
  detail: string
  icon: LucideIcon
}

type ProjectView = 'home' | 'participants' | 'datasets' | 'settlements'

type Project = DashboardProject

type ApplicantDecision = '승인' | '거절'
type ApplicantRecord = DashboardApplicant
type SubmissionRecord = DashboardSubmission
type SettlementRecord = DashboardSettlement

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

export function ResearchCreatePage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [activeProjectView, setActiveProjectView] = useState<ProjectView>('home')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [isSavingProject, setIsSavingProject] = useState(false)
  const [isSavingInstitution, setIsSavingInstitution] = useState(false)
  const [pendingApplicantId, setPendingApplicantId] = useState<string | null>(null)
  const [pendingSettlementId, setPendingSettlementId] = useState<string | null>(null)

  const refreshDashboard = useCallback(async (preferredProjectId?: string) => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const nextData = await fetchInstitutionDashboard()
      const nextProjectIds = nextData.projects.map((project) => project.id)

      setDashboardData(nextData)
      setSelectedProjectId((current) => {
        if (preferredProjectId && nextProjectIds.includes(preferredProjectId)) {
          return preferredProjectId
        }

        if (current && nextProjectIds.includes(current)) {
          return current
        }

        return nextProjectIds[0] ?? null
      })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '대시보드 데이터를 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshDashboard()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [refreshDashboard])

  const projects = useMemo(() => dashboardData?.projects ?? [], [dashboardData])
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null,
    [projects, selectedProjectId],
  )
  const applicantRecords = selectedProject ? dashboardData?.applicantsByProject[selectedProject.id] ?? [] : []
  const settlementRecords = selectedProject ? dashboardData?.settlementsByProject[selectedProject.id] ?? [] : []
  const submissionRecordsByApplicant = dashboardData?.submissionsByApplicant ?? {}

  const handleCreateProject = async (input: CreateResearchProjectInput) => {
    setIsSavingProject(true)
    setErrorMessage('')

    try {
      const projectId = await createResearchProject(input)
      setIsCreatingProject(false)
      setActiveProjectView('home')
      await refreshDashboard(projectId)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '연구를 생성하지 못했습니다.')
    } finally {
      setIsSavingProject(false)
    }
  }

  const handleCreateInstitution = async (input: { name: string; slug: string; websiteUrl?: string }) => {
    setIsSavingInstitution(true)
    setErrorMessage('')

    try {
      await createInstitutionForCurrentUser(input)
      await refreshDashboard()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '기관을 생성하지 못했습니다.')
    } finally {
      setIsSavingInstitution(false)
    }
  }

  const handleApplicantReview = async (applicantId: string, decision: ApplicantDecision) => {
    const nextStatus: Extract<ApplicantStatus, 'approved' | 'rejected'> = decision === '승인' ? 'approved' : 'rejected'

    setPendingApplicantId(applicantId)
    setErrorMessage('')

    try {
      await updateApplicationStatus(applicantId, nextStatus)
      setDashboardData((current) => updateApplicantInDashboard(current, applicantId, nextStatus))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '참여 신청 상태를 업데이트하지 못했습니다.')
    } finally {
      setPendingApplicantId(null)
    }
  }

  const handleSettleReward = async (settlementId: string) => {
    setPendingSettlementId(settlementId)
    setErrorMessage('')

    try {
      const transaction = await markSettlementSettled(settlementId)
      setDashboardData((current) => updateSettlementInDashboard(current, settlementId, transaction))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '정산 상태를 업데이트하지 못했습니다.')
    } finally {
      setPendingSettlementId(null)
    }
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-canvas-soft">
      <div className="container py-6 lg:py-8">
        {errorMessage ? (
          <div className="mb-5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <ResearchSidebar
            activeProjectView={activeProjectView}
            isCreatingProject={isCreatingProject}
            projects={projects}
            selectedProjectId={selectedProjectId ?? ''}
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
            {isLoading ? (
              <LoadingPanel />
            ) : dashboardData?.institutionId === null ? (
              <MembershipRequiredPanel isSaving={isSavingInstitution} onCreateInstitution={handleCreateInstitution} />
            ) : isCreatingProject ? (
              <ProjectCreateForm isSaving={isSavingProject} onCreateProject={handleCreateProject} />
            ) : selectedProject ? (
              <ProjectWorkspace
                applicantRecords={applicantRecords}
                pendingApplicantId={pendingApplicantId}
                pendingSettlementId={pendingSettlementId}
                selectedProject={selectedProject}
                selectedView={activeProjectView}
                settlementRecords={settlementRecords}
                submissionRecordsByApplicant={submissionRecordsByApplicant}
                onReviewApplicant={handleApplicantReview}
                onSettleReward={handleSettleReward}
              />
            ) : (
              <EmptyProjectPanel onAddProject={() => setIsCreatingProject(true)} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function updateApplicantInDashboard(dashboardData: DashboardData | null, applicantId: string, status: ApplicantStatus) {
  if (!dashboardData) {
    return dashboardData
  }

  return {
    ...dashboardData,
    applicantsByProject: Object.fromEntries(
      Object.entries(dashboardData.applicantsByProject).map(([projectId, applicants]) => [
        projectId,
        applicants.map((applicant) => (applicant.id === applicantId ? { ...applicant, status } : applicant)),
      ]),
    ),
  }
}

function updateSettlementInDashboard(
  dashboardData: DashboardData | null,
  settlementId: string,
  transaction: { transactionHash: string; transactionUrl: string },
) {
  if (!dashboardData) {
    return dashboardData
  }

  return {
    ...dashboardData,
    settlementsByProject: Object.fromEntries(
      Object.entries(dashboardData.settlementsByProject).map(([projectId, settlements]) => [
        projectId,
        settlements.map((settlement) =>
          settlement.id === settlementId
            ? {
                ...settlement,
                status: 'settled' as SettlementStatus,
                transactionHash: transaction.transactionHash,
                transactionUrl: transaction.transactionUrl,
              }
            : settlement,
        ),
      ]),
    ),
  }
}

function LoadingPanel() {
  return (
    <Card>
      <CardContent className="p-8 text-sm text-ink-secondary">Supabase에서 기관 대시보드 데이터를 불러오는 중입니다.</CardContent>
    </Card>
  )
}

function MembershipRequiredPanel({
  isSaving,
  onCreateInstitution,
}: {
  isSaving: boolean
  onCreateInstitution: (input: { name: string; slug: string; websiteUrl?: string }) => void
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    onCreateInstitution({
      name: getFormValue(formData, 'institutionName'),
      slug: getFormValue(formData, 'institutionSlug'),
      websiteUrl: getFormValue(formData, 'websiteUrl'),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>기관 멤버십이 필요합니다</CardTitle>
        <CardDescription>
          현재 로그인한 Auth 사용자를 기관 owner로 연결해야 연구를 생성하고 데이터를 관리할 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Field label="기관명">
            <input className={inputClassName} name="institutionName" defaultValue="MODi Research Lab" required />
          </Field>
          <Field label="기관 slug">
            <input className={inputClassName} name="institutionSlug" defaultValue="modi-research-lab" required />
          </Field>
          <Field label="웹사이트">
            <input className={inputClassName} name="websiteUrl" placeholder="https://example.org" type="url" />
          </Field>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? '기관 생성 중' : '기관 생성하기'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function EmptyProjectPanel({ onAddProject }: { onAddProject: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>등록된 연구가 없습니다</CardTitle>
        <CardDescription>첫 연구를 만들면 신청자, 제출 데이터, 정산 상태를 이 대시보드에서 관리할 수 있습니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" onClick={onAddProject}>
          <Plus className="mr-2 h-4 w-4" />
          프로젝트 추가하기
        </Button>
      </CardContent>
    </Card>
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
                  <span className={`tabular mt-1 block text-xs ${isSelected ? 'text-ink-mute' : 'text-white/50'}`}>
                    {project.publicCode}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-1 text-xs ${
                    isSelected ? 'bg-[#b9b9f9] text-[#4434d4]' : 'bg-white/10 text-white/70'
                  }`}
                >
                  {project.statusLabel}
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

function ProjectCreateForm({
  isSaving,
  onCreateProject,
}: {
  isSaving: boolean
  onCreateProject: (input: CreateResearchProjectInput) => void
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const rewardAmount = parseNumber(formData.get('rewardAmountPerParticipant'))
    const targetParticipants = parseNumber(formData.get('targetParticipants'))
    const accessPeriodDays = parseNumber(formData.get('accessPeriodDays'))

    onCreateProject({
      title: getFormValue(formData, 'title') || '새 연구',
      purpose: getFormValue(formData, 'purpose'),
      description: getFormValue(formData, 'description'),
      targetParticipants,
      rewardAmountPerParticipant: rewardAmount,
      rewardCurrency: getFormValue(formData, 'rewardCurrency') || 'USDC',
      accessPeriodDays,
      dataScope: dataCategories,
    })
  }

  return (
    <form className="min-w-0 space-y-5" onSubmit={handleSubmit}>
      <BasicInfoCard />
      <EligibilityCard />
      <DataSchemaCard />
      <div className="flex justify-end">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? '저장 중' : '연구 생성'}
        </Button>
      </div>
    </form>
  )
}

function getFormValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function parseNumber(value: FormDataEntryValue | null) {
  const parsed = Number.parseFloat(String(value ?? '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
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

function ProjectWorkspace({
  applicantRecords,
  pendingApplicantId,
  pendingSettlementId,
  onReviewApplicant,
  onSettleReward,
  selectedProject,
  selectedView,
  settlementRecords,
  submissionRecordsByApplicant,
}: {
  applicantRecords: ApplicantRecord[]
  pendingApplicantId: string | null
  pendingSettlementId: string | null
  onReviewApplicant: (applicantId: string, decision: ApplicantDecision) => void
  onSettleReward: (settlementId: string) => void
  selectedProject: Project
  selectedView: ProjectView
  settlementRecords: SettlementRecord[]
  submissionRecordsByApplicant: Record<string, SubmissionRecord[]>
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
        pendingApplicantId={pendingApplicantId}
        onReviewApplicant={onReviewApplicant}
      />
    )
  } else if (selectedView === 'datasets') {
    content = <ProjectDataSetCard selectedProject={selectedProject} />
  } else if (selectedView === 'settlements') {
    content = (
      <SettlementCard
        pendingSettlementId={pendingSettlementId}
        selectedProject={selectedProject}
        settlementRecords={settlementRecords}
        onSettleReward={onSettleReward}
      />
    )
  } else {
    content = (
      <div className="min-w-0 space-y-5">
        <ProjectSummaryCard applicantRecords={applicantRecords} selectedProject={selectedProject} />
        <RecentApplicantsCard
          applicantRecords={applicantRecords}
          onOpenSubmission={setSelectedSubmissionApplicantId}
          pendingApplicantId={pendingApplicantId}
          onReviewApplicant={onReviewApplicant}
        />
        <ProjectDataSetCard selectedProject={selectedProject} />
        <SettlementCard
          pendingSettlementId={pendingSettlementId}
          selectedProject={selectedProject}
          settlementRecords={settlementRecords}
          onSettleReward={onSettleReward}
        />
      </div>
    )
  }

  return (
    <>
      {content}
      <SubmissionHistoryModal
        applicant={selectedSubmissionApplicant}
        submissions={selectedSubmissionApplicant ? submissionRecordsByApplicant[selectedSubmissionApplicant.id] ?? [] : []}
        onClose={() => setSelectedSubmissionApplicantId(null)}
      />
    </>
  )
}

function ProjectSummaryCard({ applicantRecords, selectedProject }: { applicantRecords: ApplicantRecord[]; selectedProject: Project }) {
  const pendingCount = applicantRecords.filter((record) => record.status === 'pending').length
  const participants = applicantRecords.filter((record) => record.status === 'approved')
  const averageActivity =
    participants.length > 0 ? Math.round(participants.reduce((sum, record) => sum + record.score, 0) / participants.length) : 0
  const statusReadyCount = pendingCount > 0 ? `${pendingCount}건 확인` : '정상'

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-ink-mute">전체 참여자</p>
          <p className="tabular mt-2 text-2xl font-light text-ink">{participants.length}명</p>
          <p className="mt-1 text-xs text-ink-mute">목표 {selectedProject.targetLabel}</p>
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
          <p className="tabular mt-2 text-2xl font-light text-ink">{selectedProject.rewardPoolLabel}</p>
          <p className="mt-1 text-xs text-ink-mute">정산 가능 잔액</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-ink-mute">상태 체크</p>
          <p className="mt-2 text-2xl font-light text-ink">{statusReadyCount}</p>
          <p className="mt-1 text-xs text-ink-mute">{selectedProject.statusLabel}</p>
        </CardContent>
      </Card>
    </div>
  )
}

function RecentApplicantsCard({
  applicantRecords,
  onOpenSubmission,
  pendingApplicantId,
  onReviewApplicant,
}: {
  applicantRecords: ApplicantRecord[]
  onOpenSubmission: (applicantId: string) => void
  pendingApplicantId: string | null
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
                      <span className="tabular mt-1 block text-xs text-ink-mute">{row.applicantCode}</span>
                    </td>
                    <td className="tabular py-3 pr-5 font-medium text-ink">{row.score}</td>
                    <td className="py-3 pr-5 text-ink-secondary">{row.lastSync}</td>
                    <td className="py-3">
                      <DecisionButtonGroup
                        align="end"
                        disabled={pendingApplicantId === row.id}
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
  pendingApplicantId,
  onReviewApplicant,
}: {
  applicantRecords: ApplicantRecord[]
  onOpenSubmission: (applicantId: string) => void
  pendingApplicantId: string | null
  onReviewApplicant: (applicantId: string, decision: ApplicantDecision) => void
}) {
  const pendingApplicants = applicantRecords.filter((record) => record.status === 'pending')
  const participants = applicantRecords.filter((record) => record.status === 'approved')
  const totalDataSent = formatBytes(participants.reduce((sum, record) => sum + record.dataSentBytes, 0))

  return (
    <div className="min-w-0 space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <MiniStat label="신청자" value={`${pendingApplicants.length}명`} />
        <MiniStat label="참여자" value={`${participants.length}명`} />
        <MiniStat label="누적 제출량" value={totalDataSent} />
      </div>
      <ParticipantTableSection
        actionLabel="승인 여부"
        onOpenSubmission={onOpenSubmission}
        pendingApplicantId={pendingApplicantId}
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
  pendingApplicantId,
  onReviewApplicant,
  rows,
  title,
}: {
  actionLabel?: string
  onOpenSubmission: (applicantId: string) => void
  pendingApplicantId?: string | null
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
                      <span className="tabular mt-1 block text-xs text-ink-mute">{row.applicantCode}</span>
                    </td>
                    <td className="tabular py-3 pr-5 font-medium text-ink">{row.dataSent}</td>
                    <td className="py-3 pr-5 text-ink-secondary">{row.lastSync}</td>
                    <td className="py-3">
                      {onReviewApplicant ? (
                        <DecisionButtonGroup
                          align="end"
                          disabled={pendingApplicantId === row.id}
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

function SubmissionHistoryModal({
  applicant,
  onClose,
  submissions,
}: {
  applicant: ApplicantRecord | null
  onClose: () => void
  submissions: SubmissionRecord[]
}) {
  if (!applicant) {
    return null
  }

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
              {applicant.applicant} · {applicant.applicantCode}
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
          {submissions.length === 0 ? (
            <div className="rounded-md border border-border bg-white px-4 py-8 text-center text-sm text-ink-mute">
              아직 제출된 기록이 없습니다.
            </div>
          ) : (
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
                  <tr key={submission.id} className="border-b border-border last:border-0">
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
          )}
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
        {selectedProject.dataScope.length === 0 ? (
          <div className="rounded-md border border-border bg-canvas-soft px-4 py-8 text-center text-sm text-ink-mute">
            등록된 데이터 범위가 없습니다.
          </div>
        ) : (
          selectedProject.dataScope.map((scope) => (
            <div key={scope} className="flex items-center justify-between gap-3 rounded-md border border-border bg-canvas-soft px-3 py-2">
              <span className="text-sm font-medium text-ink">{scope}</span>
              <Badge variant="outline">Seal policy</Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function SettlementCard({
  pendingSettlementId,
  selectedProject,
  settlementRecords,
  onSettleReward,
}: {
  pendingSettlementId: string | null
  selectedProject: Project
  settlementRecords: SettlementRecord[]
  onSettleReward: (settlementId: string) => void
}) {
  const settledCount = settlementRecords.filter((row) => row.status === 'settled').length
  const pendingCount = settlementRecords.filter((row) => row.status === 'pending').length

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
            <p className="tabular mt-2 text-2xl font-light">{selectedProject.rewardPoolLabel}</p>
          </div>
          <MiniStat label="정산 완료" value={`${settledCount}건`} />
          <MiniStat label="정산 대기" value={`${pendingCount}건`} />
        </div>
        {settlementRecords.length === 0 ? (
          <div className="rounded-md border border-border bg-canvas-soft px-4 py-8 text-center text-sm text-ink-mute">
            표시할 정산 내역이 없습니다.
          </div>
        ) : (
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
                {settlementRecords.map((row) => {
                  const isSettled = row.status === 'settled'
                  const transactionHref = row.transactionUrl ?? buildTransactionHref(row.transactionHash)

                  return (
                    <tr key={row.id} className="border-b border-border last:border-0">
                      <td className="py-3 pr-5">
                        <p className="font-medium text-ink">{row.applicant}</p>
                        <p className="tabular mt-1 text-xs text-ink-mute">{row.applicantCode}</p>
                      </td>
                      <td className="tabular py-3 pr-5 font-medium text-ink">{row.amountLabel}</td>
                      <td className="py-3 pr-5">
                        <Badge variant={isSettled ? 'secondary' : 'outline'}>{isSettled ? '정산 완료' : '정산 대기'}</Badge>
                      </td>
                      <td className="py-3 text-right">
                        {isSettled && transactionHref ? (
                          <a
                            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                            href={transactionHref}
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
                            disabled={pendingSettlementId === row.id}
                            onClick={() => onSettleReward(row.id)}
                          >
                            {pendingSettlementId === row.id ? '정산 중' : '정산하기'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function buildTransactionHref(transactionHash: string | null) {
  if (!transactionHash) {
    return null
  }

  return `https://suivision.xyz/txblock/${transactionHash}`
}

function DecisionButtonGroup<T extends string>({
  align = 'start',
  disabled = false,
  onChange,
  options,
  value,
}: {
  align?: 'start' | 'end'
  disabled?: boolean
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
            className={`min-w-14 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              isSelected ? 'border-brand-dark bg-brand-dark text-white' : 'border-border bg-white text-ink-secondary hover:bg-canvas-soft'
            }`}
            type="button"
            disabled={disabled}
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

function BasicInfoCard() {
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
            <input className={inputClassName} name="title" defaultValue="Apple Health 활동/운동 리워드 검증 데이터" required />
          </Field>
          <Field label="기관명">
            <input className={inputClassName} name="institutionName" defaultValue="Sui Active Insurance" />
          </Field>
          <Field className="md:col-span-2" label="연구 목적">
            <input className={inputClassName} name="purpose" defaultValue="예방 리워드 산정" />
          </Field>
          <Field className="md:col-span-2" label="연구 설명">
            <textarea
              className={`${inputClassName} min-h-28 resize-none leading-6`}
              name="description"
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
            <input className={inputClassName} name="targetParticipants" defaultValue="420" inputMode="numeric" />
          </Field>
          <Field label="1인 보상(USDC)">
            <input className={inputClassName} name="rewardAmountPerParticipant" defaultValue="19" inputMode="decimal" />
            <input type="hidden" name="rewardCurrency" value="USDC" />
          </Field>
          <Field label="접근 기간">
            <input className={inputClassName} name="accessPeriodDays" defaultValue="60일" inputMode="numeric" />
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
