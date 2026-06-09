import { useState } from 'react'

import { AuthGate } from '@/components/auth/auth-gate'
import { AppHeader } from '@/components/common/app-header'
import { LandingPage } from '@/pages/LandingPage'
import { ResearchCreatePage } from '@/pages/ResearchCreatePage'

type Page = 'landing' | 'research-create'

function App() {
  const [page, setPage] = useState<Page>('landing')

  const goHome = () => {
    setPage('landing')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goCreateResearch = () => {
    setPage('research-create')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <main className="min-h-screen bg-white text-ink">
      {page === 'research-create' ? (
        <AuthGate onGoHome={goHome}>
          <ResearchCreatePage />
        </AuthGate>
      ) : (
        <>
          <AppHeader activePage={page} onCreateResearch={goCreateResearch} onGoHome={goHome} />
          <LandingPage onCreateResearch={goCreateResearch} />
        </>
      )}
    </main>
  )
}

export default App
