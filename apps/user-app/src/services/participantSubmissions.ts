import { SealClient, type KeyServerConfig } from '@mysten/seal'
import { SuiGrpcClient } from '@mysten/sui/grpc'
import * as Crypto from 'expo-crypto'
import type { ResearchRequest } from '../types/dashboard'
import { getSupabaseClient, isSupabaseConfigured } from './supabase'

declare const process: {
  env: {
    EXPO_PUBLIC_SUI_NETWORK?: string
    EXPO_PUBLIC_MODI_SEAL_PACKAGE_ID?: string
    EXPO_PUBLIC_SEAL_AGGREGATOR_URL?: string
    EXPO_PUBLIC_SEAL_KEY_SERVER_CONFIGS?: string
    EXPO_PUBLIC_SEAL_KEY_SERVER_OBJECT_IDS?: string
    EXPO_PUBLIC_SEAL_THRESHOLD?: string
    EXPO_PUBLIC_SEAL_VERIFY_KEY_SERVERS?: string
    EXPO_PUBLIC_WALRUS_AGGREGATOR_URL?: string
    EXPO_PUBLIC_WALRUS_EPOCHS?: string
    EXPO_PUBLIC_WALRUS_PUBLISHER_URL?: string
  }
}

type SuiNetwork = 'devnet' | 'mainnet' | 'testnet'
export type ParticipantSubmissionProgressStage =
  | 'preparing'
  | 'policy-loading'
  | 'security-memory-loading'
  | 'pseudonymizing'
  | 'verifying'
  | 'hardening'
  | 'reverifying'
  | 'verified'
  | 'agent-memory-uploading'
  | 'security-memory-updating'
  | 'encrypting'
  | 'walrus-uploading'
  | 'tx-verifying'
  | 'registering'
  | 'complete'

export type ParticipantSubmissionProgress = {
  detail: string
  label: string
  progress: number
  stage: ParticipantSubmissionProgressStage
}

type SubmitParticipantDataInput = {
  loginId: string
  onProgress?: (progress: ParticipantSubmissionProgress) => void
  request: ResearchRequest
}

type WalrusUploadResult = {
  blobId: string
  blobObjectId: string | null
  rawResponse: unknown
  txDigest: string | null
}

type WalrusTxVerification = {
  objectDigest: string | null
  objectOwner: string | null
  objectType: string | null
  previousTransaction: string
}

type PrivacyVerificationFinding = {
  code: string
  detail: string
  path: string
  severity: 'error' | 'warning'
}

type PrivacyVerificationResult = {
  findings: PrivacyVerificationFinding[]
  payloadHash: string
  policyMemory?: {
    blobId?: string | null
    fetchedAt?: string | null
    forbiddenFieldCount?: number
    hash?: string | null
    version?: string | null
  } | null
  receiptHash: string
  securityMemory?: {
    blobId?: string | null
    fetchedAt?: string | null
    hash?: string | null
    knownRiskPatternCount?: number
    version?: string | null
  } | null
  securityMemoryPatch?: SecurityMemoryPatch | null
  securityAgent?: {
    forbiddenFieldCount?: number
    knownSecurityMemoryPatternCount?: number
    name?: string
    policyMemoryBlobId?: string | null
    policyMemoryHash?: string | null
    policyMemoryUsed?: boolean
    policyMemoryVersion?: string | null
    securityMemoryBlobId?: string | null
    securityMemoryHash?: string | null
    securityMemoryUsed?: boolean
    securityMemoryVersion?: string | null
  }
  verified: boolean
  verifiedAt: string
  summary: string
}

type PrivacyVerificationAttempt = {
  attempt: number
  findingCodes: string[]
  findingCount: number
  payloadHash: string
  receiptHash: string
  securityMemoryPatch?: SecurityMemoryPatch | null
  securityMemoryUsed?: boolean
  summary: string
  verified: boolean
  verifiedAt: string
}

type PrivacySafetyEdit = {
  action: 'coarsen_time' | 'generalize_quasi_identifiers' | 'remove_direct_identifier_fields' | 'replace_identifier_values'
  reason: string
  sourceFindingCodes: string[]
}

type EncryptedDataset = {
  encryptionMode: 'seal-sdk'
  encryptedPayload: string
  sealIdentityHex: string
}

type AgentMemoryArtifactKind = 'agent_workflow_manifest' | 'privacy_verification_receipt' | 'pseudonymization_plan' | 'security_memory'

type AgentMemoryArtifact = {
  kind: AgentMemoryArtifactKind
  schemaVersion: string
  title: string
  [key: string]: unknown
}

type UploadedAgentMemoryArtifact = {
  blobId: string
  blobObjectId: string | null
  hash: string
  kind: AgentMemoryArtifactKind
  title: string
  txDigest: string | null
}

type PolicyPackSnapshot = {
  blobId: string
  fetchedAt: string
  hash: string | null
  payload: unknown
  version: string | null
}

type SecurityMemorySnapshot = {
  blobId: string
  fetchedAt: string
  hash: string | null
  knownRiskPatterns: SecurityMemoryKnownRiskPattern[]
  payload: unknown
  version: string | null
}

type SecurityMemoryKnownRiskPattern = {
  firstSeenAt: string | null
  findingCodes: string[]
  id: string
  lastSeenAt: string | null
  matchCount: number
  recommendedTransforms: SecurityMemoryRecommendedTransform[]
  signalCodes: string[]
}

type SecurityMemoryRecommendedTransform = {
  action: string
  field: string
  target: string
}

type SecurityMemoryPatch = {
  basedOnSecurityMemory?: {
    blobId?: string | null
    hash?: string | null
    version?: string | null
  } | null
  createdAt: string
  findingCodes: string[]
  policyMemory?: {
    blobId?: string | null
    hash?: string | null
    version?: string | null
  } | null
  projectPublicCode: string
  recommendedTransforms: SecurityMemoryRecommendedTransform[]
  riskSignals: Array<{
    code: string
    path: string
  }>
  schemaVersion: string
  source: string
}

