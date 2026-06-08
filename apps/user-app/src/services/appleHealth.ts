import { Platform } from 'react-native'
import type { CategorySampleTyped, ObjectTypeIdentifier } from '@kingstinct/react-native-healthkit'

const appleHealthReadTypes = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierHeartRate',
  'HKCategoryTypeIdentifierSleepAnalysis',
] satisfies readonly ObjectTypeIdentifier[]

const asleepValues = new Set<number>([
  1,
  3,
  4,
  5,
])
const asleepDeepValue = 4

export type AppleHealthSnapshot = {
  heartRate?: {
    bpm: number
    measuredAt: Date
  }
  sleep: {
    deepMinutes: number
    endDate?: Date
    startDate?: Date
    totalMinutes: number
  }
  steps: number
  syncedAt: Date
}

export type AppleHealthResult =
  | {
      reason: 'platform' | 'unavailable' | 'authorization'
      status: 'unsupported'
    }
  | {
      error: string
      status: 'error'
    }
  | {
      snapshot: AppleHealthSnapshot
      status: 'success'
    }

export async function fetchAppleHealthSnapshot(): Promise<AppleHealthResult> {
  if (Platform.OS !== 'ios') {
    return { reason: 'platform', status: 'unsupported' }
  }

  try {
    const {
      getMostRecentQuantitySample,
      isHealthDataAvailable,
      queryCategorySamples,
      queryStatisticsForQuantity,
      requestAuthorization,
    } = await import('@kingstinct/react-native-healthkit')

    if (!isHealthDataAvailable()) {
      return { reason: 'unavailable', status: 'unsupported' }
    }

    const authorized = await requestAuthorization({ toRead: appleHealthReadTypes })

    if (!authorized) {
      return { reason: 'authorization', status: 'unsupported' }
    }

    const now = new Date()
    const todayStart = startOfDay(now)
    const sleepWindowStart = new Date(todayStart)
    sleepWindowStart.setHours(-12, 0, 0, 0)

    const [stepStats, heartRateSample, sleepSamples] = await Promise.all([
      queryStatisticsForQuantity('HKQuantityTypeIdentifierStepCount', ['cumulativeSum'], {
        filter: { date: { endDate: now, startDate: todayStart } },
        unit: 'count',
      }),
      getMostRecentQuantitySample('HKQuantityTypeIdentifierHeartRate', 'count/min'),
      queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
        ascending: true,
        filter: { date: { endDate: now, startDate: sleepWindowStart } },
        limit: 0,
      }),
    ])

    return {
      snapshot: {
        heartRate: heartRateSample
          ? {
              bpm: Math.round(heartRateSample.quantity),
              measuredAt: asDate(heartRateSample.endDate),
            }
          : undefined,
        sleep: summarizeSleep(sleepSamples),
        steps: Math.max(0, Math.round(stepStats.sumQuantity?.quantity ?? 0)),
        syncedAt: now,
      },
      status: 'success',
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Apple 건강 데이터를 가져오지 못했습니다.',
      status: 'error',
    }
  }
}

export function getAppleHealthSupportMessage(reason: 'platform' | 'unavailable' | 'authorization') {
  if (reason === 'platform') return 'Apple 건강정보는 iOS 실기기 또는 iOS 개발 빌드에서만 사용할 수 있습니다.'
  if (reason === 'authorization') return 'Apple 건강정보 읽기 권한이 필요합니다. iOS 건강 앱 설정에서 권한을 확인해 주세요.'
  return '이 기기에서는 Apple 건강정보를 사용할 수 없습니다.'
}

function summarizeSleep(samples: readonly CategorySampleTyped<'HKCategoryTypeIdentifierSleepAnalysis'>[]) {
  let deepMinutes = 0
  let totalMinutes = 0
  let startDate: Date | undefined
  let endDate: Date | undefined

  for (const sample of samples) {
    if (!asleepValues.has(sample.value)) continue

    const sampleStart = asDate(sample.startDate)
    const sampleEnd = asDate(sample.endDate)
    const durationMinutes = Math.max(0, (sampleEnd.getTime() - sampleStart.getTime()) / 60000)

    totalMinutes += durationMinutes
    if (sample.value === asleepDeepValue) {
      deepMinutes += durationMinutes
    }

    if (!startDate || sampleStart < startDate) startDate = sampleStart
    if (!endDate || sampleEnd > endDate) endDate = sampleEnd
  }

  return {
    deepMinutes: Math.round(deepMinutes),
    endDate,
    startDate,
    totalMinutes: Math.round(totalMinutes),
  }
}

function startOfDay(date: Date) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  return start
}

function asDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value)
}
