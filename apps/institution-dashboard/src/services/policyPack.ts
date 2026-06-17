import type { CreateResearchProjectInput } from '@/services/institutionDashboard'

type WalrusUploadResult = {
  blobId: string
  blobObjectId: string | null
  publisherUrl: string
  txDigest: string | null
}

export type PolicyPackUpload = WalrusUploadResult & {
  hash: string
  policyPack: ResearchPolicyPack
}

type ResearchPolicyPack = {
  allowedUse: string
  dataType: string
  policyId: string
  policyVersion: string
  projectId: string
  purpose: string
  policyLifecycle: {
    mutability: 'versioned_append_only'
    status: 'active'
    updateMode: 'publish_new_walrus_policy_pack'
    visibility: 'public'
  }
  pseudonymizationContract: {
    executor: 'user_app_local_runtime'
    policySource: 'walrus_policy_pack'
    serverRole: 'verify_only'
  }
  securityAgentContract: {
    consumer: 'platform_security_agent'
    output: 'public_security_policy_memory'
    policyAdaptation: string
    problemFocus: string
    responsibilities: string[]
    usage: 'memwal_style_policy_recall_for_second_pass_verification'
  }
  requestedData: Array<{
    key: string
    policy: string
    source: string
  }>
  seal: {
    access: string
    approvalFunction: string
    grantFlow: string
    packageId: string
    provider: 'seal'
    researcherSuiAddress: string | null
    sealPolicyId: string
    status: 'roadmap'
    suiDataRequestId: string | null
    suiDataRequestTxDigest: string | null
    suiRewardEscrowId: string | null
  }
  transformPolicy: {
    exactValuePolicy: string
    forbiddenFields: string[]
    identityPolicy: string
    outputSchema: string
    timeGranularity: string
    valueTransform: string
  }
}

const DEFAULT_WALRUS_EPOCHS = '5'
const DEFAULT_WALRUS_PUBLISHER_URL = 'https://publisher.walrus-testnet.walrus.space'
const DEFAULT_MODI_TESTNET_SEAL_PACKAGE_ID = '0xc5be8a456d0ba7d33fbcff12e92d73181a3817872f6598f5cea65a5326ab3e21'
const POLICY_PACK_VERSION = '1.0.0'
const SUBMISSION_SCHEMA_VERSION = 'modi.participant-submission.v1'

const policyByScope: Record<string, { key: string; policy: string; source: string }> = {
  'VO2 max': { key: 'vo2_max', policy: 'Remove exact values; allow bands only', source: 'apple_health' },
  'Steps': { key: 'step_count', policy: 'Remove daily raw values; aggregate into monthly bands', source: 'apple_health' },
  'Sleep stages': { key: 'sleep_stage', policy: 'Allow stage ratios only and remove raw sessions', source: 'wearable' },
  'Sleep duration': { key: 'sleep_duration', policy: 'Remove minute-level raw values; convert to bands', source: 'wearable' },
  'Sleep efficiency': { key: 'sleep_efficiency', policy: 'Remove exact ratios; allow bands only', source: 'wearable' },
  'Heart rate': { key: 'heart_rate', policy: 'Remove exact BPM; convert to bands', source: 'wearable' },
  'Resting heart rate': { key: 'resting_heart_rate', policy: 'Remove exact BPM; allow bands only', source: 'wearable' },
  'Weight': { key: 'weight_band', policy: 'Remove exact weight; convert to bands', source: 'health_profile' },
  'Blood oxygen': { key: 'oxygen_saturation', policy: 'Remove exact SpO2; allow bands only', source: 'wearable' },
  'HRV': { key: 'hrv_band', policy: 'Remove exact values; allow recovery bands only', source: 'wearable' },
  'Device type': { key: 'device_type', policy: 'Remove detailed model names; allow device category only', source: 'device' },
  'Recorded month': { key: 'recorded_month', policy: 'Remove day-level dates; allow month-level time only', source: 'system' },
  'Exercise minutes': { key: 'exercise_minutes', policy: 'Remove minute-level raw values; convert to bands', source: 'apple_health' },
  'Active energy': { key: 'active_energy', policy: 'Remove exact kcal; allow bands only', source: 'apple_health' },
}

export async function createAndStorePolicyPack({
  input,
  publicCode,
}: {
  input: CreateResearchProjectInput
  publicCode: string
}): Promise<PolicyPackUpload> {
  const policyPack = buildResearchPolicyPack({ input, publicCode })
  const serializedPolicy = stableStringify(policyPack)
  const hash = await sha256Hex(serializedPolicy)
  const upload = await uploadJsonToWalrus(serializedPolicy)

  return {
    ...upload,
    hash,
    policyPack,
  }
}

