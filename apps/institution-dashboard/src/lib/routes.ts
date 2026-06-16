export type ProjectView = 'home' | 'participants' | 'datasets' | 'settlements'

export type AppRoute =
  | { page: 'landing' }
  | { page: 'research'; mode: 'create' }
  | { page: 'research'; mode: 'workspace'; projectId: string | null; view: ProjectView }

const projectViews = new Set<ProjectView>(['home', 'participants', 'datasets', 'settlements'])

export function parseAppRoute(pathname: string): AppRoute {
  const segments = pathname.split('/').filter(Boolean).map(decodePathSegment)
  const [section, projectId, viewSegment] = segments

  if (section === 'research-create' || (section === 'research' && projectId === 'new')) {
    return { page: 'research', mode: 'create' }
  }

  if (section === 'research') {
    return {
      page: 'research',
      mode: 'workspace',
      projectId: projectId ?? null,
      view: isProjectView(viewSegment) ? viewSegment : 'home',
    }
  }

  return { page: 'landing' }
}

export function buildLandingPath() {
  return '/'
}

export function buildResearchCreatePath() {
  return '/research/new'
}

export function buildResearchProjectPath(projectId: string | null | undefined, view: ProjectView = 'home') {
  if (!projectId) {
    return '/research'
  }

  const basePath = `/research/${encodeURIComponent(projectId)}`

  return view === 'home' ? basePath : `${basePath}/${view}`
}

function isProjectView(value: string | undefined): value is ProjectView {
  return Boolean(value && projectViews.has(value as ProjectView))
}

function decodePathSegment(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
