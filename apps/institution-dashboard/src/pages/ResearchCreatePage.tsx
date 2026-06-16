import {
  Check,
  ChevronDown,
  DatabaseZap,
  Download,
  FileText,
  Layers3,
  Plus,
  SlidersHorizontal,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useDAppKit } from '@mysten/dapp-kit-react'
import { ConnectButton } from '@mysten/dapp-kit-react/ui'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ProjectView } from '@/lib/routes'
import {
  createInstitutionForCurrentUser,
  createResearchProject,
  fetchInstitutionDashboard,
  markSettlementSettled,
  updateApplicationStatus,
  type ApplicantStatus,
  type CreateResearchProjectInput,
  type DashboardApplicant,
  type DashboardAgentMemoryArtifact,
  type DashboardData,
  type DashboardProject,
  type DashboardSettlement,
  type DashboardSubmission,
  type SettlementStatus,
} from '@/services/institutionDashboard'
import { createOnChainDataRequest } from '@/services/suiResearchRegistry'
import { downloadWalrusBlob } from '@/services/walrusDownload'

type ProjectMenuItem = {
  key: Exclude<ProjectView, 'home'>
  label: string
  detail: string
  icon: LucideIcon
}

type Project = DashboardProject

type ApplicantDecision = '승인' | '거절'
type ApplicantRecord = DashboardApplicant
type SubmissionRecord = DashboardSubmission
type SettlementRecord = DashboardSettlement
type RefreshDashboardOptions = {
  showLoading?: boolean
}

const projectMenus: ProjectMenuItem[] = [
  { key: 'participants', label: '참여자 관리', detail: '신청자/참여자 관리', icon: Users },
  { key: 'datasets', label: '데이터 관리', detail: '헬스케어 데이터 다운로드', icon: DatabaseZap },
  { key: 'settlements', label: '보상/정산', detail: 'RewardEscrow 지급', icon: Wallet },
]

const schemaRows = [
  { field: 'ageRange', source: 'Profile', policy: '연령대만 저장', enabled: true },
  { field: 'recordedMonth', source: 'System', policy: '월 단위 시간', enabled: true },
]

type DataCategoryOption = {
  detail: string
  key: string
  source: string
}

type DataCategoryGroup = {
  label: string
  options: DataCategoryOption[]
}

const dataCategoryGroups: DataCategoryGroup[] = [
  {
    label: '활동',
    options: [
      { key: '걸음', source: 'Apple Health', detail: '일별 걸음 수 band' },
      { key: '운동 시간', source: 'Apple Health', detail: '운동 시간 구간' },
      { key: '활동 에너지', source: 'Apple Health', detail: '활동 kcal band' },
      { key: 'VO2 max', source: 'Apple Health', detail: '심폐지구력 band' },
    ],
  },
  {
    label: '수면/회복',
    options: [
      { key: '수면 시간', source: 'Wearable', detail: '수면 시간 구간' },
      { key: '수면 효율', source: 'Wearable', detail: '효율 band' },
      { key: '수면 단계', source: 'Wearable', detail: '단계별 비율' },
      { key: 'HRV', source: 'Wearable', detail: '회복 band' },
    ],
  },
  {
    label: '바이탈',
    options: [
      { key: '심박수', source: 'Wearable', detail: '심박 구간' },
      { key: '안정시 심박수', source: 'Wearable', detail: '안정시 band' },
      { key: '혈중 산소', source: 'Wearable', detail: 'SpO2 band' },
      { key: '체중', source: 'Health Profile', detail: '체중 구간' },
    ],
  },
  {
    label: '메타데이터',
    options: [
      { key: '기기 유형', source: 'Device', detail: '기기 범주' },
      { key: '기록 월', source: 'System', detail: '월 단위 기간' },
    ],
  },
]
const defaultDataCategories = ['걸음', '운동 시간', 'VO2 max']
const dataCategoryOptions = dataCategoryGroups.flatMap((group) => group.options)
const dataCategoryOptionByKey = Object.fromEntries(dataCategoryOptions.map((option) => [option.key, option]))
const ageRanges = ['20-29', '30-39', '40-49', '50-59']
const applicantDecisions: ApplicantDecision[] = ['승인', '거절']

