import { ArrowLeft, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'

type AppHeaderProps = {
  activePage: 'landing' | 'research-create'
  onCreateResearch: () => void
  onGoHome: () => void
}

export function AppHeader({ activePage, onCreateResearch, onGoHome }: AppHeaderProps) {
  const isLanding = activePage === 'landing'

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-white/90 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-4">
        <button className="flex items-center gap-3 text-left" type="button" onClick={onGoHome} aria-label="MODi 기관 대시보드 홈">
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
                기능
              </a>
              <a className="hover:text-ink" href="#workflow">
                운영 흐름
              </a>
              <a className="hover:text-ink" href="#security">
                보안
              </a>
          </nav>
        ) : null}

        <div className="hidden items-center gap-3 md:flex">
          {!isLanding ? (
            <Button variant="ghost" size="sm" onClick={onGoHome}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              랜딩으로
            </Button>
          ) : null}
          <Button size="sm" onClick={onCreateResearch}>
            <Plus className="mr-2 h-4 w-4" />
            연구 생성
          </Button>
        </div>

        <Button
          className="md:hidden"
          variant="outline"
          size="icon"
          onClick={isLanding ? onCreateResearch : onGoHome}
          aria-label={isLanding ? '연구 생성' : '랜딩으로'}
        >
          {isLanding ? <Plus className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
        </Button>
      </div>
    </header>
  )
}
