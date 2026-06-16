import { createClient } from 'npm:@supabase/supabase-js@2.108.0'

type ReviewStudyApplicationBody = {
  applicationId?: unknown
  institutionSlug?: unknown
  status?: unknown
}

type ApplicationProjectRow = {
  id: string
  project_id: string
  research_projects: {
    institution_id: string
  } | null
}

type InstitutionRow = {
  id: string
}

const allowedStatuses = new Set(['approved', 'rejected'])

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

    const body = (await request.json().catch(() => null)) as ReviewStudyApplicationBody | null
    const applicationId = readRequiredText(body?.applicationId)
    const institutionSlug = readRequiredText(body?.institutionSlug)
    const status = readRequiredText(body?.status)

    if (!applicationId || !institutionSlug || !allowedStatuses.has(status)) {
      return jsonResponse({ error: 'applicationId, institutionSlug, and valid status are required.' }, 400)
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

    const { data: application, error: applicationError } = await supabase
      .from('study_applications')
      .select('id, project_id, research_projects!inner(institution_id)')
      .eq('id', applicationId)
      .maybeSingle<ApplicationProjectRow>()

    if (applicationError) {
      return jsonResponse({ error: applicationError.message }, 500)
    }

    if (!application || application.research_projects?.institution_id !== institution.id) {
      return jsonResponse({ error: 'Application not found for this institution.' }, 404)
    }

    const reviewedAt = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('study_applications')
      .update({
        status,
        reviewed_at: reviewedAt,
        updated_at: reviewedAt,
      })
      .eq('id', applicationId)

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500)
    }

    return jsonResponse({
      applicationId,
      status,
      reviewedAt,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown review error.'
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
