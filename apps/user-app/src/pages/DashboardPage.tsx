import { useCallback, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import {
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import {
  Activity,
  Bell,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  DatabaseZap,
  FileKey2,
  Flame,
  Footprints,
  HeartPulse,
  LockKeyhole,
  Moon,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react-native'

import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Progress } from '../components/ui/progress'
import { Separator } from '../components/ui/separator'
import { agentChecks, connectedHealthApps, participationRecords, researchRequests } from '../data/mvp'
import {
  fetchAppleHealthSnapshot,
  getAppleHealthSupportMessage,
  type AppleHealthSnapshot,
} from '../services/appleHealth'
import { submitParticipantData, type ParticipantSubmissionProgress, type ParticipantSubmissionProgressStage } from '../services/participantSubmissions'
import { fetchRecruitingResearchRequests } from '../services/researchProjects'
import { subscribeToUserAppRealtimeChanges } from '../services/realtime'
import {
  fetchUserResearchApplications,
  joinResearchProject,
  type UserResearchApplication,
} from '../services/userApplications'
import { colors, radii, shadow } from '../styles/theme'
import type { ConnectedHealthApp, DashboardTab, ParticipationRecord, ResearchRequest } from '../types/dashboard'

type AppleHealthSyncStatus = 'idle' | 'syncing' | 'connected' | 'unsupported' | 'error'
type HealthCalendarDay = {
  completion?: number
  day?: number
  missed?: boolean
}
type HealthTodo = {
  done: boolean
  id: string
  label: string
  value: string
}
type HomeMetric = {
  detail: string
  icon: LucideIcon
  label: string
  progress: number
  unit: string
  value: string
}
type RequestCategoryFilter = 'all' | ResearchRequest['category']
type NotificationItem = {
  detail: string
  id: string
  time: string
  title: string
  unread?: boolean
}
type SubmissionStatus = 'idle' | 'submitting' | 'submitted' | 'error'

type DashboardPageProps = {
  activeTab: DashboardTab
  activeUserId: string
  selectedRequestId: string
  onTabChange: (tab: DashboardTab) => void
  onSelectRequest: (requestId: string) => void
  onBackToLanding: () => void
}

const navItems: Array<{ id: DashboardTab; label: string; icon: LucideIcon }> = [
  { id: 'home', label: 'Home', icon: Activity },
  { id: 'projects', label: 'Projects', icon: ClipboardList },
  { id: 'my-projects', label: 'My Projects', icon: CheckCircle2 },
]

const defaultSubmissionProgress: ParticipantSubmissionProgress = {
  detail: 'Calculating the study request scope and submission period.',
  label: 'Preparing submission',
  progress: 4,
  stage: 'preparing',
}

const submissionProgressSteps: Array<{
  label: string
  stages: ParticipantSubmissionProgressStage[]
}> = [
  {
    label: 'Local Pseudonymization',
    stages: ['preparing', 'policy-loading', 'security-memory-loading', 'pseudonymizing'],
  },
  {
    label: 'Privacy Agent Verification',
    stages: ['verifying', 'hardening', 'reverifying', 'verified'],
  },
  {
    label: 'Agent Memory',
    stages: ['agent-memory-uploading', 'security-memory-updating'],
  },
  {
    label: 'Encryption',
    stages: ['encrypting'],
  },
  {
    label: 'Walrus Submission',
    stages: ['walrus-uploading', 'tx-verifying', 'registering', 'complete'],
  },
]

const privacyAgentMemoryCards: Array<{
  detail: string
  icon: LucideIcon
  label: string
}> = [
  {
    detail: 'The user app fetches the institution policy_pack from Walrus and verifies its hash before editing data.',
    icon: FileKey2,
    label: 'Walrus policy memory',
  },
  {
    detail: 'The platform Agent checks forbidden fields, hidden re-identification risk, and learned risk patterns.',
    icon: BrainCircuit,
    label: 'Privacy Agent check',
  },
  {
    detail: 'Walrus stores receipts, Security Memory, and workflow manifests without storing raw health data.',
    icon: DatabaseZap,
    label: 'memWal audit trail',
  },
]

const initialHealthTodos: HealthTodo[] = [
  { id: 'steps', label: 'Walk at least 8,000 steps', value: '8,426steps', done: true },
  { id: 'sleep', label: 'Sleep at least 7 hours', value: '7.2 hours', done: true },
  { id: 'heart', label: 'Measure heart rate', value: 'Not yet', done: false },
  { id: 'water', label: 'Drink 6 cups of water', value: '4 / 6cups', done: false },
]

const notificationItems: NotificationItem[] = [
  {
    detail: 'The BetterSleep Coaching request moved into data review.',
    id: 'notice-sleep-review',
    time: 'Just now',
    title: 'Sleep Coaching Data Review',
    unread: true,
  },
  {
    detail: 'Sui Active Insurance reward escrow has been confirmed.',
    id: 'notice-reward-ready',
    time: '12 minutes ago',
    title: 'Reward Conditions Confirmed',
    unread: true,
  },
  {
    detail: 'The wearable sharing schema was updated to match the Apple Health data scope.',
    id: 'notice-schema',
    time: 'Today',
    title: 'Data Policy Updated',
  },
]

const appleHealthFallbackMetrics: HomeMetric[] = [
  {
    detail: 'Resting range',
    icon: HeartPulse,
    label: 'Heart rate',
    progress: 72,
    unit: 'bpm',
    value: '72',
  },
  {
    detail: 'Today total',
    icon: Flame,
    label: 'Resting energy',
    progress: 78,
    unit: 'kcal',
    value: '1,420',
  },
]

const homeProfileFallback = {
  heightCm: 180,
  name: 'Han',
  weightKg: 68,
}

const sleepCycleSegments = [
  { color: '#bcd7ff', flex: 18, height: 28, label: 'Light sleep', time: '23:40' },
  { color: '#7ea7f8', flex: 15, height: 40, label: 'REM', time: '00:45' },
  { color: '#2947a9', flex: 22, height: 54, label: 'Deep sleep', time: '01:40' },
  { color: '#bcd7ff', flex: 18, height: 30, label: 'Light sleep', time: '03:05' },
  { color: '#7ea7f8', flex: 13, height: 42, label: 'REM', time: '04:20' },
  { color: '#f5c26f', flex: 6, height: 22, label: 'Awake', time: '05:18' },
  { color: '#bcd7ff', flex: 18, height: 28, label: 'Light sleep', time: '05:40' },
]

export function DashboardPage({
  activeTab,
  activeUserId,
  selectedRequestId,
  onSelectRequest,
  onTabChange,
}: DashboardPageProps) {
  const [projectRequests, setProjectRequests] = useState<ResearchRequest[]>(researchRequests)
  const [projectLoadStatus, setProjectLoadStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [projectLoadMessage, setProjectLoadMessage] = useState<string | null>(null)
  const [userApplications, setUserApplications] = useState<UserResearchApplication[]>([])
  const [applicationLoadStatus, setApplicationLoadStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [applicationLoadMessage, setApplicationLoadMessage] = useState<string | null>(null)
  const [joiningProjectId, setJoiningProjectId] = useState<string | null>(null)

  const joinedProjectIds = userApplications.map((application) => application.projectId)

  const refreshProjectRequests = useCallback(async () => {
    setProjectLoadStatus('loading')
    setProjectLoadMessage(null)

    try {
      const requests = await fetchRecruitingResearchRequests()
      setProjectRequests(requests.length > 0 ? requests : researchRequests)
      setProjectLoadStatus('loaded')
    } catch (error) {
      setProjectRequests(researchRequests)
      setProjectLoadStatus('error')
      setProjectLoadMessage(error instanceof Error ? error.message : 'Could not load projects.')
    }
  }, [])

  useEffect(() => {
    void refreshProjectRequests()
  }, [refreshProjectRequests])

  const refreshUserApplications = useCallback(async () => {
    setApplicationLoadStatus('loading')
    setApplicationLoadMessage(null)

    try {
      const applications = await fetchUserResearchApplications(activeUserId)
      setUserApplications(applications)
      setApplicationLoadStatus('loaded')
    } catch (error) {
      setUserApplications([])
      setApplicationLoadStatus('error')
      setApplicationLoadMessage(error instanceof Error ? error.message : 'Could not load My Projects.')
    }
  }, [activeUserId])

  useEffect(() => {
    void refreshUserApplications()
  }, [refreshUserApplications])

  useEffect(() => {
    if (activeTab === 'projects') {
      void refreshProjectRequests()
    }

    if (activeTab === 'my-projects') {
      void refreshUserApplications()
    }
  }, [activeTab, refreshProjectRequests, refreshUserApplications])

  useEffect(() => {
    return subscribeToUserAppRealtimeChanges({
      loginId: activeUserId,
      onApplicationsChange: () => void refreshUserApplications(),
      onProjectsChange: () => void refreshProjectRequests(),
    })
  }, [activeUserId, refreshProjectRequests, refreshUserApplications])

  const joinProject = async (requestId: string) => {
    const request = projectRequests.find((projectRequest) => projectRequest.id === requestId)

    if (!request) {
      return
    }

    setJoiningProjectId(requestId)
    setApplicationLoadMessage(null)

    try {
      const application = await joinResearchProject({ loginId: activeUserId, request })
      setUserApplications((currentApplications) => upsertUserApplication(currentApplications, application))
      onSelectRequest(requestId)
      onTabChange('my-projects')
      void refreshUserApplications()
    } catch (error) {
      setApplicationLoadStatus('error')
      setApplicationLoadMessage(error instanceof Error ? error.message : 'Could not save the application.')
    } finally {
      setJoiningProjectId(null)
    }
  }

  return (
    <DashboardShell activeTab={activeTab} onTabChange={onTabChange}>
      {activeTab === 'projects' ? (
        <ProjectsPage
          joinedProjectIds={joinedProjectIds}
          joinMessage={applicationLoadMessage}
          joiningProjectId={joiningProjectId}
          loadMessage={projectLoadMessage}
          loadStatus={projectLoadStatus}
          requests={projectRequests}
          selectedRequestId={selectedRequestId}
          onRefresh={refreshProjectRequests}
          onJoinProject={joinProject}
        />
      ) : activeTab === 'my-projects' ? (
        <MyProjectsPage
          activeUserId={activeUserId}
          applicationLoadMessage={applicationLoadMessage}
          applicationLoadStatus={applicationLoadStatus}
          requests={projectRequests}
          selectedRequestId={selectedRequestId}
          userApplications={userApplications}
          onSelectRequest={onSelectRequest}
        />
      ) : (
        <HomePage />
      )}
    </DashboardShell>
  )
}

function DashboardShell({
  activeTab,
  children,
  onTabChange,
}: {
  activeTab: DashboardTab
  children: ReactNode
  onTabChange: (tab: DashboardTab) => void
}) {
  const { width } = useWindowDimensions()
  const [notificationsVisible, setNotificationsVisible] = useState(false)
  const isWide = width >= 720
  const showsNotifications = activeTab !== 'home'

  return (
    <SafeAreaView style={styles.screen}>
      {showsNotifications ? (
        <Pressable
          accessibilityLabel="Open notifications"
          accessibilityRole="button"
          onPress={() => setNotificationsVisible(true)}
          style={({ pressed }) => [styles.notificationButton, pressed ? styles.pressed : null]}
        >
          <Bell color={colors.text} size={20} strokeWidth={2.25} />
          {notificationItems.some((item) => item.unread) ? <View style={styles.notificationUnreadDot} /> : null}
        </Pressable>
      ) : null}

      <ScrollView
        style={styles.pageViewport}
        contentContainerStyle={[styles.pageScroll, activeTab === 'home' ? styles.pageScrollHome : null, isWide ? styles.pageScrollWide : null]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>

      <BottomTabBar activeTab={activeTab} isWide={isWide} onTabChange={onTabChange} />
      <NotificationInboxModal
        notifications={notificationItems}
        visible={showsNotifications && notificationsVisible}
        onClose={() => setNotificationsVisible(false)}
      />
    </SafeAreaView>
  )
}

function NotificationInboxModal({
  notifications,
  onClose,
  visible,
}: {
  notifications: NotificationItem[]
  onClose: () => void
  visible: boolean
}) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visible}>
      <SafeAreaView style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <View style={styles.modalTitleGroup}>
            <Text style={styles.modalTitle}>Notifications</Text>
            <Text style={styles.itemMeta}>Data requests, consent, and reward progress</Text>
          </View>
          <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={onClose} style={styles.iconButton}>
            <X color={colors.text} size={20} strokeWidth={2.2} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.notificationList} showsVerticalScrollIndicator={false}>
          {notifications.map((item) => (
            <View key={item.id} style={styles.notificationItem}>
              <View style={[styles.notificationMarker, item.unread ? styles.notificationMarkerUnread : null]} />
              <View style={styles.notificationCopy}>
                <View style={styles.notificationTitleRow}>
                  <Text style={styles.notificationTitle}>{item.title}</Text>
                  <Text style={styles.notificationTime}>{item.time}</Text>
                </View>
                <Text style={styles.notificationDetail}>{item.detail}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

function BottomTabBar({
  activeTab,
  isWide,
  onTabChange,
}: {
  activeTab: DashboardTab
  isWide: boolean
  onTabChange: (tab: DashboardTab) => void
}) {
  return (
    <View style={styles.bottomNavShell}>
      <View style={[styles.bottomTabBar, isWide ? styles.bottomTabBarWide : null]}>
        {navItems.map((item) => (
          <BottomTabButton
            key={item.id}
            active={activeTab === item.id}
            icon={item.icon}
            label={item.label}
            onPress={() => onTabChange(item.id)}
          />
        ))}
      </View>
    </View>
  )
}

function BottomTabButton({
  active,
  icon: Icon,
  label,
  onPress,
}: {
  active: boolean
  icon: LucideIcon
  label: string
  onPress: () => void
}) {
  const foreground = active ? colors.primary : colors.muted

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.bottomTabButton, active ? styles.bottomTabButtonActive : null, pressed ? styles.pressed : null]}
    >
      <View style={[styles.bottomTabIcon, active ? styles.bottomTabIconActive : null]}>
        <Icon color={foreground} size={21} strokeWidth={2.25} />
      </View>
      <Text numberOfLines={1} style={[styles.bottomTabLabel, { color: foreground }]}>
        {label}
      </Text>
    </Pressable>
  )
}

function HomePage() {
  const [appleHealthSnapshot, setAppleHealthSnapshot] = useState<AppleHealthSnapshot | null>(null)
  const [hasRequestedHealthSync, setHasRequestedHealthSync] = useState(false)
  const [healthMessage, setHealthMessage] = useState<string | null>(null)
  const [healthSyncStatus, setHealthSyncStatus] = useState<AppleHealthSyncStatus>('idle')
  const [isWebHealthNoticeVisible, setIsWebHealthNoticeVisible] = useState(Platform.OS === 'web')
  const isWebHealthDemo = Platform.OS === 'web'
  const isAppleHealthConnected = appleHealthSnapshot !== null
  const shouldShowHealthData = hasRequestedHealthSync && (healthSyncStatus !== 'syncing' || isAppleHealthConnected)
  const appleHealthMetrics = appleHealthSnapshot
    ? getAppleHealthMetrics(appleHealthSnapshot)
    : shouldShowHealthData
      ? appleHealthFallbackMetrics
      : []
  const healthProfile = getHealthProfile(appleHealthSnapshot, shouldShowHealthData)
  const activitySteps = appleHealthSnapshot?.steps ?? (shouldShowHealthData ? 8426 : 0)

  const syncAppleHealth = useCallback(async () => {
    setIsWebHealthNoticeVisible(false)
    setHasRequestedHealthSync(true)
    setHealthMessage(null)
    setHealthSyncStatus('syncing')

    if (isWebHealthDemo) {
      setAppleHealthSnapshot(null)
      setHealthMessage('Web demo mode: example healthcare data is loaded because browser apps cannot read Apple Health.')
      setHealthSyncStatus('unsupported')
      return
    }

    const result = await fetchAppleHealthSnapshot()

    if (result.status === 'success') {
      setAppleHealthSnapshot(result.snapshot)
      setHealthSyncStatus('connected')
      return
    }

    if (result.status === 'unsupported') {
      setAppleHealthSnapshot(null)
      setHealthMessage(getAppleHealthSupportMessage(result.reason))
      setHealthSyncStatus('unsupported')
      return
    }

    setHealthMessage(result.error)
    setHealthSyncStatus('error')
  }, [isWebHealthDemo])

  return (
    <View style={styles.homePage}>
      <Card style={[styles.appleHealthCard, isAppleHealthConnected ? styles.appleHealthCardConnected : null]}>
        <CardContent style={styles.appleHealthContent}>
          <View style={styles.appleHealthHeader}>
            <View style={styles.profileHeaderRow}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>{healthProfile.initial}</Text>
              </View>
              <View style={styles.profileCopy}>
                <View style={styles.profileNameRow}>
                  <Text numberOfLines={1} style={styles.profileName}>{healthProfile.name}</Text>
                  <Button
                    icon={RefreshCw}
                    disabled={healthSyncStatus === 'syncing'}
                    label={healthSyncStatus === 'syncing' ? 'Syncing' : 'Refresh'}
                    onPress={syncAppleHealth}
                    size="sm"
                    variant="secondary"
                  />
                </View>
                <Text numberOfLines={1} style={styles.profileMeta}>
                  Height {healthProfile.heightLabel} · Weight {healthProfile.weightLabel}
                </Text>
                <Text numberOfLines={1} style={styles.profileStatus}>
                  {getAppleHealthHeaderMessage({
                    healthMessage,
                    hasRequestedSync: hasRequestedHealthSync,
                    isConnected: isAppleHealthConnected,
                    snapshot: appleHealthSnapshot,
                    status: healthSyncStatus,
                  })}
                </Text>
              </View>
            </View>
          </View>

          {shouldShowHealthData ? (
            <>
              <View style={styles.homeMetricGrid}>
                {appleHealthMetrics.map((metric) => (
                  <HomeMetricCard key={metric.label} metric={metric} />
                ))}
              </View>

              <ActivityGraph steps={activitySteps} syncedAt={appleHealthSnapshot?.syncedAt} />
              <SleepCycleGraph sleep={appleHealthSnapshot?.sleep} />
            </>
          ) : (
            <View style={styles.healthEmptyState}>
              <Text style={styles.healthEmptyTitle}>Waiting for health data</Text>
              <Text style={styles.healthEmptyText}>No health data to display yet.</Text>
            </View>
          )}
        </CardContent>
      </Card>

      <Modal
        animationType="fade"
        onRequestClose={() => setIsWebHealthNoticeVisible(false)}
        transparent
        visible={isWebHealthNoticeVisible}
      >
        <View style={styles.webHealthNoticeBackdrop}>
          <View style={styles.webHealthNoticeCard}>
            <View style={styles.webHealthNoticeIcon}>
              <HeartPulse color={colors.primary} size={24} strokeWidth={2.3} />
            </View>
            <Text style={styles.webHealthNoticeTitle}>Web Demo Health Data</Text>
            <Text style={styles.webHealthNoticeText}>
              This browser demo cannot read Apple Health directly. Tap Refresh to load example healthcare data for the demo flow.
            </Text>
            <View style={styles.webHealthNoticeActions}>
              <Button label="Close" onPress={() => setIsWebHealthNoticeVisible(false)} size="md" variant="secondary" />
              <Button icon={RefreshCw} label="Refresh" onPress={syncAppleHealth} size="md" />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function RewardSummaryCard({ metric, walletAddress }: { metric: HomeMetric; walletAddress?: string }) {
  const Icon = metric.icon
  const compactWalletAddress = walletAddress ? formatCompactWalletAddress(walletAddress) : null

  return (
    <Card>
      <CardContent style={styles.rewardSummaryContent}>
        <View style={styles.rewardSummaryIcon}>
          <Icon color={colors.primary} size={22} strokeWidth={2.25} />
        </View>
        <View style={styles.rewardSummaryCopy}>
          <Text style={styles.metricLabel}>{metric.label}</Text>
          <Text numberOfLines={1} style={styles.measurementDetail}>{metric.detail}</Text>
          {compactWalletAddress ? (
            <Text accessibilityLabel={`My wallet address ${walletAddress}`} numberOfLines={1} style={styles.rewardSummaryWalletText}>
              My wallet {compactWalletAddress}
            </Text>
          ) : null}
        </View>
        <View style={styles.rewardSummaryValueRow}>
          <Text style={styles.rewardSummaryValue}>{metric.value}</Text>
          <Text style={styles.rewardSummaryUnit}>{metric.unit}</Text>
        </View>
      </CardContent>
    </Card>
  )
}

function ActivityGraph({ steps, syncedAt }: { steps: number; syncedAt?: Date }) {
  const graphValues = createActivityGraphValues(steps)
  const activityDetail = syncedAt ? `${formatClock(syncedAt)} synced` : 'Today Step count'

  return (
    <View style={styles.sleepCyclePanel}>
      <View style={styles.sleepCycleHeader}>
        <View style={styles.sleepSummaryValueBlock}>
          <Text style={styles.metricLabel}>Activity</Text>
          <View style={styles.sleepSummaryValueRow}>
            <Text style={styles.sleepSummaryValue}>{steps.toLocaleString('en-US')}</Text>
            <Text style={styles.homeMetricUnit}>steps</Text>
          </View>
        </View>
        <View style={styles.sleepSummaryCopy}>
          <Text numberOfLines={1} style={styles.measurementDetail}>{activityDetail}</Text>
          <Text numberOfLines={1} style={styles.measurementDetail}>Based on a daily goal of 10,000 steps</Text>
        </View>
      </View>

      <View style={styles.sleepCycleTrack}>
        {graphValues.map((value, index) => (
          <View key={`${index}-${value}`} style={styles.activityGraphSlot}>
            <View style={[styles.activityGraphBar, { height: `${Math.max(18, Math.min(100, value))}%` }]} />
          </View>
        ))}
      </View>

      <View style={styles.sleepCycleTimeRow}>
        {['06', '09', '12', '15', '18', '21', '24'].map((time) => (
          <Text key={time} style={styles.sleepCycleTime}>{time}</Text>
        ))}
      </View>

      <View style={styles.sleepCycleLegend}>
        <SleepCycleLegend color={colors.primary} label="Steps" />
        <SleepCycleLegend color="#d8e0e8" label="Goal" />
      </View>
    </View>
  )
}

function SleepCycleGraph({ sleep }: { sleep?: AppleHealthSnapshot['sleep'] }) {
  const sleepStart = sleep?.startDate
  const sleepEnd = sleep?.endDate
  const sleepRange = sleep ? (sleepStart && sleepEnd ? `${formatClock(sleepStart)} - ${formatClock(sleepEnd)}` : 'Sleep No data') : '23:40 - 07:02'
  const sleepHours = sleep ? formatHours(sleep.totalMinutes) : '7.2'
  const sleepDetail = sleep?.deepMinutes ? `Deep sleep ${formatHours(sleep.deepMinutes)}` : 'Sleep cycle analysis'

  return (
    <View style={styles.sleepCyclePanel}>
      <View style={styles.sleepCycleHeader}>
        <View style={styles.sleepSummaryValueBlock}>
          <Text style={styles.metricLabel}>Sleep</Text>
          <View style={styles.sleepSummaryValueRow}>
            <Text style={styles.sleepSummaryValue}>{sleepHours}</Text>
            <Text style={styles.homeMetricUnit}>hours</Text>
          </View>
        </View>
        <View style={styles.sleepSummaryCopy}>
          <Text numberOfLines={1} style={styles.measurementDetail}>{sleepRange}</Text>
          <Text numberOfLines={1} style={styles.measurementDetail}>{sleepDetail}</Text>
        </View>
      </View>

      <View style={styles.sleepCycleTrack}>
        {sleepCycleSegments.map((segment, index) => (
          <View key={`${segment.label}-${segment.time}`} style={[styles.sleepCycleSlot, { flex: segment.flex }]}>
            <View
              style={[
                styles.sleepCycleSegment,
                {
                  backgroundColor: segment.color,
                  height: segment.height,
                },
                index === 0 ? styles.sleepCycleSegmentStart : null,
                index === sleepCycleSegments.length - 1 ? styles.sleepCycleSegmentEnd : null,
              ]}
            />
          </View>
        ))}
      </View>

      <View style={styles.sleepCycleTimeRow}>
        {sleepCycleSegments.map((segment) => (
          <Text key={`${segment.time}-${segment.label}`} style={styles.sleepCycleTime}>
            {segment.time}
          </Text>
        ))}
      </View>

      <View style={styles.sleepCycleLegend}>
        <SleepCycleLegend color="#2947a9" label="Deep" />
        <SleepCycleLegend color="#7ea7f8" label="REM" />
        <SleepCycleLegend color="#bcd7ff" label="Light" />
        <SleepCycleLegend color="#f5c26f" label="Awake" />
      </View>
    </View>
  )
}

function SleepCycleLegend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.sleepCycleLegendItem}>
      <View style={[styles.sleepCycleLegendDot, { backgroundColor: color }]} />
      <Text style={styles.sleepCycleLegendText}>{label}</Text>
    </View>
  )
}

function HomeMetricCard({
  metric,
}: {
  metric: HomeMetric
}) {
  const Icon = metric.icon

  return (
    <View style={styles.homeMetricCard}>
      <View style={styles.homeMetricHeader}>
        <View style={styles.homeMetricIcon}>
          <Icon color={colors.primary} size={20} strokeWidth={2.25} />
        </View>
        <Text numberOfLines={1} style={styles.metricLabel}>{metric.label}</Text>
      </View>
      <View style={styles.homeMetricValueRow}>
        <Text style={styles.homeMetricValue}>{metric.value}</Text>
        <Text style={styles.homeMetricUnit}>{metric.unit}</Text>
      </View>
      <Progress value={metric.progress} />
      <Text numberOfLines={1} style={styles.measurementDetail}>{metric.detail}</Text>
    </View>
  )
}

function getAppleHealthMetrics(snapshot: AppleHealthSnapshot): HomeMetric[] {
  const heartRateValue = snapshot.heartRate ? `${snapshot.heartRate.bpm}` : '--'
  const restingEnergyValue = snapshot.restingEnergyKcal ? snapshot.restingEnergyKcal.toLocaleString('en-US') : '--'

  return [
    {
      detail: snapshot.heartRate ? `${formatClock(snapshot.heartRate.measuredAt)} measured` : 'No recent measurement',
      icon: HeartPulse,
      label: 'Heart rate',
      progress: clampProgress(snapshot.heartRate?.bpm ?? 0),
      unit: 'bpm',
      value: heartRateValue,
    },
    {
      detail: snapshot.restingEnergyKcal ? 'Today total' : 'No data',
      icon: Flame,
      label: 'Resting energy',
      progress: clampProgress(((snapshot.restingEnergyKcal ?? 0) / 1800) * 100),
      unit: 'kcal',
      value: restingEnergyValue,
    },
  ]
}

function getReceivedRewardMetric(records: ParticipationRecord[]): HomeMetric {
  const paidRecords = records.filter((record) => getDataProvisionLogs(record).some((entry) => entry.status === 'Reward Paid'))
  const totalReward = paidRecords.reduce((sum, record) => sum + Number(record.rewardValue), 0)

  return {
    detail: `Paid ${paidRecords.length}`,
    icon: Wallet,
    label: 'Rewards Received',
    progress: clampProgress((totalReward / 30) * 100),
    unit: 'SUI',
    value: formatCompactNumber(totalReward),
  }
}

function formatCompactWalletAddress(address: string) {
  const trimmedAddress = address.trim()

  if (trimmedAddress.length <= 18) {
    return trimmedAddress
  }

  return `${trimmedAddress.slice(0, 6)}...${trimmedAddress.slice(-4)}`
}

function getSubmissionProgressStepState(
  currentStage: ParticipantSubmissionProgressStage,
  stepIndex: number,
): 'active' | 'complete' | 'pending' {
  const activeStepIndex = submissionProgressSteps.findIndex((step) => step.stages.includes(currentStage))

  if (activeStepIndex === -1) {
    return currentStage === 'complete' ? 'complete' : 'pending'
  }

  if (stepIndex < activeStepIndex || currentStage === 'complete') return 'complete'
  if (stepIndex === activeStepIndex) return 'active'
  return 'pending'
}

function getSubmissionMemoryStage(stage: ParticipantSubmissionProgressStage) {
  if (stage === 'policy-loading') {
    return {
      artifact: 'policy_pack',
      detail: 'The user app reads the institution policy from Walrus and checks the stored hash.',
      icon: FileKey2,
      memory: 'Walrus policy memory',
      title: 'Recalling request policy',
    }
  }

  if (stage === 'security-memory-loading') {
    return {
      artifact: 'security_memory',
      detail: 'Known risk patterns from earlier submissions are loaded before verification.',
      icon: BrainCircuit,
      memory: 'Reusable Security Memory',
      title: 'Recalling learned risks',
    }
  }

  if (stage === 'pseudonymizing') {
    return {
      artifact: 'pseudonymization_plan',
      detail: 'Raw health fields are converted locally before the platform sees the payload.',
      icon: LockKeyhole,
      memory: 'Local privacy edit',
      title: 'Making data safe on device',
    }
  }

  if (stage === 'verifying' || stage === 'reverifying') {
    return {
      artifact: 'verification_receipt',
      detail: 'The Privacy Agent verifies the payload against policy memory and Security Memory.',
      icon: ShieldCheck,
      memory: 'Agent verification',
      title: stage === 'reverifying' ? 'Running the Agent again' : 'Running the Privacy Agent',
    }
  }

  if (stage === 'hardening') {
    return {
      artifact: 'security_memory_patch',
      detail: 'The Agent found a risk signal, so the app generalizes the payload and prepares a safer retry.',
      icon: BrainCircuit,
      memory: 'Learned risk update',
      title: 'Applying safer local edits',
    }
  }

  if (stage === 'verified') {
    return {
      artifact: 'receipt_hash',
      detail: 'The final payload passed the Agent check and can be encrypted.',
      icon: ShieldCheck,
      memory: 'Verified payload hash',
      title: 'Privacy check passed',
    }
  }

  if (stage === 'agent-memory-uploading' || stage === 'security-memory-updating') {
    return {
      artifact: 'receipt + manifest',
      detail: 'Walrus stores the Agent receipt, workflow manifest, and any updated Security Memory.',
      icon: DatabaseZap,
      memory: 'Walrus memWal artifacts',
      title: stage === 'security-memory-updating' ? 'Updating Security Memory' : 'Writing Agent memory',
    }
  }

  if (stage === 'encrypting') {
    return {
      artifact: 'encrypted_dataset',
      detail: 'Only the verified payload is encrypted before being uploaded.',
      icon: LockKeyhole,
      memory: 'No raw health data',
      title: 'Encrypting verified data',
    }
  }

  if (stage === 'walrus-uploading' || stage === 'tx-verifying' || stage === 'registering') {
    return {
      artifact: 'Walrus blob + Tx',
      detail: 'The encrypted dataset and references are linked to the submission record.',
      icon: DatabaseZap,
      memory: 'Durable Walrus storage',
      title: 'Publishing the verified package',
    }
  }

  if (stage === 'complete') {
    return {
      artifact: 'download-ready package',
      detail: 'The institution can download the encrypted dataset and inspect the Agent audit chain.',
      icon: CheckCircle2,
      memory: 'End-to-end audit trail',
      title: 'Submission ready',
    }
  }

  return {
    artifact: 'request scope',
    detail: 'The app is preparing the study scope before reading Walrus memory.',
    icon: ClipboardList,
    memory: 'Preparing',
    title: 'Preparing the workflow',
  }
}

function getAppleHealthHeaderMessage({
  healthMessage,
  hasRequestedSync,
  isConnected,
  snapshot,
  status,
}: {
  healthMessage: string | null
  hasRequestedSync: boolean
  isConnected: boolean
  snapshot: AppleHealthSnapshot | null
  status: AppleHealthSyncStatus
}) {
  if (status === 'syncing') return 'Checking Apple Health permissions and data.'
  if (!hasRequestedSync) return 'Health data is hidden until you refresh.'
  if (healthMessage) return healthMessage
  if (isConnected && snapshot) return `${formatClock(snapshot.syncedAt)} synced`
  return 'Fetching activity, sleep, heart rate, and resting energy.'
}

function getHealthProfile(snapshot: AppleHealthSnapshot | null, showFallback: boolean) {
  const heightCm = snapshot?.heightCm ?? (showFallback ? homeProfileFallback.heightCm : undefined)
  const weightKg = snapshot?.bodyMassKg ?? (showFallback ? homeProfileFallback.weightKg : undefined)

  return {
    heightLabel: heightCm === undefined ? '--' : `${formatCompactNumber(heightCm)}cm`,
    initial: homeProfileFallback.name.slice(0, 1).toUpperCase(),
    name: homeProfileFallback.name,
    weightLabel: weightKg === undefined ? '--' : `${formatCompactNumber(weightKg)}kg`,
  }
}

function createActivityGraphValues(steps: number) {
  const progress = clampProgress((steps / 10000) * 100)

  return [
    Math.max(16, Math.round(progress * 0.28)),
    Math.max(18, Math.round(progress * 0.46)),
    Math.max(18, Math.round(progress * 0.38)),
    Math.max(22, Math.round(progress * 0.68)),
    Math.max(20, Math.round(progress * 0.54)),
    Math.max(26, Math.round(progress * 0.9)),
    Math.max(30, progress),
  ]
}

function clampProgress(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function formatHours(minutes: number) {
  return (minutes / 60).toFixed(1)
}

function formatClock(date: Date) {
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${hours}:${minutes}`
}

function formatCompactNumber(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1)
}

function HealthPage({
  healthTodos,
  setHealthTodos,
}: {
  healthTodos: HealthTodo[]
  setHealthTodos: Dispatch<SetStateAction<HealthTodo[]>>
}) {
  const heartReadings = [72, 76, 74, 78]
  const [heartRateIndex, setHeartRateIndex] = useState(0)
  const [lastMeasuredAt, setLastMeasuredAt] = useState('Today 08:12')
  const heartRate = heartReadings[heartRateIndex]
  const healthCalendarDays: HealthCalendarDay[] = [
    {},
    { day: 1, completion: 100 },
    { day: 2, completion: 88 },
    { day: 3, missed: true },
    { day: 4, completion: 72 },
    { day: 5, completion: 94 },
    { day: 6, missed: true },
    { day: 7, completion: 86 },
    { day: 8, completion: 64 },
    { day: 9, completion: 100 },
    { day: 10, completion: 91 },
    { day: 11, completion: 52 },
    { day: 12, completion: 78 },
    { day: 13, missed: true },
    { day: 14, completion: 96 },
    { day: 15, completion: 84 },
    { day: 16, completion: 68 },
    { day: 17, completion: 100 },
    { day: 18, completion: 74 },
    { day: 19, missed: true },
    { day: 20, completion: 82 },
    { day: 21, completion: 90 },
    { day: 22, completion: 60 },
    { day: 23, completion: 76 },
    { day: 24, completion: 92 },
    { day: 25, completion: 100 },
    { day: 26, completion: 70 },
    { day: 27, missed: true },
    { day: 28, completion: 88 },
    { day: 29, completion: 80 },
    { day: 30, completion: 96 },
    {},
    {},
    {},
    {},
    {},
  ]
  const measurementCards = [
    {
      icon: Footprints,
      label: 'Step count',
      value: '8,426',
      unit: 'steps',
      detail: '1,574 steps to the 10,000-step goal',
      progress: 84,
    },
    {
      icon: Moon,
      label: 'Sleep',
      value: '7.2',
      unit: 'hours',
      detail: 'Deep sleep 2.1hours',
      progress: 90,
    },
  ]
  const nextMeasurement = () => {
    setHeartRateIndex((current) => (current + 1) % heartReadings.length)
    setLastMeasuredAt('Just measured')
    setHealthTodos((items) =>
      items.map((item) => (item.id === 'heart' ? { ...item, done: true, value: `${heartReadings[(heartRateIndex + 1) % heartReadings.length]} bpm` } : item)),
    )
  }
  const toggleHealthTodo = (todoId: string) => {
    setHealthTodos((items) =>
      items.map((item) => {
        if (item.id !== todoId) return item

        const nextDone = !item.done
        const valueByState: Record<string, { done: string; pending: string }> = {
          heart: { done: `${heartRate} bpm`, pending: 'Not yet' },
          sleep: { done: '7.2hours', pending: 'Not done' },
          steps: { done: '8,426steps', pending: 'Not done' },
          water: { done: '6 / 6cups', pending: '4 / 6cups' },
        }
        const nextValue = nextDone ? valueByState[item.id].done : valueByState[item.id].pending

        return { ...item, done: nextDone, value: nextValue }
      }),
    )
  }

  return (
    <View style={styles.section}>
      <HealthCalendar days={healthCalendarDays} />
      <HealthTodoList todos={healthTodos} onToggle={toggleHealthTodo} />

      <View style={styles.measurementGrid}>
        {measurementCards.map((metric) => (
          <MeasurementMetricCard key={metric.label} metric={metric} />
        ))}
      </View>

      <Card style={styles.heartCard}>
        <CardContent>
          <View style={styles.heartHeader}>
            <View style={styles.metricIcon}>
              <HeartPulse color={colors.danger} size={22} strokeWidth={2.25} />
            </View>
            <View style={styles.heartCopy}>
              <Text style={styles.metricLabel}>Heart rate</Text>
              <Text style={styles.heartStatus}>{lastMeasuredAt}</Text>
            </View>
            <Badge label="Ready to measure" variant="warning" />
          </View>

          <View style={styles.heartValueRow}>
            <Text style={styles.heartValue}>{heartRate}</Text>
            <Text style={styles.heartUnit}>bpm</Text>
          </View>
          <Text style={styles.measurementDetail}>Keep your finger on the sensor for 10 seconds to record the latest heart rate.</Text>
          <Button icon={RefreshCw} label="Measure heart rate" onPress={nextMeasurement} />
        </CardContent>
      </Card>

      <View style={styles.measurementTimeline}>
        <MeasurementLog label="Step count synced" value="Updated at 08:00" />
        <MeasurementLog label="Sleep analysis complete" value="Sleep efficiency 91%" />
        <MeasurementLog label="Heart rate baseline" value="Resting range" />
      </View>
    </View>
  )
}

function HealthTodoList({ onToggle, todos }: { onToggle: (todoId: string) => void; todos: HealthTodo[] }) {
  return (
    <Card>
      <CardContent>
        <View style={styles.todoHeader}>
          <Text style={styles.metricLabel}>Todo</Text>
          <Badge label={`${todos.filter((todo) => todo.done).length}/${todos.length} Done`} variant="secondary" />
        </View>
        <View style={styles.todoList}>
          {todos.map((todo) => (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: todo.done }}
              key={todo.id}
              onPress={() => onToggle(todo.id)}
              style={({ pressed }) => [styles.todoItem, !todo.done ? styles.todoItemPending : null, pressed ? styles.pressed : null]}
            >
              <View style={[styles.todoCheckbox, todo.done ? styles.todoCheckboxChecked : styles.todoCheckboxPending]}>
                {todo.done ? <Check color={colors.surface} size={14} strokeWidth={3} /> : null}
              </View>
              <View style={styles.todoCopy}>
                <Text style={styles.todoLabel}>{todo.label}</Text>
                <Text style={[styles.todoValue, !todo.done ? styles.todoValuePending : null]}>{todo.value}</Text>
              </View>
              <Text style={[styles.todoState, !todo.done ? styles.todoStatePending : null]}>{todo.done ? 'Done' : 'Not done'}</Text>
            </Pressable>
          ))}
        </View>
      </CardContent>
    </Card>
  )
}

function HealthCalendar({ days }: { days: HealthCalendarDay[] }) {
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <Card>
      <CardContent>
        <View style={styles.calendarHeader}>
          <View>
            <Text style={styles.metricLabel}>Health Calendar</Text>
            <Text style={styles.measurementDetail}>Steps, Sleep, Heart rate routine completion log</Text>
          </View>
          <Badge label="2026.06" variant="secondary" />
        </View>

        <View style={styles.calendarWeekRow}>
          {weekdays.map((weekday) => (
            <Text key={weekday} style={styles.calendarWeekday}>
              {weekday}
            </Text>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {days.map((day, index) => (
            <HealthCalendarCell key={`${day.day ?? 'blank'}-${index}`} day={day} />
          ))}
        </View>

        <View style={styles.calendarLegend}>
          <CalendarLegend color="#cdecd7" label="Recorded" />
          <CalendarLegend color="#12804a" label="On track" />
          <CalendarLegend color="#f5a742" label="Missed item" />
        </View>
      </CardContent>
    </Card>
  )
}

function HealthCalendarCell({ day }: { day: HealthCalendarDay }) {
  if (!day.day) return <View style={[styles.calendarDayCell, styles.calendarDayBlank]} />

  const tone = getCalendarTone(day)

  return (
    <View style={[styles.calendarDayCell, { backgroundColor: tone.backgroundColor }]}>
      <Text style={[styles.calendarDayText, { color: tone.color }]}>{day.day}</Text>
    </View>
  )
}

function CalendarLegend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.calendarLegendItem}>
      <View style={[styles.calendarLegendSwatch, { backgroundColor: color }]} />
      <Text style={styles.calendarLegendText}>{label}</Text>
    </View>
  )
}

function getCalendarTone(day: HealthCalendarDay) {
  if (day.missed) return { backgroundColor: '#f5a742', color: '#5f3900' }
  const completion = day.completion ?? 0

  if (completion >= 95) return { backgroundColor: '#12804a', color: colors.surface }
  if (completion >= 80) return { backgroundColor: '#2f9f61', color: colors.surface }
  if (completion >= 65) return { backgroundColor: '#82d39b', color: '#0d3f25' }
  return { backgroundColor: '#cdecd7', color: '#1d5231' }
}

function MeasurementMetricCard({
  metric,
}: {
  metric: {
    detail: string
    icon: LucideIcon
    label: string
    progress: number
    unit: string
    value: string
  }
}) {
  const Icon = metric.icon

  return (
    <Card style={styles.measurementCard}>
      <CardContent>
        <View style={styles.metricCardHeader}>
          <View style={styles.metricIcon}>
            <Icon color={colors.primary} size={22} strokeWidth={2.25} />
          </View>
          <Text style={styles.metricLabel}>{metric.label}</Text>
        </View>
        <View style={styles.metricValueRow}>
          <Text style={styles.metricValue}>{metric.value}</Text>
          <Text style={styles.metricUnit}>{metric.unit}</Text>
        </View>
        <Progress value={metric.progress} />
        <Text style={styles.measurementDetail}>{metric.detail}</Text>
      </CardContent>
    </Card>
  )
}

function MeasurementLog({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.measurementLogItem}>
      <View style={styles.measurementLogDot} />
      <View style={styles.measurementLogCopy}>
        <Text style={styles.measurementLogLabel}>{label}</Text>
        <Text style={styles.measurementLogValue}>{value}</Text>
      </View>
    </View>
  )
}

function BodyPage({ healthTodos }: { healthTodos: HealthTodo[] }) {
  const completedCount = healthTodos.filter((todo) => todo.done).length
  const bodyScore = Math.round((completedCount / healthTodos.length) * 100)
  const bodyTone = getBodyTone(bodyScore)
  const pendingTodos = healthTodos.filter((todo) => !todo.done)

  return (
    <View style={styles.section}>
      <Card style={styles.bodyHeroCard}>
        <CardContent>
          <View style={styles.bodyAvatarStage}>
            <View style={[styles.bodyAura, { backgroundColor: bodyTone.aura }]} />
            <View style={styles.bodyAvatar}>
              <View style={[styles.avatarHead, { backgroundColor: bodyTone.skin }]} />
              <View style={styles.avatarShoulderRow}>
                <View style={[styles.avatarArm, { backgroundColor: bodyTone.limb }]} />
                <View style={[styles.avatarTorso, { backgroundColor: bodyTone.body }]} />
                <View style={[styles.avatarArm, { backgroundColor: bodyTone.limb }]} />
              </View>
              <View style={styles.avatarLegRow}>
                <View style={[styles.avatarLeg, { backgroundColor: bodyTone.limb }]} />
                <View style={[styles.avatarLeg, { backgroundColor: bodyTone.limb }]} />
              </View>
            </View>
          </View>

          <View style={styles.bodyScoreBlock}>
            <Text style={styles.bodyScoreLabel}>Body Status Today</Text>
            <View style={styles.bodyScoreRow}>
              <Text style={styles.bodyScoreValue}>{bodyScore}</Text>
              <Text style={styles.bodyScoreUnit}>pts</Text>
            </View>
            <Progress value={bodyScore} />
            <Text style={styles.measurementDetail}>{bodyTone.message}</Text>
          </View>
        </CardContent>
      </Card>

      <View style={styles.bodyStatusGrid}>
        <BodyStatusCard label="Completed routines" value={`${completedCount}`} tone="green" />
        <BodyStatusCard label="Remaining routines" value={`${pendingTodos.length}`} tone={pendingTodos.length > 0 ? 'orange' : 'green'} />
      </View>

      <Card>
        <CardHeader>
          <CardTitle>Next actions to improve your body status</CardTitle>
          <CardDescription>Complete Todo items in the Health tab to improve the avatar condition.</CardDescription>
        </CardHeader>
        <CardContent>
          <View style={styles.bodyTodoList}>
            {(pendingTodos.length > 0 ? pendingTodos : healthTodos.slice(0, 2)).map((todo) => (
              <View key={todo.id} style={[styles.bodyTodoItem, todo.done ? styles.bodyTodoItemDone : null]}>
                <View style={[styles.measurementLogDot, { backgroundColor: todo.done ? '#12804a' : '#f5a742' }]} />
                <View style={styles.measurementLogCopy}>
                  <Text style={styles.measurementLogLabel}>{todo.label}</Text>
                  <Text style={styles.measurementLogValue}>{todo.done ? 'Completed' : todo.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </CardContent>
      </Card>
    </View>
  )
}

function BodyStatusCard({ label, tone, value }: { label: string; tone: 'green' | 'orange'; value: string }) {
  return (
    <View style={[styles.bodyStatusCard, tone === 'orange' ? styles.bodyStatusCardOrange : styles.bodyStatusCardGreen]}>
      <Text style={styles.bodyStatusLabel}>{label}</Text>
      <Text style={styles.bodyStatusValue}>{value}</Text>
    </View>
  )
}

function getBodyTone(score: number) {
  if (score >= 90) {
    return {
      aura: '#dff7e8',
      body: '#12804a',
      limb: '#2f9f61',
      message: 'You completed almost every routine, so your body status is excellent.',
      skin: '#f4c7a1',
    }
  }

  if (score >= 70) {
    return {
      aura: '#edf8d8',
      body: '#2f9f61',
      limb: '#82d39b',
      message: 'Good momentum. Complete the remaining routines to improve the avatar.',
      skin: '#f4c7a1',
    }
  }

  if (score >= 45) {
    return {
      aura: '#fff1d6',
      body: '#f5a742',
      limb: '#f5c26f',
      message: 'In progress. Complete missed items to improve your body status.',
      skin: '#f4c7a1',
    }
  }

  return {
    aura: '#fff1f5',
    body: '#ea6a22',
    limb: '#f5a742',
    message: 'Routines are light today. Complete one item first.',
    skin: '#f4c7a1',
  }
}

function ProjectsPage({
  joinedProjectIds,
  joinMessage,
  joiningProjectId,
  loadMessage,
  loadStatus,
  requests,
  selectedRequestId,
  onRefresh,
  onJoinProject,
}: {
  joinedProjectIds: string[]
  joinMessage: string | null
  joiningProjectId: string | null
  loadMessage: string | null
  loadStatus: 'idle' | 'loading' | 'loaded' | 'error'
  requests: ResearchRequest[]
  selectedRequestId: string
  onRefresh: () => void
  onJoinProject: (requestId: string) => void | Promise<void>
}) {
  const [categoryFilter, setCategoryFilter] = useState<RequestCategoryFilter>('all')
  const joinedProjectIdSet = new Set(joinedProjectIds)
  const availableProjects = requests.filter((request) => !joinedProjectIdSet.has(request.id))
  const categoryFilters = getCategoryFilters(availableProjects)

  return (
    <View style={styles.section}>
      <ProjectSyncStatusCard loadMessage={loadMessage} loadStatus={loadStatus} onRefresh={onRefresh} />
      {joinMessage ? (
        <Card>
          <CardContent style={styles.emptyState}>
            <Text style={styles.itemTitle}>Check the application status.</Text>
            <Text style={styles.itemMeta}>{joinMessage}</Text>
          </CardContent>
        </Card>
      ) : null}
      <FilterGroup label="Topic">
        {categoryFilters.map((filter) => (
          <FilterChip
            key={filter.id}
            active={categoryFilter === filter.id}
            count={filter.count}
            icon={ClipboardList}
            label={filter.label}
            onPress={() => setCategoryFilter(filter.id)}
          />
        ))}
      </FilterGroup>

      <ResearchList
        categoryFilter={categoryFilter}
        joiningProjectId={joiningProjectId}
        requests={availableProjects}
        selectedRequestId={selectedRequestId}
        onSelectRequest={onJoinProject}
      />
    </View>
  )
}

function ProjectSyncStatusCard({
  loadMessage,
  loadStatus,
  onRefresh,
}: {
  loadMessage: string | null
  loadStatus: 'idle' | 'loading' | 'loaded' | 'error'
  onRefresh: () => void
}) {
  if (loadStatus !== 'loading' && loadStatus !== 'error') {
    return null
  }

  return (
    <Card>
      <CardContent style={styles.emptyState}>
        <Text style={styles.itemTitle}>{loadStatus === 'loading' ? 'Loading recruiting projects.' : 'Check the Supabase connection.'}</Text>
        <Text style={styles.itemMeta}>
          {loadStatus === 'loading' ? 'Syncing recruiting studies from the institution dashboard.' : loadMessage ?? 'Showing existing sample studies.'}
        </Text>
        {loadStatus === 'error' ? <Button icon={RefreshCw} label="Reload" onPress={onRefresh} size="sm" variant="secondary" /> : null}
      </CardContent>
    </Card>
  )
}

function MyProjectsPage({
  activeUserId,
  applicationLoadMessage,
  applicationLoadStatus,
  requests,
  selectedRequestId,
  userApplications,
  onSelectRequest,
}: {
  activeUserId: string
  applicationLoadMessage: string | null
  applicationLoadStatus: 'idle' | 'loading' | 'loaded' | 'error'
  requests: ResearchRequest[]
  selectedRequestId: string
  userApplications: UserResearchApplication[]
  onSelectRequest: (requestId: string) => void
}) {
  const records = getJoinedProjectRecords(userApplications, requests)
  const rewardMetric = getReceivedRewardMetric(records)

  return (
    <View style={styles.section}>
      <RewardSummaryCard metric={rewardMetric} walletAddress={activeUserId} />
      {applicationLoadStatus === 'loading' || applicationLoadStatus === 'error' ? (
        <Card>
          <CardContent style={styles.emptyState}>
            <Text style={styles.itemTitle}>
              {applicationLoadStatus === 'loading' ? 'Loading My Projects.' : 'My Projects needs to sync.'}
            </Text>
            <Text style={styles.itemMeta}>
              {applicationLoadStatus === 'loading'
                ? 'Checking application and approval status in Supabase.'
                : applicationLoadMessage ?? 'Could not load the application list.'}
            </Text>
          </CardContent>
        </Card>
      ) : null}
      <ParticipationList
        activeUserId={activeUserId}
        records={records}
        selectedRequestId={selectedRequestId}
        onSelectRequest={onSelectRequest}
      />
    </View>
  )
}

function getCategoryFilters(source: ResearchRequest[]) {
  return [
    { id: 'all' as const, label: 'All', count: source.length },
    {
      id: 'insurance' as const,
      label: 'Insurance Rewards',
      count: source.filter((request) => request.category === 'insurance').length,
    },
    {
      id: 'coaching' as const,
      label: 'Health Coaching',
      count: source.filter((request) => request.category === 'coaching').length,
    },
    {
      id: 'care' as const,
      label: 'Clinical Monitoring',
      count: source.filter((request) => request.category === 'care').length,
    },
    {
      id: 'wellness' as const,
      label: 'Corporate Wellness',
      count: source.filter((request) => request.category === 'wellness').length,
    },
  ]
}

function getJoinedProjectRecords(userApplications: UserResearchApplication[], requests: ResearchRequest[]) {
  const currentRecordById = new Map(participationRecords.map((record) => [record.id, record]))
  const requestById = new Map(requests.map((request) => [request.id, request]))

  return userApplications
    .map((application) => {
      const request = requestById.get(application.projectId)

      if (!request) {
        return null
      }

      const baseRecord = currentRecordById.get(request.id) ?? createParticipationRecord(request)
      return applyApplicationStateToRecord(baseRecord, application)
    })
    .filter((record): record is ParticipationRecord => Boolean(record))
}

function createParticipationRecord(request: ResearchRequest): ParticipationRecord {
  return {
    ...request,
    accessStatus: 'Project access requested',
    consentDate: 'Today',
    consentStatus: 'Applications Done',
    progressValue: 24,
    rewardStatus: 'Requirements Pending',
  }
}

function applyApplicationStateToRecord(record: ParticipationRecord, application: UserResearchApplication): ParticipationRecord {
  if (application.status === 'approved') {
    return {
      ...record,
      accessStatus: application.dataSentBytes > 0 ? 'Data submitted' : 'Consent pending',
      consentDate: formatApplicationDate(application.lastSubmissionAt),
      consentStatus: 'Participation approved',
      progressValue: application.dataSentBytes > 0 ? 64 : 48,
      rewardStatus: application.dataSentBytes > 0 ? 'Pending Settlement' : 'Requirements Pending',
    }
  }

  return {
    ...record,
    accessStatus: 'Institution approval pending',
    consentDate: 'Today',
    consentStatus: 'Applications Done',
    progressValue: 24,
    rewardStatus: 'Requirements Pending',
  }
}

function upsertUserApplication(currentApplications: UserResearchApplication[], nextApplication: UserResearchApplication) {
  const exists = currentApplications.some((application) => application.projectId === nextApplication.projectId)

  if (!exists) {
    return [nextApplication, ...currentApplications]
  }

  return currentApplications.map((application) =>
    application.projectId === nextApplication.projectId ? { ...application, ...nextApplication } : application,
  )
}

function formatApplicationDate(value: string | null) {
  if (!value) {
    return 'Today'
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

function isApplicationPendingReview(record: ParticipationRecord) {
  return record.consentStatus === 'Applications Done' || record.accessStatus === 'Institution approval pending'
}

function ConnectedAppsSection() {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionHeaderCopy}>
          <Text style={styles.sectionHeading}>Healthcare app integrations</Text>
        </View>
      </View>

      <View style={styles.connectedAppGrid}>
        {connectedHealthApps.map((app) => (
          <ConnectedAppCard app={app} key={app.id} />
        ))}
      </View>

    </View>
  )
}

function ConnectedAppCard({ app }: { app: ConnectedHealthApp }) {
  const Icon = app.icon
  const isConnected = app.status === 'Connected'
  const needsReview = app.status === 'Needs Review'

  return (
    <Card style={[styles.connectedAppCard, isConnected ? styles.connectedAppCardActive : null]}>
      <CardContent style={styles.connectedAppContent}>
        <View style={styles.connectedAppHeader}>
          <View style={styles.connectedAppTitleRow}>
            <View style={[styles.connectedAppIcon, needsReview ? styles.connectedAppIconWarning : null]}>
              <Icon color={needsReview ? colors.accentText : colors.primary} size={21} strokeWidth={2.2} />
            </View>
            <View style={styles.connectedAppTitleCopy}>
              <Text style={styles.itemTitle}>{app.name}</Text>
              <Text style={styles.itemMeta}>{app.description}</Text>
            </View>
          </View>
          <Badge label={app.status} variant={isConnected ? 'success' : needsReview ? 'warning' : 'secondary'} />
        </View>

        <View style={styles.connectedAppActionRow}>
          <View style={styles.connectedAppBadgeGroup}>
            {app.dataTypes.map((type) => (
              <Badge key={type} label={type} variant="outline" />
            ))}
          </View>
          <Button
            label={isConnected ? 'Manage' : 'Connect'}
            onPress={() => undefined}
            size="sm"
            trailingIcon={ChevronRight}
            variant={isConnected ? 'outline' : 'secondary'}
          />
        </View>
      </CardContent>
    </Card>
  )
}

function ResearchList({
  categoryFilter,
  joiningProjectId,
  requests,
  selectedRequestId,
  onSelectRequest,
}: {
  categoryFilter: RequestCategoryFilter
  joiningProjectId: string | null
  requests: ResearchRequest[]
  selectedRequestId: string
  onSelectRequest: (requestId: string) => void | Promise<void>
}) {
  const [detailRequest, setDetailRequest] = useState<ResearchRequest | null>(null)
  const filteredRequests =
    categoryFilter === 'all' ? requests : requests.filter((request) => request.category === categoryFilter)

  return (
    <View style={styles.section}>
      {filteredRequests.length > 0 ? (
        <View style={styles.cardList}>
          {filteredRequests.map((request) => (
            <ResearchCard
              key={request.id}
              request={request}
              selected={selectedRequestId === request.id}
              onOpen={() => setDetailRequest(request)}
            />
          ))}
        </View>
      ) : (
        <Card>
          <CardContent style={styles.emptyState}>
            <Text style={styles.itemTitle}>No available studies to join.</Text>
            <Text style={styles.itemMeta}>Joined studies are available in the My Projects tab.</Text>
          </CardContent>
        </Card>
      )}

      <ResearchDetailModal
        joiningProjectId={joiningProjectId}
        request={detailRequest}
        onClose={() => setDetailRequest(null)}
        onSelectRequest={(requestId) => {
          setDetailRequest(null)
          void onSelectRequest(requestId)
        }}
      />
    </View>
  )
}

function ResearchCard({
  onOpen,
  request,
  selected,
}: {
  onOpen: () => void
  request: ResearchRequest
  selected: boolean
}) {
  return (
    <Pressable
      accessibilityLabel={`${request.title} View Details`}
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => (pressed ? styles.pressed : null)}
    >
      <Card style={selected ? styles.selectedCard : null}>
        <CardContent style={styles.serviceCardContent}>
          <View style={styles.serviceCardHeader}>
            <View style={styles.serviceCardCopy}>
              <Text style={styles.itemTitle}>{request.title}</Text>
              <Text style={styles.serviceOrganization}>Purpose: {getProjectPurposeSummary(request)}</Text>
              <Text style={styles.itemMeta}>Institution: {request.organization}</Text>
            </View>
          </View>

          <View style={styles.serviceRewardRow}>
            <View style={styles.serviceRewardCopy}>
              <Text style={styles.tinyMuted}>Reward</Text>
              <Text style={styles.rewardText}>{request.reward}</Text>
            </View>
            <View style={styles.detailPill}>
              <Text style={styles.detailPillText}>View Details</Text>
              <ChevronRight color={colors.text} size={15} strokeWidth={2.25} />
            </View>
          </View>
        </CardContent>
      </Card>
    </Pressable>
  )
}

function ResearchDetailModal({
  joiningProjectId,
  onClose,
  onSelectRequest,
  request,
}: {
  joiningProjectId: string | null
  onClose: () => void
  onSelectRequest: (requestId: string) => void | Promise<void>
  request: ResearchRequest | null
}) {
  if (!request) return null

  const requiredData = getReadableRequiredData(request)
  const isJoining = joiningProjectId === request.id

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible>
      <SafeAreaView style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <View style={styles.modalTitleGroup}>
            <Text style={styles.modalTitle}>{request.title}</Text>
            <Text style={styles.itemMeta}>Institution: {request.organization}</Text>
          </View>
          <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={onClose} style={styles.iconButton}>
            <X color={colors.text} size={20} strokeWidth={2.2} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.calloutSoft}>
            <Text style={styles.calloutTitle}>Study Purpose</Text>
            <Text style={styles.calloutText}>{getProjectPurposeDetail(request)}</Text>
          </View>

          <Text style={styles.sectionHeading}>Required Data</Text>
          <View style={styles.requiredDataList}>
            {requiredData.map((item) => (
              <View key={item.label} style={styles.requiredDataRow}>
                <Text style={styles.requiredDataLabel}>{item.label}</Text>
                <Text style={styles.requiredDataValue}>{item.value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.infoGrid}>
            <InfoRow label="Allowed Use" value={formatAllowedUse(request.allowedUse)} />
            <InfoRow label="Access Deadline" value={request.expiresAt} />
            <InfoRow label="Reward" value={request.reward} />
            <InfoRow label="Recruitment" value={request.participants} />
          </View>
        </ScrollView>
        <View style={styles.modalFooter}>
          <Button label="Close" onPress={onClose} variant="secondary" />
          <Button disabled={isJoining} label={isJoining ? 'Applying' : 'Join Study'} onPress={() => onSelectRequest(request.id)} />
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const readableConditionLabels: Record<string, string> = {
  active_energy: 'Active energy',
  blood_glucose: 'Glucose',
  blood_pressure: 'Blood pressure',
  distance_walking_running: 'Walking/running distance',
  exercise_minutes: 'Exercise minutes',
  glucose_range: 'Glucose range',
  heart_rate: 'Heart rate',
  hrv_sdnn: 'Heart rate variability',
  insulin_delivery: 'Insulin delivery records',
  metabolic_pattern: 'Metabolic pattern',
  mindful_minutes: 'Mindfulness minutes',
  oxygen_saturation: 'Blood oxygen level',
  respiratory_rate: 'Respiratory rate',
  resting_heart_rate: 'Resting heart rate',
  sleep_analysis: 'Sleep record',
  sleep_consistency: 'Sleep consistency',
  sleep_duration: 'Total sleep duration',
  sleep_stage_band: 'Sleep stages such as deep and light sleep',
  stand_time: 'Stand time',
  step_count: 'Step count',
  vo2_max: 'Cardio fitness',
  workout_summary: 'Workout summary',
}

const allowedUseLabels: Record<string, string> = {
  aggregate_research: 'Aggregate cohort research analysis',
  personalized_coaching: 'Personalized health coaching improvement',
  remote_monitoring: 'Remote health monitoring improvement',
  reward_validation: 'Reward eligibility validation',
}

const projectPurposeSummaries: Record<string, string> = {
  'REQ-SUI-1029': 'Develop more accurate wearable reward criteria from activity records',
  'REQ-SUI-1034': 'Improve recovery coaching with sleep and mindfulness patterns',
  'REQ-SUI-1041': 'Develop monitoring features that detect recovery changes from cardiovascular signals',
  'REQ-SUI-1058': 'Develop metabolic health management features using glucose and insulin patterns',
}

const projectPurposeDetails: Record<string, string> = {
  'REQ-SUI-1029':
    'Steps, exercise minutes, active energy, and cardio fitness help estimate sustained activity. This study uses that data to make wearable reward criteria fairer and more accurate.',
  'REQ-SUI-1034':
    'Sleep duration, sleep stages, and mindfulness minutes help explain recovery changes. This data supports more personalized sleep coaching and wearable recovery features.',
  'REQ-SUI-1041':
    'Heart rate, HRV, oxygen saturation, blood pressure, and respiratory rate show whether the body is recovering or under strain. This study improves wearable monitoring for earlier recovery signals outside the hospital.',
  'REQ-SUI-1058':
    'Glucose and insulin patterns help explain metabolic changes across meals, activity, and sleep. This study uses summarized data, not raw readings, to improve metabolic health management.',
}

function getProjectPurposeSummary(request: ResearchRequest) {
  return projectPurposeSummaries[request.id] ?? `${request.purposeLabel} feature improvement`
}

function getProjectPurposeDetail(request: ResearchRequest) {
  return projectPurposeDetails[request.id] ?? `${request.purposeLabel} study uses required health data patterns to improve related product features.`
}

function getReadableRequiredData(request: ResearchRequest) {
  return [
    {
      label: 'Age Range',
      value: request.requiredAgeRanges.map(formatAgeRange).join(', '),
    },
    {
      label: 'Health Records',
      value: request.requiredConditionTags.map(formatConditionTag).join(', '),
    },
    {
      label: 'Region',
      value: 'State/province-level region only',
    },
    {
      label: 'Record Period',
      value: 'month-level period',
    },
  ]
}

function formatAgeRange(range: string) {
  const startAge = Number(range.split('-')[0])
  if (Number.isNaN(startAge)) return range

  return `${startAge}s`
}

function formatConditionTag(tag: string) {
  return readableConditionLabels[tag] ?? tag.replaceAll('_', ' ')
}

function formatAllowedUse(allowedUse: string) {
  return allowedUseLabels[allowedUse] ?? allowedUse
}

function ParticipationList({
  activeUserId,
  records,
  selectedRequestId,
  onSelectRequest,
}: {
  activeUserId: string
  records: ParticipationRecord[]
  selectedRequestId: string
  onSelectRequest: (requestId: string) => void
}) {
  const [detailRecord, setDetailRecord] = useState<ParticipationRecord | null>(null)

  return (
    <View style={styles.section}>
      {records.length > 0 ? (
        <View style={styles.cardList}>
          {records.map((record) => (
            <ParticipationCard
              key={record.id}
              record={record}
              selected={selectedRequestId === record.id}
              onOpen={() => {
                onSelectRequest(record.id)
                setDetailRecord(record)
              }}
            />
          ))}
        </View>
      ) : (
        <Card>
          <CardContent style={styles.emptyState}>
            <Text style={styles.itemTitle}>No joined studies yet.</Text>
            <Text style={styles.itemMeta}>Join a study from the Projects tab to see it here.</Text>
          </CardContent>
        </Card>
      )}

      <ParticipationDetailModal activeUserId={activeUserId} record={detailRecord} onClose={() => setDetailRecord(null)} />
    </View>
  )
}

function ParticipationCard({
  onOpen,
  record,
  selected,
}: {
  onOpen: () => void
  record: ParticipationRecord
  selected: boolean
}) {
  const latestLog = getDataProvisionLogs(record)[0]
  const isPendingReview = isApplicationPendingReview(record)

  return (
    <Pressable
      accessibilityLabel={`${record.title} View Details`}
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => (pressed ? styles.pressed : null)}
    >
      <Card style={[selected ? styles.selectedCard : null, isPendingReview ? styles.reviewPendingCard : null]}>
        <CardContent style={styles.serviceCardContent}>
          <View style={styles.serviceCardHeader}>
            <View style={styles.serviceCardCopy}>
              <Text style={styles.itemTitle}>{record.title}</Text>
              <Text style={styles.serviceOrganization}>Purpose: {getProjectPurposeSummary(record)}</Text>
              <Text style={styles.itemMeta}>Institution: {record.organization}</Text>
            </View>
          </View>

          <View style={[styles.serviceRewardRow, isPendingReview ? styles.serviceRewardRowReviewPending : null]}>
            <View style={styles.serviceRewardCopy}>
            <Text style={styles.tinyMuted}>Recent Activity</Text>
              <Text style={styles.serviceDetailValue}>{latestLog ? `${latestLog.date} · ${latestLog.status}` : 'No sharing history'}</Text>
            </View>
            <View style={styles.detailPill}>
              <Text style={styles.detailPillText}>View Details</Text>
              <ChevronRight color={colors.text} size={15} strokeWidth={2.25} />
            </View>
          </View>
        </CardContent>
      </Card>
    </Pressable>
  )
}

function ParticipationDetailModal({
  activeUserId,
  onClose,
  record,
}: {
  activeUserId: string
  onClose: () => void
  record: ParticipationRecord | null
}) {
  const provisionLogs = record ? getDataProvisionLogs(record) : []
  const defaultLogId = provisionLogs[0]?.id ?? null
  const [expandedLogId, setExpandedLogId] = useState<string | null>(defaultLogId)
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(null)
  const [submissionProgress, setSubmissionProgress] = useState<ParticipantSubmissionProgress>(defaultSubmissionProgress)
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>('idle')
  const [isSubmissionConfirmOpen, setIsSubmissionConfirmOpen] = useState(false)

  useEffect(() => {
    setExpandedLogId(defaultLogId)
  }, [defaultLogId])

  if (!record) return null

  const requiredData = getReadableRequiredData(record)
  const isPendingReview = isApplicationPendingReview(record)
  const isSubmissionLoading = submissionStatus === 'submitting'
  const submissionLoadingProgress = Math.round(submissionProgress.progress)
  const submitAdditionalData = async () => {
    setSubmissionMessage(null)
    setIsSubmissionConfirmOpen(false)
    setSubmissionProgress(defaultSubmissionProgress)
    setSubmissionStatus('submitting')

    try {
      const submissionResult = await submitParticipantData({
        loginId: activeUserId,
        onProgress: setSubmissionProgress,
        request: record,
      })
      const txLabel = submissionResult.walrusTxDigest
        ? `Tx ${formatCompactWalletAddress(submissionResult.walrusTxDigest)}`
        : `Blob ${formatCompactWalletAddress(submissionResult.walrusBlobId)}`
      setSubmissionStatus('submitted')
      setSubmissionMessage(`User-app pseudonymization, Privacy Agent verification, platform_encryption_v1, and Walrus upload are complete. ${txLabel}`)
    } catch (error) {
      setSubmissionStatus('error')
      setSubmissionMessage(error instanceof Error ? error.message : 'Data submission failed.')
    }
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible>
      <SafeAreaView style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <View style={styles.modalTitleGroup}>
            <Text style={styles.modalTitle}>{record.title}</Text>
            <Text style={styles.itemMeta}>Institution: {record.organization}</Text>
          </View>
          <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={onClose} style={styles.iconButton}>
            <X color={colors.text} size={20} strokeWidth={2.2} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.calloutSoft}>
            <Text style={styles.calloutTitle}>Study Purpose</Text>
            <Text style={styles.calloutText}>{getProjectPurposeDetail(record)}</Text>
          </View>

          <Text style={styles.sectionHeading}>Required Data</Text>
          <View style={styles.requiredDataList}>
            {requiredData.map((item) => (
              <View key={item.label} style={styles.requiredDataRow}>
                <Text style={styles.requiredDataLabel}>{item.label}</Text>
                <Text style={styles.requiredDataValue}>{item.value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.infoGrid}>
            <InfoRow label="Allowed Use" value={formatAllowedUse(record.allowedUse)} />
            <InfoRow label="Access Deadline" value={record.expiresAt} />
            <InfoRow label="Reward" value={record.reward} />
            <InfoRow label="Recruitment" value={record.participants} />
          </View>

          <View style={styles.accessLogSection}>
            <Text style={styles.sectionHeading}>Data Sharing History</Text>
            <Text style={styles.sectionLead}>Open a sharing date to see submitted data and management status.</Text>
            <View style={styles.accessLogList}>
              {provisionLogs.map((entry) => (
                <DataProvisionLogItem
                  key={entry.id}
                  entry={entry}
                  expanded={expandedLogId === entry.id}
                  onToggle={() => setExpandedLogId(expandedLogId === entry.id ? null : entry.id)}
                />
              ))}
            </View>
            <View style={styles.accessLogActionRow}>
              <Button
                disabled={isPendingReview || submissionStatus === 'submitting'}
                icon={UploadCloud}
                label={isPendingReview ? 'Waiting for Approval' : submissionStatus === 'submitting' ? 'Submitting' : 'Submit Data'}
                onPress={() => setIsSubmissionConfirmOpen(true)}
                size="lg"
              />
            </View>
            {submissionMessage ? (
              <Text style={[styles.sectionLead, submissionStatus === 'error' ? styles.errorText : styles.successText]}>
                {submissionMessage}
              </Text>
            ) : null}
          </View>
        </ScrollView>
        <Modal
          animationType="fade"
          onRequestClose={() => {
            if (!isSubmissionLoading) setIsSubmissionConfirmOpen(false)
          }}
          transparent
          visible={isSubmissionConfirmOpen}
        >
          <View style={styles.confirmModalBackdrop}>
            <View style={styles.confirmModalCard}>
              <View style={styles.confirmModalHeader}>
                <View style={styles.modalTitleGroup}>
                  <Text style={styles.confirmModalTitle}>Submit Data</Text>
                  <Text style={styles.itemMeta}>{record.title}</Text>
                </View>
                <Pressable
                  accessibilityLabel="Close"
                  accessibilityRole="button"
                  disabled={isSubmissionLoading}
                  onPress={() => setIsSubmissionConfirmOpen(false)}
                  style={styles.iconButton}
                >
                  <X color={colors.text} size={20} strokeWidth={2.2} />
                </Pressable>
              </View>

              <ScrollView
                contentContainerStyle={styles.confirmModalBody}
                showsVerticalScrollIndicator={false}
                style={styles.confirmModalScroll}
              >
                <Text style={styles.sectionLead}>The user app pseudonymizes the requested fields, passes Privacy Agent verification, wraps the dataset with platform_encryption_v1, then submits it to Walrus.</Text>
                <PrivacyAgentMemoryPreview />
                <View style={styles.requiredDataList}>
                  {requiredData.map((item) => (
                    <View key={item.label} style={styles.requiredDataRow}>
                      <Text style={styles.requiredDataLabel}>{item.label}</Text>
                      <Text style={styles.requiredDataValue}>{item.value}</Text>
                    </View>
                  ))}
                </View>
                {submissionStatus === 'error' && submissionMessage ? (
                  <Text style={[styles.sectionLead, styles.errorText]}>{submissionMessage}</Text>
                ) : null}
              </ScrollView>

              <View style={styles.confirmModalFooter}>
                <Button
                  disabled={isSubmissionLoading}
                  label="Close"
                  onPress={() => setIsSubmissionConfirmOpen(false)}
                  variant="secondary"
                />
                <Button
                  disabled={isSubmissionLoading}
                  label="Submit"
                  onPress={submitAdditionalData}
                />
              </View>
            </View>
          </View>
        </Modal>
        <Modal animationType="fade" onRequestClose={() => undefined} transparent visible={isSubmissionLoading}>
          <View style={styles.loadingModalBackdrop}>
            <View style={styles.loadingModalCard}>
              <View style={styles.loadingProgressHeader}>
                <Text style={styles.loadingModalTitle}>{submissionProgress.label}</Text>
                <Text style={styles.loadingProgressValue}>{submissionLoadingProgress}%</Text>
              </View>
              <Text style={styles.loadingModalDetail}>{submissionProgress.detail}</Text>
              <View style={styles.loadingProgressBlock}>
                <Progress value={submissionLoadingProgress} />
              </View>
              <SubmissionMemoryStagePanel progress={submissionProgress} />
              <View style={styles.loadingStepList}>
                {submissionProgressSteps.map((step, index) => {
                  const stepState = getSubmissionProgressStepState(submissionProgress.stage, index)

                  return (
                    <View key={step.label} style={styles.loadingStepRow}>
                      <View
                        style={[
                          styles.loadingStepDot,
                          stepState === 'complete' ? styles.loadingStepDotComplete : null,
                          stepState === 'active' ? styles.loadingStepDotActive : null,
                        ]}
                      >
                        {stepState === 'complete' ? <Check color={colors.surface} size={10} strokeWidth={3} /> : null}
                      </View>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.loadingStepText,
                          stepState === 'complete' ? styles.loadingStepTextComplete : null,
                          stepState === 'active' ? styles.loadingStepTextActive : null,
                        ]}
                      >
                        {step.label}
                      </Text>
                    </View>
                  )
                })}
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  )
}

function PrivacyAgentMemoryPreview() {
  return (
    <View style={styles.agentMemoryPreview}>
      <View style={styles.agentMemoryPreviewHeader}>
        <BrainCircuit color={colors.primary} size={18} strokeWidth={2.3} />
        <View style={styles.agentMemoryPreviewCopy}>
          <Text style={styles.agentMemoryPreviewTitle}>Privacy Agent memory chain</Text>
          <Text style={styles.agentMemoryPreviewText}>
            The Agent does not approve blindly. It reuses Walrus policy memory and writes a reusable audit trail.
          </Text>
        </View>
      </View>
      <View style={styles.agentMemoryCardList}>
        {privacyAgentMemoryCards.map((item) => {
          const Icon = item.icon

          return (
            <View key={item.label} style={styles.agentMemoryCard}>
              <View style={styles.agentMemoryIcon}>
                <Icon color={colors.primary} size={16} strokeWidth={2.25} />
              </View>
              <View style={styles.agentMemoryCardCopy}>
                <Text style={styles.agentMemoryLabel}>{item.label}</Text>
                <Text style={styles.agentMemoryDetail}>{item.detail}</Text>
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}

function SubmissionMemoryStagePanel({ progress }: { progress: ParticipantSubmissionProgress }) {
  const stage = getSubmissionMemoryStage(progress.stage)
  const Icon = stage.icon

  return (
    <View style={styles.submissionMemoryPanel}>
      <View style={styles.submissionMemoryHeader}>
        <View style={styles.submissionMemoryIcon}>
          <Icon color={colors.primary} size={17} strokeWidth={2.3} />
        </View>
        <View style={styles.submissionMemoryCopy}>
          <Text style={styles.submissionMemoryTitle}>{stage.title}</Text>
          <Text style={styles.submissionMemoryDetail}>{stage.detail}</Text>
        </View>
      </View>
      <View style={styles.submissionMemoryTagRow}>
        <Text numberOfLines={1} style={styles.submissionMemoryTag}>{stage.memory}</Text>
        <Text numberOfLines={1} style={styles.submissionMemoryTag}>{stage.artifact}</Text>
      </View>
    </View>
  )
}

function DataProvisionLogItem({
  entry,
  expanded,
  onToggle,
}: {
  entry: ReturnType<typeof getDataProvisionLogs>[number]
  expanded: boolean
  onToggle: () => void
}) {
  const statusTone = getProvisionStatusTone(entry.status)
  const isPendingReview = entry.status === 'Under Review'

  return (
    <View style={[styles.accessLogItem, isPendingReview ? styles.accessLogItemReviewPending : null]}>
      <Pressable accessibilityRole="button" onPress={onToggle} style={({ pressed }) => [styles.accessLogHeader, pressed ? styles.pressed : null]}>
        <View style={styles.accessLogHeaderCopy}>
          <Text style={styles.accessLogDate}>{entry.date}</Text>
          <Text style={styles.accessLogSummary}>{entry.title}</Text>
        </View>
        <View style={styles.accessLogStatusBlock}>
          <View style={[styles.accessLogStatusPill, { backgroundColor: statusTone.backgroundColor, borderColor: statusTone.borderColor }]}>
            <Text style={[styles.accessLogStatus, { color: statusTone.color }]}>{entry.status}</Text>
          </View>
          <ChevronRight
            color={colors.muted}
            size={18}
            strokeWidth={2.2}
            style={expanded ? styles.accessLogChevronExpanded : styles.accessLogChevron}
          />
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.accessLogPanel}>
          <View style={styles.accessLogDataBlock}>
            <Text style={styles.tinyMuted}>Shared Data</Text>
            <Text style={styles.accessLogData}>{entry.dataLabel}</Text>
          </View>
          <View style={styles.accessEventList}>
            {entry.events.map((item) => (
              <View key={`${entry.id}-${item.label}`} style={styles.accessEventRow}>
                <View style={[styles.accessEventDot, item.tone === 'success' ? styles.accessEventDotSuccess : null]} />
                <View style={styles.accessEventContent}>
                  <View style={styles.accessEventHeader}>
                    <Text style={styles.accessEventLabel}>{item.label}</Text>
                    <Text style={styles.accessEventTime}>{item.time}</Text>
                  </View>
                  <Text style={styles.accessEventDetail}>{item.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  )
}

function getProvisionStatusTone(status: string) {
  if (status === 'Reward Paid') {
    return {
      backgroundColor: '#e9f7ee',
      borderColor: '#bde7ca',
      color: '#12804a',
    }
  }

  if (status === 'Participation Approved') {
    return {
      backgroundColor: colors.successFill,
      borderColor: '#a9d9bd',
      color: colors.successText,
    }
  }

  if (status === 'Under Review') {
    return {
      backgroundColor: colors.accent,
      borderColor: '#f5c26f',
      color: colors.accentText,
    }
  }

  return {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    color: colors.text,
  }
}

function getDataProvisionLogs(record: ParticipationRecord) {
  const readableData = record.requiredConditionTags.map(formatConditionTag)
  const primaryData = readableData.slice(0, 5).join(', ')
  const fullData = readableData.join(', ')
  const approvalLog = {
    dataLabel: fullData,
    date: record.consentDate,
    events: [
      {
        detail: 'The institution approved this application.',
        label: 'Approve Done',
        time: record.consentDate,
        tone: 'success',
      },
    ],
    id: `${record.id}-approved-${record.consentDate}`,
    management: [
      { label: 'Application Status', value: 'The institution approved this application.' },
      { label: 'Data Transfer', value: 'Walrus upload starts only when the user submits data after approval.' },
      { label: 'Next Step', value: 'Open Submit Data to review and submit the requested data fields.' },
    ],
    status: 'Participation Approved',
    title: 'Participation Approved',
  }

  if (isApplicationPendingReview(record)) {
    return [
      {
        dataLabel: fullData,
        date: record.consentDate,
        events: [
          {
            detail: 'The application entered the institution review queue.',
            label: 'Applied',
            time: record.consentDate,
          },
          {
            detail: 'Before approval, institutions cannot access raw participant data.',
            label: 'Institution Access',
            time: 'Pending',
          },
          {
            detail: 'Reward eligibility is calculated after approval and data submission.',
            label: 'Reward Receipt',
            time: 'Pending',
          },
        ],
        id: `${record.id}-application-review`,
        management: [
          { label: 'Application Status', value: 'The institution is reviewing this application.' },
          { label: 'Data Transfer', value: 'The institution cannot access health data before approval.' },
          { label: 'Next Step', value: 'After approval, policy review and local processing can continue.' },
        ],
        status: 'Under Review',
        title: 'Application Review',
      },
    ]
  }

  if (record.progressValue < 60) {
    return [approvalLog]
  }

  return [
    approvalLog,
    {
      dataLabel: primaryData,
      date: '2026.06.06',
      events: [
        {
          detail: 'Initial summary data was uploaded to Walrus after user approval.',
          label: 'Sent At',
          time: '2026.06.06 09:12',
        },
        {
          detail: `${record.organization} accessed this study to verify conditions.`,
          label: 'Institution Access',
          time: '2026.06.06 10:04',
        },
        {
          detail: `${record.reward} reward has been paid.`,
          label: 'Reward Receipt',
          time: '2026.06.06 18:20',
          tone: 'success',
        },
      ],
      id: `${record.id}-20260606`,
      management: [
        { label: 'Consent Record', value: 'User consent and access request terms were recorded as Sui events.' },
        { label: 'Storage Method', value: 'Raw sensor values were not stored; only research-grade categorical data was linked.' },
        { label: 'Reward', value: `${record.reward} reward has been paid.` },
      ],
      status: 'Reward Paid',
      title: 'Initial Data Sharing',
    },
    {
      dataLabel: primaryData,
      date: '2026.06.07',
      events: [
        {
          detail: 'Only purpose-matched summary data was submitted.',
          label: 'Sent At',
          time: '2026.06.07 08:46',
        },
        {
          detail: `${record.organization} reviewed summary data and access logs.`,
          label: 'Institution Access',
          time: '2026.06.07 11:18',
        },
        {
          detail: 'Reward settlement reflects the verified access record.',
          label: 'Reward Receipt',
          time: 'Pending',
        },
      ],
      id: `${record.id}-20260607`,
      management: [
        { label: 'Policy Check', value: 'Only fields required for the study purpose remain; detailed identifiers were removed.' },
        { label: 'Institution Access', value: 'The requesting institution can view only summary data and access logs.' },
        { label: 'Reward Processing', value: 'Verified access logs are applied to reward eligibility.' },
      ],
      status: 'Submission complete',
      title: `${formatAllowedUse(record.allowedUse)} Summary Sharing`,
    },
    {
      dataLabel: fullData,
      date: '2026.06.08',
      events: [
        {
          detail: 'Daily health record update was submitted to Walrus.',
          label: 'Sent At',
          time: '2026.06.08 09:28',
        },
        {
          detail: 'Policy review is in progress before institution access.',
          label: 'Institution Access',
          time: 'Pending',
        },
        {
          detail: 'Reward processing is determined after institution access and review.',
          label: 'Reward Receipt',
          time: 'Pending',
        },
      ],
      id: `${record.id}-20260608`,
      management: [
        { label: 'Policy Check', value: 'Forbidden data and precise time fields were excluded.' },
        { label: 'Submission status', value: 'The record changes to submitted after review is complete.' },
        { label: 'Access Rights', value: 'The requesting institution cannot view data while review is pending.' },
      ],
      status: 'Under Review',
      title: 'Daily Health Record Update',
    },
  ]
}

function FilterGroup({ children, label }: { children: ReactNode; label: string }) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterGroupLabel}>{label}</Text>
      <ScrollView
        horizontal
        contentContainerStyle={styles.filterGroupControls}
        showsHorizontalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  )
}

function FilterChip({
  active,
  count,
  icon: Icon,
  label,
  onPress,
}: {
  active: boolean
  count: number
  icon: LucideIcon
  label: string
  onPress: () => void
}) {
  const foreground = active ? colors.surface : colors.text

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.filterChip, active ? styles.filterChipActive : null, pressed ? styles.pressed : null]}
    >
      <Icon color={foreground} size={16} strokeWidth={2.2} />
      <Text style={[styles.filterLabel, { color: foreground }]}>{label}</Text>
      <Text style={[styles.filterCount, active ? styles.filterCountActive : null]}>{count}</Text>
    </Pressable>
  )
}

function AgentManagement() {
  const memoryItems = [
    { label: 'Institution Request Criteria', value: 'Insurance Rewards, Health Coaching' },
    { label: 'Reusable Safety Rules', value: 'Exclude detailed location and precise time' },
    { label: 'Latest policy memory', value: 'mvp-health-v1' },
  ]

  return (
    <View style={styles.detailGrid}>
      <Card>
        <CardHeader>
          <CardTitle>Agent Status</CardTitle>
          <CardDescription>Reviews institution policy and privacy risk before sending healthcare MyData.</CardDescription>
        </CardHeader>
        <CardContent>
          <View style={styles.statGrid}>
            <AgentStat icon={BrainCircuit} label="Agent v0.1.0" value="No pending verification" />
            <AgentStat icon={CheckCircle2} label="Policy Passed" value="No forbidden fields detected" />
            <AgentStat icon={LockKeyhole} label="Permission Scope" value="Requires user approval" />
          </View>

          <Separator />

          <View>
            <Text style={styles.sectionHeading}>Agent memory</Text>
            <Text style={styles.sectionLead}>
              It remembers policy and prior risk patterns, but never creates consent or decryption rights without user approval.
            </Text>
            <View style={styles.memoryList}>
              {memoryItems.map((item) => (
                <View key={item.label} style={styles.memoryItem}>
                  <Text style={styles.itemMeta}>{item.label}</Text>
                  <Text style={styles.memoryValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verification Checks</CardTitle>
          <CardDescription>Checks whether data was made safe for the company request before upload</CardDescription>
        </CardHeader>
        <CardContent>
          {agentChecks.map((check) => (
            <View key={check.name} style={styles.checkItem}>
              <Text style={styles.checkName}>{check.name}</Text>
              <Text style={styles.checkDetail}>{check.detail}</Text>
            </View>
          ))}
        </CardContent>
      </Card>

      <Card style={styles.agentLimitCard}>
        <CardHeader>
          <CardTitle>Agent Limits</CardTitle>
          <CardDescription style={styles.agentLimitDescription}>User Protection Principles</CardDescription>
        </CardHeader>
        <CardContent>
          <Text style={styles.limitText}>Never sends raw PHI to the platform server.</Text>
          <Text style={styles.limitText}>Never creates consent without user approval.</Text>
          <Text style={styles.limitText}>Blocks uploads while forbidden fields remain.</Text>
        </CardContent>
      </Card>
    </View>
  )
}

function AgentStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Icon color={colors.primary} size={21} strokeWidth={2.2} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.itemMeta}>{value}</Text>
    </View>
  )
}

function InfoRow({ label, value, style }: { label: string; value: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.infoRow, style]}>
      <Text style={styles.tinyMuted}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  activityGraphBar: {
    backgroundColor: colors.primary,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    width: '100%',
  },
  activityGraphSlot: {
    backgroundColor: colors.surface,
    borderRadius: 6,
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    marginHorizontal: 2,
    overflow: 'hidden',
  },
  accessLogChevron: {
    transform: [{ rotate: '0deg' }],
  },
  accessLogChevronExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  accessLogActionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 2,
  },
  accessLogData: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  accessLogDataBlock: {
    gap: 4,
  },
  accessEventContent: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  accessEventDetail: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  accessEventDot: {
    backgroundColor: '#f5c26f',
    borderRadius: 5,
    height: 10,
    marginTop: 4,
    width: 10,
  },
  accessEventDotSuccess: {
    backgroundColor: colors.primary,
  },
  accessEventHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  accessEventLabel: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  accessEventList: {
    gap: 10,
  },
  accessEventRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 9,
  },
  accessEventTime: {
    color: colors.muted,
    flexShrink: 0,
    fontSize: 12,
    lineHeight: 16,
  },
  accessLogDate: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  accessLogHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: 12,
  },
  accessLogHeaderCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  accessLogItem: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  accessLogItemReviewPending: {
    backgroundColor: colors.accent,
    borderColor: '#f5c26f',
  },
  accessLogList: {
    gap: 8,
  },
  accessLogPanel: {
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 12,
    padding: 12,
  },
  accessLogSection: {
    gap: 10,
  },
  accessLogStatus: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  accessLogStatusBlock: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 0,
    gap: 4,
  },
  accessLogStatusPill: {
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  accessLogSummary: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  accessManagementLabel: {
    color: colors.muted,
    flexShrink: 0,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    minWidth: 66,
  },
  accessManagementList: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  accessManagementRow: {
    alignItems: 'flex-start',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 9,
  },
  accessManagementValue: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  agentLimitCard: {
    backgroundColor: colors.accent,
  },
  agentLimitDescription: {
    color: '#61718a',
  },
  badgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  appHeader: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  appleHealthCard: {
    borderColor: colors.border,
  },
  appleHealthCardConnected: {
    borderColor: '#a9d9bd',
  },
  appleHealthContent: {
    gap: 10,
    padding: 12,
  },
  appleHealthHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  bottomNavShell: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  bottomTabBar: {
    flexDirection: 'row',
    maxWidth: 760,
    width: '100%',
  },
  bottomTabBarWide: {
    paddingHorizontal: 40,
  },
  bottomTabButton: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
    minHeight: 58,
    minWidth: 0,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  bottomTabButtonActive: {},
  bottomTabIcon: {
    alignItems: 'center',
    borderRadius: 18,
    height: 34,
    justifyContent: 'center',
    width: 48,
  },
  bottomTabIconActive: {
    backgroundColor: '#eef0ff',
  },
  bottomTabLabel: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
    maxWidth: '100%',
    textAlign: 'center',
  },
  avatarArm: {
    borderRadius: 18,
    height: 76,
    marginTop: 8,
    width: 30,
  },
  avatarHead: {
    borderRadius: 32,
    height: 64,
    width: 64,
  },
  avatarLeg: {
    borderRadius: 16,
    height: 64,
    width: 32,
  },
  avatarLegRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginTop: -2,
  },
  avatarShoulderRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 8,
  },
  avatarTorso: {
    borderRadius: 30,
    height: 92,
    width: 72,
  },
  bodyAura: {
    borderRadius: 90,
    height: 180,
    opacity: 0.95,
    position: 'absolute',
    width: 180,
  },
  bodyAvatar: {
    alignItems: 'center',
  },
  bodyAvatarStage: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 238,
  },
  bodyHeroCard: {
    borderColor: '#d8eadf',
  },
  bodyScoreBlock: {
    gap: 10,
  },
  bodyScoreLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  bodyScoreRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 6,
  },
  bodyScoreUnit: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: '700',
    paddingBottom: 8,
  },
  bodyScoreValue: {
    color: colors.text,
    fontSize: 54,
    fontWeight: '700',
    lineHeight: 60,
  },
  bodyStatusCard: {
    borderRadius: radii.lg,
    flex: 1,
    gap: 6,
    minWidth: 140,
    padding: 16,
  },
  bodyStatusCardGreen: {
    backgroundColor: '#e9f7ee',
    borderColor: '#bde7ca',
    borderWidth: 1,
  },
  bodyStatusCardOrange: {
    backgroundColor: '#fff8ec',
    borderColor: '#f5c26f',
    borderWidth: 1,
  },
  bodyStatusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  bodyStatusLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  bodyStatusValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
  },
  bodyTodoItem: {
    alignItems: 'flex-start',
    backgroundColor: '#fff8ec',
    borderColor: '#f5c26f',
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  bodyTodoItemDone: {
    backgroundColor: '#e9f7ee',
    borderColor: '#bde7ca',
  },
  bodyTodoList: {
    gap: 9,
  },
  calloutSoft: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    gap: 8,
    padding: 16,
  },
  calloutText: {
    color: '#273951',
    fontSize: 14,
    lineHeight: 22,
  },
  calloutTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  agentMemoryCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  agentMemoryCardCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  agentMemoryCardList: {
    gap: 8,
  },
  agentMemoryDetail: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  agentMemoryIcon: {
    alignItems: 'center',
    backgroundColor: colors.successFill,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  agentMemoryLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  agentMemoryPreview: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  agentMemoryPreviewCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  agentMemoryPreviewHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  agentMemoryPreviewText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  agentMemoryPreviewTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },
  confirmModalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(18, 29, 24, 0.38)',
    flex: 1,
    justifyContent: 'center',
    padding: 18,
  },
  confirmModalBody: {
    gap: 14,
    padding: 16,
  },
  confirmModalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    maxWidth: 520,
    overflow: 'hidden',
    width: '100%',
  },
  confirmModalFooter: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
    padding: 16,
  },
  confirmModalHeader: {
    alignItems: 'flex-start',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    padding: 16,
  },
  confirmModalScroll: {
    maxHeight: 520,
  },
  confirmModalTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 25,
  },
  loadingModalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(18, 29, 24, 0.46)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  loadingModalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    gap: 12,
    maxWidth: 420,
    padding: 20,
    width: '100%',
  },
  loadingModalDetail: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  loadingModalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
  },
  loadingProgressBlock: {
    paddingTop: 4,
  },
  loadingProgressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  loadingProgressValue: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  webHealthNoticeActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'flex-end',
  },
  webHealthNoticeBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(18, 29, 24, 0.42)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  webHealthNoticeCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    gap: 14,
    maxWidth: 430,
    padding: 20,
    width: '100%',
  },
  webHealthNoticeIcon: {
    alignItems: 'center',
    backgroundColor: '#eef7f2',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  webHealthNoticeText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  webHealthNoticeTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
  },
  loadingStepDot: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  loadingStepDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  loadingStepDotComplete: {
    backgroundColor: colors.successText,
    borderColor: colors.successText,
  },
  loadingStepList: {
    gap: 8,
    paddingTop: 4,
  },
  loadingStepRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
    minHeight: 22,
  },
  loadingStepText: {
    color: colors.muted,
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  loadingStepTextActive: {
    color: colors.primary,
  },
  loadingStepTextComplete: {
    color: colors.text,
  },
  calendarDayBlank: {
    backgroundColor: 'transparent',
  },
  calendarDayCell: {
    alignItems: 'center',
    aspectRatio: 1,
    borderRadius: radii.sm,
    flexBasis: '13%',
    flexGrow: 1,
    justifyContent: 'center',
    maxWidth: '13.4%',
    minWidth: 34,
  },
  calendarDayText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  calendarHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  calendarLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  calendarLegendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  calendarLegendSwatch: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  calendarLegendText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  calendarWeekRow: {
    flexDirection: 'row',
    gap: 5,
  },
  calendarWeekday: {
    color: colors.muted,
    flexBasis: '13%',
    flexGrow: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    maxWidth: '13.4%',
    minWidth: 34,
    textAlign: 'center',
  },
  cardList: {
    gap: 14,
  },
  connectedAppActionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  connectedAppBadgeGroup: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    minWidth: 0,
  },
  connectedAppCard: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 260,
  },
  connectedAppCardActive: {
    borderColor: colors.primary,
  },
  connectedAppContent: {
    gap: 14,
  },
  connectedAppGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  connectedAppHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  connectedAppIcon: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  connectedAppIconWarning: {
    backgroundColor: colors.accent,
  },
  connectedAppTitleCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  connectedAppTitleRow: {
    alignItems: 'flex-start',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minWidth: 0,
  },
  checkDetail: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 4,
  },
  checkItem: {
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: 14,
  },
  checkName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  detailGrid: {
    gap: 16,
  },
  emptyState: {
    gap: 6,
  },
  filterChip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexShrink: 0,
    flexDirection: 'row',
    gap: 7,
    minHeight: 40,
    paddingHorizontal: 12,
  },
  filterChipActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  filterCount: {
    backgroundColor: colors.background,
    borderRadius: radii.pill,
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    minWidth: 20,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
    textAlign: 'center',
  },
  filterCountActive: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    color: colors.surface,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  filterGroup: {
    gap: 8,
  },
  filterGroupControls: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
  },
  filterGroupLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  headerSubtitle: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19,
  },
  headerTitleGroup: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  homeMetricCard: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexBasis: '31%',
    flexGrow: 1,
    gap: 6,
    minWidth: 0,
    padding: 9,
  },
  homeMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 7,
  },
  healthEmptyState: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 6,
    minHeight: 190,
    justifyContent: 'center',
    padding: 18,
  },
  healthEmptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  healthEmptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
    textAlign: 'center',
  },
  homeMetricHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  homeMetricIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  homeMetricUnit: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    paddingBottom: 4,
  },
  homeMetricValue: {
    color: colors.text,
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 31,
  },
  homeMetricValueRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 4,
  },
  homePage: {
    gap: 14,
  },
  heartCard: {
    borderColor: '#ffd3df',
  },
  heartCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  heartHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  heartStatus: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  heartUnit: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: '700',
    paddingBottom: 8,
  },
  heartValue: {
    color: colors.text,
    fontSize: 54,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 60,
  },
  heartValueRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoRow: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    gap: 4,
    minWidth: 140,
    paddingTop: 12,
  },
  infoValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  integrationPage: {
    gap: 18,
  },
  itemMeta: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  itemTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '300',
    lineHeight: 25,
  },
  ongoingHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  ongoingHeaderCopy: {
    flex: 1,
    gap: 7,
    minWidth: 0,
  },
  ongoingPanel: {
    backgroundColor: '#eef2f6',
    borderColor: '#d8e0e8',
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: 14,
    padding: 14,
  },
  limitText: {
    color: '#273951',
    fontSize: 14,
    lineHeight: 22,
  },
  memoryItem: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    gap: 5,
    padding: 14,
  },
  memoryList: {
    gap: 10,
    marginTop: 14,
  },
  memoryValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  measurementCard: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 150,
  },
  measurementDetail: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  measurementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  measurementLogCopy: {
    flex: 1,
    gap: 2,
  },
  measurementLogDot: {
    backgroundColor: colors.primary,
    borderRadius: 5,
    height: 10,
    marginTop: 4,
    width: 10,
  },
  measurementLogItem: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  measurementLogLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  measurementLogValue: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  measurementTimeline: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  metricCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  metricIcon: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  metricLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  metricUnit: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    paddingBottom: 5,
  },
  metricValue: {
    color: colors.text,
    fontSize: 33,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 39,
  },
  metricValueRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 7,
  },
  modalContent: {
    gap: 16,
    padding: 18,
    paddingBottom: 28,
  },
  modalDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  modalFooter: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
    padding: 16,
  },
  modalHeader: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    padding: 18,
  },
  modalScreen: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '300',
    lineHeight: 29,
  },
  modalTitleGroup: {
    flex: 1,
    gap: 10,
  },
  notificationButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: 22,
    top: 18,
    width: 44,
    zIndex: 20,
    ...shadow,
  },
  notificationCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  notificationDetail: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  notificationItem: {
    alignItems: 'flex-start',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 14,
  },
  notificationList: {
    padding: 18,
    paddingBottom: 28,
  },
  notificationMarker: {
    backgroundColor: colors.border,
    borderRadius: 5,
    height: 10,
    marginTop: 5,
    width: 10,
  },
  notificationMarkerUnread: {
    backgroundColor: colors.primary,
  },
  notificationTime: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  notificationTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  notificationTitleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  notificationUnreadDot: {
    backgroundColor: colors.danger,
    borderColor: colors.surface,
    borderRadius: 5,
    borderWidth: 1,
    height: 10,
    position: 'absolute',
    right: 9,
    top: 9,
    width: 10,
  },
  monoMuted: {
    color: colors.muted,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  pageScroll: {
    gap: 16,
    padding: 16,
    paddingBottom: 20,
  },
  pageScrollHome: {
    padding: 12,
    paddingBottom: 12,
  },
  pageScrollWide: {
    alignSelf: 'center',
    maxWidth: 760,
    width: '100%',
  },
  pageViewport: {
    flex: 1,
  },
  profileAvatar: {
    alignItems: 'center',
    backgroundColor: colors.successFill,
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  profileAvatarText: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
  },
  profileCopy: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  profileHeaderRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minWidth: 0,
  },
  profileMeta: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  profileName: {
    color: colors.text,
    flex: 1,
    fontSize: 21,
    fontWeight: '300',
    lineHeight: 26,
  },
  profileNameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  profileStatus: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ translateY: 1 }],
  },
  submissionMemoryCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  submissionMemoryDetail: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  submissionMemoryHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  submissionMemoryIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 17,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  submissionMemoryPanel: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  submissionMemoryTag: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    color: colors.text,
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  submissionMemoryTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  submissionMemoryTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  progressBlock: {
    gap: 8,
  },
  progressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  rewardRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  rewardSummaryContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  rewardSummaryCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  rewardSummaryIcon: {
    alignItems: 'center',
    backgroundColor: colors.successFill,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  rewardSummaryUnit: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    paddingBottom: 4,
  },
  rewardSummaryValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 34,
  },
  rewardSummaryValueRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 4,
  },
  rewardSummaryWalletText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  requiredDataLabel: {
    color: colors.text,
    flexShrink: 0,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    minWidth: 66,
  },
  requiredDataList: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  requiredDataRow: {
    alignItems: 'flex-start',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  requiredDataValue: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'right',
  },
  rewardText: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '300',
    lineHeight: 28,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  section: {
    gap: 14,
  },
  sectionHeaderRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  sectionHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  sectionHeading: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  sectionLead: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  errorText: {
    color: colors.danger,
    fontWeight: '700',
  },
  detailPill: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  detailPillText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  selectedCard: {
    borderColor: colors.primary,
  },
  reviewPendingCard: {
    backgroundColor: colors.accent,
    borderColor: '#f5c26f',
  },
  serviceCardContent: {
    gap: 14,
  },
  serviceCardCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  serviceCardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  serviceDetailValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  serviceOrganization: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  serviceRewardCopy: {
    flex: 1,
    minWidth: 0,
  },
  serviceRewardRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  serviceRewardRowReviewPending: {
    borderTopColor: '#f5c26f',
  },
  statCard: {
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexGrow: 1,
    gap: 8,
    minWidth: 150,
    padding: 14,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  successText: {
    color: '#12804a',
    fontWeight: '700',
  },
  statLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  sleepCycleHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sleepCycleLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sleepCycleLegendDot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  sleepCycleLegendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  sleepCycleLegendText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  sleepCyclePanel: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 7,
    padding: 10,
  },
  sleepCycleSegment: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    width: '100%',
  },
  sleepCycleSegmentEnd: {
    borderTopRightRadius: 10,
  },
  sleepCycleSegmentStart: {
    borderTopLeftRadius: 10,
  },
  sleepCycleSlot: {
    justifyContent: 'flex-end',
    minWidth: 18,
  },
  sleepCycleTime: {
    color: colors.muted,
    flex: 1,
    fontSize: 10,
    lineHeight: 12,
  },
  sleepCycleTimeRow: {
    flexDirection: 'row',
    gap: 2,
  },
  sleepCycleTrack: {
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    height: 68,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingTop: 6,
  },
  sleepSummaryCopy: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  sleepSummaryValue: {
    color: colors.text,
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 31,
  },
  sleepSummaryValueBlock: {
    minWidth: 92,
  },
  sleepSummaryValueRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 4,
  },
  tinyMuted: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  todoCheckbox: {
    alignItems: 'center',
    borderRadius: 6,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  todoCheckboxChecked: {
    backgroundColor: '#12804a',
  },
  todoCheckboxPending: {
    backgroundColor: colors.surface,
    borderColor: '#f5a742',
    borderWidth: 2,
  },
  todoCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  todoHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  todoItem: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 58,
    padding: 12,
  },
  todoItemPending: {
    backgroundColor: '#fff8ec',
    borderColor: '#f5c26f',
  },
  todoLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  todoList: {
    gap: 9,
  },
  todoState: {
    color: '#12804a',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  todoStatePending: {
    color: '#9b6829',
  },
  todoValue: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  todoValuePending: {
    color: '#9b6829',
  },
  warningPanel: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    gap: 8,
    padding: 16,
  },
  walletPill: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    maxWidth: 126,
    minHeight: 36,
    paddingHorizontal: 10,
  },
  walletText: {
    color: colors.primary,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
})
