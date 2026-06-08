import { useState } from 'react'

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
      <AppHeader activePage={page} onCreateResearch={goCreateResearch} onGoHome={goHome} />
      {page === 'research-create' ? <ResearchCreatePage /> : <LandingPage onCreateResearch={goCreateResearch} />}
    </main>
  )
}

export default App
