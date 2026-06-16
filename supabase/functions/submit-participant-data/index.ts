import { createClient } from 'npm:@supabase/supabase-js@2.108.0'

type SubmitParticipantDataBody = {
  projectPublicCode?: unknown
  participantLoginId?: unknown
  participantLabel?: unknown
  category?: unknown
  periodStart?: unknown
  periodEnd?: unknown
  privacyPolicyBlobId?: unknown
  privacyPolicyHash?: unknown
  privacyPolicyVersion?: unknown
  encryptionMode?: unknown
  encryptionProvider?: unknown
  privacyVerificationFindings?: unknown
  privacyVerificationPayloadHash?: unknown
  privacyVerificationReceiptHash?: unknown
  privacyVerificationSummary?: unknown
  privacyVerificationVerifiedAt?: unknown
  participantPseudonymId?: unknown
  securityMemoryBlobId?: unknown
  securityMemoryBlobObjectId?: unknown
  securityMemoryHash?: unknown
  securityMemoryVersion?: unknown
  sealPolicyId?: unknown
  sealIdentityHex?: unknown
  volumeBytes?: unknown
  walrusBlobId?: unknown
  walrusBlobObjectId?: unknown
  walrusManifestHash?: unknown
  walrusPublisherUrl?: unknown
  walrusTxDigest?: unknown
  agentMemoryArtifacts?: unknown
}

type ResearchProjectRow = {
  id: string
}

type StudyApplicationRow = {
  id: string
  data_sent_bytes: number | string | null
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return jsonResponse({ ok: true })
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

    const body = (await request.json().catch(() => null)) as SubmitParticipantDataBody | null
    const projectPublicCode = readRequiredText(body?.projectPublicCode)
    const participantLoginId = readRequiredText(body?.participantLoginId)
    const applicantCode = normalizeApplicantCode(participantLoginId)

    if (!projectPublicCode || !participantLoginId || !applicantCode) {
      return jsonResponse({ error: 'projectPublicCode and participantLoginId are required.' }, 400)
    }

    const now = new Date()
    const nowIso = now.toISOString()
    const participantLabel = readOptionalText(body?.participantLabel) ?? `${participantLoginId} 사용자`
    const category = readOptionalText(body?.category) ?? '활동 데이터'
    const periodStart = readDateOnly(body?.periodStart) ?? toDateOnly(addDays(now, -6))
    const periodEnd = readDateOnly(body?.periodEnd) ?? toDateOnly(now)
    const privacyPolicyBlobId = readOptionalText(body?.privacyPolicyBlobId)
    const privacyPolicyHash = readOptionalText(body?.privacyPolicyHash)
    const privacyPolicyVersion = readOptionalText(body?.privacyPolicyVersion)
    const encryptionProvider = readEncryptionProvider(body?.encryptionProvider)
    const encryptionMode = readOptionalText(body?.encryptionMode)
    const privacyVerificationFindings = readJsonArray(body?.privacyVerificationFindings)
    const privacyVerificationPayloadHash = readOptionalText(body?.privacyVerificationPayloadHash)
    const privacyVerificationReceiptHash = readOptionalText(body?.privacyVerificationReceiptHash)
    const privacyVerificationSummary = readOptionalText(body?.privacyVerificationSummary)
    const privacyVerificationVerifiedAt = readOptionalText(body?.privacyVerificationVerifiedAt)
    const participantPseudonymId = readOptionalText(body?.participantPseudonymId)
    const securityMemoryBlobId = readOptionalText(body?.securityMemoryBlobId)
    const securityMemoryBlobObjectId = readOptionalText(body?.securityMemoryBlobObjectId)
    const securityMemoryHash = readOptionalText(body?.securityMemoryHash)
    const securityMemoryVersion = readOptionalText(body?.securityMemoryVersion)
    const sealPolicyId = readOptionalText(body?.sealPolicyId)
    const sealIdentityHex = readOptionalText(body?.sealIdentityHex)
    const volumeBytes = readNonNegativeInteger(body?.volumeBytes)
    const walrusBlobId = readOptionalText(body?.walrusBlobId)
    const walrusBlobObjectId = readOptionalText(body?.walrusBlobObjectId)
    const walrusManifestHash = readOptionalText(body?.walrusManifestHash)
    const walrusPublisherUrl = readOptionalText(body?.walrusPublisherUrl)
    const walrusTxDigest = readOptionalText(body?.walrusTxDigest)
    const agentMemoryArtifacts = readJsonRecord(body?.agentMemoryArtifacts)

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: project, error: projectError } = await supabase
      .from('research_projects')
      .select('id')
      .eq('public_code', projectPublicCode)
      .eq('status', 'recruiting')
      .maybeSingle<ResearchProjectRow>()

    if (projectError) {
      return jsonResponse({ error: projectError.message }, 500)
    }

    if (!project) {
      return jsonResponse({ error: 'Recruiting project not found.' }, 404)
    }

    const { data: existingApplication, error: applicationSelectError } = await supabase
      .from('study_applications')
      .select('id, data_sent_bytes')
      .eq('project_id', project.id)
      .eq('applicant_code', applicantCode)
      .maybeSingle<StudyApplicationRow>()

    if (applicationSelectError) {
      return jsonResponse({ error: applicationSelectError.message }, 500)
    }

    const applicationId = existingApplication
      ? await updateApplication({
          applicantLabel: participantLabel,
          applicationId: existingApplication.id,
          currentDataSentBytes: existingApplication.data_sent_bytes,
          nowIso,
          supabase,
          volumeBytes,
        })
      : await createApplication({
          applicantCode,
          applicantLabel: participantLabel,
          nowIso,
          projectId: project.id,
          supabase,
          volumeBytes,
        })

    const { data: submission, error: submissionError } = await supabase
      .from('participant_submissions')
      .insert({
        application_id: applicationId,
        project_id: project.id,
        profile_id: null,
        submitted_at: nowIso,
        category,
        period_start: periodStart,
        period_end: periodEnd,
        volume_bytes: volumeBytes,
        validation_status: privacyVerificationReceiptHash ? 'policy_passed' : 'pending_review',
        walrus_blob_id: walrusBlobId,
        walrus_dataset_object_id: walrusBlobObjectId,
        walrus_manifest_hash: walrusManifestHash,
        walrus_publisher_url: walrusPublisherUrl,
        walrus_tx_digest: walrusTxDigest,
        privacy_policy_blob_id: privacyPolicyBlobId,
        privacy_policy_hash: privacyPolicyHash,
        privacy_policy_version: privacyPolicyVersion,
        seal_policy_id: sealPolicyId,
        encryption_provider: encryptionProvider,
        encryption_mode: encryptionMode,
        seal_identity_hex: sealIdentityHex,
        metadata: {
          source: 'user-app',
          demo_login_id: participantLoginId,
          storage_stage: walrusBlobId ? 'walrus' : 'supabase-first',
          walrus_blob_object_id: walrusBlobObjectId,
          walrus_publisher_url: walrusPublisherUrl,
          walrus_ready: Boolean(walrusBlobId),
          walrus_tx_digest: walrusTxDigest,
          privacy_policy_blob_id: privacyPolicyBlobId,
          privacy_policy_hash: privacyPolicyHash,
          privacy_policy_version: privacyPolicyVersion,
          privacy_verification: {
            findings: privacyVerificationFindings,
            payload_hash: privacyVerificationPayloadHash,
            receipt_hash: privacyVerificationReceiptHash,
            summary: privacyVerificationSummary,
            verified_at: privacyVerificationVerifiedAt,
          },
          security_memory: {
            blob_id: securityMemoryBlobId,
            hash: securityMemoryHash,
            object_id: securityMemoryBlobObjectId,
            updated_at: securityMemoryBlobId ? nowIso : null,
            version: securityMemoryVersion,
          },
          encryption: {
            mode: encryptionMode,
            provider: encryptionProvider,
            seal_identity_hex: sealIdentityHex,
          },
          agent_memory: agentMemoryArtifacts,
          participant_pseudonym_id: participantPseudonymId,
          seal_policy_id: sealPolicyId,
        },
      })
      .select('id')
      .single()

    if (submissionError) {
      return jsonResponse({ error: submissionError.message }, 500)
    }

    if (securityMemoryBlobId) {
      const { error: securityMemoryError } = await supabase
        .from('research_projects')
        .update({
          security_memory_blob_id: securityMemoryBlobId,
          security_memory_object_id: securityMemoryBlobObjectId,
          security_memory_hash: securityMemoryHash,
          security_memory_version: securityMemoryVersion,
          security_memory_updated_at: nowIso,
        })
        .eq('id', project.id)

      if (securityMemoryError) {
        return jsonResponse({ error: securityMemoryError.message }, 500)
      }
    }

    return jsonResponse({
      applicationId,
      submissionId: submission.id,
      walrusBlobId,
      walrusBlobObjectId,
      walrusManifestHash,
      walrusTxDigest,
      agentMemoryArtifacts,
      privacyVerificationReceiptHash,
      securityMemoryBlobId,
      securityMemoryHash,
      securityMemoryVersion,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown submission error.'
    return jsonResponse({ error: message }, 500)
  }
})

