type VerifyParticipantPayloadBody = {
  participantLoginId?: unknown
  payload?: unknown
  payloadHash?: unknown
  privacyPolicyBlobId?: unknown
  privacyPolicyHash?: unknown
  privacyPolicyVersion?: unknown
  projectPublicCode?: unknown
  securityMemoryBlobId?: unknown
  securityMemoryHash?: unknown
  securityMemoryVersion?: unknown
}

type VerificationFinding = {
  code: string
  detail: string
  path: string
  severity: 'error' | 'warning'
}

type QuasiIdentifierSignal = {
  code: string
  path: string
}

type PolicyMemory = {
  blobId: string
  fetchedAt: string
  forbiddenFields: string[]
  hash: string
  payload: unknown
  version: string | null
}

type SecurityMemoryKnownRiskPattern = {
  findingCodes: string[]
  id: string | null
  recommendedTransforms: SecurityMemoryRecommendedTransform[]
  signalCodes: string[]
}

type SecurityMemoryRecommendedTransform = {
  action: string
  field: string
  target: string
}

type SecurityMemory = {
  blobId: string
  fetchedAt: string
  hash: string
  knownRiskPatterns: SecurityMemoryKnownRiskPattern[]
  payload: unknown
  version: string | null
}

type SecurityMemoryPatch = {
  basedOnSecurityMemory: {
    blobId: string
    hash: string
    version: string | null
  } | null
  createdAt: string
  findingCodes: string[]
  policyMemory: {
    blobId: string
    hash: string
    version: string | null
  } | null
  projectPublicCode: string
  recommendedTransforms: SecurityMemoryRecommendedTransform[]
  riskSignals: QuasiIdentifierSignal[]
  schemaVersion: 'modi.security-memory-patch.v1'
  source: 'platform_security_agent'
}

