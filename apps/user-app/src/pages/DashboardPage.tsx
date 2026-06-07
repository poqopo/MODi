import { useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
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
  AlertTriangle,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Footprints,
  HeartPulse,
  LockKeyhole,
  Moon,
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
import { agentChecks, connectedHealthApps, participationRecords, researchRequests, sampleFields } from '../data/mvp'
import { colors, radii, shadow } from '../styles/theme'
import type { ConnectedHealthApp, DashboardTab, ParticipationRecord, ResearchRequest } from '../types/dashboard'

type LogTone = 'blue' | 'yellow' | 'red'
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
type RequestCategoryFilter = 'all' | ResearchRequest['category']

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

const appleHealthMetrics = [
  {
    detail: '오늘 08:00 동기화',
    icon: Footprints,
    label: '걸음 수',
    progress: 84,
    unit: '보',
    value: '8,426',
  },
  {
    detail: '깊은 수면 2.1시간',
    icon: Moon,
    label: '수면',
    progress: 90,
    unit: '시간',
    value: '7.2',
  },
  {
    detail: '안정시 범위',
    icon: HeartPulse,
    label: '심박',
    progress: 72,
    unit: 'bpm',
    value: '72',
  },
]

const sleepCycleSegments = [
  { color: '#bcd7ff', flex: 18, height: 44, label: '얕은 수면', time: '23:40' },
  { color: '#7ea7f8', flex: 15, height: 64, label: 'REM', time: '00:45' },
  { color: '#2947a9', flex: 22, height: 82, label: '깊은 수면', time: '01:40' },
  { color: '#bcd7ff', flex: 18, height: 48, label: '얕은 수면', time: '03:05' },
  { color: '#7ea7f8', flex: 13, height: 68, label: 'REM', time: '04:20' },
  { color: '#f5c26f', flex: 6, height: 34, label: '깸', time: '05:18' },
  { color: '#bcd7ff', flex: 18, height: 46, label: '얕은 수면', time: '05:40' },
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
  const isWide = width >= 720

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        style={styles.pageViewport}
        contentContainerStyle={[styles.pageScroll, isWide ? styles.pageScrollWide : null]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>

      <BottomTabBar activeTab={activeTab} isWide={isWide} onTabChange={onTabChange} />
    </SafeAreaView>
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
  const appleHealthApp = connectedHealthApps.find((app) => app.id === 'apple-health') ?? connectedHealthApps[0]
  const [isAppleHealthConnected, setIsAppleHealthConnected] = useState(appleHealthApp.status === '연동됨')
  const [lastSyncedAt, setLastSyncedAt] = useState('오늘 08:00 동기화')

  const handleAppleHealthPress = () => {
    if (!isAppleHealthConnected) {
      setIsAppleHealthConnected(true)
      setLastSyncedAt('방금 연동됨')
      return
    }

    setLastSyncedAt('방금 동기화됨')
  }

  return (
    <View style={styles.homePage}>
      <Card style={[styles.appleHealthCard, isAppleHealthConnected ? styles.appleHealthCardConnected : null]}>
        <CardContent style={styles.appleHealthContent}>
          <View style={styles.appleHealthHeader}>
            <View style={styles.appleHealthTitleRow}>
              <View style={styles.appleHealthIcon}>
                <HeartPulse color={colors.primary} size={22} strokeWidth={2.25} />
              </View>
              <View style={styles.appleHealthTitleCopy}>
                <Text style={styles.appleHealthTitle}>Apple 건강정보</Text>
                <Text style={styles.itemMeta}>
                  {isAppleHealthConnected ? lastSyncedAt : '걸음 수, 수면, 심박 데이터를 가져옵니다.'}
                </Text>
              </View>
            </View>
            <Badge label={isAppleHealthConnected ? '연동됨' : '미연동'} variant={isAppleHealthConnected ? 'success' : 'secondary'} />
          </View>

          {isAppleHealthConnected ? (
            <>
              <View style={styles.homeMetricGrid}>
                {appleHealthMetrics.map((metric) => (
                  <HomeMetricCard key={metric.label} metric={metric} />
                ))}
              </View>

              <SleepCycleGraph />
            </>
          ) : (
            <View style={styles.notConnectedPanel}>
              <Text style={styles.itemTitle}>Apple 건강정보 연동이 필요합니다.</Text>
              <Text style={styles.itemMeta}>연동 후 홈에서 오늘의 걸음 수, 수면 시간, 심박 데이터를 바로 확인할 수 있습니다.</Text>
            </View>
          )}

          <View style={styles.appleHealthActionRow}>
            <View style={styles.appleHealthDataTypes}>
              {appleHealthApp.dataTypes.map((type) => (
                <Badge key={type} label={type} variant="outline" />
              ))}
            </View>
            <Button
              icon={isAppleHealthConnected ? RefreshCw : undefined}
              label={isAppleHealthConnected ? '새로 동기화' : '연동하기'}
              onPress={handleAppleHealthPress}
              trailingIcon={isAppleHealthConnected ? undefined : ChevronRight}
            />
          </View>
        </CardContent>
      </Card>
    </View>
  )
}

function SleepCycleGraph() {
  return (
    <View style={styles.sleepCyclePanel}>
      <View style={styles.sleepCycleHeader}>
        <View>
          <Text style={styles.metricLabel}>수면 주기</Text>
          <Text style={styles.measurementDetail}>23:40 - 07:02</Text>
        </View>
        <Badge label="수면 효율 91%" variant="secondary" />
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
    <View style={styles.homeMetricCard}>
      <View style={styles.homeMetricHeader}>
        <View style={styles.metricIcon}>
          <Icon color={colors.primary} size={20} strokeWidth={2.25} />
        </View>
        <Text style={styles.metricLabel}>{metric.label}</Text>
      </View>
      <View style={styles.homeMetricValueRow}>
        <Text style={styles.homeMetricValue}>{metric.value}</Text>
        <Text style={styles.homeMetricUnit}>{metric.unit}</Text>
      </View>
      <Progress value={metric.progress} />
      <Text style={styles.measurementDetail}>{metric.detail}</Text>
    </View>
  )
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
      <View style={styles.filterPanel}>
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
      </View>

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
    <Card style={selected ? styles.selectedCard : null}>
      <CardContent style={styles.serviceCardContent}>
        <View style={styles.serviceCardHeader}>
          <View style={styles.serviceCardCopy}>
            <Text style={styles.itemTitle}>{request.title}</Text>
            <Text style={styles.serviceOrganization}>{request.organization}</Text>
            <Text style={styles.itemMeta}>{request.description}</Text>
          </View>
          <View style={styles.serviceBadgeStack}>
            <Badge label={request.categoryLabel} variant="secondary" />
          </View>
        </View>

        <View style={styles.serviceRewardRow}>
          <View style={styles.serviceRewardCopy}>
            <Text style={styles.tinyMuted}>보상</Text>
            <Text style={styles.rewardText}>{request.reward}</Text>
          </View>
          <Button
            label="참여하기"
            onPress={onOpen}
            size="sm"
            trailingIcon={ChevronRight}
          />
        </View>
      </CardContent>
    </Card>
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

  const requiredData = [
    { label: '연령대', value: request.requiredAgeRanges.join(', '), reason: '정확한 생년월일 대신 범주형 연령대만 사용합니다.' },
    { label: '제공 태그', value: request.requiredConditionTags.join(', '), reason: '원본 센서값이 아닌 제공용 범주 태그만 포함합니다.' },
    { label: '지역', value: 'KR 단위 지역 코드', reason: '상세 주소나 GPS 좌표는 제외합니다.' },
    { label: '측정 기간', value: '월 단위 recordedMonth', reason: '정밀 타임스탬프와 초 단위 기록은 제외합니다.' },
  ]

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible>
      <SafeAreaView style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <View style={styles.modalTitleGroup}>
            <Badge label={request.categoryLabel} variant="dark" />
            <Text style={styles.modalTitle}>{request.title}</Text>
          </View>
          <Pressable accessibilityLabel="닫기" accessibilityRole="button" onPress={onClose} style={styles.iconButton}>
            <X color={colors.text} size={20} strokeWidth={2.2} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.modalDescription}>
            {request.organization}에서 운영하는 프로젝트입니다. 동의한 범위의 건강 데이터만 제공하고 조건을 충족하면 보상을
            받을 수 있습니다.
          </Text>

          <View style={styles.calloutSoft}>
            <Text style={styles.calloutTitle}>프로젝트 목적</Text>
            <Text style={styles.calloutText}>
              {request.purposeLabel}를 위해 동의한 사용자의 범주형 웨어러블 데이터를 처리합니다. 플랫폼은 원본
              센서 기록을 보관하지 않고 Sui에는 동의, 접근, 보상 상태만 기록합니다.
            </Text>
          </View>

          <Text style={styles.sectionHeading}>필요한 데이터</Text>
          <View style={styles.requiredDataList}>
            {requiredData.map((item) => (
              <View key={item.label} style={styles.requiredDataRow}>
                <View style={styles.requiredDataCopy}>
                  <Text style={styles.requiredDataLabel}>{item.label}</Text>
                  <Text style={styles.requiredDataReason}>{item.reason}</Text>
                </View>
                <Text style={styles.requiredDataValue}>{item.value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.infoGrid}>
            <InfoRow label="허용 활용" value={request.allowedUse} />
            <InfoRow label="보관 기간" value={`${request.retentionDays}일`} />
            <InfoRow label="접근 기간" value={request.accessWindow} />
            <InfoRow label="보상" value={request.reward} />
            <InfoRow label="마감일" value={request.expiresAt} />
            <InfoRow label="모집 현황" value={request.participants} />
          </View>

          <View style={styles.warningPanel}>
            <Text style={styles.calloutTitle}>제외되는 데이터</Text>
            <Text style={styles.calloutText}>
              이름, 전화번호, 이메일, 상세 주소, GPS 원본, 정밀 타임스탬프, 원본 센서 스트림은 제공 대상이 아닙니다.
            </Text>
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

  if (detailRecord) {
    return <ParticipationDetailPage record={detailRecord} onBack={() => setDetailRecord(null)} />
  }

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
  return (
    <Card style={selected ? styles.selectedCard : null}>
      <CardContent style={styles.serviceCardContent}>
        <View style={styles.serviceCardHeader}>
          <View style={styles.serviceCardCopy}>
            <Text style={styles.itemTitle}>{record.title}</Text>
            <Text style={styles.itemMeta}>{record.description}</Text>
          </View>
          <Badge label={record.consentStatus} variant={record.progressValue >= 60 ? 'success' : 'warning'} />
        </View>

        <View style={styles.serviceRewardRow}>
          <View style={styles.serviceRewardCopy}>
            <Text style={styles.tinyMuted}>보상</Text>
            <Text style={styles.rewardText}>{record.reward}</Text>
          </View>
          <Button label="상세 보기" onPress={onOpen} size="sm" trailingIcon={ChevronRight} variant="outline" />
        </View>
      </CardContent>
    </Card>
  )
}

function FilterGroup({ children, label }: { children: ReactNode; label: string }) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterGroupLabel}>{label}</Text>
      <View style={styles.filterGroupControls}>{children}</View>
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

function ParticipationDetailPage({ record, onBack }: { record: ParticipationRecord; onBack: () => void }) {
  const logs = getParticipationLogs(record)

  return (
    <View style={styles.detailGrid}>
      <Card>
        <CardHeader>
          <View style={styles.detailHeader}>
            <View style={styles.detailHeaderCopy}>
              <Badge label={record.consentStatus} variant={record.progressValue >= 60 ? 'success' : 'warning'} />
              <CardTitle style={styles.detailTitle}>{record.title}</CardTitle>
              <CardDescription>{record.organization}</CardDescription>
            </View>
            <Button icon={ChevronLeft} label="목록" onPress={onBack} size="sm" variant="outline" />
          </View>
        </CardHeader>
        <CardContent>
          <View style={styles.infoGrid}>
            <InfoRow label="요청 목적" value={record.purposeLabel} />
            <InfoRow label="동의일" value={record.consentDate} />
            <InfoRow label="동의 상태" value={record.consentStatus} />
            <InfoRow label="접근 상태" value={record.accessStatus} />
            <InfoRow label="보상 상태" value={record.rewardStatus} />
            <InfoRow label="예상 보상" value={record.reward} />
          </View>

          <View style={styles.warningPanel}>
            <Text style={styles.calloutTitle}>데이터 제공 기록</Text>
            <Text style={styles.calloutText}>
              사용자가 동의한 뒤 Agent가 금지 필드를 확인하고, 암호화된 데이터와 manifest 참조만 Walrus/Sui 로그로
              남긴 기록입니다.
            </Text>
          </View>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>데이터 제공 로그</CardTitle>
          <CardDescription>내 데이터가 언제 처리되고 참조되었는지 보여주는 감사 이력</CardDescription>
        </CardHeader>
        <CardContent>
          <View style={styles.legendRow}>
            <LogLegend color="blue" label="통과" />
            <LogLegend color="yellow" label="Agent 검증중" />
            <LogLegend color="red" label="오류 발견" />
          </View>
          <View style={styles.logList}>
            {logs.map((log) => (
              <LogCard key={`${log.event}-${log.date}`} log={log} />
            ))}
          </View>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>제공 데이터 범위</CardTitle>
          <CardDescription>원본이 아닌 가명처리 필드</CardDescription>
        </CardHeader>
        <CardContent>
          <View style={styles.fieldTable}>
            {sampleFields.map((field) => (
              <View key={field.key} style={styles.fieldRow}>
                <View style={styles.fieldRowCopy}>
                  <Text style={styles.tinyMuted}>{field.label}</Text>
                  <Text style={styles.fieldPolicy}>{field.policy}</Text>
                </View>
                <Text style={styles.fieldRowValue}>{field.value}</Text>
              </View>
            ))}
          </View>
        </CardContent>
      </Card>
    </View>
  )
}

function getParticipationLogs(record: ParticipationRecord) {
  if (record.consentStatus.includes('대기') || record.progressValue < 60) {
    return [
      {
        date: '2026.06.05',
        event: 'AgentReviewStarted',
        title: 'Agent 검증중',
        detail: 'Agent가 요청 목적과 데이터 범위가 사용자 선호와 충돌하지 않는지 확인하기 시작했습니다.',
        icon: BrainCircuit,
        tone: 'yellow' as const,
      },
      {
        date: '2026.06.05',
        event: 'ForbiddenFieldScan',
        title: '오류 발견',
        detail: '정밀 시간 필드가 남아 있어 업로드 전 월 단위 recordedMonth로 다시 변환해야 합니다.',
        icon: AlertTriangle,
        tone: 'red' as const,
      },
    ]
  }

  return [
    {
      date: '2026.06.06',
      event: 'DataAssetRegistered',
      title: '통과',
      detail: '암호화된 데이터셋과 manifest blob 참조가 Walrus에 저장되고 Sui DataAsset으로 연결되었습니다.',
      icon: ClipboardList,
      tone: 'blue' as const,
    },
    {
      date: '2026.06.06',
      event: 'ConsentGranted',
      title: '통과',
      detail: `${record.purposeLabel} 목적과 ${record.accessWindow} 접근 기간에 대해 사용자 동의가 기록되었습니다.`,
      icon: CheckCircle2,
      tone: 'blue' as const,
    },
    {
      date: '2026.06.06',
      event: 'SealPolicyLinked',
      title: '통과',
      detail: '유효한 ConsentGrant가 있을 때만 요청자가 복호화 권한을 요청할 수 있도록 Seal policy가 연결되었습니다.',
      icon: LockKeyhole,
      tone: 'blue' as const,
    },
    {
      date: '2026.06.06',
      event: 'RewardEscrowPending',
      title: '통과',
      detail: `${record.reward} 보상은 접근 또는 활용 완료 이벤트 이후 지급 대기 상태로 전환됩니다.`,
      icon: Wallet,
      tone: 'blue' as const,
    },
  ]
}

function LogCard({
  log,
}: {
  log: {
    date: string
    detail: string
    event: string
    icon: LucideIcon
    title: string
    tone: LogTone
  }
}) {
  const tone = logToneStyle(log.tone)
  const Icon = log.icon

  return (
    <View style={styles.logCard}>
      <View style={[styles.logIcon, { backgroundColor: tone.iconBackground }]}>
        <Icon color={tone.iconColor} size={20} strokeWidth={2.2} />
      </View>
      <View style={styles.logCopy}>
        <Text style={styles.logDate}>{log.date}</Text>
        <Text style={styles.logEvent}>{log.event}</Text>
        <Text style={styles.logDetail}>{log.detail}</Text>
      </View>
    </View>
  )
}

function LogLegend({ color, label }: { color: LogTone; label: string }) {
  const tone = logToneStyle(color)

  return (
    <View style={styles.legendPill}>
      <View style={[styles.legendDot, { backgroundColor: tone.dot }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  )
}

function logToneStyle(tone: LogTone) {
  const stylesByTone = {
    blue: {
      dot: colors.primary,
      iconBackground: colors.successFill,
      iconColor: colors.successText,
    },
    red: {
      dot: colors.danger,
      iconBackground: '#fff1f5',
      iconColor: colors.danger,
    },
    yellow: {
      dot: colors.accentText,
      iconBackground: colors.accent,
      iconColor: colors.accentText,
    },
  }

  return stylesByTone[tone]
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
  appleHealthActionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  appleHealthCard: {
    borderColor: colors.border,
  },
  appleHealthCardConnected: {
    borderColor: '#a9d9bd',
  },
  appleHealthContent: {
    gap: 16,
  },
  appleHealthDataTypes: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    minWidth: 180,
  },
  appleHealthHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  appleHealthIcon: {
    alignItems: 'center',
    backgroundColor: colors.successFill,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  appleHealthTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '300',
    lineHeight: 29,
  },
  appleHealthTitleCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  appleHealthTitleRow: {
    alignItems: 'flex-start',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minWidth: 0,
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
  detailHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  detailHeaderCopy: {
    flex: 1,
    gap: 8,
  },
  detailTitle: {
    marginTop: 2,
  },
  fieldPolicy: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  fieldRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fieldRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  fieldRowValue: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  fieldTable: {
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
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
    flexWrap: 'wrap',
    gap: 8,
  },
  filterGroupLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  filterPanel: {
    backgroundColor: colors.surface,
    borderColor: '#d8e0e8',
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 14,
    padding: 12,
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
    gap: 10,
    minWidth: 150,
    padding: 14,
  },
  homeMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  homeMetricHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  homeMetricUnit: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    paddingBottom: 5,
  },
  homeMetricValue: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 40,
  },
  homeMetricValueRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 7,
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
  legendDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  legendPill: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  legendText: {
    color: colors.muted,
    fontSize: 12,
  },
  limitText: {
    color: '#273951',
    fontSize: 14,
    lineHeight: 22,
  },
  logCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  logCopy: {
    flex: 1,
    gap: 3,
  },
  logDate: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  logDetail: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  logEvent: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  logIcon: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  logList: {
    gap: 10,
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
  pageScrollWide: {
    alignSelf: 'center',
    maxWidth: 760,
    width: '100%',
  },
  pageViewport: {
    flex: 1,
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
  notConnectedPanel: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 6,
    padding: 14,
  },
  rewardRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  requiredDataCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  requiredDataLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  requiredDataList: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  requiredDataReason: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
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
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    maxWidth: '48%',
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
  serviceBadgeStack: {
    alignItems: 'flex-end',
    gap: 6,
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
    gap: 12,
    justifyContent: 'space-between',
  },
  sleepCycleLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  sleepCyclePanel: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 12,
    padding: 14,
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
    lineHeight: 14,
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
    height: 104,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingTop: 10,
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
