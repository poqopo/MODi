import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react'
import { useCurrentAccount, useWalletConnection } from '@mysten/dapp-kit-react'
import { ConnectModal } from '@mysten/dapp-kit-react/ui'
import { SLUSH_WALLET_NAME } from '@mysten/slush-wallet'

import { AuthGate } from '@/components/auth/auth-gate'
import { AppHeader } from '@/components/common/app-header'
import {
  buildLandingPath,
  buildResearchCreatePath,
  buildResearchProjectPath,
  parseAppRoute,
  type ProjectView,
} from '@/lib/routes'
import { LandingPage } from '@/pages/LandingPage'
import { ResearchCreatePage } from '@/pages/ResearchCreatePage'

function App() {
  const [route, setRoute] = useState(() => parseAppRoute(window.location.pathname))
  const account = useCurrentAccount()
  const walletConnection = useWalletConnection()
  const [isSlushModalOpen, setIsSlushModalOpen] = useState(false)
  const [shouldCreateAfterWalletConnect, setShouldCreateAfterWalletConnect] = useState(false)
  const slushModalRef = useRef<ComponentRef<typeof ConnectModal>>(null)

  useEffect(() => {
    const handlePopState = () => {
      setRoute(parseAppRoute(window.location.pathname))
    }

    window.addEventListener('popstate', handlePopState)

    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigateToPath = useCallback((path: string, options?: { replace?: boolean; scroll?: boolean }) => {
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`

    if (currentPath !== path) {
      if (options?.replace) {
        window.history.replaceState({}, '', path)
      } else {
        window.history.pushState({}, '', path)
      }
    }

    setRoute(parseAppRoute(path))

    if (options?.scroll !== false) {
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
    }
  }, [])

  const goHome = () => {
    navigateToPath(buildLandingPath())
  }

  const goCreateResearch = useCallback(() => {
    if (account) {
      navigateToPath(buildResearchCreatePath())
      return
    }

    setShouldCreateAfterWalletConnect(true)
    setIsSlushModalOpen(true)
  }, [account, navigateToPath])

  useEffect(() => {
    if (!shouldCreateAfterWalletConnect || !account || walletConnection.status !== 'connected') {
      return
    }

    const timer = window.setTimeout(() => {
      setShouldCreateAfterWalletConnect(false)
      setIsSlushModalOpen(false)
      navigateToPath(buildResearchCreatePath())
    }, 0)

    return () => window.clearTimeout(timer)
  }, [account, navigateToPath, shouldCreateAfterWalletConnect, walletConnection.status])

  const handleSlushModalClosed = useCallback(() => {
    setIsSlushModalOpen(false)

    if (!account) {
      setShouldCreateAfterWalletConnect(false)
    }
  }, [account])

  useEffect(() => {
    const modal = slushModalRef.current

    if (!modal) {
      return
    }

    modal.addEventListener('close', handleSlushModalClosed)

    return () => modal.removeEventListener('close', handleSlushModalClosed)
  }, [handleSlushModalClosed])

  const goProjectRoute = useCallback(
    (projectId: string, view: ProjectView = 'home', options?: { replace?: boolean }) => {
      navigateToPath(buildResearchProjectPath(projectId, view), { replace: options?.replace })
    },
    [navigateToPath],
  )

  return (
    <main className="min-h-screen bg-white text-ink">
      {isSlushModalOpen ? (
        <div className="pointer-events-none fixed inset-0 z-40 bg-ink/50 backdrop-blur-sm" aria-hidden="true" />
      ) : null}
      <ConnectModal
        ref={slushModalRef}
        className="institution-slush-connect-modal"
        open={isSlushModalOpen}
        filterFn={(wallet) => wallet.name === SLUSH_WALLET_NAME}
      />
      {route.page === 'research' ? (
        <AuthGate onGoHome={goHome}>
          <ResearchCreatePage
            isCreateRoute={route.mode === 'create'}
            researcherSuiAddress={account?.address ?? null}
            routeProjectId={route.mode === 'workspace' ? route.projectId : null}
            routeView={route.mode === 'workspace' ? route.view : 'home'}
            onCreateRoute={goCreateResearch}
            onProjectRoute={goProjectRoute}
          />
        </AuthGate>
      ) : (
        <>
          <AppHeader activePage="landing" onCreateResearch={goCreateResearch} onGoHome={goHome} />
          <LandingPage onCreateResearch={goCreateResearch} />
        </>
      )}
    </main>
  )
}

export default App