type ResearchCreatePageProps = {
  isCreateRoute: boolean
  researcherSuiAddress: string | null
  routeProjectId: string | null
  routeView: ProjectView
  onCreateRoute: () => void
  onProjectRoute: (projectId: string, view?: ProjectView, options?: { replace?: boolean }) => void
}

export function ResearchCreatePage({
  isCreateRoute,
  onCreateRoute,
  onProjectRoute,
  researcherSuiAddress,
  routeProjectId,
  routeView,
}: ResearchCreatePageProps) {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [isSavingProject, setIsSavingProject] = useState(false)
  const [isSavingInstitution, setIsSavingInstitution] = useState(false)
  const [pendingApplicantId, setPendingApplicantId] = useState<string | null>(null)
  const [pendingSettlementId, setPendingSettlementId] = useState<string | null>(null)
  const dashboardDataRef = useRef<DashboardData | null>(null)
  const lastForegroundRefreshAtRef = useRef(0)
  const dAppKit = useDAppKit()
  const isCreatingProject = isCreateRoute
  const activeProjectView = routeView

  const refreshDashboard = useCallback(async (options: RefreshDashboardOptions = {}) => {
    const showLoading = options.showLoading ?? true

    if (showLoading) {
      setIsLoading(true)
    }

    setErrorMessage('')

    try {
      const nextData = await fetchInstitutionDashboard({ researcherSuiAddress })
      setDashboardData(nextData)
      return nextData
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '대시보드 데이터를 불러오지 못했습니다.')
      return null
    } finally {
      if (showLoading) {
        setIsLoading(false)
      }
    }
  }, [researcherSuiAddress])

  useEffect(() => {
    dashboardDataRef.current = dashboardData
  }, [dashboardData])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshDashboard({ showLoading: dashboardDataRef.current === null })
    }, 0)

    return () => window.clearTimeout(timer)
  }, [activeProjectView, isCreatingProject, refreshDashboard, routeProjectId])

  useEffect(() => {
    const refreshOnReturn = () => {
      if (document.visibilityState !== 'visible' || isCreatingProject) {
        return
      }

      const now = Date.now()

      if (now - lastForegroundRefreshAtRef.current < 1500) {
        return
      }

      lastForegroundRefreshAtRef.current = now
      void refreshDashboard({ showLoading: false })
    }

    window.addEventListener('focus', refreshOnReturn)
    document.addEventListener('visibilitychange', refreshOnReturn)

    return () => {
      window.removeEventListener('focus', refreshOnReturn)
      document.removeEventListener('visibilitychange', refreshOnReturn)
    }
  }, [isCreatingProject, refreshDashboard])

  const projects = useMemo(() => dashboardData?.projects ?? [], [dashboardData])
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === routeProjectId) ?? projects[0] ?? null,
    [projects, routeProjectId],
  )
  const applicantRecords = selectedProject ? dashboardData?.applicantsByProject[selectedProject.id] ?? [] : []
  const settlementRecords = selectedProject ? dashboardData?.settlementsByProject[selectedProject.id] ?? [] : []
  const submissionRecordsByApplicant = dashboardData?.submissionsByApplicant ?? {}

  useEffect(() => {
    if (isLoading || isCreatingProject || !selectedProject) {
      return
    }

    if (routeProjectId !== selectedProject.id || routeView !== activeProjectView) {
      onProjectRoute(selectedProject.id, activeProjectView, { replace: true })
    }
  }, [activeProjectView, isCreatingProject, isLoading, onProjectRoute, routeProjectId, routeView, selectedProject])

  const handleCreateProject = async (input: CreateResearchProjectInput) => {
    if (!researcherSuiAddress) {
      setErrorMessage('연구 생성을 위해 기관 Slush 지갑 연결이 필요합니다.')
      return
    }

    setIsSavingProject(true)
    setErrorMessage('')

    try {
      const onChainRequest = await createOnChainDataRequest({
        dAppKit,
        input: {
          accessPeriodDays: input.accessPeriodDays,
          criteriaHash: null,
          dataScope: input.dataScope,
          purpose: input.purpose || input.title,
          rewardAmountPerParticipant: input.rewardAmountPerParticipant,
          targetParticipants: input.targetParticipants,
        },
      })
      const projectId = await createResearchProject({
        ...input,
        researcherSuiAddress,
        suiDataRequestId: onChainRequest.suiDataRequestId,
        suiDataRequestTxDigest: onChainRequest.txDigest,
        suiRegistryPackageId: onChainRequest.registryPackageId,
        suiRewardEscrowId: onChainRequest.rewardEscrowId,
      })
      await refreshDashboard()
      onProjectRoute(projectId, 'home', { replace: true })
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
            selectedProjectId={selectedProject?.id ?? ''}
            onAddProject={() => {
              onCreateRoute()
            }}
            onSelectMenu={(view) => {
              if (selectedProject) {
                if (selectedProject.id === routeProjectId && view === activeProjectView) {
                  void refreshDashboard({ showLoading: false })
                }

                onProjectRoute(selectedProject.id, view)
              }
            }}
            onSelectProject={(projectId) => {
              if (projectId === selectedProject?.id && activeProjectView === 'home') {
                void refreshDashboard({ showLoading: false })
              }

              onProjectRoute(projectId, 'home')
            }}
          />

          <div className="min-w-0 space-y-5">
            {isLoading ? (
              <LoadingPanel />
            ) : dashboardData?.institutionId === null ? (
              <MembershipRequiredPanel isSaving={isSavingInstitution} onCreateInstitution={handleCreateInstitution} />
            ) : isCreatingProject && !researcherSuiAddress ? (
              <WalletRequiredPanel />
            ) : isCreatingProject ? (
              <ProjectCreateForm
                isSaving={isSavingProject}
                researcherSuiAddress={researcherSuiAddress ?? ''}
                onCreateProject={handleCreateProject}
              />
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
              <EmptyProjectPanel
                onAddProject={() => {
                  onCreateRoute()
                }}
              />
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

function WalletRequiredPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>기관 Slush 지갑</CardTitle>
        <CardDescription>연구를 만들려면 복호화 권한을 받을 기관 Sui 주소가 필요합니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <ConnectButton />
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
  researcherSuiAddress,
  onCreateProject,
}: {
  isSaving: boolean
  researcherSuiAddress: string
  onCreateProject: (input: CreateResearchProjectInput) => void
}) {
  const [selectedDataCategories, setSelectedDataCategories] = useState(defaultDataCategories)

  const toggleDataCategory = (category: string) => {
    setSelectedDataCategories((current) =>
      current.includes(category) ? current.filter((item) => item !== category) : [...current, category],
    )
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (selectedDataCategories.length === 0) {
      return
    }

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
      dataScope: selectedDataCategories,
      researcherSuiAddress,
    })
  }

  return (
    <form className="min-w-0 space-y-5" onSubmit={handleSubmit}>
      <SlushResearcherCard researcherSuiAddress={researcherSuiAddress} />
      <BasicInfoCard />
      <EligibilityCard selectedDataCategories={selectedDataCategories} onToggleDataCategory={toggleDataCategory} />
      <DataSchemaCard selectedDataCategories={selectedDataCategories} />
      <div className="flex justify-end">
        <Button type="submit" disabled={isSaving || selectedDataCategories.length === 0}>
          {isSaving ? '저장 중' : '연구 생성'}
        </Button>
      </div>
    </form>
  )
}