export function buildResearchPolicyPack({
  input,
  publicCode,
}: {
  input: CreateResearchProjectInput
  publicCode: string
}): ResearchPolicyPack {
  const allowedUse = inferAllowedUse(input.purpose)
  const policyId = `${publicCode.toLowerCase()}-policy-v1`

  return {
    policyVersion: POLICY_PACK_VERSION,
    policyId,
    projectId: publicCode,
    dataType: 'pseudonymized_health_submission',
    purpose: input.purpose || input.title,
    allowedUse,
    policyLifecycle: {
      visibility: 'public',
      status: 'active',
      mutability: 'versioned_append_only',
      updateMode: 'publish_new_walrus_policy_pack',
    },
    securityAgentContract: {
      consumer: 'platform_security_agent',
      output: 'public_security_policy_memory',
      usage: 'memwal_style_policy_recall_for_second_pass_verification',
      problemFocus: 'safe_processing_of_user_transmitted_healthcare_mydata_for_changing_institution_requests',
      policyAdaptation: 'publish_new_versioned_walrus_policy_pack_when_requested_data_or_privacy_rules_change',
      responsibilities: [
        'select_requested_health_data_categories',
        'define_allowed_use_and_retention',
        'publish_versioned_public_policy_to_walrus',
        'provide_forbidden_fields_and_transform_rules_to_security_agent',
        'support_policy_updates_without_requiring_raw_health_data_to_leave_user_device',
      ],
    },
    pseudonymizationContract: {
      executor: 'user_app_local_runtime',
      policySource: 'walrus_policy_pack',
      serverRole: 'verify_only',
    },
    requestedData: input.dataScope.map((scope) => policyByScope[scope] ?? {
      key: normalizeKey(scope),
      policy: 'Remove direct identifiers and exact raw values',
      source: 'user_health_data',
    }),
    transformPolicy: {
      outputSchema: SUBMISSION_SCHEMA_VERSION,
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
      provider: 'seal',
      status: 'roadmap',
      sealPolicyId: policyId,
      packageId: readModiSealPackageId(),
      researcherSuiAddress: normalizeSuiAddress(input.researcherSuiAddress),
      approvalFunction: 'registry::seal_approve',
      grantFlow: 'user_submit_registers_data_asset_consent_and_transfers_access_grant_to_institution',
      access: 'institution_download_requires_project_access_grant',
      suiDataRequestId: normalizeSuiObjectId(input.suiDataRequestId),
      suiDataRequestTxDigest: input.suiDataRequestTxDigest?.trim() || null,
      suiRewardEscrowId: normalizeSuiObjectId(input.suiRewardEscrowId),
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
    throw new Error(`Failed to store policy_pack on Walrus. ${responseText || response.statusText}`)
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
    throw new Error('Could not find the blob ID in the policy_pack Walrus response.')
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

  if (text.includes('reward') || text.includes('insurance') || text.includes('incentive')) {
    return 'reward_validation'
  }

  if (text.includes('coaching')) {
    return 'personalized_coaching'
  }

  if (text.includes('monitoring')) {
    return 'remote_monitoring'
  }

  return 'aggregate_research'
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function readWalrusPublisherUrl() {
  const value = import.meta.env.VITE_WALRUS_PUBLISHER_URL?.trim()
  return value && /^https?:\/\//.test(value) ? value : DEFAULT_WALRUS_PUBLISHER_URL
}

function readWalrusEpochs() {
  const value = Number(import.meta.env.VITE_WALRUS_EPOCHS)
  return Number.isFinite(value) && value > 0 ? String(Math.floor(value)) : DEFAULT_WALRUS_EPOCHS
}

function readModiSealPackageId() {
  const value = import.meta.env.VITE_MODI_SEAL_PACKAGE_ID?.trim().toLowerCase()
  return value && /^0x[0-9a-f]{64}$/.test(value) ? value : DEFAULT_MODI_TESTNET_SEAL_PACKAGE_ID
}

function normalizeSuiAddress(value: string | null | undefined) {
  const text = value?.trim().toLowerCase()
  return text && /^0x[0-9a-f]{64}$/.test(text) ? text : null
}

function normalizeSuiObjectId(value: string | null | undefined) {
  const text = value?.trim().toLowerCase()
  return text && /^0x[0-9a-f]{1,64}$/.test(text) ? text : null
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
