import { createClient } from 'npm:@supabase/supabase-js@2.108.0'

type JoinResearchProjectBody = {
  participantLabel?: unknown
  participantLoginId?: unknown
  projectPublicCode?: unknown
}

type ResearchProjectRow = {
  id: string
}

type StudyApplicationRow = {
  id: string
  status: string
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

    const body = (await request.json().catch(() => null)) as JoinResearchProjectBody | null
    const projectPublicCode = readRequiredText(body?.projectPublicCode)
    const participantLoginId = readRequiredText(body?.participantLoginId)
    const applicantCode = normalizeApplicantCode(participantLoginId)

    if (!projectPublicCode || !participantLoginId || !applicantCode) {
      return jsonResponse({ error: 'projectPublicCode and participantLoginId are required.' }, 400)
    }

    const participantLabel = readOptionalText(body?.participantLabel) ?? `${participantLoginId} user`
    const nowIso = new Date().toISOString()
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

    const { data: existingApplication, error: existingError } = await supabase
      .from('study_applications')
      .select('id, status')
      .eq('project_id', project.id)
      .eq('applicant_code', applicantCode)
      .maybeSingle<StudyApplicationRow>()

    if (existingError) {
      return jsonResponse({ error: existingError.message }, 500)
    }

    if (existingApplication) {
      const nextStatus = existingApplication.status === 'approved' ? 'approved' : 'pending'
      const { error: updateError } = await supabase
        .from('study_applications')
        .update({
          applicant_label: participantLabel,
          reviewed_at: nextStatus === 'approved' ? undefined : null,
          status: nextStatus,
          updated_at: nowIso,
        })
        .eq('id', existingApplication.id)

      if (updateError) {
        return jsonResponse({ error: updateError.message }, 500)
      }

      return jsonResponse({
        applicationId: existingApplication.id,
        projectPublicCode,
        status: nextStatus,
      })
    }

    const { data: application, error: insertError } = await supabase
      .from('study_applications')
      .insert({
        project_id: project.id,
        profile_id: null,
        applicant_code: applicantCode,
        applicant_label: participantLabel,
        status: 'pending',
        match_score: 82,
        data_sent_bytes: 0,
      })
      .select('id')
      .single()

    if (insertError) {
      return jsonResponse({ error: insertError.message }, 500)
    }

    return jsonResponse({
      applicationId: application.id,
      projectPublicCode,
      status: 'pending',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown join error.'
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

function normalizeApplicantCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