function SlushResearcherCard({ researcherSuiAddress }: { researcherSuiAddress: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>복호화 지갑</CardTitle>
        <CardDescription>참가자가 제출할 때 이 주소로 Seal AccessGrant를 발급합니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-border bg-canvas-soft px-3 py-2 font-mono text-xs text-ink">
          {researcherSuiAddress}
        </div>
      </CardContent>
    </Card>
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

function parseBytesLabel(value: string) {
  const match = value.match(/^([\d,.]+)\s*(B|KB|MB|GB|TB)$/)

  if (!match) {
    return 0
  }

  const amount = Number(match[1].replaceAll(',', ''))
  const unitIndex = ['B', 'KB', 'MB', 'GB', 'TB'].indexOf(match[2])

  return Number.isFinite(amount) && unitIndex >= 0 ? amount * 1024 ** unitIndex : 0
}

function formatCompactIdentifier(value: string) {
  return value.length > 16 ? `${value.slice(0, 5)}.......${value.slice(-5)}` : value
}

function formatParticipantLabel(label: string) {
  return label.replace(/0x[a-f0-9]{12,}/gi, (match) => formatCompactIdentifier(match))
}

function formatAgentMemoryArtifactLabel(kind: string) {
  if (kind === 'pseudonymization_plan') return 'Local Pseudonymization'
  if (kind === 'privacy_verification_receipt') return 'Security Receipt'
  if (kind === 'security_memory') return 'Learned Security Memory'
  if (kind === 'agent_workflow_manifest') return 'Security Workflow'
  return kind.replaceAll('_', ' ')
}

function buildHealthcareFileName(applicant: ApplicantRecord, submission: SubmissionRecord) {
  const participantRef = formatCompactIdentifier(applicant.applicantCode).replaceAll('.', '')
  return `modi-${participantRef}-${submission.id}-encrypted-healthcare-dataset.json`
}

function buildAgentMemoryFileName(applicant: ApplicantRecord, submission: SubmissionRecord, artifact: DashboardAgentMemoryArtifact) {
  const participantRef = formatCompactIdentifier(applicant.applicantCode).replaceAll('.', '')
  return `modi-${participantRef}-${submission.id}-${artifact.kind}.json`
}

function hasWalrusDownloadRef(submission: SubmissionRecord) {
  return Boolean(submission.walrusBlobId || submission.walrusDatasetObjectId)
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
    content = (
      <DataManagementView
        applicantRecords={applicantRecords}
        selectedProject={selectedProject}
        submissionRecordsByApplicant={submissionRecordsByApplicant}
      />
    )
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
                      <span className="block font-medium text-ink">{formatParticipantLabel(row.applicant)}</span>
                      <span className="tabular mt-1 block text-xs text-ink-mute">
                        {formatCompactIdentifier(row.applicantCode)}
                      </span>
                    </td>
                    <td className="tabular py-3 pr-5 font-medium text-ink">{row.score}</td>
                    <td className="py-3 pr-5 text-ink-secondary">{row.lastSync}</td>
                    <td className="py-3" onClick={(event) => event.stopPropagation()}>
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
                      <span className="block font-medium text-ink">{formatParticipantLabel(row.applicant)}</span>
                      <span className="tabular mt-1 block text-xs text-ink-mute">
                        {formatCompactIdentifier(row.applicantCode)}
                      </span>
                    </td>
                    <td className="tabular py-3 pr-5 font-medium text-ink">{row.dataSent}</td>
                    <td className="py-3 pr-5 text-ink-secondary">{row.lastSync}</td>
                    <td className="py-3" onClick={(event) => event.stopPropagation()}>
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
  const [downloadError, setDownloadError] = useState('')
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null)

  if (!applicant) {
    return null
  }

  const handleDownload = async ({ fileName, key, submission }: { fileName: string; key: string; submission: SubmissionRecord }) => {
    setDownloadError('')
    setDownloadingKey(key)

    try {
      await downloadWalrusBlob({
        blobId: submission.walrusBlobId ?? '',
        fileName,
        objectId: submission.walrusDatasetObjectId,
      })
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Walrus 다운로드에 실패했습니다.')
    } finally {
      setDownloadingKey(null)
    }
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
              {formatParticipantLabel(applicant.applicant)} · {formatCompactIdentifier(applicant.applicantCode)}
            </p>
          </div>
          <Button aria-label="모달 닫기" size="icon" type="button" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-4 overflow-y-auto p-5">
          <div className="rounded-md border border-border bg-canvas-soft p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Walrus Blob</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-ink-secondary">
              참가자가 user-app에서 Walrus에 올린 암호화된 헬스케어 데이터셋을 내려받습니다.
            </p>
            {downloadError ? <p className="mt-2 text-sm text-destructive">{downloadError}</p> : null}
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
                    <th className="py-3 pr-5 font-medium">대상 기간</th>
                    <th className="py-3 pr-5 font-medium">용량</th>
                    <th className="py-3 text-right font-medium">다운로드</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((submission) => {
                    const downloadKey = `${submission.id}:healthcare-data`

                    return (
                      <tr key={submission.id} className="border-b border-border last:border-0">
                        <td className="tabular py-3 pr-5 font-medium text-ink">{submission.date}</td>
                        <td className="tabular py-3 pr-5 text-ink-secondary">{submission.period}</td>
                        <td className="tabular py-3 pr-5 font-medium text-ink">{submission.volume}</td>
                        <td className="py-3 text-right">
                          <Button
                            size="sm"
                            type="button"
                            variant="outline"
                            disabled={!hasWalrusDownloadRef(submission) || downloadingKey === downloadKey}
                            onClick={() =>
                              handleDownload({
                                fileName: buildHealthcareFileName(applicant, submission),
                                key: downloadKey,
                                submission,
                              })
                            }
                          >
                            <Download className="mr-2 h-4 w-4" />
                            {downloadingKey === downloadKey ? '다운로드 중' : '다운로드'}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
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
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-border bg-white px-3 py-2">
            <p className="text-xs text-ink-mute">Sui DataRequest</p>
            <p className="mt-1 font-mono text-xs text-ink">
              {selectedProject.suiDataRequestId ? formatCompactIdentifier(selectedProject.suiDataRequestId) : '생성 전'}
            </p>
          </div>
          <div className="rounded-md border border-border bg-white px-3 py-2">
            <p className="text-xs text-ink-mute">기관 Slush 주소</p>
            <p className="mt-1 font-mono text-xs text-ink">
              {selectedProject.researcherSuiAddress ? formatCompactIdentifier(selectedProject.researcherSuiAddress) : '연결 전'}
            </p>
          </div>
        </div>
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

function DataManagementView({
  applicantRecords,
  selectedProject,
  submissionRecordsByApplicant,
}: {
  applicantRecords: ApplicantRecord[]
  selectedProject: Project
  submissionRecordsByApplicant: Record<string, SubmissionRecord[]>
}) {
  const [downloadError, setDownloadError] = useState('')
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null)
  const submissionRows = useMemo(
    () =>
      applicantRecords.flatMap((applicant) =>
        (submissionRecordsByApplicant[applicant.id] ?? []).map((submission) => ({
          applicant,
          submission,
        })),
      ),
    [applicantRecords, submissionRecordsByApplicant],
  )
  const totalHealthcareBytes = submissionRows.reduce((sum, row) => sum + parseBytesLabel(row.submission.volume), 0)
  const agentMemoryRows = submissionRows.flatMap(({ applicant, submission }) =>
    submission.agentMemoryArtifacts.map((artifact) => ({
      applicant,
      artifact,
      submission,
    })),
  )

  const handleDownload = async ({
    fileName,
    key,
    submission,
  }: {
    fileName: string
    key: string
    submission: SubmissionRecord
  }) => {
    setDownloadError('')
    setDownloadingKey(key)

    try {
      await downloadWalrusBlob({
        blobId: submission.walrusBlobId ?? '',
        fileName,
        objectId: submission.walrusDatasetObjectId,
      })
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Walrus 다운로드에 실패했습니다.')
    } finally {
      setDownloadingKey(null)
    }
  }

  const handleAgentMemoryDownload = async ({
    artifact,
    fileName,
    key,
  }: {
    artifact: DashboardAgentMemoryArtifact
    fileName: string
    key: string
  }) => {
    setDownloadError('')
    setDownloadingKey(key)

    try {
      await downloadWalrusBlob({
        blobId: artifact.blobId,
        fileName,
        objectId: artifact.blobObjectId,
      })
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Walrus Security Agent record 다운로드에 실패했습니다.')
    } finally {
      setDownloadingKey(null)
    }
  }

  return (
    <div className="min-w-0 space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MiniStat label="제출 데이터" value={`${submissionRows.length}건`} />
        <MiniStat label="누적 제출량" value={formatBytes(totalHealthcareBytes)} />
        <MiniStat label="Security Trail" value={`${agentMemoryRows.length}개`} />
        <MiniStat label="Security Memory" value={selectedProject.securityMemoryBlobId ? 'Active' : '없음'} />
        <MiniStat label="Workflow Manifest" value={`${submissionRows.filter((row) => row.submission.agentMemoryManifestBlobId).length}개`} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Security Agent Audit Trail</CardTitle>
              <CardDescription>Walrus policy memory를 재사용한 platform Security Agent 검증 기록을 확인합니다</CardDescription>
            </div>
            <Layers3 className="h-5 w-5 text-primary" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {downloadError ? <p className="text-sm text-destructive">{downloadError}</p> : null}

          {agentMemoryRows.length === 0 ? (
            <div className="rounded-md border border-border bg-white px-4 py-8 text-center text-sm text-ink-mute">
              아직 Walrus Security Agent audit trail이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="text-xs text-ink-mute">
                  <tr className="border-b border-border">
                    <th className="py-3 pr-5 font-medium">참여자</th>
                    <th className="py-3 pr-5 font-medium">Audit artifact</th>
                    <th className="py-3 pr-5 font-medium">Walrus Blob</th>
                    <th className="py-3 pr-5 font-medium">Hash</th>
                    <th className="py-3 pr-5 font-medium">연결 제출</th>
                    <th className="py-3 text-right font-medium">Record</th>
                  </tr>
                </thead>
                <tbody>
                  {agentMemoryRows.map(({ applicant, artifact, submission }) => {
                    const downloadKey = `memory-${submission.id}-${artifact.blobId}`

                    return (
                      <tr key={`${submission.id}-${artifact.kind}-${artifact.blobId}`} className="border-b border-border last:border-0">
                        <td className="py-3 pr-5">
                          <span className="block font-medium text-ink">{formatParticipantLabel(applicant.applicant)}</span>
                          <span className="tabular mt-1 block text-xs text-ink-mute">
                            {formatCompactIdentifier(applicant.applicantCode)}
                          </span>
                        </td>
                        <td className="py-3 pr-5">
                          <span className="block font-medium text-ink">{formatAgentMemoryArtifactLabel(artifact.kind)}</span>
                          <span className="mt-1 block text-xs text-ink-mute">{artifact.title}</span>
                        </td>
                        <td className="tabular py-3 pr-5 text-ink-secondary">{formatCompactIdentifier(artifact.blobId)}</td>
                        <td className="tabular py-3 pr-5 text-ink-secondary">{artifact.hash ? formatCompactIdentifier(artifact.hash) : '-'}</td>
                        <td className="tabular py-3 pr-5 text-ink-secondary">{submission.date}</td>
                        <td className="py-3 text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={downloadingKey === downloadKey}
                            onClick={() =>
                              void handleAgentMemoryDownload({
                                artifact,
                                fileName: buildAgentMemoryFileName(applicant, submission, artifact),
                                key: downloadKey,
                              })
                            }
                          >
                            <Download className="mr-2 h-4 w-4" />
                            {downloadingKey === downloadKey ? '받는 중' : '다운로드'}
                          </Button>
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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>데이터 다운로드</CardTitle>
              <CardDescription>참가자가 user-app에서 Walrus에 올린 암호화된 헬스케어 데이터셋을 내려받습니다</CardDescription>
            </div>
            <DatabaseZap className="h-5 w-5 text-primary" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {downloadError ? <p className="text-sm text-destructive">{downloadError}</p> : null}

          {submissionRows.length === 0 ? (
            <div className="rounded-md border border-border bg-white px-4 py-10 text-center text-sm text-ink-mute">
              아직 다운로드할 헬스케어 데이터가 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs text-ink-mute">
                  <tr className="border-b border-border">
                    <th className="py-3 pr-5 font-medium">참여자</th>
                    <th className="py-3 pr-5 font-medium">제출일</th>
                    <th className="py-3 pr-5 font-medium">대상 기간</th>
                    <th className="py-3 pr-5 font-medium">용량</th>
                    <th className="py-3 text-right font-medium">다운로드</th>
                  </tr>
                </thead>
                <tbody>
                  {submissionRows.map(({ applicant, submission }) => {
                    const downloadKey = `${submission.id}:healthcare-data`

                    return (
                      <tr key={submission.id} className="border-b border-border last:border-0">
                        <td className="py-3 pr-5">
                          <span className="block font-medium text-ink">{formatParticipantLabel(applicant.applicant)}</span>
                          <span className="tabular mt-1 block text-xs text-ink-mute">
                            {formatCompactIdentifier(applicant.applicantCode)}
                          </span>
                        </td>
                        <td className="tabular py-3 pr-5 font-medium text-ink">{submission.date}</td>
                        <td className="tabular py-3 pr-5 text-ink-secondary">{submission.period}</td>
                        <td className="tabular py-3 pr-5 font-medium text-ink">{submission.volume}</td>
                        <td className="py-3 text-right">
                          <Button
                            size="sm"
                            type="button"
                            variant="outline"
                            disabled={!hasWalrusDownloadRef(submission) || downloadingKey === downloadKey}
                            onClick={() =>
                              handleDownload({
                                fileName: buildHealthcareFileName(applicant, submission),
                                key: downloadKey,
                                submission,
                              })
                            }
                          >
                            <Download className="mr-2 h-4 w-4" />
                            {downloadingKey === downloadKey ? '다운로드 중' : '다운로드'}
                          </Button>
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
    </div>
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
                        <p className="font-medium text-ink">{formatParticipantLabel(row.applicant)}</p>
                        <p className="tabular mt-1 text-xs text-ink-mute">{formatCompactIdentifier(row.applicantCode)}</p>
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
          <Field className="md:col-span-2" label="연구명">
            <input className={inputClassName} name="title" defaultValue="Apple Health 활동/운동 리워드 검증 데이터" required />
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

function EligibilityCard({
  onToggleDataCategory,
  selectedDataCategories,
}: {
  onToggleDataCategory: (category: string) => void
  selectedDataCategories: string[]
}) {
  const selectedSet = new Set(selectedDataCategories)

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
          <div className="mt-3 space-y-3">
            {dataCategoryGroups.map((group) => (
              <div key={group.label} className="rounded-md border border-border bg-white p-3">
                <p className="mb-2 text-xs font-medium text-ink-mute">{group.label}</p>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {group.options.map((option) => {
                    const isSelected = selectedSet.has(option.key)

                    return (
                      <button
                        key={option.key}
                        className={`flex min-h-20 items-start gap-2 rounded-md border px-3 py-2 text-left transition-colors ${
                          isSelected
                            ? 'border-primary bg-[#f6f4ff] text-primary'
                            : 'border-border bg-white text-ink-secondary hover:bg-canvas-soft'
                        }`}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => onToggleDataCategory(option.key)}
                      >
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            isSelected ? 'border-primary bg-primary text-white' : 'border-border bg-white'
                          }`}
                          aria-hidden="true"
                        >
                          {isSelected ? <Check className="h-3 w-3" /> : null}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{option.key}</span>
                          <span className={`mt-1 block text-xs ${isSelected ? 'text-primary/75' : 'text-ink-mute'}`}>
                            {option.detail}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          {selectedDataCategories.length === 0 ? (
            <p className="mt-2 text-xs font-medium text-destructive">최소 1개 이상의 요청 데이터를 선택해야 합니다.</p>
          ) : (
            <p className="mt-2 text-xs text-ink-mute">선택됨: {selectedDataCategories.join(', ')}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function DataSchemaCard({ selectedDataCategories }: { selectedDataCategories: string[] }) {
  const selectedSchemaRows = buildSelectedSchemaRows(selectedDataCategories)

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
              {[...schemaRows, ...selectedSchemaRows].map((row) => (
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

function buildSelectedSchemaRows(selectedDataCategories: string[]) {
  return selectedDataCategories.map((category) => {
    const option = dataCategoryOptionByKey[category]
    const field = category
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, '_')
      .replace(/^_+|_+$/g, '')

    return {
      field,
      source: option?.source ?? 'User Health Data',
      policy: `${category} 원본값 제거 후 연구용 범주만 허용`,
      enabled: true,
    }
  })
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
