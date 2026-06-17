import { ArrowLeft, BookOpen, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'

type AppHeaderProps = {
  activePage: 'docs' | 'landing' | 'research-create'
  onCreateResearch: () => void
  onGoHome: () => void
  onViewDocs?: () => void
}

export function AppHeader({ activePage, onCreateResearch, onGoHome, onViewDocs }: AppHeaderProps) {
  const isLanding = activePage === 'landing'

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-white/90 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-4">
        <button className="flex items-center gap-3 text-left" type="button" onClick={onGoHome} aria-label="MODi MODi institution dashboard home">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-dark text-sm font-semibold text-white">
            M
          </span>
          <span>
            <span className="block text-sm font-semibold leading-4 text-ink">MODi</span>
            <span className="block text-xs leading-4 text-ink-mute">Institution Dashboard</span>
          </span>
        </button>

        {isLanding ? (
          <nav className="hidden items-center gap-7 text-sm text-ink-secondary md:flex" aria-label="Primary navigation">
              <a className="hover:text-ink" href="#capabilities">
                Features
              </a>
              <a className="hover:text-ink" href="#workflow">
                Workflow
              </a>
              <button className="hover:text-ink" type="button" onClick={onViewDocs}>
                Docs
              </button>
          </nav>
        ) : null}

        <div className="hidden items-center gap-3 md:flex">
          {!isLanding ? (
            <Button variant="ghost" size="sm" onClick={onGoHome}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Landing
            </Button>
          ) : null}
          {isLanding && onViewDocs ? (
            <Button variant="ghost" size="sm" onClick={onViewDocs}>
              <BookOpen className="mr-2 h-4 w-4" />
              Docs
            </Button>
          ) : null}
          <Button size="sm" onClick={onCreateResearch}>
            <Plus className="mr-2 h-4 w-4" />
            Create Study
          </Button>
        </div>

        <Button
          className="md:hidden"
          variant="outline"
          size="icon"
          onClick={isLanding ? onCreateResearch : onGoHome}
          aria-label={isLanding ? 'Create Study' : 'Landing'}
        >
          {isLanding ? <Plus className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
        </Button>
      </div>
    </header>
  )
}