const DEFAULT_WALRUS_AGGREGATOR_URL = 'https://aggregator.walrus-testnet.walrus.space'
const DEFAULT_WALRUS_EPOCHS = '5'
const DEFAULT_WALRUS_PUBLISHER_URL = 'https://publisher.walrus-testnet.walrus.space'
const DEFAULT_SEAL_KEY_SERVER_CONFIGS: KeyServerConfig[] = [
  {
    aggregatorUrl: 'https://seal-aggregator-testnet.mystenlabs.com',
    objectId: '0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98',
    weight: 1,
  },
]
const DEFAULT_MODI_TESTNET_SEAL_PACKAGE_ID = '0xc5be8a456d0ba7d33fbcff12e92d73181a3817872f6598f5cea65a5326ab3e21'
const DEFAULT_SEAL_THRESHOLD = 1
const DEFAULT_SEAL_TIMEOUT_MS = 10_000
const AGENT_MEMORY_BUNDLE_SCHEMA_VERSION = 'modi.agent-memory-bundle.v1'
const AGENT_MEMORY_SCHEMA_VERSION = 'modi.agent-memory.v1'
const ENCRYPTED_DATASET_SCHEMA_VERSION = 'modi.encrypted-health-dataset.v1'
const SECURITY_MEMORY_VERSION = 'modi.security-memory.v1'
const SUBMISSION_SCHEMA_VERSION = 'modi.participant-submission.v1'
const fullnodeUrls: Record<SuiNetwork, string> = {
  devnet: 'https://fullnode.devnet.sui.io:443',
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
}
const conditionLabels: Record<string, string> = {
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
  sleep_stage_band: 'Sleep stages',
  stand_time: 'Stand time',
  step_count: 'Step count',
  vo2_max: 'Cardio fitness',
  workout_summary: 'Workout summary',
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

export async function submitParticipantData({ loginId, onProgress, request }: SubmitParticipantDataInput): Promise<SubmitParticipantDataResult> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase configuration is required.')
  }

  reportSubmissionProgress(onProgress, {
    detail: 'Calculating the study request scope and submission period.',
    label: 'Preparing submission',
    progress: 4,
    stage: 'preparing',
  })

  const supabase = getSupabaseClient()
  const now = new Date()
  const periodEnd = toDateOnly(now)
  const periodStart = toDateOnly(addDays(now, -6))
  const volumeBytes = estimateSubmissionVolumeBytes(request)
  const category = getSubmissionCategory(request)
  const participantLabel = getParticipantLabel(loginId)
  reportSubmissionProgress(onProgress, {
    detail: 'Loading the institution policy_pack from Walrus and verifying its hash.',
    label: 'Checking Policy Pack',
    progress: 12,
    stage: 'policy-loading',
  })
  const policyPack = await fetchPolicyPackSnapshot(request)
  reportSubmissionProgress(onProgress, {
    detail: 'Loading prior Security Memory for this study when available.',
    label: 'Loading Security Memory',
    progress: 20,
    stage: 'security-memory-loading',
  })
  const securityMemory = await fetchSecurityMemorySnapshot(request)
  const policyHash = policyPack?.hash ?? request.policyPackHash ?? null
  const policyVersion = policyPack?.version ?? request.policyPackVersion ?? null
  reportSubmissionProgress(onProgress, {
    detail: 'Separating the login ID and raw health data into a study-grade pseudonymized payload.',
    label: 'Local pseudonymization',
    progress: 30,
    stage: 'pseudonymizing',
  })
  const participantPseudonymId = await buildProjectPseudonym({
    loginId,
    policyHash,
    projectPublicCode: request.id,
  })
  let payload: unknown = buildWalrusSubmissionPayload({
    category,
    createdAt: now.toISOString(),
    loginId,
    participantLabel,
    participantPseudonymId,
    periodEnd,
    periodStart,
    policyPack,
    request,
    volumeBytes,
  })
  let serializedPayload = stableStringify(payload)
  let pseudonymizedPayloadHash = await sha256Hex(serializedPayload)
  const verificationAttempts: PrivacyVerificationAttempt[] = []
  let safetyEdits: PrivacySafetyEdit[] = []
  const securityMemoryPatches: SecurityMemoryPatch[] = []
  reportSubmissionProgress(onProgress, {
    detail: 'The Privacy Agent in Supabase Edge Functions verifies payload, policy, and Security Memory together.',
    label: 'Privacy Agent first pass',
    progress: 42,
    stage: 'verifying',
  })
  let privacyVerification = await verifyPseudonymizedPayload({
    loginId,
    payload,
    payloadHash: pseudonymizedPayloadHash,
    privacyPolicyBlobId: policyPack?.blobId ?? request.policyPackBlobId ?? null,
    policyHash,
    policyVersion,
    projectPublicCode: request.id,
    securityMemory,
  })
  if (privacyVerification.securityMemoryPatch) {
    securityMemoryPatches.push(privacyVerification.securityMemoryPatch)
  }
  verificationAttempts.push(buildPrivacyVerificationAttempt(privacyVerification, 1))

  if (!privacyVerification.verified) {
    reportSubmissionProgress(onProgress, {
      detail: `Privacy Agent found ${privacyVerification.findings.length} risk signals and generalized the payload into broader categories.`,
      label: 'Hardening risk signals',
      progress: 54,
      stage: 'hardening',
    })
    safetyEdits = buildPrivacySafetyEdits(privacyVerification.findings)
    payload = hardenPayloadForPrivacy({ loginId, payload })
    serializedPayload = stableStringify(payload)
    pseudonymizedPayloadHash = await sha256Hex(serializedPayload)
    reportSubmissionProgress(onProgress, {
      detail: 'Rechecking whether the hardened payload passes the same Privacy Agent verification.',
      label: 'Privacy Agent recheck',
      progress: 63,
      stage: 'reverifying',
    })
    privacyVerification = await verifyPseudonymizedPayload({
      loginId,
      payload,
      payloadHash: pseudonymizedPayloadHash,
      privacyPolicyBlobId: policyPack?.blobId ?? request.policyPackBlobId ?? null,
      policyHash,
      policyVersion,
      projectPublicCode: request.id,
      securityMemory,
    })
    if (privacyVerification.securityMemoryPatch) {
      securityMemoryPatches.push(privacyVerification.securityMemoryPatch)
    }
    verificationAttempts.push(buildPrivacyVerificationAttempt(privacyVerification, 2))
  } else {
    reportSubmissionProgress(onProgress, {
      detail: 'Passed policy and Security Memory criteria without additional hardening.',
      label: 'Privacy Agent passed',
      progress: 63,
      stage: 'verified',
    })
  }

  if (!privacyVerification.verified || privacyVerification.payloadHash !== pseudonymizedPayloadHash) {
    throw new Error(privacyVerification.summary || 'Pseudonymized payload did not pass verification.')
  }

  reportSubmissionProgress(onProgress, {
    detail: 'Storing the pseudonymization plan on Walrus as an agent memory artifact.',
    label: 'Storing Agent Memory',
    progress: 69,
    stage: 'agent-memory-uploading',
  })
  const pseudonymizationPlanMemory = await uploadAgentMemoryArtifact({
    artifact: buildPseudonymizationPlanMemory({
      category,
      createdAt: now.toISOString(),
      participantPseudonymId,
      periodEnd,
      periodStart,
      policyHash,
      policyPack,
      policyVersion,
      request,
    }),
    loginId,
  })
  reportSubmissionProgress(onProgress, {
    detail: 'Writing the Privacy Agent verification receipt to Walrus for future traceability.',
    label: 'Storing Verification Receipt',
    progress: 74,
    stage: 'agent-memory-uploading',
  })
  const privacyReceiptMemory = await uploadAgentMemoryArtifact({
    artifact: buildPrivacyVerificationMemory({
      createdAt: now.toISOString(),
      participantPseudonymId,
      policyHash,
      policyVersion,
      privacyVerification,
      projectPublicCode: request.id,
      pseudonymizationPlanMemory,
      pseudonymizedPayloadHash,
      safetyEdits,
      securityMemory,
      securityMemoryPatches,
      verificationAttempts,
    }),
    loginId,
  })
  if (securityMemoryPatches.length > 0) {
    reportSubmissionProgress(onProgress, {
      detail: 'Updating Security Memory so future submissions can reuse newly discovered risk patterns.',
      label: 'Updating Security Memory',
      progress: 78,
      stage: 'security-memory-updating',
    })
  }
  const securityMemoryArtifact = securityMemoryPatches.length > 0
    ? await uploadAgentMemoryArtifact({
        artifact: buildSecurityMemoryArtifact({
          createdAt: now.toISOString(),
          participantPseudonymId,
          policyHash,
          policyVersion,
          projectPublicCode: request.id,
          securityMemory,
          securityMemoryPatches,
        }),
        loginId,
      })
    : null
  reportSubmissionProgress(onProgress, {
    detail: 'Converting the verified payload into a Seal SDK-based encrypted dataset.',
    label: 'Encrypting dataset',
    progress: 84,
    stage: 'encrypting',
  })
  const encryptedDataset = await encryptDatasetForWalrus({
    plaintext: serializedPayload,
    projectPublicCode: request.id,
    pseudonymizedPayloadHash,
    privacyPolicyHash: policyHash,
  })
  const encryptedDatasetHash = await sha256Hex(encryptedDataset.encryptedPayload)
  reportSubmissionProgress(onProgress, {
    detail: 'Uploading the encrypted healthcare dataset to the Walrus publisher.',
    label: 'Uploading to Walrus',
    progress: 89,
    stage: 'walrus-uploading',
  })
  const walrusUpload = await uploadToWalrus({
    loginId,
    payload: encryptedDataset.encryptedPayload,
  })
  reportSubmissionProgress(onProgress, {
    detail: 'Verifying the Walrus object owner and transaction digest on the fullnode.',
    label: 'Verifying Walrus Tx',
    progress: 93,
    stage: 'tx-verifying',
  })
  const walrusTxVerification = await verifyWalrusUploadTx({
    expectedOwner: normalizeSuiAddress(loginId),
    upload: walrusUpload,
  })
  const walrusTxDigest = walrusUpload.txDigest ?? walrusTxVerification.previousTransaction
  reportSubmissionProgress(onProgress, {
    detail: 'Storing the full workflow manifest as Walrus memory.',
    label: 'Storing Workflow Memory',
    progress: 96,
    stage: 'agent-memory-uploading',
  })
  const workflowMemory = await uploadAgentMemoryArtifact({
    artifact: buildWorkflowManifestMemory({
      createdAt: now.toISOString(),
      encryptedDatasetHash,
      participantPseudonymId,
      policyHash,
      policyPack,
      privacyReceiptMemory,
      pseudonymizationPlanMemory,
      request,
      safetyEdits,
      sealIdentityHex: encryptedDataset.sealIdentityHex,
      securityMemory,
      securityMemoryArtifact,
      securityMemoryPatches,
      verificationAttempts,
      walrusBlobId: walrusUpload.blobId,
      walrusBlobObjectId: walrusUpload.blobObjectId,
      walrusTxDigest,
    }),
    loginId,
  })
  const agentMemoryArtifacts = {
    artifacts: [
      pseudonymizationPlanMemory,
      privacyReceiptMemory,
      ...(securityMemoryArtifact ? [securityMemoryArtifact] : []),
      workflowMemory,
    ],
    memoryPolicy: {
      containsPlainHealthData: false,
      containsRawPayload: false,
      purpose: 'long-term verifiable agent memory for privacy-safe healthcare submission workflow',
    },
    schemaVersion: AGENT_MEMORY_BUNDLE_SCHEMA_VERSION,
    storage: {
      backend: 'walrus',
      publisherUrl: readWalrusPublisherUrl(),
    },
    workflow: {
      manifestBlobId: workflowMemory.blobId,
      manifestHash: workflowMemory.hash,
    },
  }

  reportSubmissionProgress(onProgress, {
    detail: 'Registering the submission record and Walrus blob reference with the platform server.',
    label: 'Registering submission',
    progress: 98,
    stage: 'registering',
  })
  const { data, error } = await supabase.functions.invoke('submit-participant-data', {
    body: {
      projectPublicCode: request.id,
      participantLoginId: loginId,
      participantLabel,
      category,
      periodStart,
      periodEnd,
      volumeBytes,
      privacyPolicyBlobId: policyPack?.blobId ?? request.policyPackBlobId ?? null,
      privacyPolicyHash: policyHash,
      privacyPolicyVersion: policyVersion,
      encryptionMode: encryptedDataset.encryptionMode,
      encryptionProvider: 'seal',
      sealIdentityHex: encryptedDataset.sealIdentityHex,
      sealPolicyId: request.sealPolicyId ?? null,
      privacyVerificationFindings: privacyVerification.findings,
      privacyVerificationPayloadHash: privacyVerification.payloadHash,
      privacyVerificationReceiptHash: privacyVerification.receiptHash,
      privacyVerificationSummary: privacyVerification.summary,
      privacyVerificationVerifiedAt: privacyVerification.verifiedAt,
      participantPseudonymId,
      securityMemoryBlobId: securityMemoryArtifact?.blobId ?? null,
      securityMemoryBlobObjectId: securityMemoryArtifact?.blobObjectId ?? null,
      securityMemoryHash: securityMemoryArtifact?.hash ?? null,
      securityMemoryVersion: securityMemoryArtifact ? SECURITY_MEMORY_VERSION : null,
      agentMemoryArtifacts,
      walrusBlobId: walrusUpload.blobId,
      walrusBlobObjectId: walrusUpload.blobObjectId,
      walrusManifestHash: encryptedDatasetHash,
      walrusPublisherUrl: readWalrusPublisherUrl(),
      walrusTxDigest,
    },
  })

  if (error) {
    throw error
  }

  reportSubmissionProgress(onProgress, {
    detail: 'Submission data is ready for decrypted download in the institution dashboard.',
    label: 'Submission complete',
    progress: 100,
    stage: 'complete',
  })

  return {
    ...(data as {
      applicationId: string
      submissionId: string
      walrusBlobId: string
      walrusBlobObjectId: string | null
      walrusManifestHash: string
      walrusTxDigest: string | null
      privacyVerificationReceiptHash?: string
    }),
    agentMemoryArtifacts,
  }
}

