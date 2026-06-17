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

type ApplicantDecision = 'Approve' | 'Reject'
type ApplicantRecord = DashboardApplicant
type SubmissionRecord = DashboardSubmission
type SettlementRecord = DashboardSettlement
type RefreshDashboardOptions = {
  showLoading?: boolean
}

const projectMenus: ProjectMenuItem[] = [
  { key: 'participants', label: 'Participant Management', detail: 'Applicant and participant management', icon: Users },
  { key: 'datasets', label: 'Data Management', detail: 'Healthcare data download', icon: DatabaseZap },
  { key: 'settlements', label: 'Rewards / Settlement', detail: 'RewardEscrow payout', icon: Wallet },
]

const schemaRows = [
  { field: 'ageRange', source: 'Profile', policy: 'Store age range only', enabled: true },
  { field: 'recordedMonth', source: 'System', policy: 'Month-level time only', enabled: true },
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
    label: 'Activity',
    options: [
      { key: 'Steps', source: 'Apple Health', detail: 'Daily step count band' },
      { key: 'Exercise minutes', source: 'Apple Health', detail: 'exercise minute band' },
      { key: 'Active energy', source: 'Apple Health', detail: 'active kcal band' },
      { key: 'VO2 max', source: 'Apple Health', detail: 'cardio fitness band' },
    ],
  },
  {
    label: 'Sleep / Recovery',
    options: [
      { key: 'Sleep duration', source: 'Wearable', detail: 'sleep duration band' },
      { key: 'Sleep efficiency', source: 'Wearable', detail: 'efficiency band' },
      { key: 'Sleep stages', source: 'Wearable', detail: 'stage ratio' },
      { key: 'HRV', source: 'Wearable', detail: 'recovery band' },
    ],
  },
  {
    label: 'Vitals',
    options: [
      { key: 'Heart rate', source: 'Wearable', detail: 'heart rate band' },
      { key: 'Resting heart rate', source: 'Wearable', detail: 'resting band' },
      { key: 'Blood oxygen', source: 'Wearable', detail: 'SpO2 band' },
      { key: 'Weight', source: 'Health Profile', detail: 'Weight range' },
    ],
  },
  {
    label: 'Metadata',
    options: [
      { key: 'Device type', source: 'Device', detail: 'device category' },
      { key: 'Recorded month', source: 'System', detail: 'month-level period' },
    ],
  },
]
const defaultDataCategories = ['Steps', 'Exercise minutes', 'VO2 max']
const dataCategoryOptions = dataCategoryGroups.flatMap((group) => group.options)
const dataCategoryOptionByKey = Object.fromEntries(dataCategoryOptions.map((option) => [option.key, option]))
const ageRanges = ['20-29', '30-39', '40-49', '50-59']
const applicantDecisions: ApplicantDecision[] = ['Approve', 'Reject']

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
      setErrorMessage(error instanceof Error ? error.message : 'Could not load dashboard data.')
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
      setErrorMessage('Connect the institution Slush wallet before creating a study.')
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
      setErrorMessage(error instanceof Error ? error.message : 'Could not create study.')
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
      setErrorMessage(error instanceof Error ? error.message : 'Could not create institution.')
    } finally {
      setIsSavingInstitution(false)
    }
  }

  const handleApplicantReview = async (applicantId: string, decision: ApplicantDecision) => {
    const nextStatus: Extract<ApplicantStatus, 'approved' | 'rejected'> = decision === 'Approve' ? 'approved' : 'rejected'

    setPendingApplicantId(applicantId)
    setErrorMessage('')

    try {
      await updateApplicationStatus(applicantId, nextStatus)
      setDashboardData((current) => updateApplicantInDashboard(current, applicantId, nextStatus))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not update application status.')
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
      setErrorMessage(error instanceof Error ? error.message : 'Could not update settlement status.')
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
      <CardContent className="p-8 text-sm text-ink-secondary">Loading institution dashboard data from Supabase.</CardContent>
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
        <CardTitle>Institution Membership Required</CardTitle>
        <CardDescription>
          Connect the current Auth user as the institution owner before creating studies and managing data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Field label="Institution name">
            <input className={inputClassName} name="institutionName" defaultValue="MODi Research Lab" required />
          </Field>
          <Field label="Institution slug">
            <input className={inputClassName} name="institutionSlug" defaultValue="modi-research-lab" required />
          </Field>
          <Field label="Website">
            <input className={inputClassName} name="websiteUrl" placeholder="https://example.org" type="url" />
          </Field>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Creating Institution' : 'Create Institution'}
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
        <CardTitle>No Studies Registered</CardTitle>
        <CardDescription>Create the first study to manage applicants, submitted data, and settlement status from this dashboard.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" onClick={onAddProject}>
          <Plus className="mr-2 h-4 w-4" />
          Add Project
        </Button>
      </CardContent>
    </Card>
  )
}

function WalletRequiredPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Institution Slush Wallet</CardTitle>
        <CardDescription>A Sui address is required so the institution can receive decryption access for study submissions.</CardDescription>
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
          <p className="text-sm font-medium">Active Projects</p>
          <p className="mt-1 text-xs text-white/55">Project workspace</p>
        </div>
        <Badge variant="dark">{projects.length}</Badge>
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
          Add Project
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
      title: getFormValue(formData, 'title') || 'New Study',
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
          {isSaving ? 'Saving' : 'Create Study'}
        </Button>
      </div>
    </form>
  )
}

function SlushResearcherCard({ researcherSuiAddress }: { researcherSuiAddress: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Decryption Wallet</CardTitle>
        <CardDescription>Participant submissions issue a Seal AccessGrant to this address.</CardDescription>
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

  return `${value.toLocaleString('en-US', { maximumFractionDigits: value >= 10 ? 0 : 1 })} ${units[unitIndex]}`
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
  const statusReadyCount = pendingCount > 0 ? `${pendingCount} to review` : 'All clear'

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-ink-mute">Total Participants</p>
          <p className="tabular mt-2 text-2xl font-light text-ink">{participants.length} people</p>
          <p className="mt-1 text-xs text-ink-mute">Goal {selectedProject.targetLabel}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-ink-mute">Participant Activity</p>
          <p className="tabular mt-2 text-2xl font-light text-ink">{averageActivity}%</p>
          <p className="mt-1 text-xs text-ink-mute">Based on the last 7 days</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-ink-mute">Remaining USDC</p>
          <p className="tabular mt-2 text-2xl font-light text-ink">{selectedProject.rewardPoolLabel}</p>
          <p className="mt-1 text-xs text-ink-mute">Available settlement balance</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-ink-mute">Status Check</p>
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
            <CardTitle>Recent Applicants</CardTitle>
            <CardDescription>Quickly approve or reject new applicants</CardDescription>
          </div>
          <Users className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        {recentApplicants.length === 0 ? (
          <div className="rounded-md border border-border bg-canvas-soft px-4 py-8 text-center text-sm text-ink-mute">
            No recent applicants to review.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-ink-mute">
                <tr className="border-b border-border">
                  <th className="py-3 pr-5 font-medium">Applicants</th>
                  <th className="py-3 pr-5 font-medium">Match Score</th>
                  <th className="py-3 pr-5 font-medium">Latest Submission</th>
                  <th className="py-3 text-right font-medium">Decision</th>
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
        <MiniStat label="Applicants" value={`${pendingApplicants.length} people`} />
        <MiniStat label="Participants" value={`${participants.length} people`} />
        <MiniStat label="Total Volume" value={totalDataSent} />
      </div>
      <ParticipantTableSection
        actionLabel="Decision"
        onOpenSubmission={onOpenSubmission}
        pendingApplicantId={pendingApplicantId}
        rows={pendingApplicants}
        title="Applicants"
        onReviewApplicant={onReviewApplicant}
      />
      <ParticipantTableSection onOpenSubmission={onOpenSubmission} rows={participants} title="Participants" />
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
            <CardDescription>Click a person to inspect submission history</CardDescription>
          </div>
          <Badge variant="outline">{rows.length} people</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="rounded-md border border-border bg-canvas-soft px-4 py-8 text-center text-sm text-ink-mute">No people to display.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs text-ink-mute">
                <tr className="border-b border-border">
                  <th className="py-3 pr-5 font-medium">Person</th>
                  <th className="py-3 pr-5 font-medium">Data Sent</th>
                  <th className="py-3 pr-5 font-medium">Latest Submission</th>
                  <th className="py-3 text-right font-medium">{actionLabel ?? 'Status'}</th>
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
      setDownloadError(error instanceof Error ? error.message : 'Walrus download failed.')
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
            <p className="text-sm font-medium text-ink">Submission History</p>
            <p className="mt-1 truncate text-xs text-ink-mute">
              {formatParticipantLabel(applicant.applicant)} · {formatCompactIdentifier(applicant.applicantCode)}
            </p>
          </div>
          <Button aria-label="Close modal" size="icon" type="button" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-4 overflow-y-auto p-5">
          <div className="rounded-md border border-border bg-canvas-soft p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Walrus Blob</Badge>
            </div>
            <p className="mt-3 text-sm leading-6 text-ink-secondary">
              Download encrypted healthcare datasets uploaded to Walrus from the user app.
            </p>
            {downloadError ? <p className="mt-2 text-sm text-destructive">{downloadError}</p> : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniStat label="Total Volume" value={applicant.dataSent} />
            <MiniStat label="Latest Submission" value={applicant.lastSync} />
            <MiniStat label="Submission Count" value={`${submissions.length}`} />
          </div>
          {submissions.length === 0 ? (
            <div className="rounded-md border border-border bg-white px-4 py-8 text-center text-sm text-ink-mute">
              No submissions yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="text-xs text-ink-mute">
                  <tr className="border-b border-border">
                    <th className="py-3 pr-5 font-medium">Submitted At</th>
                    <th className="py-3 pr-5 font-medium">Period</th>
                    <th className="py-3 pr-5 font-medium">Size</th>
                    <th className="py-3 text-right font-medium">Download</th>
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
                            {downloadingKey === downloadKey ? 'Downloading' : 'Download'}
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
            <CardTitle>Dataset</CardTitle>
            <CardDescription>Collection scope and access policy</CardDescription>
          </div>
          <DatabaseZap className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-border bg-white px-3 py-2">
            <p className="text-xs text-ink-mute">Sui DataRequest</p>
            <p className="mt-1 font-mono text-xs text-ink">
              {selectedProject.suiDataRequestId ? formatCompactIdentifier(selectedProject.suiDataRequestId) : 'Not created'}
            </p>
          </div>
          <div className="rounded-md border border-border bg-white px-3 py-2">
            <p className="text-xs text-ink-mute">Institution Slush Address</p>
            <p className="mt-1 font-mono text-xs text-ink">
              {selectedProject.researcherSuiAddress ? formatCompactIdentifier(selectedProject.researcherSuiAddress) : 'Not connected'}
            </p>
          </div>
        </div>
        {selectedProject.dataScope.length === 0 ? (
          <div className="rounded-md border border-border bg-canvas-soft px-4 py-8 text-center text-sm text-ink-mute">
            No data scope registered.
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
      setDownloadError(error instanceof Error ? error.message : 'Walrus download failed.')
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
      setDownloadError(error instanceof Error ? error.message : 'Walrus Security Agent record download failed.')
    } finally {
      setDownloadingKey(null)
    }
  }

  return (
    <div className="min-w-0 space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MiniStat label="Submitted Data" value={`${submissionRows.length}`} />
        <MiniStat label="Total Volume" value={formatBytes(totalHealthcareBytes)} />
        <MiniStat label="Security Trail" value={`${agentMemoryRows.length}`} />
        <MiniStat label="Security Memory" value={selectedProject.securityMemoryBlobId ? 'Active' : 'None'} />
        <MiniStat label="Workflow Manifest" value={`${submissionRows.filter((row) => row.submission.agentMemoryManifestBlobId).length}`} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Security Agent Audit Trail</CardTitle>
              <CardDescription>Inspect platform Security Agent records that reuse Walrus policy memory</CardDescription>
            </div>
            <Layers3 className="h-5 w-5 text-primary" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {downloadError ? <p className="text-sm text-destructive">{downloadError}</p> : null}

          {agentMemoryRows.length === 0 ? (
            <div className="rounded-md border border-border bg-white px-4 py-8 text-center text-sm text-ink-mute">
              No Walrus Security Agent audit trail yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="text-xs text-ink-mute">
                  <tr className="border-b border-border">
                    <th className="py-3 pr-5 font-medium">Participants</th>
                    <th className="py-3 pr-5 font-medium">Audit artifact</th>
                    <th className="py-3 pr-5 font-medium">Walrus Blob</th>
                    <th className="py-3 pr-5 font-medium">Hash</th>
                    <th className="py-3 pr-5 font-medium">Linked Submission</th>
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
                            {downloadingKey === downloadKey ? 'Downloading' : 'Download'}
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
              <CardTitle>Data Download</CardTitle>
              <CardDescription>Download encrypted healthcare datasets uploaded to Walrus from the user app</CardDescription>
            </div>
            <DatabaseZap className="h-5 w-5 text-primary" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {downloadError ? <p className="text-sm text-destructive">{downloadError}</p> : null}

          {submissionRows.length === 0 ? (
            <div className="rounded-md border border-border bg-white px-4 py-10 text-center text-sm text-ink-mute">
              No healthcare data available for download yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs text-ink-mute">
                  <tr className="border-b border-border">
                    <th className="py-3 pr-5 font-medium">Participants</th>
                    <th className="py-3 pr-5 font-medium">Submitted At</th>
                    <th className="py-3 pr-5 font-medium">Period</th>
                    <th className="py-3 pr-5 font-medium">Size</th>
                    <th className="py-3 text-right font-medium">Download</th>
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
                            {downloadingKey === downloadKey ? 'Downloading' : 'Download'}
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
            <CardTitle>Rewards / Settlement</CardTitle>
            <CardDescription>RewardEscrow payment status</CardDescription>
          </div>
          <Wallet className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md bg-brand-dark p-4 text-white">
            <p className="text-xs text-white/60">Escrowed Reward</p>
            <p className="tabular mt-2 text-2xl font-light">{selectedProject.rewardPoolLabel}</p>
          </div>
          <MiniStat label="Settled" value={`${settledCount}`} />
          <MiniStat label="Pending Settlement" value={`${pendingCount}`} />
        </div>
        {settlementRecords.length === 0 ? (
          <div className="rounded-md border border-border bg-canvas-soft px-4 py-8 text-center text-sm text-ink-mute">
            No settlement records to display.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs text-ink-mute">
                <tr className="border-b border-border">
                  <th className="py-3 pr-5 font-medium">Person</th>
                  <th className="py-3 pr-5 font-medium">Reward Amount</th>
                  <th className="py-3 pr-5 font-medium">Settlement Status</th>
                  <th className="py-3 text-right font-medium">Action</th>
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
                        <Badge variant={isSettled ? 'secondary' : 'outline'}>{isSettled ? 'Settled' : 'Pending Settlement'}</Badge>
                      </td>
                      <td className="py-3 text-right">
                        {isSettled && transactionHref ? (
                          <a
                            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                            href={transactionHref}
                            rel="noreferrer"
                            target="_blank"
                          >
                            View Transaction
                          </a>
                        ) : (
                          <Button
                            size="sm"
                            type="button"
                            variant="outline"
                            disabled={pendingSettlementId === row.id}
                            onClick={() => onSettleReward(row.id)}
                          >
                            {pendingSettlementId === row.id ? 'Settling' : 'Settle'}
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
    return <Badge variant="secondary">Participating</Badge>
  }

  if (status === 'rejected') {
    return <Badge variant="outline">Reject</Badge>
  }

  return <Badge variant="outline">Applied</Badge>
}

function BasicInfoCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Values shown on study cards and the user app recruitment list</CardDescription>
          </div>
          <FileText className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <Field className="md:col-span-2" label="Study Name">
            <input className={inputClassName} name="title" defaultValue="Apple Health Activity Reward Validation Data" required />
          </Field>
          <Field className="md:col-span-2" label="Study Purpose">
            <input className={inputClassName} name="purpose" defaultValue="Preventive reward calculation" />
          </Field>
          <Field className="md:col-span-2" label="Study Description">
            <textarea
              className={`${inputClassName} min-h-28 resize-none leading-6`}
              name="description"
              defaultValue="Categorize steps, distance, exercise minutes, active energy, and VO2 max to validate reward calculation accuracy."
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
            <CardTitle>Participation Conditions</CardTitle>
            <CardDescription>Recruitment target, reward, and data access period</CardDescription>
          </div>
          <SlidersHorizontal className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Target Participants">
            <input className={inputClassName} name="targetParticipants" defaultValue="420" inputMode="numeric" />
          </Field>
          <Field label="Reward per Participant (USDC)">
            <input className={inputClassName} name="rewardAmountPerParticipant" defaultValue="19" inputMode="decimal" />
            <input type="hidden" name="rewardCurrency" value="USDC" />
          </Field>
          <Field label="Access Period">
            <input className={inputClassName} name="accessPeriodDays" defaultValue="60" inputMode="numeric" />
          </Field>
        </div>

        <div>
          <p className="text-sm font-medium text-ink">Age Range</p>
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
          <p className="text-sm font-medium text-ink">Requested Data</p>
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
            <p className="mt-2 text-xs font-medium text-destructive">Select at least one requested data category.</p>
          ) : (
            <p className="mt-2 text-xs text-ink-mute">Selected: {selectedDataCategories.join(', ')}</p>
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
            <CardTitle>Data Schema</CardTitle>
            <CardDescription>Fields provided by the user app and institution access policy</CardDescription>
          </div>
          <Layers3 className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-ink-mute">
              <tr className="border-b border-border">
                <th className="py-3 font-medium">Field</th>
                <th className="py-3 font-medium">Source</th>
                <th className="py-3 font-medium">Policy</th>
                <th className="py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {[...schemaRows, ...selectedSchemaRows].map((row) => (
                <tr key={row.field} className="border-b border-border last:border-0">
                  <td className="tabular py-3 pr-5 font-medium text-ink">{row.field}</td>
                  <td className="py-3 pr-5 text-ink-secondary">{row.source}</td>
                  <td className="py-3 pr-5 text-ink-secondary">{row.policy}</td>
                  <td className="py-3 text-right">
                    <Badge variant={row.enabled ? 'secondary' : 'outline'}>{row.enabled ? 'Included' : 'Excluded'}</Badge>
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
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')

    return {
      field,
      source: option?.source ?? 'User Health Data',
      policy: `${category} raw values are removed; only research-grade bands are allowed`,
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
