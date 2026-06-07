import { useState } from 'react'
import { StatusBar } from 'expo-status-bar'

import { researchRequests } from './data/mvp'
import { DashboardPage } from './pages/DashboardPage'
import { LandingPage } from './pages/LandingPage'
import type { DashboardTab } from './types/dashboard'

function App() {
  const [started, setStarted] = useState(false)
  const [activeTab, setActiveTab] = useState<DashboardTab>('home')
  const [selectedRequestId, setSelectedRequestId] = useState(researchRequests[0].id)

  return (
    <>
      <StatusBar style="dark" />
      {!started ? (
        <LandingPage onStart={() => setStarted(true)} />
      ) : (
        <DashboardPage
          activeTab={activeTab}
          selectedRequestId={selectedRequestId}
          onBackToLanding={() => setStarted(false)}
          onSelectRequest={setSelectedRequestId}
          onTabChange={setActiveTab}
        />
      )}
    </>
  )
}

export default App