async function uploadAgentMemoryArtifact({
  artifact,
  loginId,
}: {
  artifact: AgentMemoryArtifact
  loginId: string
}): Promise<UploadedAgentMemoryArtifact> {
  const payload = stableStringify(artifact)
  const [hash, upload] = await Promise.all([
    sha256Hex(payload),
    uploadToWalrus({
      loginId,
      payload,
    }),
  ])

  return {
    blobId: upload.blobId,
    blobObjectId: upload.blobObjectId,
    hash,
    kind: artifact.kind,
    title: artifact.title,
    txDigest: upload.txDigest,
  }
}

function reportSubmissionProgress(
  onProgress: SubmitParticipantDataInput['onProgress'],
  progress: ParticipantSubmissionProgress,
) {
  onProgress?.({
    ...progress,
    progress: Math.max(0, Math.min(progress.progress, 100)),
  })
}

function buildPrivacyVerificationAttempt(
  verification: PrivacyVerificationResult,
  attempt: number,
): PrivacyVerificationAttempt {
  const findingCodes = [...new Set(verification.findings.map((finding) => finding.code))].sort()

  return {
    attempt,
    findingCodes,
    findingCount: verification.findings.length,
    payloadHash: verification.payloadHash,
    receiptHash: verification.receiptHash,
    securityMemoryPatch: verification.securityMemoryPatch ?? null,
    securityMemoryUsed: verification.securityAgent?.securityMemoryUsed ?? false,
    summary: verification.summary,
    verified: verification.verified,
    verifiedAt: verification.verifiedAt,
  }
}

function buildPrivacySafetyEdits(findings: PrivacyVerificationFinding[]): PrivacySafetyEdit[] {
  const findingCodes = [...new Set(findings.map((finding) => finding.code))].sort()
  const edits: PrivacySafetyEdit[] = []

  if (findingCodes.includes('direct_identifier_key_present') || findingCodes.includes('policy_forbidden_field_present')) {
    edits.push({
      action: 'remove_direct_identifier_fields',
      reason: 'Remove direct identifiers and keys forbidden by Walrus policy memory from the payload.',
      sourceFindingCodes: findingCodes.filter((code) => code === 'direct_identifier_key_present' || code === 'policy_forbidden_field_present'),
    })
  }

  if (findingCodes.includes('exact_date_present') || findingCodes.includes('exact_timestamp_present')) {
    edits.push({
      action: 'coarsen_time',
      reason: 'Generalize exact dates and timestamps into month-level values.',
      sourceFindingCodes: findingCodes.filter((code) => code === 'exact_date_present' || code === 'exact_timestamp_present'),
    })
  }

  const identifierValueCodes = findingCodes.filter((code) =>
    ['email_pattern_present', 'participant_login_id_present', 'phone_value_present', 'wallet_address_pattern_present'].includes(code),
  )

  if (identifierValueCodes.length > 0) {
    edits.push({
      action: 'replace_identifier_values',
      reason: 'Replace identifiable string values with removal markers.',
      sourceFindingCodes: identifierValueCodes,
    })
  }

  const quasiIdentifierCodes = findingCodes.filter((code) =>
    ['quasi_identifier_combination_risk', 'security_memory_known_risk_pattern', 'small_cohort_reidentification_risk'].includes(code),
  )

  if (quasiIdentifierCodes.length > 0) {
    edits.push({
      action: 'generalize_quasi_identifiers',
      reason: 'Generalize quasi-identifier combinations that could re-identify users in small cohorts.',
      sourceFindingCodes: quasiIdentifierCodes,
    })
  }

  if (edits.length === 0 && findings.length > 0) {
    edits.push({
      action: 'remove_direct_identifier_fields',
      reason: 'Reapply identifier removal rules conservatively because Security Agent findings remain.',
      sourceFindingCodes: findingCodes,
    })
  }

  return edits
}