const DEFAULT_WALRUS_AGGREGATOR_URL = 'https://aggregator.walrus-testnet.walrus.space'
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const directIdentifierKeys = new Set([
  'address',
  'birthDate',
  'birth_date',
  'email',
  'fullName',
  'full_name',
  'loginId',
  'name',
  'phone',
  'preciseLocation',
  'rawDate',
  'rawStepCount',
  'rawTimestamp',
  'walletAddress',
])
const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const suiAddressPattern = /0x[a-f0-9]{40,64}/i
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return jsonResponse({ ok: true })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  try {
    const body = (await request.json().catch(() => null)) as VerifyParticipantPayloadBody | null
    const payload = body?.payload
    const participantLoginId = readOptionalText(body?.participantLoginId)
    const projectPublicCode = readOptionalText(body?.projectPublicCode)
    const privacyPolicyBlobId = readOptionalText(body?.privacyPolicyBlobId)
    const privacyPolicyHash = readOptionalText(body?.privacyPolicyHash)
    const privacyPolicyVersion = readOptionalText(body?.privacyPolicyVersion)
    const securityMemoryBlobId = readOptionalText(body?.securityMemoryBlobId)
    const securityMemoryHash = readOptionalText(body?.securityMemoryHash)
    const securityMemoryVersion = readOptionalText(body?.securityMemoryVersion)
    const suppliedPayloadHash = readOptionalText(body?.payloadHash)

    if (!body || !payload || !projectPublicCode) {
      return jsonResponse({ error: 'projectPublicCode and payload are required.' }, 400)
    }

    const payloadHash = await sha256Hex(stableStringify(payload))
    const findings: VerificationFinding[] = []
    const [policyMemory, securityMemory] = await Promise.all([
      privacyPolicyBlobId
        ? fetchPolicyMemory({
            blobId: privacyPolicyBlobId,
          })
        : Promise.resolve(null),
      securityMemoryBlobId
        ? fetchSecurityMemory({
            blobId: securityMemoryBlobId,
          })
        : Promise.resolve(null),
    ])
    const forbiddenFields = buildForbiddenFields(policyMemory)

    if (policyMemory && privacyPolicyHash && policyMemory.hash !== privacyPolicyHash) {
      findings.push({
        code: 'policy_memory_hash_mismatch',
        detail: 'Walrus policy memory hash와 연구에 저장된 policy hash가 일치하지 않습니다.',
        path: '$.policy',
        severity: 'error',
      })
    }

    if (securityMemory && securityMemoryHash && securityMemory.hash !== securityMemoryHash) {
      findings.push({
        code: 'security_memory_hash_mismatch',
        detail: 'Walrus Security Memory hash와 연구에 저장된 Security Memory hash가 일치하지 않습니다.',
        path: '$.securityMemory',
        severity: 'error',
      })
    }

    verifySecurityMemoryRisk({
      findings,
      path: '$',
      securityMemory,
      value: payload,
    })
    verifyPayload({
      forbiddenFields,
      findings,
      participantLoginId,
      path: '$',
      value: payload,
    })
    verifyQuasiIdentifierRisk({
      findings,
      path: '$',
      value: payload,
    })

    if (suppliedPayloadHash && suppliedPayloadHash !== payloadHash) {
      findings.push({
        code: 'payload_hash_mismatch',
        detail: 'user-app이 보낸 payloadHash와 서버 재계산 hash가 일치하지 않습니다.',
        path: '$',
        severity: 'error',
      })
    }

    const verified = !findings.some((finding) => finding.severity === 'error')
    const verifiedAt = new Date().toISOString()
    const securityMemoryPatch = buildSecurityMemoryPatch({
      createdAt: verifiedAt,
      findings,
      policyMemory,
      projectPublicCode,
      securityMemory,
      value: payload,
    })
    const receipt = {
      schemaVersion: 'modi.security-agent-verification-receipt.v1',
      verifiedAt,
      verified,
      projectPublicCode,
      payloadHash,
      policyMemory: buildPolicyMemoryReceipt(policyMemory),
      privacyPolicyHash,
      privacyPolicyVersion,
      securityMemory: buildSecurityMemoryReceipt(securityMemory),
      securityMemoryPatch,
      securityMemoryVersion,
      findingCount: findings.length,
      findings,
    }
    const receiptHash = await sha256Hex(stableStringify(receipt))

    return jsonResponse({
      findings,
      payloadHash,
      policyMemory: buildPolicyMemoryReceipt(policyMemory),
      receiptHash,
      securityAgent: {
        name: 'MODi Platform Security Agent',
        knownSecurityMemoryPatternCount: securityMemory?.knownRiskPatterns.length ?? 0,
        policyMemoryUsed: Boolean(policyMemory),
        policyMemoryBlobId: policyMemory?.blobId ?? null,
        policyMemoryHash: policyMemory?.hash ?? null,
        policyMemoryVersion: policyMemory?.version ?? privacyPolicyVersion,
        securityMemoryBlobId: securityMemory?.blobId ?? null,
        securityMemoryHash: securityMemory?.hash ?? null,
        securityMemoryUsed: Boolean(securityMemory),
        securityMemoryVersion: securityMemory?.version ?? securityMemoryVersion,
        forbiddenFieldCount: forbiddenFields.size,
      },
      securityMemory: buildSecurityMemoryReceipt(securityMemory),
      securityMemoryPatch,
      verified,
      verifiedAt,
      summary: buildSummary(verified, findings),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown payload verification error.'
    return jsonResponse({ error: message }, 500)
  }
})

function verifyPayload({
  forbiddenFields,
  findings,
  participantLoginId,
  path,
  value,
}: {
  forbiddenFields: Set<string>
  findings: VerificationFinding[]
  participantLoginId: string | null
  path: string
  value: unknown
}) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      verifyPayload({
        forbiddenFields,
        findings,
        participantLoginId,
        path: `${path}[${index}]`,
        value: item,
      })
    })
    return
  }

  if (!value || typeof value !== 'object') {
    verifyScalar({ findings, participantLoginId, path, value })
    return
  }

  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const nextPath = `${path}.${key}`

    if (forbiddenFields.has(key)) {
      findings.push({
        code: directIdentifierKeys.has(key) ? 'direct_identifier_key_present' : 'policy_forbidden_field_present',
        detail: `${key} 필드는 Walrus policy memory 기준으로 user-app 로컬 가명처리 단계에서 제거되어야 합니다.`,
        path: nextPath,
        severity: 'error',
      })
    }

    verifyPayload({
      forbiddenFields,
      findings,
      participantLoginId,
      path: nextPath,
      value: item,
    })
  }
}

