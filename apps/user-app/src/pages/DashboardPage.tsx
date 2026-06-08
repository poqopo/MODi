import { useCallback, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import {
  Modal,
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
  Flame,
  Footprints,
  HeartPulse,
  LockKeyhole,
  Moon,
  Plus,
  RefreshCw,
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

type DashboardPageProps = {
  activeTab: DashboardTab
  selectedRequestId: string
  onTabChange: (tab: DashboardTab) => void
  onSelectRequest: (requestId: string) => void
  onBackToLanding: () => void
}

const navItems: Array<{ id: DashboardTab; label: string; icon: LucideIcon }> = [
  { id: 'home', label: '홈', icon: Activity },
  { id: 'projects', label: '프로젝트', icon: ClipboardList },
  { id: 'my-projects', label: '내 프로젝트', icon: CheckCircle2 },
]

const initialJoinedProjectIds = participationRecords.map((record) => record.id)

const initialHealthTodos: HealthTodo[] = [
  { id: 'steps', label: '8,000보 이상 걷기', value: '8,426보', done: true },
  { id: 'sleep', label: '7시간 이상 수면', value: '7.2시간', done: true },
  { id: 'heart', label: '심박수 재기', value: '아직 안 함', done: false },
  { id: 'water', label: '물 6잔 마시기', value: '4 / 6잔', done: false },
]

const notificationItems: NotificationItem[] = [
  {
    detail: 'BetterSleep Coaching 요청이 Agent 검토 단계로 이동했습니다.',
    id: 'notice-sleep-review',
    time: '방금',
    title: '수면 코칭 데이터 검토',
    unread: true,
  },
  {
    detail: 'Sui Active Insurance 보상 escrow가 확인되었습니다.',
    id: 'notice-reward-ready',
    time: '12분 전',
    title: '보상 조건 확인',
    unread: true,
  },
  {
    detail: '웨어러블 제공 스키마가 Apple Health 데이터 범위에 맞게 업데이트되었습니다.',
    id: 'notice-schema',
    time: '오늘',
    title: '데이터 정책 업데이트',
  },
]

const appleHealthFallbackMetrics: HomeMetric[] = [
  {
    detail: '안정시 범위',
    icon: HeartPulse,
    label: '심박수',
    progress: 72,
    unit: 'bpm',
    value: '72',
  },
  {
    detail: '오늘 누적',
    icon: Flame,
    label: '휴식 에너지',
    progress: 78,
    unit: 'kcal',
    value: '1,420',
  },
]

const homeProfileFallback = {
  heightCm: 174,
  name: 'Han',
  weightKg: 68,
}

const sleepCycleSegments = [
  { color: '#bcd7ff', flex: 18, height: 28, label: '얕은 수면', time: '23:40' },
  { color: '#7ea7f8', flex: 15, height: 40, label: 'REM', time: '00:45' },
  { color: '#2947a9', flex: 22, height: 54, label: '깊은 수면', time: '01:40' },
  { color: '#bcd7ff', flex: 18, height: 30, label: '얕은 수면', time: '03:05' },
  { color: '#7ea7f8', flex: 13, height: 42, label: 'REM', time: '04:20' },
  { color: '#f5c26f', flex: 6, height: 22, label: '깸', time: '05:18' },
  { color: '#bcd7ff', flex: 18, height: 28, label: '얕은 수면', time: '05:40' },
]

export function DashboardPage({
  activeTab,
  selectedRequestId,
  onSelectRequest,
  onTabChange,
}: DashboardPageProps) {
  const [joinedProjectIds, setJoinedProjectIds] = useState<string[]>(initialJoinedProjectIds)

  const joinProject = (requestId: string) => {
    setJoinedProjectIds((currentIds) => (currentIds.includes(requestId) ? currentIds : [...currentIds, requestId]))
    onSelectRequest(requestId)
    onTabChange('my-projects')
  }

  return (
    <DashboardShell activeTab={activeTab} onTabChange={onTabChange}>
      {activeTab === 'projects' ? (
        <ProjectsPage
          joinedProjectIds={joinedProjectIds}
          selectedRequestId={selectedRequestId}
          onJoinProject={joinProject}
        />
      ) : activeTab === 'my-projects' ? (
        <MyProjectsPage
          joinedProjectIds={joinedProjectIds}
          selectedRequestId={selectedRequestId}
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
          accessibilityLabel="알림함 열기"
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
            <Text style={styles.modalTitle}>알림함</Text>
            <Text style={styles.itemMeta}>데이터 요청, 동의, 보상 진행 상태</Text>
          </View>
          <Pressable accessibilityLabel="닫기" accessibilityRole="button" onPress={onClose} style={styles.iconButton}>
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
  const [healthMessage, setHealthMessage] = useState<string | null>(null)
  const [healthSyncStatus, setHealthSyncStatus] = useState<AppleHealthSyncStatus>('idle')
  const isAppleHealthConnected = appleHealthSnapshot !== null
  const appleHealthMetrics = appleHealthSnapshot ? getAppleHealthMetrics(appleHealthSnapshot) : appleHealthFallbackMetrics
  const healthProfile = getHealthProfile(appleHealthSnapshot)
  const rewardMetric = getReceivedRewardMetric(participationRecords)
  const activitySteps = appleHealthSnapshot?.steps ?? 8426

  const syncAppleHealth = useCallback(async () => {
    setHealthMessage(null)
    setHealthSyncStatus('syncing')

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
  }, [])

  useEffect(() => {
    void syncAppleHealth()
  }, [syncAppleHealth])

  return (
    <View style={styles.homePage}>
      <RewardSummaryCard metric={rewardMetric} />

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
                    label={healthSyncStatus === 'syncing' ? '동기화 중' : '새로고침'}
                    onPress={syncAppleHealth}
                    size="sm"
                    variant="secondary"
                  />
                </View>
                <Text numberOfLines={1} style={styles.profileMeta}>
                  키 {healthProfile.heightLabel} · 몸무게 {healthProfile.weightLabel}
                </Text>
                <Text numberOfLines={1} style={styles.profileStatus}>
                  {getAppleHealthHeaderMessage({
                    healthMessage,
                    isConnected: isAppleHealthConnected,
                    snapshot: appleHealthSnapshot,
                    status: healthSyncStatus,
                  })}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.homeMetricGrid}>
            {appleHealthMetrics.map((metric) => (
              <HomeMetricCard key={metric.label} metric={metric} />
            ))}
          </View>

          <ActivityGraph steps={activitySteps} syncedAt={appleHealthSnapshot?.syncedAt} />
          <SleepCycleGraph sleep={appleHealthSnapshot?.sleep} />
        </CardContent>
      </Card>
    </View>
  )
}

function RewardSummaryCard({ metric }: { metric: HomeMetric }) {
  const Icon = metric.icon

  return (
    <Card>
      <CardContent style={styles.rewardSummaryContent}>
        <View style={styles.rewardSummaryIcon}>
          <Icon color={colors.primary} size={22} strokeWidth={2.25} />
        </View>
        <View style={styles.rewardSummaryCopy}>
          <Text style={styles.metricLabel}>{metric.label}</Text>
          <Text numberOfLines={1} style={styles.measurementDetail}>{metric.detail}</Text>
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
  const activityDetail = syncedAt ? `${formatClock(syncedAt)} 동기화` : '오늘 걸음 수'

  return (
    <View style={styles.sleepCyclePanel}>
      <View style={styles.sleepCycleHeader}>
        <View style={styles.sleepSummaryValueBlock}>
          <Text style={styles.metricLabel}>운동</Text>
          <View style={styles.sleepSummaryValueRow}>
            <Text style={styles.sleepSummaryValue}>{steps.toLocaleString('ko-KR')}</Text>
            <Text style={styles.homeMetricUnit}>보</Text>
          </View>
        </View>
        <View style={styles.sleepSummaryCopy}>
          <Text numberOfLines={1} style={styles.measurementDetail}>{activityDetail}</Text>
          <Text numberOfLines={1} style={styles.measurementDetail}>일일 목표 10,000보 기준</Text>
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
        <SleepCycleLegend color={colors.primary} label="걸음" />
        <SleepCycleLegend color="#d8e0e8" label="목표" />
      </View>
    </View>
  )
}

function SleepCycleGraph({ sleep }: { sleep?: AppleHealthSnapshot['sleep'] }) {
  const sleepStart = sleep?.startDate
  const sleepEnd = sleep?.endDate
  const sleepRange = sleep ? (sleepStart && sleepEnd ? `${formatClock(sleepStart)} - ${formatClock(sleepEnd)}` : '수면 데이터 없음') : '23:40 - 07:02'
  const sleepHours = sleep ? formatHours(sleep.totalMinutes) : '7.2'
  const sleepDetail = sleep?.deepMinutes ? `깊은 수면 ${formatHours(sleep.deepMinutes)}` : '수면 주기 분석'

  return (
    <View style={styles.sleepCyclePanel}>
      <View style={styles.sleepCycleHeader}>
        <View style={styles.sleepSummaryValueBlock}>
          <Text style={styles.metricLabel}>수면</Text>
          <View style={styles.sleepSummaryValueRow}>
            <Text style={styles.sleepSummaryValue}>{sleepHours}</Text>
            <Text style={styles.homeMetricUnit}>시간</Text>
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
        <SleepCycleLegend color="#2947a9" label="깊은" />
        <SleepCycleLegend color="#7ea7f8" label="REM" />
        <SleepCycleLegend color="#bcd7ff" label="얕은" />
        <SleepCycleLegend color="#f5c26f" label="깸" />
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
  const restingEnergyValue = snapshot.restingEnergyKcal ? snapshot.restingEnergyKcal.toLocaleString('ko-KR') : '--'

  return [
    {
      detail: snapshot.heartRate ? `${formatClock(snapshot.heartRate.measuredAt)} 측정` : '최근 측정 없음',
      icon: HeartPulse,
      label: '심박수',
      progress: clampProgress(snapshot.heartRate?.bpm ?? 0),
      unit: 'bpm',
      value: heartRateValue,
    },
    {
      detail: snapshot.restingEnergyKcal ? '오늘 누적' : '데이터 없음',
      icon: Flame,
      label: '휴식 에너지',
      progress: clampProgress(((snapshot.restingEnergyKcal ?? 0) / 1800) * 100),
      unit: 'kcal',
      value: restingEnergyValue,
    },
  ]
}

function getReceivedRewardMetric(records: ParticipationRecord[]): HomeMetric {
  const paidRecords = records.filter((record) => getDataProvisionLogs(record).some((entry) => entry.status === '리워드 지급 완료'))
  const totalReward = paidRecords.reduce((sum, record) => sum + Number(record.rewardValue), 0)

  return {
    detail: `지급 완료 ${paidRecords.length}건`,
    icon: Wallet,
    label: '받은 리워드',
    progress: clampProgress((totalReward / 30) * 100),
    unit: 'SUI',
    value: formatCompactNumber(totalReward),
  }
}

function getAppleHealthHeaderMessage({
  healthMessage,
  isConnected,
  snapshot,
  status,
}: {
  healthMessage: string | null
  isConnected: boolean
  snapshot: AppleHealthSnapshot | null
  status: AppleHealthSyncStatus
}) {
  if (status === 'syncing') return 'Apple 건강정보 권한과 데이터를 확인하는 중입니다.'
  if (healthMessage) return healthMessage
  if (isConnected && snapshot) return `${formatClock(snapshot.syncedAt)} 동기화`
  return '운동, 수면, 심박수, 휴식 에너지를 가져옵니다.'
}

function getHealthProfile(snapshot: AppleHealthSnapshot | null) {
  const heightCm = snapshot?.heightCm ?? homeProfileFallback.heightCm
  const weightKg = snapshot?.bodyMassKg ?? homeProfileFallback.weightKg

  return {
    heightLabel: `${formatCompactNumber(heightCm)}cm`,
    initial: homeProfileFallback.name.slice(0, 1).toUpperCase(),
    name: homeProfileFallback.name,
    weightLabel: `${formatCompactNumber(weightKg)}kg`,
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
  const [lastMeasuredAt, setLastMeasuredAt] = useState('오늘 08:12')
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
      label: '걸음 수',
      value: '8,426',
      unit: 'steps',
      detail: '목표 10,000보까지 1,574보',
      progress: 84,
    },
    {
      icon: Moon,
      label: '수면',
      value: '7.2',
      unit: 'hours',
      detail: '깊은 수면 2.1시간',
      progress: 90,
    },
  ]
  const nextMeasurement = () => {
    setHeartRateIndex((current) => (current + 1) % heartReadings.length)
    setLastMeasuredAt('방금 측정됨')
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
          heart: { done: `${heartRate} bpm`, pending: '아직 안 함' },
          sleep: { done: '7.2시간', pending: '안 함' },
          steps: { done: '8,426보', pending: '안 함' },
          water: { done: '6 / 6잔', pending: '4 / 6잔' },
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
              <Text style={styles.metricLabel}>심박수</Text>
              <Text style={styles.heartStatus}>{lastMeasuredAt}</Text>
            </View>
            <Badge label="측정 가능" variant="warning" />
          </View>

          <View style={styles.heartValueRow}>
            <Text style={styles.heartValue}>{heartRate}</Text>
            <Text style={styles.heartUnit}>bpm</Text>
          </View>
          <Text style={styles.measurementDetail}>손가락을 센서에 올린 상태로 10초간 유지하면 최근 심박수를 기록합니다.</Text>
          <Button icon={RefreshCw} label="심박수 재기" onPress={nextMeasurement} />
        </CardContent>
      </Card>

      <View style={styles.measurementTimeline}>
        <MeasurementLog label="걸음 수 동기화" value="08:00 업데이트" />
        <MeasurementLog label="수면 분석 완료" value="수면 효율 91%" />
        <MeasurementLog label="심박수 기준" value="안정시 범위" />
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
          <Badge label={`${todos.filter((todo) => todo.done).length}/${todos.length} 완료`} variant="secondary" />
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
              <Text style={[styles.todoState, !todo.done ? styles.todoStatePending : null]}>{todo.done ? '완료' : '안 함'}</Text>
            </Pressable>
          ))}
        </View>
      </CardContent>
    </Card>
  )
}

function HealthCalendar({ days }: { days: HealthCalendarDay[] }) {
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']

  return (
    <Card>
      <CardContent>
        <View style={styles.calendarHeader}>
          <View>
            <Text style={styles.metricLabel}>건강관리 달력</Text>
            <Text style={styles.measurementDetail}>걸음, 수면, 심박수 루틴 완료 기록</Text>
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
          <CalendarLegend color="#cdecd7" label="기록 있음" />
          <CalendarLegend color="#12804a" label="잘함" />
          <CalendarLegend color="#f5a742" label="빠진 항목" />
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
            <Text style={styles.bodyScoreLabel}>오늘의 몸 상태</Text>
            <View style={styles.bodyScoreRow}>
              <Text style={styles.bodyScoreValue}>{bodyScore}</Text>
              <Text style={styles.bodyScoreUnit}>점</Text>
            </View>
            <Progress value={bodyScore} />
            <Text style={styles.measurementDetail}>{bodyTone.message}</Text>
          </View>
        </CardContent>
      </Card>

      <View style={styles.bodyStatusGrid}>
        <BodyStatusCard label="완료한 루틴" value={`${completedCount}개`} tone="green" />
        <BodyStatusCard label="남은 루틴" value={`${pendingTodos.length}개`} tone={pendingTodos.length > 0 ? 'orange' : 'green'} />
      </View>

      <Card>
        <CardHeader>
          <CardTitle>몸을 더 좋게 만드는 다음 행동</CardTitle>
          <CardDescription>건강 탭의 Todo를 완료하면 아바타 컨디션이 올라갑니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <View style={styles.bodyTodoList}>
            {(pendingTodos.length > 0 ? pendingTodos : healthTodos.slice(0, 2)).map((todo) => (
              <View key={todo.id} style={[styles.bodyTodoItem, todo.done ? styles.bodyTodoItemDone : null]}>
                <View style={[styles.measurementLogDot, { backgroundColor: todo.done ? '#12804a' : '#f5a742' }]} />
                <View style={styles.measurementLogCopy}>
                  <Text style={styles.measurementLogLabel}>{todo.label}</Text>
                  <Text style={styles.measurementLogValue}>{todo.done ? '완료됨' : todo.value}</Text>
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
      message: '루틴을 거의 다 지켜서 몸 컨디션이 아주 좋습니다.',
      skin: '#f4c7a1',
    }
  }

  if (score >= 70) {
    return {
      aura: '#edf8d8',
      body: '#2f9f61',
      limb: '#82d39b',
      message: '좋은 흐름입니다. 남은 루틴을 채우면 아바타가 더 건강해집니다.',
      skin: '#f4c7a1',
    }
  }

  if (score >= 45) {
    return {
      aura: '#fff1d6',
      body: '#f5a742',
      limb: '#f5c26f',
      message: '관리 중입니다. 빠진 항목을 완료하면 몸 상태가 올라갑니다.',
      skin: '#f4c7a1',
    }
  }

  return {
    aura: '#fff1f5',
    body: '#ea6a22',
    limb: '#f5a742',
    message: '오늘은 루틴이 부족합니다. 한 가지부터 완료해 보세요.',
    skin: '#f4c7a1',
  }
}

function ProjectsPage({
  joinedProjectIds,
  selectedRequestId,
  onJoinProject,
}: {
  joinedProjectIds: string[]
  selectedRequestId: string
  onJoinProject: (requestId: string) => void
}) {
  const [categoryFilter, setCategoryFilter] = useState<RequestCategoryFilter>('all')
  const joinedProjectIdSet = new Set(joinedProjectIds)
  const availableProjects = researchRequests.filter((request) => !joinedProjectIdSet.has(request.id))
  const categoryFilters = getCategoryFilters(availableProjects)

  return (
    <View style={styles.section}>
      <FilterGroup label="주제">
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
        requests={availableProjects}
        selectedRequestId={selectedRequestId}
        onSelectRequest={onJoinProject}
      />
    </View>
  )
}

function MyProjectsPage({
  joinedProjectIds,
  selectedRequestId,
  onSelectRequest,
}: {
  joinedProjectIds: string[]
  selectedRequestId: string
  onSelectRequest: (requestId: string) => void
}) {
  const records = getJoinedProjectRecords(joinedProjectIds)

  return (
    <View style={styles.section}>
      <ParticipationList records={records} selectedRequestId={selectedRequestId} onSelectRequest={onSelectRequest} />
    </View>
  )
}

function getCategoryFilters(source: ResearchRequest[]) {
  return [
    { id: 'all' as const, label: '전체', count: source.length },
    {
      id: 'insurance' as const,
      label: '보험 리워드',
      count: source.filter((request) => request.category === 'insurance').length,
    },
    {
      id: 'coaching' as const,
      label: '건강 코칭',
      count: source.filter((request) => request.category === 'coaching').length,
    },
    {
      id: 'care' as const,
      label: '병원 모니터링',
      count: source.filter((request) => request.category === 'care').length,
    },
    {
      id: 'wellness' as const,
      label: '기업 웰니스',
      count: source.filter((request) => request.category === 'wellness').length,
    },
  ]
}

function getJoinedProjectRecords(joinedProjectIds: string[]) {
  const joinedProjectIdSet = new Set(joinedProjectIds)
  const currentRecordById = new Map(participationRecords.map((record) => [record.id, record]))

  return researchRequests
    .filter((request) => joinedProjectIdSet.has(request.id))
    .map((request) => currentRecordById.get(request.id) ?? createParticipationRecord(request))
}

function createParticipationRecord(request: ResearchRequest): ParticipationRecord {
  return {
    ...request,
    accessStatus: '프로젝트 참여 접수',
    consentDate: '오늘',
    consentStatus: '참여 신청 완료',
    progressValue: 24,
    rewardStatus: '조건 충족 전',
  }
}

function ConnectedAppsSection() {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionHeaderCopy}>
          <Text style={styles.sectionHeading}>헬스케어 앱 연동</Text>
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
  const isConnected = app.status === '연동됨'
  const needsReview = app.status === '확인 필요'

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
            label={isConnected ? '관리' : '연동'}
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
  requests,
  selectedRequestId,
  onSelectRequest,
}: {
  categoryFilter: RequestCategoryFilter
  requests: ResearchRequest[]
  selectedRequestId: string
  onSelectRequest: (requestId: string) => void
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
            <Text style={styles.itemTitle}>참여 가능한 프로젝트가 없습니다.</Text>
            <Text style={styles.itemMeta}>이미 참여한 프로젝트는 내 프로젝트 탭에서 확인할 수 있습니다.</Text>
          </CardContent>
        </Card>
      )}

      <ResearchDetailModal
        request={detailRequest}
        onClose={() => setDetailRequest(null)}
        onSelectRequest={(requestId) => {
          setDetailRequest(null)
          onSelectRequest(requestId)
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
      accessibilityLabel={`${request.title} 상세보기`}
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => (pressed ? styles.pressed : null)}
    >
      <Card style={selected ? styles.selectedCard : null}>
        <CardContent style={styles.serviceCardContent}>
          <View style={styles.serviceCardHeader}>
            <View style={styles.serviceCardCopy}>
              <Text style={styles.itemTitle}>{request.title}</Text>
              <Text style={styles.serviceOrganization}>목적: {getProjectPurposeSummary(request)}</Text>
              <Text style={styles.itemMeta}>진행 기관: {request.organization}</Text>
            </View>
          </View>

          <View style={styles.serviceRewardRow}>
            <View style={styles.serviceRewardCopy}>
              <Text style={styles.tinyMuted}>보상</Text>
              <Text style={styles.rewardText}>{request.reward}</Text>
            </View>
            <View style={styles.detailPill}>
              <Text style={styles.detailPillText}>상세보기</Text>
              <ChevronRight color={colors.text} size={15} strokeWidth={2.25} />
            </View>
          </View>
        </CardContent>
      </Card>
    </Pressable>
  )
}

function ResearchDetailModal({
  onClose,
  onSelectRequest,
  request,
}: {
  onClose: () => void
  onSelectRequest: (requestId: string) => void
  request: ResearchRequest | null
}) {
  if (!request) return null

  const requiredData = getReadableRequiredData(request)

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible>
      <SafeAreaView style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <View style={styles.modalTitleGroup}>
            <Text style={styles.modalTitle}>{request.title}</Text>
            <Text style={styles.itemMeta}>진행 기관: {request.organization}</Text>
          </View>
          <Pressable accessibilityLabel="닫기" accessibilityRole="button" onPress={onClose} style={styles.iconButton}>
            <X color={colors.text} size={20} strokeWidth={2.2} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.calloutSoft}>
            <Text style={styles.calloutTitle}>프로젝트 목적</Text>
            <Text style={styles.calloutText}>{getProjectPurposeDetail(request)}</Text>
          </View>

          <Text style={styles.sectionHeading}>필요한 데이터</Text>
          <View style={styles.requiredDataList}>
            {requiredData.map((item) => (
              <View key={item.label} style={styles.requiredDataRow}>
                <Text style={styles.requiredDataLabel}>{item.label}</Text>
                <Text style={styles.requiredDataValue}>{item.value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.infoGrid}>
            <InfoRow label="활용 방식" value={formatAllowedUse(request.allowedUse)} />
            <InfoRow label="접근 요청 기한" value={request.expiresAt} />
            <InfoRow label="보상" value={request.reward} />
            <InfoRow label="모집 현황" value={request.participants} />
          </View>
        </ScrollView>
        <View style={styles.modalFooter}>
          <Button label="닫기" onPress={onClose} variant="secondary" />
          <Button label="참여하기" onPress={() => onSelectRequest(request.id)} />
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const readableConditionLabels: Record<string, string> = {
  active_energy: '활동으로 쓴 에너지',
  blood_glucose: '혈당',
  blood_pressure: '혈압',
  distance_walking_running: '걷거나 뛴 거리',
  exercise_minutes: '운동한 시간',
  glucose_range: '혈당 범위',
  heart_rate: '심박수',
  hrv_sdnn: '심박 변화 정도',
  insulin_delivery: '인슐린 투여 기록',
  metabolic_pattern: '대사 변화 패턴',
  mindful_minutes: '마음챙김 시간',
  oxygen_saturation: '혈중 산소 수준',
  respiratory_rate: '호흡수',
  resting_heart_rate: '쉬고 있을 때 심박수',
  sleep_analysis: '수면 기록',
  sleep_consistency: '수면 규칙성',
  sleep_duration: '총 수면 시간',
  sleep_stage_band: '깊은 수면과 얕은 수면 같은 수면 단계',
  stand_time: '일어서 있던 시간',
  step_count: '걸음 수',
  vo2_max: '심폐 체력',
  workout_summary: '운동 기록 요약',
}

const allowedUseLabels: Record<string, string> = {
  aggregate_research: '여러 사람의 데이터를 합친 연구 분석',
  personalized_coaching: '개인 맞춤 건강 코칭 개선',
  remote_monitoring: '원격 건강 모니터링 개선',
  reward_validation: '리워드 조건 확인',
}

const projectPurposeSummaries: Record<string, string> = {
  'REQ-SUI-1029': '활동 기록으로 더 정확한 웨어러블 리워드 기준 개발',
  'REQ-SUI-1034': '수면·마음챙김 패턴을 활용한 회복 코칭 개선',
  'REQ-SUI-1041': '심혈관 신호로 회복 변화를 파악하는 모니터링 기능 개발',
  'REQ-SUI-1058': '혈당·인슐린 흐름을 이해하는 대사 건강 관리 기능 개발',
}

const projectPurposeDetails: Record<string, string> = {
  'REQ-SUI-1029':
    '걸음 수, 운동 시간, 활동 에너지, 심폐 체력 같은 기록을 보면 사용자가 실제로 얼마나 꾸준히 움직이는지 더 잘 판단할 수 있습니다. 이 프로젝트는 그 데이터를 활용해 웨어러블 기반 리워드 기준을 더 공정하고 정확하게 만드는 것이 목적입니다.',
  'REQ-SUI-1034':
    '수면 시간, 수면 단계, 마음챙김 시간을 함께 보면 회복 상태가 어떻게 달라지는지 이해할 수 있습니다. 이 데이터는 개인에게 더 잘 맞는 수면 코칭과 웨어러블 회복 기능을 개발하는 데 필요합니다.',
  'REQ-SUI-1041':
    '심박수, 심박 변화, 산소포화도, 혈압, 호흡수는 몸이 회복 중인지 무리하고 있는지 보여주는 기본 신호입니다. 이 프로젝트는 병원 밖에서도 회복 변화를 더 빨리 알아차리는 웨어러블 모니터링 기능을 만드는 것이 목적입니다.',
  'REQ-SUI-1058':
    '혈당과 인슐린 사용 흐름은 식사, 활동, 수면에 따른 대사 변화를 이해하는 데 필요합니다. 이 프로젝트는 원본 수치가 아닌 요약 데이터를 활용해 더 나은 대사 건강 관리 기능을 개발하는 것이 목적입니다.',
}

function getProjectPurposeSummary(request: ResearchRequest) {
  return projectPurposeSummaries[request.id] ?? `${request.purposeLabel} 기능 개선`
}

function getProjectPurposeDetail(request: ResearchRequest) {
  return projectPurposeDetails[request.id] ?? `${request.purposeLabel}에 필요한 건강 데이터 패턴을 이해하고 관련 기능을 개선하기 위한 프로젝트입니다.`
}

function getReadableRequiredData(request: ResearchRequest) {
  return [
    {
      label: '나이대',
      value: request.requiredAgeRanges.map(formatAgeRange).join(', '),
    },
    {
      label: '건강 기록',
      value: request.requiredConditionTags.map(formatConditionTag).join(', '),
    },
    {
      label: '지역',
      value: '시/도 수준의 지역 정보',
    },
    {
      label: '기록 기간',
      value: '월 단위 기간',
    },
  ]
}

function formatAgeRange(range: string) {
  const startAge = Number(range.split('-')[0])
  if (Number.isNaN(startAge)) return range

  return `${startAge}대`
}

function formatConditionTag(tag: string) {
  return readableConditionLabels[tag] ?? tag.replaceAll('_', ' ')
}

function formatAllowedUse(allowedUse: string) {
  return allowedUseLabels[allowedUse] ?? allowedUse
}

function ParticipationList({
  records,
  selectedRequestId,
  onSelectRequest,
}: {
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
            <Text style={styles.itemTitle}>참여 중인 프로젝트가 없습니다.</Text>
            <Text style={styles.itemMeta}>프로젝트 탭에서 참여할 항목을 선택하면 이곳에 표시됩니다.</Text>
          </CardContent>
        </Card>
      )}

      <ParticipationDetailModal record={detailRecord} onClose={() => setDetailRecord(null)} />
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

  return (
    <Pressable
      accessibilityLabel={`${record.title} 상세보기`}
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => (pressed ? styles.pressed : null)}
    >
      <Card style={selected ? styles.selectedCard : null}>
        <CardContent style={styles.serviceCardContent}>
          <View style={styles.serviceCardHeader}>
            <View style={styles.serviceCardCopy}>
              <Text style={styles.itemTitle}>{record.title}</Text>
              <Text style={styles.serviceOrganization}>목적: {getProjectPurposeSummary(record)}</Text>
              <Text style={styles.itemMeta}>진행 기관: {record.organization}</Text>
            </View>
          </View>

          <View style={styles.serviceRewardRow}>
            <View style={styles.serviceRewardCopy}>
              <Text style={styles.tinyMuted}>최근 제공</Text>
              <Text style={styles.serviceDetailValue}>{latestLog ? `${latestLog.date} · ${latestLog.status}` : '제공 내역 없음'}</Text>
            </View>
            <View style={styles.detailPill}>
              <Text style={styles.detailPillText}>상세보기</Text>
              <ChevronRight color={colors.text} size={15} strokeWidth={2.25} />
            </View>
          </View>
        </CardContent>
      </Card>
    </Pressable>
  )
}

function ParticipationDetailModal({
  onClose,
  record,
}: {
  onClose: () => void
  record: ParticipationRecord | null
}) {
  const provisionLogs = record ? getDataProvisionLogs(record) : []
  const defaultLogId = provisionLogs[0]?.id ?? null
  const [expandedLogId, setExpandedLogId] = useState<string | null>(defaultLogId)

  useEffect(() => {
    setExpandedLogId(defaultLogId)
  }, [defaultLogId])

  if (!record) return null

  const requiredData = getReadableRequiredData(record)

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible>
      <SafeAreaView style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <View style={styles.modalTitleGroup}>
            <Text style={styles.modalTitle}>{record.title}</Text>
            <Text style={styles.itemMeta}>진행 기관: {record.organization}</Text>
          </View>
          <Pressable accessibilityLabel="닫기" accessibilityRole="button" onPress={onClose} style={styles.iconButton}>
            <X color={colors.text} size={20} strokeWidth={2.2} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.calloutSoft}>
            <Text style={styles.calloutTitle}>프로젝트 목적</Text>
            <Text style={styles.calloutText}>{getProjectPurposeDetail(record)}</Text>
          </View>

          <Text style={styles.sectionHeading}>필요한 데이터</Text>
          <View style={styles.requiredDataList}>
            {requiredData.map((item) => (
              <View key={item.label} style={styles.requiredDataRow}>
                <Text style={styles.requiredDataLabel}>{item.label}</Text>
                <Text style={styles.requiredDataValue}>{item.value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.infoGrid}>
            <InfoRow label="활용 방식" value={formatAllowedUse(record.allowedUse)} />
            <InfoRow label="접근 요청 기한" value={record.expiresAt} />
            <InfoRow label="보상" value={record.reward} />
            <InfoRow label="모집 현황" value={record.participants} />
          </View>

          <View style={styles.accessLogSection}>
            <Text style={styles.sectionHeading}>데이터 제공 내역</Text>
            <Text style={styles.sectionLead}>제공 날짜를 열면 그날 보낸 데이터와 관리 상태를 확인할 수 있습니다.</Text>
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
              <Button icon={Plus} label="추가 제출하기" onPress={() => undefined} variant="secondary" />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
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

  return (
    <View style={styles.accessLogItem}>
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
            <Text style={styles.tinyMuted}>제공 데이터</Text>
            <Text style={styles.accessLogData}>{entry.dataLabel}</Text>
          </View>
          <View style={styles.accessManagementList}>
            {entry.management.map((item) => (
              <View key={item.label} style={styles.accessManagementRow}>
                <Text style={styles.accessManagementLabel}>{item.label}</Text>
                <Text style={styles.accessManagementValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  )
}

function getProvisionStatusTone(status: string) {
  if (status === '리워드 지급 완료') {
    return {
      backgroundColor: colors.successFill,
      borderColor: '#a9d9bd',
      color: colors.successText,
    }
  }

  if (status === 'Agent 검토중') {
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

  if (record.progressValue < 60) {
    return [
      {
        dataLabel: fullData,
        date: record.consentDate,
        id: `${record.id}-pending-${record.consentDate}`,
        management: [
          { label: 'Agent 검토', value: '보낼 데이터가 프로젝트 목적과 맞는지 확인 중입니다.' },
          { label: '전송 상태', value: '검토가 끝나기 전까지 기관은 데이터를 볼 수 없습니다.' },
          { label: '저장 방식', value: '전송 전 임시 요약만 만들고 원본 건강 기록은 앱 밖에 저장하지 않습니다.' },
        ],
        status: 'Agent 검토중',
        title: '데이터 제공 준비',
      },
    ]
  }

  return [
    {
      dataLabel: fullData,
      date: '2026.06.08',
      id: `${record.id}-20260608`,
      management: [
        { label: 'Agent 검증', value: '금지 데이터와 정밀 시간 정보가 제외됐는지 확인했습니다.' },
        { label: '제출 상태', value: '검토가 끝나면 제출 완료 상태로 전환됩니다.' },
        { label: '접근 권한', value: '검토 중에는 요청 기관이 데이터를 열람할 수 없습니다.' },
      ],
      status: 'Agent 검토중',
      title: '일일 건강 기록 업데이트',
    },
    {
      dataLabel: primaryData,
      date: '2026.06.07',
      id: `${record.id}-20260607`,
      management: [
        { label: 'Agent 검증', value: '프로젝트 목적에 필요한 항목만 남기고 상세 식별 정보는 제외했습니다.' },
        { label: '기관 접근', value: '요청 기관은 요약 데이터와 접근 로그만 확인할 수 있습니다.' },
        { label: '보상 처리', value: '접근 기록이 확인되면 보상 조건에 반영됩니다.' },
      ],
      status: '제출 완료',
      title: `${formatAllowedUse(record.allowedUse)}용 요약 제공`,
    },
    {
      dataLabel: primaryData,
      date: '2026.06.06',
      id: `${record.id}-20260606`,
      management: [
        { label: '동의 기록', value: '사용자 동의와 접근 요청 조건이 Sui 이벤트로 남았습니다.' },
        { label: '저장 방식', value: '원본 센서값은 보관하지 않고 연구용 범주 데이터만 연결했습니다.' },
        { label: '리워드', value: `${record.reward} 보상 지급이 완료되었습니다.` },
      ],
      status: '리워드 지급 완료',
      title: '초기 데이터 제공',
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
    { label: '선호 제공 목적', value: '보험 리워드, 건강 코칭' },
    { label: '반복 적용 규칙', value: '상세 위치와 정밀 시간 제외' },
    { label: '최근 검증 정책', value: 'mvp-health-v1' },
  ]

  return (
    <View style={styles.detailGrid}>
      <Card>
        <CardHeader>
          <CardTitle>Agent 상태</CardTitle>
          <CardDescription>내 데이터 제공 전에 정책과 동의 범위를 검토합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <View style={styles.statGrid}>
            <AgentStat icon={BrainCircuit} label="Agent v0.1.0" value="검증 대기 없음" />
            <AgentStat icon={CheckCircle2} label="정책 통과" value="금지 필드 미탐지" />
            <AgentStat icon={LockKeyhole} label="권한 범위" value="사용자 승인 필요" />
          </View>

          <Separator />

          <View>
            <Text style={styles.sectionHeading}>Agent memory</Text>
            <Text style={styles.sectionLead}>
              이전 선택과 선호를 기억하지만, 사용자 승인 없이 동의나 복호화 권한을 만들지 않습니다.
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
          <CardTitle>검증 체크</CardTitle>
          <CardDescription>업로드 전 Agent가 확인하는 항목</CardDescription>
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
          <CardTitle>Agent 제한</CardTitle>
          <CardDescription style={styles.agentLimitDescription}>사용자 보호 원칙</CardDescription>
        </CardHeader>
        <CardContent>
          <Text style={styles.limitText}>원본 PHI를 플랫폼 서버로 보내지 않습니다.</Text>
          <Text style={styles.limitText}>사용자 승인 없이 동의를 생성하지 않습니다.</Text>
          <Text style={styles.limitText}>금지 필드가 남아 있으면 업로드를 승인하지 않습니다.</Text>
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
    justifyContent: 'flex-end',
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