function buildPseudonymizationPlanMemory({
  category,
  createdAt,
  participantPseudonymId,
  periodEnd,
  periodStart,
  policyHash,
  policyPack,
  policyVersion,
  request,
}: {
  category: string
  createdAt: string
  participantPseudonymId: string
  periodEnd: string
  periodStart: string
  policyHash: string | null
  policyPack: PolicyPackSnapshot | null
  policyVersion: string | null
  request: ResearchRequest
}): AgentMemoryArtifact {
  return {
    kind: 'pseudonymization_plan',
    schemaVersion: AGENT_MEMORY_SCHEMA_VERSION,
    title: 'Local Pseudonymization Plan',
    createdAt,
    memoryScope: {
      projectPublicCode: request.id,
      participantPseudonymId,
      reusableAcrossSessions: true,
    },
    memoryPolicy: {
      containsEncryptedDataset: false,
      containsPlainHealthData: false,
      containsRawPayload: false,
      longTermPurpose: 'local pseudonymization rules derived from the public Walrus policy pack',
      storage: 'walrus',
    },
    summary: 'Records the local pseudonymization rules applied by the user app from the public institution policy_pack.',
    project: {
      allowedUse: request.allowedUse,
      dataScope: request.requiredConditionTags,
      policyPackBlobId: policyPack?.blobId ?? request.policyPackBlobId ?? null,
      policyPackHash: policyHash,
      policyPackVersion: policyPack?.version ?? policyVersion,
      publicCode: request.id,
      title: request.title,
    },
    plan: {
      inputCategory: category,
      outputSchemaVersion: SUBMISSION_SCHEMA_VERSION,
      period: {
        end: toMonthOnly(periodEnd),
        granularity: 'monthly',
        start: toMonthOnly(periodStart),
      },
      transformations: [
        {
          action: 'remove',
          fields: [...directIdentifierKeys].sort(),
          reason: 'Remove direct identifiers and wallet/contact patterns before Walrus storage.',
        },
        {
          action: 'coarsen_time',
          fields: ['createdAt', 'periodStart', 'periodEnd', 'recordedAt'],
          granularity: 'month',
          reason: 'Reduce time to month-level granularity so precise timestamps do not persist in long-term agent memory.',
        },
        {
          action: 'scope_pseudonym',
          fields: ['participant.pseudonymId'],
          reason: 'Reuse user identity only as a pseudonym bound to the study and policy hash.',
        },
      ],
    },
  }
}

function buildPrivacyVerificationMemory({
  createdAt,
  participantPseudonymId,
  policyHash,
  policyVersion,
  privacyVerification,
  projectPublicCode,
  pseudonymizationPlanMemory,
  pseudonymizedPayloadHash,
  safetyEdits,
  securityMemory,
  securityMemoryPatches,
  verificationAttempts,
}: {
  createdAt: string
  participantPseudonymId: string
  policyHash: string | null
  policyVersion: string | null
  privacyVerification: PrivacyVerificationResult
  projectPublicCode: string
  pseudonymizationPlanMemory: UploadedAgentMemoryArtifact
  pseudonymizedPayloadHash: string
  safetyEdits: PrivacySafetyEdit[]
  securityMemory: SecurityMemorySnapshot | null
  securityMemoryPatches: SecurityMemoryPatch[]
  verificationAttempts: PrivacyVerificationAttempt[]
}): AgentMemoryArtifact {
  return {
    kind: 'privacy_verification_receipt',
    schemaVersion: AGENT_MEMORY_SCHEMA_VERSION,
    title: 'Security Agent Verification Receipt',
    createdAt,
    memoryScope: {
      projectPublicCode,
      participantPseudonymId,
      reusableAcrossAgents: true,
    },
    memoryPolicy: {
      containsEncryptedDataset: false,
      containsPlainHealthData: false,
      containsRawPayload: false,
      longTermPurpose: 'verifiable Security Agent decision history using Walrus policy memory',
      storage: 'walrus',
    },
    summary: privacyVerification.summary,
    upstreamMemory: {
      pseudonymizationPlanBlobId: pseudonymizationPlanMemory.blobId,
      pseudonymizationPlanHash: pseudonymizationPlanMemory.hash,
    },
    receipt: {
      findings: privacyVerification.findings,
      payloadHash: privacyVerification.payloadHash,
      policyMemory: privacyVerification.policyMemory ?? null,
      pseudonymizedPayloadHash,
      receiptHash: privacyVerification.receiptHash,
      securityAgent: privacyVerification.securityAgent ?? null,
      securityMemory: privacyVerification.securityMemory ?? null,
      securityMemoryPatch: privacyVerification.securityMemoryPatch ?? null,
      verified: privacyVerification.verified,
      verifiedAt: privacyVerification.verifiedAt,
    },
    longTermVerificationTrace: {
      attempts: verificationAttempts,
      finalPayloadHash: pseudonymizedPayloadHash,
      finalReceiptHash: privacyVerification.receiptHash,
      safetyEdits,
      securityMemoryPatchCount: securityMemoryPatches.length,
      securityMemoryPatches,
    },
    recalledSecurityMemory: securityMemory
      ? {
          blobId: securityMemory.blobId,
          fetchedAt: securityMemory.fetchedAt,
          hash: securityMemory.hash,
          knownRiskPatternCount: securityMemory.knownRiskPatterns.length,
          version: securityMemory.version,
        }
      : null,
    policy: {
      hash: policyHash,
      version: policyVersion,
    },
  }
}

function buildSecurityMemoryArtifact({
  createdAt,
  participantPseudonymId,
  policyHash,
  policyVersion,
  projectPublicCode,
  securityMemory,
  securityMemoryPatches,
}: {
  createdAt: string
  participantPseudonymId: string
  policyHash: string | null
  policyVersion: string | null
  projectPublicCode: string
  securityMemory: SecurityMemorySnapshot | null
  securityMemoryPatches: SecurityMemoryPatch[]
}): AgentMemoryArtifact {
  const knownRiskPatterns = mergeKnownRiskPatterns({
    existingPatterns: securityMemory?.knownRiskPatterns ?? [],
    patches: securityMemoryPatches,
  })

  return {
    kind: 'security_memory',
    schemaVersion: AGENT_MEMORY_SCHEMA_VERSION,
    title: 'Security Agent Learned Risk Memory',
    createdAt,
    memoryVersion: SECURITY_MEMORY_VERSION,
    memoryScope: {
      projectPublicCode,
      reusableAcrossSubmissions: true,
      reusableBy: 'platform_security_agent',
    },
    memoryPolicy: {
      containsEncryptedDataset: false,
      containsPlainHealthData: false,
      containsRawPayload: false,
      longTermPurpose: 'learned security risk patterns recalled before future platform verification',
      storage: 'walrus',
    },
    previousMemory: securityMemory
      ? {
          blobId: securityMemory.blobId,
          fetchedAt: securityMemory.fetchedAt,
          hash: securityMemory.hash,
          knownRiskPatternCount: securityMemory.knownRiskPatterns.length,
          version: securityMemory.version,
        }
      : null,
    learnedFrom: {
      participantPseudonymId,
      policyHash,
      policyVersion,
      patchCount: securityMemoryPatches.length,
    },
    knownRiskPatterns,
    patches: securityMemoryPatches,
    summary: 'Walrus memory storing re-identification risk signal combinations and recommended generalization rules found in past submissions.',
  }
}

function mergeKnownRiskPatterns({
  existingPatterns,
  patches,
}: {
  existingPatterns: SecurityMemoryKnownRiskPattern[]
  patches: SecurityMemoryPatch[]
}) {
  const merged = new Map<string, SecurityMemoryKnownRiskPattern>()

  for (const pattern of existingPatterns) {
    merged.set(buildKnownRiskPatternKey(pattern), pattern)
  }

  for (const patch of patches) {
    const nextPattern = buildKnownRiskPatternFromPatch(patch)

    if (!nextPattern) {
      continue
    }

    const key = buildKnownRiskPatternKey(nextPattern)
    const existingPattern = merged.get(key)

    if (!existingPattern) {
      merged.set(key, nextPattern)
      continue
    }

    merged.set(key, {
      ...existingPattern,
      findingCodes: [...new Set([...existingPattern.findingCodes, ...nextPattern.findingCodes])].sort(),
      lastSeenAt: nextPattern.lastSeenAt,
      matchCount: existingPattern.matchCount + 1,
      recommendedTransforms: mergeRecommendedTransforms(existingPattern.recommendedTransforms, nextPattern.recommendedTransforms),
    })
  }

  return [...merged.values()].sort((left, right) => left.id.localeCompare(right.id))
}