function verifyScalar({
  findings,
  participantLoginId,
  path,
  value,
}: {
  findings: VerificationFinding[]
  participantLoginId: string | null
  path: string
  value: unknown
}) {
  if (typeof value !== 'string') {
    return
  }

  if (timestampPattern.test(value)) {
    findings.push({
      code: 'exact_timestamp_present',
      detail: '정확한 타임스탬프는 user-app 가명처리 단계에서 월 단위로 일반화되어야 합니다.',
      path,
      severity: 'error',
    })
  } else if (dateOnlyPattern.test(value)) {
    findings.push({
      code: 'exact_date_present',
      detail: '정확한 날짜는 user-app 가명처리 단계에서 월 단위로 일반화되어야 합니다.',
      path,
      severity: 'error',
    })
  }

  if (emailPattern.test(value)) {
    findings.push({
      code: 'email_pattern_present',
      detail: '이메일 패턴은 user-app 가명처리 단계에서 제거되어야 합니다.',
      path,
      severity: 'error',
    })
  }

  if (suiAddressPattern.test(value)) {
    findings.push({
      code: 'wallet_address_pattern_present',
      detail: '지갑 주소는 user-app 가명처리 단계에서 payload 밖으로 분리되어야 합니다.',
      path,
      severity: 'error',
    })
  }

  if (participantLoginId && value.toLowerCase().includes(participantLoginId.toLowerCase())) {
    findings.push({
      code: 'participant_login_id_present',
      detail: '로그인 ID는 user-app 가명처리 단계에서 payload 밖으로 분리되어야 합니다.',
      path,
      severity: 'error',
    })
  }

  if (isPhoneLikeValue(value)) {
    findings.push({
      code: 'phone_value_present',
      detail: '전화번호 형태의 문자열은 user-app 가명처리 단계에서 제거되어야 합니다.',
      path,
      severity: 'error',
    })
  }
}

function isPhoneLikeValue(value: string) {
  const trimmedValue = value.trim()

  if (dateOnlyPattern.test(trimmedValue) || timestampPattern.test(trimmedValue)) {
    return false
  }

  const digits = trimmedValue.replace(/\D/g, '')
  return digits.length >= 8 && digits.length <= 15 && /^\+?[\d\s().-]+$/.test(trimmedValue)
}

function verifySecurityMemoryRisk({
  findings,
  path,
  securityMemory,
  value,
}: {
  findings: VerificationFinding[]
  path: string
  securityMemory: SecurityMemory | null
  value: unknown
}) {
  if (!securityMemory || securityMemory.knownRiskPatterns.length === 0) {
    return
  }

  const signals = collectQuasiIdentifierSignals({ path, value })
  const signalCodes = new Set(signals.map((signal) => signal.code))
  const matchedPattern = securityMemory.knownRiskPatterns.find((pattern) =>
    pattern.signalCodes.length > 0 && pattern.signalCodes.every((code) => signalCodes.has(code)),
  )

  if (!matchedPattern) {
    return
  }

  findings.push({
    code: 'security_memory_known_risk_pattern',
    detail: `Walrus Security Memory에서 이전에 발견한 위험 패턴(${matchedPattern.signalCodes.join(', ')})과 일치합니다.`,
    path: '$',
    severity: 'error',
  })
}

function verifyQuasiIdentifierRisk({
  findings,
  path,
  value,
}: {
  findings: VerificationFinding[]
  path: string
  value: unknown
}) {
  const signals = collectQuasiIdentifierSignals({ path, value })
  const signalCodes = new Set(signals.map((signal) => signal.code))
  const riskScore = signals.reduce((score, signal) => score + readQuasiSignalWeight(signal.code), 0)

  if (riskScore < 5) {
    return
  }

  findings.push({
    code: 'quasi_identifier_combination_risk',
    detail: `직접 식별자는 없지만 ${signals.length}개 준식별자 조합이 특정 참가자를 좁힐 수 있습니다.`,
    path: '$',
    severity: 'error',
  })

  if (signalCodes.has('precise_region') && signalCodes.has('narrow_age_range') && signalCodes.has('rare_condition')) {
    findings.push({
      code: 'small_cohort_reidentification_risk',
      detail: '좁은 지역, 좁은 연령대, 희귀 건강 상태 조합은 작은 cohort에서 재식별 위험이 큽니다.',
      path: '$',
      severity: 'error',
    })
  }
}

