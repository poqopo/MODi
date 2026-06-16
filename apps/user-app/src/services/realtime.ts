import { getSupabaseClient, isSupabaseConfigured } from './supabase'

type UserAppRealtimeHandlers = {
  loginId: string
  onApplicationsChange: () => void
  onProjectsChange: () => void
}

const projectRealtimeTables = ['research_projects', 'project_age_ranges', 'project_data_fields', 'institutions']

export function subscribeToUserAppRealtimeChanges({
  loginId,
  onApplicationsChange,
  onProjectsChange,
}: UserAppRealtimeHandlers) {
  if (!isSupabaseConfigured) {
    return () => undefined
  }

  const supabase = getSupabaseClient()
  const applicantCode = normalizeApplicantCode(loginId)
  const channel = supabase.channel(`user-app:${applicantCode}:${Date.now()}`)
  const scheduleProjectRefresh = createDebouncedCallback(onProjectsChange)
  const scheduleApplicationRefresh = createDebouncedCallback(onApplicationsChange)

  projectRealtimeTables.forEach((table) => {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
      },
      scheduleProjectRefresh,
    )
  })

  if (applicantCode) {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        filter: `applicant_code=eq.${applicantCode}`,
        schema: 'public',
        table: 'study_applications',
      },
      scheduleApplicationRefresh,
    )
  }

  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'participant_submissions',
    },
    scheduleApplicationRefresh,
  )

  channel.subscribe()

  return () => {
    scheduleProjectRefresh.cancel()
    scheduleApplicationRefresh.cancel()
    void supabase.removeChannel(channel)
  }
}

function createDebouncedCallback(callback: () => void) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const debounced = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(callback, 350)
  }

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  return debounced
}

function normalizeApplicantCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