function buildKnownRiskPatternFromPatch(patch: SecurityMemoryPatch): SecurityMemoryKnownRiskPattern | null {
  const signalCodes = [...new Set(patch.riskSignals.map((signal) => signal.code).filter(Boolean))].sort()

  if (signalCodes.length === 0) {
    return null
  }

  const findingCodes = [...new Set(patch.findingCodes)].sort()
  const id = `risk:${signalCodes.join('+')}`

  return {
    id,
    firstSeenAt: patch.createdAt,
    findingCodes,
    lastSeenAt: patch.createdAt,
    matchCount: 1,
    recommendedTransforms: mergeRecommendedTransforms([], patch.recommendedTransforms),
    signalCodes,
  }
}

function buildKnownRiskPatternKey(pattern: SecurityMemoryKnownRiskPattern) {
  return pattern.signalCodes.join('+')
}

function mergeRecommendedTransforms(
  left: SecurityMemoryRecommendedTransform[],
  right: SecurityMemoryRecommendedTransform[],
) {
  const seen = new Set<string>()

  return [...left, ...right].filter((transform) => {
    const key = `${transform.field}:${transform.action}:${transform.target}`

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function buildWorkflowManifestMemory({
  createdAt,
  encryptedDatasetHash,
  participantPseudonymId,
  policyHash,
  policyPack,
  privacyReceiptMemory,
  pseudonymizationPlanMemory,
  request,
  safetyEdits,
  sealIdentityHex,
  securityMemory,
  securityMemoryArtifact,
  securityMemoryPatches,
  verificationAttempts,
  walrusBlobId,
  walrusBlobObjectId,
  walrusTxDigest,
}: {
  createdAt: string
  encryptedDatasetHash: string
  participantPseudonymId: string
  policyHash: string | null
  policyPack: PolicyPackSnapshot | null
  privacyReceiptMemory: UploadedAgentMemoryArtifact
  pseudonymizationPlanMemory: UploadedAgentMemoryArtifact
  request: ResearchRequest
  safetyEdits: PrivacySafetyEdit[]
  sealIdentityHex: string
  securityMemory: SecurityMemorySnapshot | null
  securityMemoryArtifact: UploadedAgentMemoryArtifact | null
  securityMemoryPatches: SecurityMemoryPatch[]
  verificationAttempts: PrivacyVerificationAttempt[]
  walrusBlobId: string
  walrusBlobObjectId: string | null
  walrusTxDigest: string | null
}): AgentMemoryArtifact {
  return {
    kind: 'agent_workflow_manifest',
    schemaVersion: AGENT_MEMORY_SCHEMA_VERSION,
    title: 'MODi Agent Workflow Memory',
    createdAt,
    memoryScope: {
      projectPublicCode: request.id,
      participantPseudonymId,
      persistentStorage: 'walrus',
      reusableAcrossAgents: true,
    },
    memoryPolicy: {
      containsEncryptedDataset: false,
      containsPlainHealthData: false,
      containsRawPayload: false,
      longTermPurpose: 'portable workflow record shared by platform Security Agent and institution download flow',
      storage: 'walrus',
    },
    summary: 'Durable workflow record shared by public policy memory, user-app local pseudonymization, platform Security Agent, and institution download flow.',
    agentWorkflow: [
      'institution_published_public_policy',
      'user_app_loaded_public_policy_pack',
      'user_app_applied_local_pseudonymization',
      'platform_security_agent_recalled_walrus_security_memory',
      'platform_security_agent_reused_walrus_policy_memory',
      'platform_security_agent_emitted_security_memory_patch',
      'security_agent_receipt_verified',
      'security_memory_updated_on_walrus',
      'encrypted_dataset_uploaded_to_walrus',
      'institution_can_replay_security_record',
    ],
    verificationState: {
      attemptCount: verificationAttempts.length,
      finalAttempt: verificationAttempts[verificationAttempts.length - 1] ?? null,
      safetyEditCount: safetyEdits.length,
      safetyEdits,
      securityMemoryPatchCount: securityMemoryPatches.length,
    },
    artifacts: {
      encryptedDataset: {
        blobId: walrusBlobId,
        hash: encryptedDatasetHash,
        objectId: walrusBlobObjectId,
        sealIdentityHex,
        txDigest: walrusTxDigest,
      },
      policyPack: policyPack
        ? {
            blobId: policyPack.blobId,
            hash: policyHash,
            version: policyPack.version,
          }
        : null,
      privacyVerificationReceipt: privacyReceiptMemory,
      pseudonymizationPlan: pseudonymizationPlanMemory,
      recalledSecurityMemory: securityMemory
        ? {
            blobId: securityMemory.blobId,
            hash: securityMemory.hash,
            knownRiskPatternCount: securityMemory.knownRiskPatterns.length,
            version: securityMemory.version,
          }
        : null,
      updatedSecurityMemory: securityMemoryArtifact,
    },
  }
}

export type SubmitParticipantDataResult = {
  applicationId: string
  agentMemoryArtifacts: {
    artifacts: UploadedAgentMemoryArtifact[]
    schemaVersion: string
    storage: {
      backend: string
      publisherUrl: string
    }
    workflow: {
      manifestBlobId: string
      manifestHash: string
    }
  }
  submissionId: string
  walrusBlobId: string
  walrusBlobObjectId: string | null
  walrusManifestHash: string
  walrusTxDigest: string | null
  privacyVerificationReceiptHash?: string
  securityMemoryBlobId?: string | null
  securityMemoryHash?: string | null
  securityMemoryVersion?: string | null
}

async function verifyPseudonymizedPayload({
  loginId,
  payload,
  payloadHash,
  privacyPolicyBlobId,
  policyHash,
  policyVersion,
  projectPublicCode,
  securityMemory,
}: {
  loginId: string
  payload: unknown
  payloadHash: string
  privacyPolicyBlobId: string | null
  policyHash: string | null
  policyVersion: string | null
  projectPublicCode: string
  securityMemory: SecurityMemorySnapshot | null
}) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.functions.invoke('verify-participant-payload', {
    body: {
      participantLoginId: loginId,
      payload,
      payloadHash,
      privacyPolicyBlobId,
      privacyPolicyHash: policyHash,
      privacyPolicyVersion: policyVersion,
      projectPublicCode,
      securityMemoryBlobId: securityMemory?.blobId ?? null,
      securityMemoryHash: securityMemory?.hash ?? null,
      securityMemoryVersion: securityMemory?.version ?? null,
    },
  })

  if (error) {
    throw error
  }

  const verification = data as PrivacyVerificationResult

  if (typeof verification?.verified !== 'boolean' || !verification.payloadHash || !verification.receiptHash) {
    throw new Error('Agent pseudonymization verification response is invalid.')
  }

  return verification
}

async function fetchPolicyPackSnapshot(request: ResearchRequest): Promise<PolicyPackSnapshot | null> {
  if (!request.policyPackBlobId) {
    return null
  }

  const response = await fetch(buildWalrusFetchUrl(request.policyPackBlobId))
  const responseText = await response.text()

  if (!response.ok) {
    throw new Error(`Could not fetch policy_pack from Walrus. ${responseText || response.statusText}`)
  }

  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, responseText)

  if (request.policyPackHash && request.policyPackHash !== hash) {
    throw new Error('policy_pack hash does not match the value stored when the study was created.')
  }

  const payload = parseJson(responseText)
  const policyPack = asRecord(payload)

  return {
    blobId: request.policyPackBlobId,
    fetchedAt: new Date().toISOString(),
    hash,
    payload,
    version: request.policyPackVersion ?? readString(policyPack?.policyVersion),
  }
}

async function fetchSecurityMemorySnapshot(request: ResearchRequest): Promise<SecurityMemorySnapshot | null> {
  if (!request.securityMemoryBlobId) {
    return null
  }

  const response = await fetch(buildWalrusFetchUrl(request.securityMemoryBlobId))
  const responseText = await response.text()

  if (!response.ok) {
    throw new Error(`Could not fetch Security Memory from Walrus. ${responseText || response.statusText}`)
  }

  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, responseText)

  if (request.securityMemoryHash && request.securityMemoryHash !== hash) {
    throw new Error('Security Memory hash does not match the value stored on the study.')
  }

  const payload = parseJson(responseText)
  const memory = asRecord(payload)

  return {
    blobId: request.securityMemoryBlobId,
    fetchedAt: new Date().toISOString(),
    hash,
    knownRiskPatterns: readKnownRiskPatterns(memory),
    payload,
    version: request.securityMemoryVersion ?? readString(memory?.memoryVersion),
  }
}