function buildSecurityMemoryPatch({
  createdAt,
  findings,
  policyMemory,
  projectPublicCode,
  securityMemory,
  value,
}: {
  createdAt: string
  findings: VerificationFinding[]
  policyMemory: PolicyMemory | null
  projectPublicCode: string
  securityMemory: SecurityMemory | null
  value: unknown
}): SecurityMemoryPatch | null {
  const findingCodes = [...new Set(findings
    .filter((finding) => finding.severity === 'error')
    .map((finding) => finding.code)
    .filter((code) => !['payload_hash_mismatch', 'policy_memory_hash_mismatch', 'security_memory_hash_mismatch'].includes(code)))]
    .sort()

  if (findingCodes.length === 0) {
    return null
  }

  const riskSignals = dedupeQuasiIdentifierSignals(collectQuasiIdentifierSignals({ path: '$', value }))

  return {
    schemaVersion: 'modi.security-memory-patch.v1',
    createdAt,
    projectPublicCode,
    source: 'platform_security_agent',
    basedOnSecurityMemory: securityMemory
      ? {
          blobId: securityMemory.blobId,
          hash: securityMemory.hash,
          version: securityMemory.version,
        }
      : null,
    policyMemory: policyMemory
      ? {
          blobId: policyMemory.blobId,
          hash: policyMemory.hash,
          version: policyMemory.version,
        }
      : null,
    findingCodes,
    riskSignals,
    recommendedTransforms: buildRecommendedTransforms(riskSignals),
  }
}