async function createApplication({
  applicantCode,
  applicantLabel,
  nowIso,
  projectId,
  supabase,
  volumeBytes,
}: {
  applicantCode: string
  applicantLabel: string
  nowIso: string
  projectId: string
  supabase: ReturnType<typeof createClient>
  volumeBytes: number
}) {
  const { data, error } = await supabase
    .from('study_applications')
    .insert({
      project_id: projectId,
      profile_id: null,
      applicant_code: applicantCode,
      applicant_label: applicantLabel,
      status: 'pending',
      match_score: 82,
      data_sent_bytes: volumeBytes,
      last_submission_at: nowIso,
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data.id as string
}

async function updateApplication({
  applicantLabel,
  applicationId,
  currentDataSentBytes,
  nowIso,
  supabase,
  volumeBytes,
}: {
  applicantLabel: string
  applicationId: string
  currentDataSentBytes: number | string | null
  nowIso: string
  supabase: ReturnType<typeof createClient>
  volumeBytes: number
}) {
  const nextDataSentBytes = Number(currentDataSentBytes ?? 0) + volumeBytes
  const { data, error } = await supabase
    .from('study_applications')
    .update({
      applicant_label: applicantLabel,
      data_sent_bytes: nextDataSentBytes,
      last_submission_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', applicationId)
    .select('id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data.id as string
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

function readOptionalText(value: unknown) {
  const text = readRequiredText(value)
  return text.length > 0 ? text : null
}

function readEncryptionProvider(value: unknown) {
  const text = readOptionalText(value)
  return text === 'client_aes_gcm' ? 'client_aes_gcm' : 'seal'
}

function readDateOnly(value: unknown) {
  const text = readRequiredText(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null
}

function readNonNegativeInteger(value: unknown) {
  const parsedValue = typeof value === 'number' || typeof value === 'string' ? Number(value) : 0
  return Number.isFinite(parsedValue) ? Math.max(0, Math.floor(parsedValue)) : 0
}

function readJsonArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function readJsonRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function normalizeApplicantCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}