function readKnownRiskPatterns(memory: Record<string, unknown> | null): SecurityMemoryKnownRiskPattern[] {
  const patterns = Array.isArray(memory?.knownRiskPatterns) ? memory.knownRiskPatterns : []

  return patterns.map(readKnownRiskPattern).filter((pattern): pattern is SecurityMemoryKnownRiskPattern => Boolean(pattern))
}

function readKnownRiskPattern(value: unknown): SecurityMemoryKnownRiskPattern | null {
  const pattern = asRecord(value)
  const signalCodes = readStringArray(pattern?.signalCodes).sort()

  if (signalCodes.length === 0) {
    return null
  }

  const id = readString(pattern?.id) ?? `risk:${signalCodes.join('+')}`

  return {
    id,
    firstSeenAt: readString(pattern?.firstSeenAt),
    findingCodes: readStringArray(pattern?.findingCodes).sort(),
    lastSeenAt: readString(pattern?.lastSeenAt),
    matchCount: readNumber(pattern?.matchCount) ?? 1,
    recommendedTransforms: readRecommendedTransforms(pattern?.recommendedTransforms),
    signalCodes,
  }
}

function readRecommendedTransforms(value: unknown): SecurityMemoryRecommendedTransform[] {
  return Array.isArray(value)
    ? value.map(readRecommendedTransform).filter((transform): transform is SecurityMemoryRecommendedTransform => Boolean(transform))
    : []
}

function readRecommendedTransform(value: unknown): SecurityMemoryRecommendedTransform | null {
  const transform = asRecord(value)
  const action = readString(transform?.action)
  const field = readString(transform?.field)
  const target = readString(transform?.target)

  return action && field && target ? { action, field, target } : null
}

function buildWalrusSubmissionPayload({
  category,
  createdAt,
  loginId,
  participantLabel,
  participantPseudonymId,
  periodEnd,
  periodStart,
  policyPack,
  request,
  volumeBytes,
}: {
  category: string
  createdAt: string
  loginId: string
  participantLabel: string
  participantPseudonymId: string
  periodEnd: string
  periodStart: string
  policyPack: PolicyPackSnapshot | null
  request: ResearchRequest
  volumeBytes: number
}) {
  return {
    schemaVersion: SUBMISSION_SCHEMA_VERSION,
    project: {
      allowedUse: request.allowedUse,
      organization: request.organization,
      publicCode: request.id,
      purposeLabel: request.purposeLabel,
      retentionDays: request.retentionDays,
      reward: request.reward,
      title: request.title,
      policyPack: policyPack
        ? {
            fetchedAt: policyPack.fetchedAt,
            sha256: policyPack.hash,
            version: policyPack.version,
            walrusBlobId: policyPack.blobId,
          }
        : null,
      sealPolicyId: request.sealPolicyId ?? null,
    },
    policyPack: policyPack?.payload ?? null,
    participant: {
      label: participantLabel,
      pseudonymId: participantPseudonymId,
      pseudonymScope: 'project',
    },
    privacy: {
      directIdentifiers: 'removed_on_device',
      platformVerification: 'required_before_walrus_upload',
      pseudonymization: 'project_scoped_sha256',
    },
    requiredData: {
      ageRanges: request.requiredAgeRanges,
      healthRecordFields: request.requiredConditionTags.map((tag) => ({
        key: tag,
        label: getConditionLabel(tag),
      })),
      periodGranularity: 'monthly',
      regionGranularity: 'province',
    },
    submission: {
      category,
      createdAt: toMonthOnly(createdAt),
      periodEnd: toMonthOnly(periodEnd),
      periodStart: toMonthOnly(periodStart),
      volumeBytes,
    },
    healthcareData: buildDemoHealthcareSnapshot({ loginId, request }),
  }
}

function buildDemoHealthcareSnapshot({
  loginId,
  request,
}: {
  loginId: string
  request: ResearchRequest
}) {
  const isRiskDemo = loginId === 'han-demo-risk' || request.title.toLowerCase().includes('security memory')

  if (isRiskDemo) {
    return {
      participantProfile: {
        ageRange: '40-44',
        region: 'Jeju-Seogwipo',
      },
      health: {
        conditionTag: 'sleep_apnea_with_pacemaker',
        restingHeartRateBand: '40-44',
        sleepDurationBand: '6-7h',
        stepCountBand: '25k+',
        vo2MaxBand: 'superior',
      },
      device: {
        deviceType: 'Apple Watch Ultra 2',
      },
      activity: {
        workoutPattern: 'open_water_swim_5x_week',
      },
    }
  }

  return {
    participantProfile: {
      ageRange: request.requiredAgeRanges[0] ?? '40-49',
      region: 'Jeju',
    },
    health: {
      conditionTag: 'sleep_cardiovascular',
      restingHeartRateBand: '50-59',
      sleepDurationBand: '6-7h',
      stepCountBand: '10k-15k',
      vo2MaxBand: 'high',
    },
    device: {
      deviceType: 'wearable',
    },
    activity: {
      workoutPattern: 'regular_activity',
    },
  }
}

async function buildProjectPseudonym({
  loginId,
  policyHash,
  projectPublicCode,
}: {
  loginId: string
  policyHash: string | null
  projectPublicCode: string
}) {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    ['modi', 'participant-pseudonym', projectPublicCode, policyHash ?? 'no-policy', loginId.trim().toLowerCase()].join(':'),
  )

  return `modi_${hash.slice(0, 32)}`
}

function hardenPayloadForPrivacy({ loginId, payload }: { loginId: string; payload: unknown }) {
  return sanitizePrivacyValue({ loginId, value: payload }) ?? null
}

function sanitizePrivacyValue({ key, loginId, value }: { key?: string; loginId: string; value: unknown }): unknown {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizePrivacyValue({ loginId, value: item }))
      .filter((item) => item !== undefined)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !directIdentifierKeys.has(key))
        .map(([key, item]) => [key, sanitizePrivacyValue({ key, loginId, value: item })])
        .filter(([, item]) => item !== undefined),
    )
  }

  if (typeof value !== 'string') {
    return value
  }

  const generalizedValue = generalizeQuasiIdentifierValue({ key, value })

  if (generalizedValue !== value) {
    return generalizedValue
  }

  if (timestampPattern.test(value) || dateOnlyPattern.test(value)) {
    return toMonthOnly(value)
  }

  if (
    emailPattern.test(value) ||
    suiAddressPattern.test(value) ||
    value.toLowerCase().includes(loginId.toLowerCase()) ||
    isPhoneLikeValue(value)
  ) {
    return '[removed]'
  }

  return value
}

