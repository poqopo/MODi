import { createClient } from 'npm:@supabase/supabase-js@2.108.0'

type CreateResearchProjectBody = {
  accessPeriodDays?: unknown
  dataScope?: unknown
  description?: unknown
  institutionSlug?: unknown
  purpose?: unknown
  researcherSuiAddress?: unknown
  rewardAmountPerParticipant?: unknown
  rewardCurrency?: unknown
  suiDataRequestId?: unknown
  suiDataRequestTxDigest?: unknown
  suiRegistryPackageId?: unknown
  suiRewardEscrowId?: unknown
  targetParticipants?: unknown
  title?: unknown
}

type WalrusUploadResult = {
  blobId: string
  blobObjectId: string | null
  publisherUrl: string
  txDigest: string | null
}

type InstitutionRow = {
  id: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, x-supabase-api-version, apikey, content-type, accept-profile, content-profile',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

const defaultAgeRanges = ['20-29', '30-39']
const defaultWalrusEpochs = '1'
const defaultWalrusPublisherUrl = 'https://publisher.walrus-testnet.walrus.space'
const defaultModiTestnetSealPackageId = '0xc5be8a456d0ba7d33fbcff12e92d73181a3817872f6598f5cea65a5326ab3e21'
const policyPackVersion = '1.0.0'
const submissionSchemaVersion = 'modi.participant-submission.v1'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') ?? corsHeaders['Access-Control-Allow-Headers'],
      },
      status: 204,
    })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = getSupabaseAdminKey()

    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: 'Supabase function secrets are not configured.' }, 500)
    }

    const body = (await request.json().catch(() => null)) as CreateResearchProjectBody | null
    const institutionSlug = readRequiredText(body?.institutionSlug)

    if (!institutionSlug) {
      return jsonResponse({ error: 'institutionSlug is required.' }, 400)
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: institution, error: institutionError } = await supabase
      .from('institutions')
      .select('id')
      .eq('slug', institutionSlug)
      .maybeSingle<InstitutionRow>()

    if (institutionError) {
      return jsonResponse({ error: institutionError.message }, 500)
    }

    if (!institution) {
      return jsonResponse({ error: 'Institution not found.' }, 404)
    }

    const input = normalizeInput(body)
    const publicCode = `REQ-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
    const policyPack = buildResearchPolicyPack({ input, publicCode })
    const serializedPolicy = stableStringify(policyPack)
    const [policyHash, policyUpload] = await Promise.all([
      sha256Hex(serializedPolicy),
      uploadJsonToWalrus(serializedPolicy),
    ])
    const rewardPoolTotal = input.targetParticipants * input.rewardAmountPerParticipant
    const { data: project, error: projectError } = await supabase
      .from('research_projects')
      .insert({
        institution_id: institution.id,
        public_code: publicCode,
        title: input.title,
        purpose: input.purpose,
        description: input.description,
        status: 'recruiting',
        target_participants: input.targetParticipants,
        reward_currency: input.rewardCurrency,
        reward_amount_per_participant: input.rewardAmountPerParticipant,
        reward_pool_total: rewardPoolTotal,
        reward_pool_remaining: rewardPoolTotal,
        access_period_days: input.accessPeriodDays,
        data_scope: input.dataScope,
        policy_pack_blob_id: policyUpload.blobId,
        policy_pack_object_id: policyUpload.blobObjectId,
        policy_pack_hash: policyHash,
        policy_pack_version: policyPack.policyVersion,
        policy_pack_tx_digest: policyUpload.txDigest,
        policy_pack_publisher_url: policyUpload.publisherUrl,
        policy_pack_created_at: new Date().toISOString(),
        seal_policy_id: policyPack.seal.sealPolicyId,
        researcher_sui_address: input.researcherSuiAddress,
        sui_data_request_id: input.suiDataRequestId,
        sui_data_request_tx_digest: input.suiDataRequestTxDigest,
        sui_registry_package_id: input.suiRegistryPackageId ?? policyPack.seal.packageId,
        sui_reward_escrow_id: input.suiRewardEscrowId,
      })
      .select('id')
      .single()

    if (projectError) {
      return jsonResponse({ error: projectError.message }, 500)
    }

    const projectId = project.id as string
    const [{ error: fieldError }, { error: ageRangeError }] = await Promise.all([
      supabase.from('project_data_fields').insert(
        buildProjectDataFields(input.dataScope).map((field) => ({
          project_id: projectId,
          ...field,
        })),
      ),
      supabase.from('project_age_ranges').insert(
        defaultAgeRanges.map((ageRange) => ({
          project_id: projectId,
          age_range: ageRange,
        })),
      ),
    ])

    if (fieldError) {
      return jsonResponse({ error: fieldError.message }, 500)
    }

    if (ageRangeError) {
      return jsonResponse({ error: ageRangeError.message }, 500)
    }

    return jsonResponse({
      projectId,
      publicCode,
      policyPackBlobId: policyUpload.blobId,
      policyPackHash: policyHash,
      sealPolicyId: policyPack.seal.sealPolicyId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown research creation error.'
    return jsonResponse({ error: message }, 500)
  }
})

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function normalizeInput(body: CreateResearchProjectBody | null) {
  const title = readRequiredText(body?.title) || '새 연구'
  const purpose = readRequiredText(body?.purpose) || '건강 데이터 연구'
  const description = readRequiredText(body?.description) || `${title} 참여자를 모집합니다.`
  const dataScope = readStringList(body?.dataScope)
  const researcherSuiAddress = normalizeSuiAddress(body?.researcherSuiAddress)
  const suiDataRequestId = normalizeSuiObjectId(body?.suiDataRequestId)
  const suiDataRequestTxDigest = readRequiredText(body?.suiDataRequestTxDigest) || null
  const suiRegistryPackageId = normalizeSuiObjectId(body?.suiRegistryPackageId)
  const suiRewardEscrowId = normalizeSuiObjectId(body?.suiRewardEscrowId)

  return {
    title,
    purpose,
    description,
    researcherSuiAddress,
    suiDataRequestId,
    suiDataRequestTxDigest,
    suiRegistryPackageId,
    suiRewardEscrowId,
    targetParticipants: Math.max(1, Math.trunc(readNumber(body?.targetParticipants) || 1)),
    rewardAmountPerParticipant: Math.max(0, readNumber(body?.rewardAmountPerParticipant)),
    rewardCurrency: readRequiredText(body?.rewardCurrency) || 'USDC',
    accessPeriodDays: Math.max(1, Math.trunc(readNumber(body?.accessPeriodDays) || 60)),
    dataScope: dataScope.length > 0 ? dataScope : ['웨어러블 데이터'],
  }
}

function buildResearchPolicyPack({
  input,
  publicCode,
}: {
  input: ReturnType<typeof normalizeInput>
  publicCode: string
}) {
  const policyId = `${publicCode.toLowerCase()}-policy-v1`

  return {
    policyVersion: policyPackVersion,
    policyId,
    projectId: publicCode,
    dataType: 'pseudonymized_health_submission',
    purpose: input.purpose || input.title,
    allowedUse: inferAllowedUse(input.purpose),
    requestedData: input.dataScope.map(mapDataScopePolicy),
    transformPolicy: {
      outputSchema: submissionSchemaVersion,
      timeGranularity: 'month',
      valueTransform: 'range_bands_and_counts',
      exactValuePolicy: 'forbid_exact_dates_and_raw_values',
      identityPolicy: 'no_direct_identifier_in_dataset',
      forbiddenFields: [
        'name',
        'email',
        'phone',
        'birthDate',
        'rawDate',
        'rawTimestamp',
        'rawStepCount',
        'preciseLocation',
      ],
    },
    seal: {
      provider: 'seal' as const,
      sealPolicyId: policyId,
      packageId: readModiSealPackageId(),
      researcherSuiAddress: input.researcherSuiAddress,
      approvalFunction: 'registry::seal_approve',
      grantFlow: 'user_submit_registers_data_asset_consent_and_transfers_access_grant_to_institution',
      access: 'institution_download_requires_project_access_grant',
      suiDataRequestId: input.suiDataRequestId,
      suiDataRequestTxDigest: input.suiDataRequestTxDigest,
      suiRewardEscrowId: input.suiRewardEscrowId,
    },
  }
}

async function uploadJsonToWalrus(serializedJson: string): Promise<WalrusUploadResult> {
  const publisherUrl = readWalrusPublisherUrl().replace(/\/+$/g, '')
  const response = await fetch(`${publisherUrl}/v1/blobs?epochs=${encodeURIComponent(readWalrusEpochs())}`, {
    body: serializedJson,
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'PUT',
  })
  const responseText = await response.text()
  const responseBody = parseJson(responseText)

  if (!response.ok) {
    throw new Error(`policy_pack Walrus store failed. ${responseText || response.statusText}`)
  }

  const parsed = parseWalrusUploadResponse(responseBody)

  return {
    ...parsed,
    publisherUrl,
  }
}

function parseWalrusUploadResponse(responseBody: unknown) {
  const root = asRecord(responseBody)
  const newlyCreated = asRecord(root?.newlyCreated)
  const alreadyCertified = asRecord(root?.alreadyCertified)
  const blobObject = asRecord(newlyCreated?.blobObject) ?? asRecord(alreadyCertified?.blobObject)
  const event = asRecord(newlyCreated?.event) ?? asRecord(alreadyCertified?.event)
  const blobId = readString(blobObject?.blobId) ?? readString(newlyCreated?.blobId) ?? readString(alreadyCertified?.blobId)
  const blobObjectId = readString(blobObject?.id) ?? readString(newlyCreated?.blobObjectId) ?? readString(alreadyCertified?.blobObjectId)
  const txDigest = readString(event?.txDigest) ?? readString(newlyCreated?.txDigest) ?? readString(alreadyCertified?.txDigest)

  if (!blobId) {
    throw new Error('Could not parse policy_pack Walrus blob ID.')
  }

  return {
    blobId,
    blobObjectId,
    txDigest,
  }
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function inferAllowedUse(purpose: string) {
  const text = purpose.toLowerCase()

  if (text.includes('리워드') || text.includes('보험') || text.includes('reward') || text.includes('insurance')) {
    return 'reward_validation'
  }

  if (text.includes('코칭') || text.includes('coaching')) {
    return 'personalized_coaching'
  }

  if (text.includes('모니터링') || text.includes('monitoring')) {
    return 'remote_monitoring'
  }

  return 'aggregate_research'
}

function mapDataScopePolicy(scope: string) {
  if (scope === 'VO2 max') return { key: 'vo2_max', source: 'apple_health', policy: '정확 수치 제거 후 band만 허용' }
  if (scope === '걸음') return { key: 'step_count', source: 'apple_health', policy: '일별 원본값 제거 후 월 단위 구간화' }
  if (scope === '수면 단계') return { key: 'sleep_stage', source: 'wearable', policy: '단계별 비율만 허용하고 세션 원본 제거' }
  if (scope === '수면 시간') return { key: 'sleep_duration', source: 'wearable', policy: '분 단위 원본값 제거 후 구간화' }
  if (scope === '수면 효율') return { key: 'sleep_efficiency', source: 'wearable', policy: '정확 비율 제거 후 band만 허용' }
  if (scope === '심박수') return { key: 'heart_rate', source: 'wearable', policy: '정확 bpm 제거 후 구간화' }
  if (scope === '안정시 심박수') return { key: 'resting_heart_rate', source: 'wearable', policy: '정확 bpm 제거 후 band만 허용' }
  if (scope === '체중') return { key: 'weight_band', source: 'health_profile', policy: '정확 체중 제거 후 구간화' }
  if (scope === '혈중 산소') return { key: 'oxygen_saturation', source: 'wearable', policy: '정확 SpO2 제거 후 band만 허용' }
  if (scope === 'HRV') return { key: 'hrv_band', source: 'wearable', policy: '정확 수치 제거 후 회복 band만 허용' }
  if (scope === '기기 유형') return { key: 'device_type', source: 'device', policy: '상세 모델명 제거 후 기기 범주만 허용' }
  if (scope === '기록 월') return { key: 'recorded_month', source: 'system', policy: '일 단위 날짜 제거 후 월 단위만 허용' }
  if (scope === '운동 시간') return { key: 'exercise_minutes', source: 'apple_health', policy: '분 단위 원본값 제거 후 구간화' }
  if (scope === '활동 에너지') return { key: 'active_energy', source: 'apple_health', policy: '정확 kcal 제거 후 band만 허용' }

  return {
    key: scope.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, '_').replace(/^_+|_+$/g, ''),
    source: 'user_health_data',
    policy: '직접 식별자와 정확한 원본값 제거',
  }
}

function buildProjectDataFields(dataScope: string[]) {
  const fields = dataScope.map((scope) => {
    const policy = mapDataScopePolicy(scope)

    return {
      field_key: policy.key,
      source: policy.source,
      policy: policy.policy,
      is_enabled: true,
    }
  })

  return fields.length > 0 ? fields : [
    {
      field_key: 'health_record',
      source: 'user_health_data',
      policy: '직접 식별자와 정확한 원본값 제거',
      is_enabled: true,
    },
  ]
}

function readWalrusPublisherUrl() {
  const value = Deno.env.get('WALRUS_PUBLISHER_URL')?.trim()
  return value && /^https?:\/\//.test(value) ? value : defaultWalrusPublisherUrl
}

function readWalrusEpochs() {
  const value = Number(Deno.env.get('WALRUS_EPOCHS'))
  return Number.isFinite(value) && value > 0 ? String(Math.floor(value)) : defaultWalrusEpochs
}

function readModiSealPackageId() {
  const value = Deno.env.get('MODI_SEAL_PACKAGE_ID')?.trim().toLowerCase()
  return value && /^0x[0-9a-f]{64}$/.test(value) ? value : defaultModiTestnetSealPackageId
}

function getSupabaseAdminKey() {
  const secretKeysJson = Deno.env.get('SUPABASE_SECRET_KEYS')

  if (secretKeysJson) {
    try {
      const secretKeys = JSON.parse(secretKeysJson) as Record<string, string | undefined>
      const defaultKey = secretKeys.default

      if (defaultKey) {
        return defaultKey
      }
    } catch {
      // Fall back to legacy single-key environment variables below.
    }
  }

  return (
    Deno.env.get('SUPABASE_SECRET_KEY') ??
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    Deno.env.get('SUPABASE_SERVICE_ROLE') ??
    null
  )
}

function readRequiredText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function readNumber(value: unknown) {
  const numberValue = typeof value === 'number' || typeof value === 'string' ? Number(String(value).replace(/[^0-9.]/g, '')) : 0
  return Number.isFinite(numberValue) ? numberValue : 0
}

function readStringList(value: unknown) {
  return Array.isArray(value) ? value.map(readRequiredText).filter(Boolean) : []
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

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeSuiAddress(value: unknown) {
  const text = readString(value)?.toLowerCase()
  return text && /^0x[0-9a-f]{64}$/.test(text) ? text : null
}

function normalizeSuiObjectId(value: unknown) {
  const text = readString(value)?.toLowerCase()
  return text && /^0x[0-9a-f]{1,64}$/.test(text) ? text : null
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(',')}}`
}