function dedupeQuasiIdentifierSignals(signals: QuasiIdentifierSignal[]) {
  const seen = new Set<string>()

  return signals.filter((signal) => {
    const key = `${signal.code}:${signal.path}`

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function buildRecommendedTransforms(signals: QuasiIdentifierSignal[]): SecurityMemoryRecommendedTransform[] {
  const transforms = signals.map((signal) => readRecommendedTransform(signal)).filter((transform): transform is SecurityMemoryRecommendedTransform => Boolean(transform))
  const seen = new Set<string>()

  return transforms.filter((transform) => {
    const key = `${transform.field}:${transform.action}:${transform.target}`

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function readRecommendedTransform(signal: QuasiIdentifierSignal): SecurityMemoryRecommendedTransform | null {
  if (signal.code === 'narrow_age_range') {
    return { field: 'ageRange', action: 'broaden', target: '10_year_band' }
  }

  if (signal.code === 'precise_region') {
    return { field: 'region', action: 'generalize', target: 'province_only' }
  }

  if (signal.code === 'rare_condition') {
    return { field: 'conditionTag', action: 'group', target: 'condition_group_only' }
  }

  if (signal.code === 'detailed_device_model') {
    return { field: 'deviceType', action: 'generalize', target: 'generic_category_only' }
  }

  if (signal.code === 'outlier_vital_band') {
    return { field: 'restingHeartRateBand', action: 'broaden', target: 'coarse_band' }
  }

  if (signal.code === 'outlier_fitness_band') {
    return { field: 'vo2MaxBand', action: 'broaden', target: 'coarse_band' }
  }

  if (signal.code === 'outlier_activity_band') {
    return { field: 'stepCountBand', action: 'broaden', target: 'coarse_band' }
  }

  if (signal.code === 'rare_workout_pattern') {
    return { field: 'workoutPattern', action: 'group', target: 'activity_pattern_group' }
  }

  return null
}

function collectQuasiIdentifierSignals({
  path,
  value,
}: {
  path: string
  value: unknown
}): QuasiIdentifierSignal[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectQuasiIdentifierSignals({
      path: `${path}[${index}]`,
      value: item,
    }))
  }

  if (!value || typeof value !== 'object') {
    return []
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
    const nextPath = `${path}.${key}`
    const nestedSignals = collectQuasiIdentifierSignals({ path: nextPath, value: item })
    const fieldSignal = readQuasiIdentifierSignal({ key, path: nextPath, value: item })

    return fieldSignal ? [fieldSignal, ...nestedSignals] : nestedSignals
  })
}

function readQuasiIdentifierSignal({
  key,
  path,
  value,
}: {
  key: string
  path: string
  value: unknown
}): QuasiIdentifierSignal | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalizedKey = key.toLowerCase()
  const normalizedValue = value.trim().toLowerCase()

  if ((normalizedKey === 'agerange' || normalizedKey === 'age_range') && isNarrowAgeRange(normalizedValue)) {
    return { code: 'narrow_age_range', path }
  }

  if ((normalizedKey === 'region' || normalizedKey === 'regiongranularity') && isPreciseRegion(normalizedValue)) {
    return { code: 'precise_region', path }
  }

  if ((normalizedKey === 'conditiontag' || normalizedKey === 'conditiongroup' || normalizedKey === 'condition') && isRareCondition(normalizedValue)) {
    return { code: 'rare_condition', path }
  }

  if ((normalizedKey === 'devicetype' || normalizedKey === 'devicemodel') && isDetailedDeviceModel(normalizedValue)) {
    return { code: 'detailed_device_model', path }
  }

  if (normalizedKey === 'restingheartrateband' && isOutlierRestingHeartRate(normalizedValue)) {
    return { code: 'outlier_vital_band', path }
  }

  if (normalizedKey === 'vo2maxband' && isOutlierFitnessBand(normalizedValue)) {
    return { code: 'outlier_fitness_band', path }
  }

  if (normalizedKey === 'stepcountband' && isOutlierActivityBand(normalizedValue)) {
    return { code: 'outlier_activity_band', path }
  }

  if (normalizedKey === 'workoutpattern' && isRareWorkoutPattern(normalizedValue)) {
    return { code: 'rare_workout_pattern', path }
  }

  return null
}

function readQuasiSignalWeight(code: string) {
  if (code === 'rare_condition') return 2
  if (code === 'precise_region') return 2
  if (code === 'rare_workout_pattern') return 2
  return 1
}

function isNarrowAgeRange(value: string) {
  const match = value.match(/^(\d{2})-(\d{2})$/)

  if (!match) {
    return false
  }

  return Number(match[2]) - Number(match[1]) <= 5
}

function isPreciseRegion(value: string) {
  return value.includes('-') || value.includes('seogwipo') || value.includes('gangnam') || value.includes('dong')
}

function isRareCondition(value: string) {
  return value.includes('pacemaker') || value.includes('sleep_apnea') || value.includes('rare')
}

function isDetailedDeviceModel(value: string) {
  return /\b(ultra|series|watch|galaxy)\b/.test(value) && /\d/.test(value)
}

function isOutlierRestingHeartRate(value: string) {
  const match = value.match(/^(\d{2})-(\d{2})$/)
  return Boolean((match && Number(match[2]) < 50) || value.includes('under_45'))
}

function isOutlierFitnessBand(value: string) {
  return value === 'superior' || value === 'elite'
}

function isOutlierActivityBand(value: string) {
  return value.includes('25k') || value.includes('30k')
}

function isRareWorkoutPattern(value: string) {
  return value.includes('open_water') || value.includes('triathlon') || value.includes('5x_week')
}

function buildSummary(verified: boolean, findings: VerificationFinding[]) {
  if (verified) {
    return 'user-app 가명처리 payload가 platform Security Agent 검증을 통과했습니다.'
  }

  return `platform Security Agent가 user-app 가명처리 payload에서 ${findings.length}개 안전성 항목을 확인했습니다.`
}

async function fetchPolicyMemory({
  blobId,
}: {
  blobId: string
}): Promise<PolicyMemory> {
  const response = await fetch(buildWalrusFetchUrl(blobId), {
    headers: {
      Accept: 'application/json',
    },
  })
  const responseText = await response.text()

  if (!response.ok) {
    throw new Error(`Security Agent가 Walrus policy memory를 불러오지 못했습니다. ${responseText || response.statusText}`)
  }

  const hash = await sha256Hex(responseText)
  const payload = parseJson(responseText)
  const policy = asRecord(payload)

  return {
    blobId,
    fetchedAt: new Date().toISOString(),
    forbiddenFields: readPolicyForbiddenFields(policy),
    hash,
    payload,
    version: readOptionalText(policy?.policyVersion) ?? null,
  }
}

async function fetchSecurityMemory({
  blobId,
}: {
  blobId: string
}): Promise<SecurityMemory> {
  const response = await fetch(buildWalrusFetchUrl(blobId), {
    headers: {
      Accept: 'application/json',
    },
  })
  const responseText = await response.text()

  if (!response.ok) {
    throw new Error(`Security Agent가 Walrus Security Memory를 불러오지 못했습니다. ${responseText || response.statusText}`)
  }

  const hash = await sha256Hex(responseText)
  const payload = parseJson(responseText)
  const memory = asRecord(payload)

  return {
    blobId,
    fetchedAt: new Date().toISOString(),
    hash,
    knownRiskPatterns: readKnownRiskPatterns(memory),
    payload,
    version: readOptionalText(memory?.memoryVersion) ?? null,
  }
}

function buildForbiddenFields(policyMemory: PolicyMemory | null) {
  const fields = new Set(directIdentifierKeys)

  for (const field of policyMemory?.forbiddenFields ?? []) {
    fields.add(field)
  }

  return fields
}

function readPolicyForbiddenFields(policy: Record<string, unknown> | null) {
  const transformPolicy = asRecord(policy?.transformPolicy)
  const forbiddenFields = Array.isArray(transformPolicy?.forbiddenFields)
    ? transformPolicy.forbiddenFields.map(readOptionalText).filter((field): field is string => Boolean(field))
    : []

  return [...new Set(forbiddenFields)].sort()
}

function buildPolicyMemoryReceipt(policyMemory: PolicyMemory | null) {
  if (!policyMemory) {
    return null
  }

  return {
    blobId: policyMemory.blobId,
    fetchedAt: policyMemory.fetchedAt,
    forbiddenFieldCount: policyMemory.forbiddenFields.length,
    hash: policyMemory.hash,
    version: policyMemory.version,
  }
}

function buildSecurityMemoryReceipt(securityMemory: SecurityMemory | null) {
  if (!securityMemory) {
    return null
  }

  return {
    blobId: securityMemory.blobId,
    fetchedAt: securityMemory.fetchedAt,
    hash: securityMemory.hash,
    knownRiskPatternCount: securityMemory.knownRiskPatterns.length,
    version: securityMemory.version,
  }
}

function readKnownRiskPatterns(memory: Record<string, unknown> | null): SecurityMemoryKnownRiskPattern[] {
  const patterns = Array.isArray(memory?.knownRiskPatterns) ? memory.knownRiskPatterns : []

  return patterns.map(readKnownRiskPattern).filter((pattern): pattern is SecurityMemoryKnownRiskPattern => Boolean(pattern))
}

function readKnownRiskPattern(value: unknown): SecurityMemoryKnownRiskPattern | null {
  const pattern = asRecord(value)
  const signalCodes = Array.isArray(pattern?.signalCodes)
    ? pattern.signalCodes.map(readOptionalText).filter((code): code is string => Boolean(code))
    : []

  if (signalCodes.length === 0) {
    return null
  }

  const findingCodes = Array.isArray(pattern?.findingCodes)
    ? pattern.findingCodes.map(readOptionalText).filter((code): code is string => Boolean(code))
    : []
  const recommendedTransforms = Array.isArray(pattern?.recommendedTransforms)
    ? pattern.recommendedTransforms.map(readRecommendedTransformFromMemory).filter((transform): transform is SecurityMemoryRecommendedTransform => Boolean(transform))
    : []

  return {
    findingCodes,
    id: readOptionalText(pattern?.id),
    recommendedTransforms,
    signalCodes: [...new Set(signalCodes)].sort(),
  }
}

function readRecommendedTransformFromMemory(value: unknown): SecurityMemoryRecommendedTransform | null {
  const transform = asRecord(value)
  const action = readOptionalText(transform?.action)
  const field = readOptionalText(transform?.field)
  const target = readOptionalText(transform?.target)

  return action && field && target ? { action, field, target } : null
}

function buildWalrusFetchUrl(blobId: string) {
  const aggregatorUrl = readWalrusAggregatorUrl().replace(/\/+$/g, '')
  return `${aggregatorUrl}/v1/blobs/${encodeURIComponent(blobId)}`
}

function readWalrusAggregatorUrl() {
  const value = Deno.env.get('WALRUS_AGGREGATOR_URL')?.trim()
  return value && /^https?:\/\//.test(value) ? value : DEFAULT_WALRUS_AGGREGATOR_URL
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function readOptionalText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function parseJson(value: string) {
  if (!value) return null

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

async function sha256Hex(value: string) {
  const encodedValue = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', encodedValue)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function stableStringify(value: unknown): string {
  if (value === undefined) {
    return 'null'
  }

  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null'
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(',')}}`
}