function generalizeQuasiIdentifierValue({ key, value }: { key?: string; value: string }) {
  const normalizedKey = key?.toLowerCase()
  const normalizedValue = value.trim().toLowerCase()

  if (normalizedKey === 'agerange' || normalizedKey === 'age_range') {
    return /^\d{2}-\d{2}$/.test(normalizedValue) && Number(normalizedValue.slice(3, 5)) - Number(normalizedValue.slice(0, 2)) <= 5
      ? `${normalizedValue.slice(0, 1)}0-${normalizedValue.slice(0, 1)}9`
      : value
  }

  if (normalizedKey === 'region') {
    return value.includes('-') ? value.split('-')[0] : value
  }

  if (normalizedKey === 'conditiontag' || normalizedKey === 'conditiongroup' || normalizedKey === 'condition') {
    return normalizedValue.includes('pacemaker') || normalizedValue.includes('sleep_apnea') ? 'sleep_cardiovascular' : value
  }

  if (normalizedKey === 'devicetype' || normalizedKey === 'devicemodel') {
    return /\b(ultra|series|watch|galaxy)\b/i.test(value) && /\d/.test(value) ? 'wearable' : value
  }

  if (normalizedKey === 'restingheartrateband') {
    return /^\d{2}-\d{2}$/.test(normalizedValue) && Number(normalizedValue.slice(3, 5)) < 50 ? 'under_50' : value
  }

  if (normalizedKey === 'vo2maxband') {
    return normalizedValue === 'superior' || normalizedValue === 'elite' ? 'high' : value
  }

  if (normalizedKey === 'stepcountband') {
    return normalizedValue.includes('25k') || normalizedValue.includes('30k') ? '20k+' : value
  }

  if (normalizedKey === 'workoutpattern') {
    return normalizedValue.includes('open_water') || normalizedValue.includes('triathlon') || normalizedValue.includes('5x_week') ? 'high_activity' : value
  }

  return value
}

async function encryptDatasetForWalrus({
  plaintext,
  projectPublicCode,
  privacyPolicyHash,
  pseudonymizedPayloadHash,
}: {
  plaintext: string
  projectPublicCode: string
  privacyPolicyHash: string | null
  pseudonymizedPayloadHash: string
}): Promise<EncryptedDataset> {
  const sealIdentityHex = await sha256Hex(
    ['modi', 'encrypted-health-dataset', projectPublicCode, privacyPolicyHash ?? 'no-policy', pseudonymizedPayloadHash].join(':'),
  )
  const packageId = readModiSealPackageId()
  const keyServerConfigs = readSealKeyServerConfigs()
  const threshold = readSealThreshold(keyServerConfigs)
  const sealClient = new SealClient({
    serverConfigs: keyServerConfigs,
    suiClient: new SuiGrpcClient({
      baseUrl: readSuiFullnodeUrl(),
      network: readSuiNetwork(process.env.EXPO_PUBLIC_SUI_NETWORK),
    }),
    timeout: DEFAULT_SEAL_TIMEOUT_MS,
    verifyKeyServers: readSealVerifyKeyServers(),
  })
  const plaintextBytes = new TextEncoder().encode(plaintext)
  const { encryptedObject } = await sealClient.encrypt({
    data: plaintextBytes,
    id: sealIdentityHex,
    packageId,
    threshold,
  })
  const envelope = {
    schemaVersion: ENCRYPTED_DATASET_SCHEMA_VERSION,
    encryptedAt: new Date().toISOString(),
    projectPublicCode,
    dataset: {
      plaintextSha256: pseudonymizedPayloadHash,
      plaintextSchemaVersion: SUBMISSION_SCHEMA_VERSION,
    },
    encryption: {
      provider: 'seal',
      mode: 'seal-sdk',
      algorithm: 'Seal threshold encryption',
      keyManagement: 'seal-key-server-threshold',
      keyServers: keyServerConfigs.map(({ aggregatorUrl, objectId, weight }) => ({
        aggregatorUrl: aggregatorUrl ?? null,
        objectId,
        weight,
      })),
      packageId,
      sealIdentityHex,
      sealIdentity: `0x${sealIdentityHex}`,
      threshold,
      privacyPolicyHash,
    },
    cipher: {
      encryptedObjectBase64: bytesToBase64(encryptedObject),
    },
  }

  return {
    encryptionMode: 'seal-sdk',
    encryptedPayload: stableStringify(envelope),
    sealIdentityHex,
  }
}

async function uploadToWalrus({ loginId, payload }: { loginId: string; payload: string }): Promise<WalrusUploadResult> {
  const response = await fetch(buildWalrusUploadUrl(loginId), {
    body: payload,
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'PUT',
  })

  const responseText = await response.text()
  const responseBody = parseJson(responseText)

  if (!response.ok) {
    throw new Error(`Walrus upload failed. ${responseText || response.statusText}`)
  }

  return parseWalrusUploadResponse(responseBody)
}

function buildWalrusUploadUrl(loginId: string) {
  const publisherUrl = readWalrusPublisherUrl().replace(/\/+$/g, '')
  const query = [`epochs=${encodeURIComponent(readWalrusEpochs())}`]
  const recipientAddress = normalizeSuiAddress(loginId)

  if (recipientAddress) {
    query.push(`send_object_to=${encodeURIComponent(recipientAddress)}`)
  }

  return `${publisherUrl}/v1/blobs?${query.join('&')}`
}

function buildWalrusFetchUrl(blobId: string) {
  const aggregatorUrl = readWalrusAggregatorUrl().replace(/\/+$/g, '')
  return `${aggregatorUrl}/v1/blobs/${encodeURIComponent(blobId)}`
}

function parseWalrusUploadResponse(responseBody: unknown): WalrusUploadResult {
  const root = asRecord(responseBody)
  const newlyCreated = asRecord(root?.newlyCreated)
  const alreadyCertified = asRecord(root?.alreadyCertified)
  const blobObject = asRecord(newlyCreated?.blobObject) ?? asRecord(alreadyCertified?.blobObject)
  const event = asRecord(newlyCreated?.event) ?? asRecord(alreadyCertified?.event)
  const blobId = readString(blobObject?.blobId) ?? readString(newlyCreated?.blobId) ?? readString(alreadyCertified?.blobId)
  const blobObjectId = readString(blobObject?.id) ?? readString(newlyCreated?.blobObjectId) ?? readString(alreadyCertified?.blobObjectId)
  const txDigest = readString(event?.txDigest) ?? readString(newlyCreated?.txDigest) ?? readString(alreadyCertified?.txDigest)

  if (!blobId) {
    throw new Error('Could not find the blob ID in the Walrus upload response.')
  }

  return {
    blobId,
    blobObjectId,
    rawResponse: responseBody,
    txDigest,
  }
}

async function verifyWalrusUploadTx({
  expectedOwner,
  upload,
}: {
  expectedOwner: string | null
  upload: WalrusUploadResult
}): Promise<WalrusTxVerification> {
  if (!upload.blobObjectId) {
    throw new Error('Walrus upload succeeded, but Tx verification cannot proceed because the Sui object ID is missing.')
  }

  const maxAttempts = 5
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await fetchSuiObjectTx({
        expectedOwner,
        objectId: upload.blobObjectId,
      })
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Sui Tx verification failed.')

      if (attempt < maxAttempts - 1) {
        await wait(700 * (attempt + 1))
      }
    }
  }

  throw lastError ?? new Error('Could not verify the Walrus Tx on the Sui fullnode.')
}

