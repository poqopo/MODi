import { createClient } from 'npm:@supabase/supabase-js@2.108.0'

type ListUserApplicationsBody = {
  participantLoginId?: unknown
}

type StudyApplicationRow = {
  data_sent_bytes: number | string | null
  id: string
  last_submission_at: string | null
  project_id: string
  status: string
}

type ResearchProjectRow = {
  id: string
  public_code: string | null
}

const visibleStatuses = ['pending', 'approved']

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

    const body = (await request.json().catch(() => null)) as ListUserApplicationsBody | null
    const participantLoginId = readRequiredText(body?.participantLoginId)
    const applicantCode = normalizeApplicantCode(participantLoginId)

    if (!participantLoginId || !applicantCode) {
      return jsonResponse({ error: 'participantLoginId is required.' }, 400)
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: applicationRows, error: applicationError } = await supabase
      .from('study_applications')
      .select('id, project_id, status, data_sent_bytes, last_submission_at')
      .eq('applicant_code', applicantCode)
      .in('status', visibleStatuses)
      .order('created_at', { ascending: false })

    if (applicationError) {
      return jsonResponse({ error: applicationError.message }, 500)
    }

    const applications = typedRows<StudyApplicationRow>(applicationRows)
    const projectIds = Array.from(new Set(applications.map((application) => application.project_id)))

    if (projectIds.length === 0) {
      return jsonResponse({ applications: [] })
    }

    const { data: projectRows, error: projectError } = await supabase
      .from('research_projects')
      .select('id, public_code')
      .in('id', projectIds)

    if (projectError) {
      return jsonResponse({ error: projectError.message }, 500)
    }

    const publicCodeByProjectId = new Map(
      typedRows<ResearchProjectRow>(projectRows).map((project) => [project.id, project.public_code ?? project.id]),
    )

    return jsonResponse({
      applications: applications
        .map((application) => {
          const projectPublicCode = publicCodeByProjectId.get(application.project_id)

          if (!projectPublicCode) {
            return null
          }

          return {
            applicationId: application.id,
            dataSentBytes: Number(application.data_sent_bytes ?? 0),
            lastSubmissionAt: application.last_submission_at,
            projectPublicCode,
            status: application.status,
          }
        })
        .filter(Boolean),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown list error.'
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

function normalizeApplicantCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function typedRows<T>(rows: unknown): T[] {
  return Array.isArray(rows) ? (rows as T[]) : []
}