async function fetchSuiObjectTx({
  expectedOwner,
  objectId,
}: {
  expectedOwner: string | null
  objectId: string
}): Promise<WalrusTxVerification> {
  const response = await fetch(readSuiFullnodeUrl(), {
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'sui_getObject',
      params: [
        objectId,
        {
          showOwner: true,
          showPreviousTransaction: true,
          showType: true,
        },
      ],
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  const responseText = await response.text()
  const responseBody = parseJson(responseText)

  if (!response.ok) {
    throw new Error(`Sui Tx verification failed. ${responseText || response.statusText}`)
  }

  const root = asRecord(responseBody)
  const result = asRecord(root?.result)
  const data = asRecord(result?.data)
  const error = asRecord(root?.error) ?? asRecord(result?.error)

  if (error) {
    throw new Error(readString(error.message) ?? 'Could not find the object on the Sui fullnode.')
  }

  const previousTransaction = readString(data?.previousTransaction)
  const objectDigest = readString(data?.digest)
  const objectOwner = readSuiOwnerAddress(data?.owner)
  const objectType = readString(data?.type)

  if (!previousTransaction) {
    throw new Error('The Sui object was found, but it has no previous Tx digest.')
  }

  if (objectType && !objectType.includes('::blob::Blob')) {
    throw new Error('The Sui object is not a Walrus blob object.')
  }

  if (expectedOwner && objectOwner && objectOwner !== expectedOwner) {
    throw new Error('The Walrus blob object owner does not match the current wallet address.')
  }

  return {
    objectDigest,
    objectOwner,
    objectType,
    previousTransaction,
  }
}

function readWalrusPublisherUrl() {
  const value = process.env.EXPO_PUBLIC_WALRUS_PUBLISHER_URL?.trim()
  return value && /^https?:\/\//.test(value) ? value : DEFAULT_WALRUS_PUBLISHER_URL
}

function readWalrusAggregatorUrl() {
  const value = process.env.EXPO_PUBLIC_WALRUS_AGGREGATOR_URL?.trim()
  return value && /^https?:\/\//.test(value) ? value : DEFAULT_WALRUS_AGGREGATOR_URL
}

function readWalrusEpochs() {
  const value = Number(process.env.EXPO_PUBLIC_WALRUS_EPOCHS)
  return Number.isFinite(value) && value > 0 ? String(Math.floor(value)) : DEFAULT_WALRUS_EPOCHS
}

function readModiSealPackageId() {
  const packageId = normalizeSuiObjectId(process.env.EXPO_PUBLIC_MODI_SEAL_PACKAGE_ID)

  if (packageId) {
    return packageId
  }

  if (readSuiNetwork(process.env.EXPO_PUBLIC_SUI_NETWORK) === 'testnet') {
    return DEFAULT_MODI_TESTNET_SEAL_PACKAGE_ID
  }

  throw new Error('EXPO_PUBLIC_MODI_SEAL_PACKAGE_ID is required for Seal encryption.')
}

function readSealKeyServerConfigs(): KeyServerConfig[] {
  const configuredJson = process.env.EXPO_PUBLIC_SEAL_KEY_SERVER_CONFIGS?.trim()

  if (configuredJson) {
    const parsed = parseJson(configuredJson)
    const configs = Array.isArray(parsed) ? parsed.map(normalizeSealKeyServerConfig).filter(isPresent) : []

    if (!configs.length) {
      throw new Error('EXPO_PUBLIC_SEAL_KEY_SERVER_CONFIGS is invalid.')
    }

    return configs
  }

  const objectIds = process.env.EXPO_PUBLIC_SEAL_KEY_SERVER_OBJECT_IDS?.split(',').map(normalizeSuiObjectId).filter(isPresent) ?? []

  if (objectIds.length) {
    const aggregatorUrl = readSealAggregatorUrl()
    return objectIds.map((objectId) => ({
      ...(aggregatorUrl ? { aggregatorUrl } : {}),
      objectId,
      weight: 1,
    }))
  }

  return DEFAULT_SEAL_KEY_SERVER_CONFIGS
}

function normalizeSealKeyServerConfig(value: unknown): KeyServerConfig | null {
  const config = asRecord(value)
  const objectId = normalizeSuiObjectId(config?.objectId)
  const weight = readPositiveInteger(config?.weight, 1)

  if (!objectId || !weight) {
    return null
  }

  const aggregatorUrl = readUrl(config?.aggregatorUrl)
  const apiKeyName = readString(config?.apiKeyName)
  const apiKey = readString(config?.apiKey)

  return {
    ...(aggregatorUrl ? { aggregatorUrl } : {}),
    ...(apiKeyName && apiKey ? { apiKeyName, apiKey } : {}),
    objectId,
    weight,
  }
}

function readSealAggregatorUrl() {
  return readUrl(process.env.EXPO_PUBLIC_SEAL_AGGREGATOR_URL)
}

function readSealThreshold(keyServerConfigs: KeyServerConfig[]) {
  const totalWeight = keyServerConfigs.reduce((sum, config) => sum + config.weight, 0)
  const configuredThreshold = readPositiveInteger(process.env.EXPO_PUBLIC_SEAL_THRESHOLD, DEFAULT_SEAL_THRESHOLD)
  return Math.min(configuredThreshold, totalWeight)
}

function readSealVerifyKeyServers() {
  return process.env.EXPO_PUBLIC_SEAL_VERIFY_KEY_SERVERS?.trim().toLowerCase() === 'true'
}

function sha256Hex(value: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value)
}

function readSuiFullnodeUrl() {
  return fullnodeUrls[readSuiNetwork(process.env.EXPO_PUBLIC_SUI_NETWORK)]
}

function readSuiNetwork(value: string | undefined): SuiNetwork {
  if (value === 'devnet' || value === 'mainnet' || value === 'testnet') {
    return value
  }

  return 'testnet'
}

function normalizeSuiAddress(value: string) {
  const trimmedValue = value.trim().toLowerCase()
  return /^0x[0-9a-f]{64}$/.test(trimmedValue) ? trimmedValue : null
}

function normalizeSuiObjectId(value: unknown) {
  const text = readString(value)?.toLowerCase()
  return text && /^0x[0-9a-f]{1,64}$/.test(text) ? text : null
}

function readPositiveInteger(value: unknown, fallback: number) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue >= 1 ? Math.floor(numberValue) : fallback
}

function readUrl(value: unknown) {
  const text = readString(value)
  return text && /^https?:\/\//.test(text) ? text : null
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
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

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(readString).filter((item): item is string => Boolean(item)) : []
}

function readNumber(value: unknown) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function readSuiOwnerAddress(value: unknown) {
  const owner = asRecord(value)
  return readString(owner?.AddressOwner)?.toLowerCase() ?? null
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

function getParticipantLabel(loginId: string) {
  if (loginId === 'user-a2048') {
    return 'Activity data applicant in their 30s'
  }

  if (loginId === 'user-a2128') {
    return 'Sleep recovery participant in their 30s'
  }

  if (loginId === 'han-demo-risk') {
    return 'Seogwipo wearable cohort participant'
  }

  return `${loginId} user`
}

function getSubmissionCategory(request: ResearchRequest) {
  if (request.requiredConditionTags.some((tag) => tag.includes('sleep'))) {
    return 'Sleep recovery'
  }

  if (request.requiredConditionTags.some((tag) => tag.includes('heart') || tag.includes('hrv'))) {
    return 'Cardio summary'
  }

  return 'Activity data'
}

function getConditionLabel(tag: string) {
  return conditionLabels[tag] ?? tag.replaceAll('_', ' ')
}

function estimateSubmissionVolumeBytes(request: ResearchRequest) {
  const baseMegabytes = Math.max(24, request.requiredConditionTags.length * 28)
  return baseMegabytes * 1024 * 1024
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function toMonthOnly(value: string) {
  return value.slice(0, 7)
}

function isPhoneLikeValue(value: string) {
  const trimmedValue = value.trim()

  if (dateOnlyPattern.test(trimmedValue) || timestampPattern.test(trimmedValue)) {
    return false
  }

  const digits = trimmedValue.replace(/\D/g, '')
  return digits.length >= 8 && digits.length <= 15 && /^\+?[\d\s().-]+$/.test(trimmedValue)
}

function bytesToBase64(bytes: Uint8Array) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let result = ''
  let index = 0

  for (; index + 2 < bytes.length; index += 3) {
    const chunk = (bytes[index] << 16) | (bytes[index + 1] << 8) | bytes[index + 2]
    result += chars[(chunk >> 18) & 63] + chars[(chunk >> 12) & 63] + chars[(chunk >> 6) & 63] + chars[chunk & 63]
  }

  if (index < bytes.length) {
    const remaining = bytes.length - index
    const chunk = (bytes[index] << 16) | (remaining === 2 ? bytes[index + 1] << 8 : 0)
    result += chars[(chunk >> 18) & 63] + chars[(chunk >> 12) & 63] + (remaining === 2 ? chars[(chunk >> 6) & 63] : '=') + '='
  }

  return result
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
