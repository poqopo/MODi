import type { Session } from '@supabase/supabase-js'
import { useCurrentAccount, useCurrentWallet, useDAppKit } from '@mysten/dapp-kit-react'
import { ConnectButton } from '@mysten/dapp-kit-react/ui'
import { ArrowLeft, LogOut, Wallet } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import {
  registerSlushInstitution,
  resolveSlushInstitution,
  type SlushInstitutionProfile,
} from '@/services/institutionDashboard'

const institutionExampleIds = ['sui-active-insurance']
const demoInstitutionStorageKey = 'modi_institution_login_id'
const registeredSlushInstitutionStorageKey = 'modi_registered_slush_institution'

type AuthGateProps = {
  children: ReactNode
  onGoHome: () => void
}

export function AuthGate({ children, onGoHome }: AuthGateProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [demoLoginId, setDemoLoginId] = useState(() => getStoredInstitutionSlug())
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured)
  const [isRegisteringSlushInstitution, setIsRegisteringSlushInstitution] = useState(false)
  const [isResolvingSlushInstitution, setIsResolvingSlushInstitution] = useState(false)
  const [slushInstitution, setSlushInstitution] = useState<SlushInstitutionProfile | null>(null)
  const [slushInstitutionError, setSlushInstitutionError] = useState('')
  const account = useCurrentAccount()
  const wallet = useCurrentWallet()
  const dAppKit = useDAppKit()

  useEffect(() => {
    if (!supabase) {
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setIsLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!account || session) {
      return
    }

    let isCanceled = false

    const timer = window.setTimeout(() => {
      setIsResolvingSlushInstitution(true)
      setSlushInstitutionError('')

      resolveSlushInstitution(account.address)
        .then((profile) => {
          if (!isCanceled) {
            setSlushInstitution(profile)
            if (profile) {
              storeSlushInstitutionProfile(profile)
              window.localStorage.setItem(demoInstitutionStorageKey, profile.institutionSlug)
              setDemoLoginId(profile.institutionSlug)
            }
          }
        })
        .catch((error) => {
          if (!isCanceled) {
            setSlushInstitution(null)
            setSlushInstitutionError(error instanceof Error ? error.message : '기관 등록 상태를 확인하지 못했습니다.')
          }
        })
        .finally(() => {
          if (!isCanceled) {
            setIsResolvingSlushInstitution(false)
          }
        })
    }, 0)

    return () => {
      isCanceled = true
      window.clearTimeout(timer)
    }
  }, [account, session])

  if (!isSupabaseConfigured) {
    return <SupabaseConfigRequired onGoHome={onGoHome} />
  }

  const handleSignOut = () => {
    window.localStorage.removeItem(demoInstitutionStorageKey)
    window.localStorage.removeItem(registeredSlushInstitutionStorageKey)
    setDemoLoginId(null)
    setSlushInstitution(null)
    void dAppKit.disconnectWallet().catch(() => undefined)
    void supabase?.auth.signOut()
  }

  const handleRegisterSlushInstitution = async (input: { institutionName: string; websiteUrl?: string }) => {
    if (!account) {
      return
    }

    setIsRegisteringSlushInstitution(true)
    setSlushInstitutionError('')

    try {
      const profile = await registerSlushInstitution({
        institutionName: input.institutionName,
        walletAddress: account.address,
        websiteUrl: input.websiteUrl,
      })

      setSlushInstitution(profile)
      storeSlushInstitutionProfile(profile)
      window.localStorage.setItem(demoInstitutionStorageKey, profile.institutionSlug)
      setDemoLoginId(profile.institutionSlug)
    } catch (error) {
      setSlushInstitutionError(error instanceof Error ? error.message : '기관을 등록하지 못했습니다.')
    } finally {
      setIsRegisteringSlushInstitution(false)
    }
  }

  if (isLoading) {
    return (
      <section className="flex min-h-screen items-center justify-center bg-page px-6">
        <div className="text-sm font-medium text-ink-secondary">기관 세션을 확인하고 있습니다.</div>
      </section>
    )
  }

  const activeSlushInstitution =
    account && slushInstitution?.walletAddress.toLowerCase() === account.address.toLowerCase() ? slushInstitution : null

  if (!session) {
    if (account) {
      if (isResolvingSlushInstitution) {
        return <SlushInstitutionLoadingPanel walletAddress={account.address} onGoHome={onGoHome} />
      }

      if (!activeSlushInstitution) {
        return (
          <SlushInstitutionRegistrationPanel
            errorMessage={slushInstitutionError}
            isSaving={isRegisteringSlushInstitution}
            walletAddress={account.address}
            onGoHome={onGoHome}
            onRegister={handleRegisterSlushInstitution}
            onSignOut={handleSignOut}
          />
        )
      }
    }

    if (!demoLoginId) {
      return <AuthForm onDemoLogin={setDemoLoginId} onGoHome={onGoHome} />
    }
  }

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-5">
          <button className="flex items-center gap-3 text-left" type="button" onClick={onGoHome}>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-dark text-xs font-semibold text-white">
              M
            </span>
            <span className="text-sm font-semibold text-ink">기관 운영 콘솔</span>
          </button>
          <div className="flex items-center gap-2">
            {account ? (
              <div className="hidden items-center gap-2 rounded-md border border-border bg-canvas-soft px-3 py-1.5 text-xs font-medium text-ink-secondary sm:flex">
                <Wallet className="h-3.5 w-3.5" />
                <span>{wallet?.name ?? 'Sui Wallet'}</span>
                {activeSlushInstitution ? <span>{activeSlushInstitution.institutionName}</span> : null}
                <span className="font-mono text-ink">{formatWalletAddress(account.address)}</span>
              </div>
            ) : (
              <ConnectButton />
            )}
            <Button variant="ghost" size="sm" onClick={onGoHome}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              랜딩으로
            </Button>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              로그아웃
            </Button>
          </div>
        </div>
      </div>
      {children}
    </>
  )
}

function SupabaseConfigRequired({ onGoHome }: { onGoHome: () => void }) {
  return (
    <section className="flex min-h-screen items-center justify-center bg-page px-6">
      <Card className="w-full max-w-xl rounded-lg border-border shadow-sm">
        <CardHeader>
          <CardTitle>Supabase 설정이 필요합니다</CardTitle>
          <CardDescription>
            기관 대시보드를 실제 DB와 연결하려면 Vite 환경변수에 Supabase 프로젝트 정보를 넣어야 합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-border bg-white p-4 text-sm text-ink-secondary">
            <div className="font-medium text-ink">필요한 값</div>
            <div className="mt-2 font-mono text-xs leading-6">
              VITE_SUPABASE_URL
              <br />
              VITE_SUPABASE_PUBLISHABLE_KEY
            </div>
          </div>
          <Button variant="outline" onClick={onGoHome}>
            랜딩으로 돌아가기
          </Button>
        </CardContent>
      </Card>
    </section>
  )
}

function SlushInstitutionLoadingPanel({ onGoHome, walletAddress }: { onGoHome: () => void; walletAddress: string }) {
  return (
    <section className="flex min-h-screen items-center justify-center bg-page px-6">
      <Card className="w-full max-w-md rounded-lg border-border shadow-sm">
        <CardHeader>
          <CardTitle>기관 등록 상태 확인</CardTitle>
          <CardDescription>연결된 Slush 지갑에 등록된 기관이 있는지 확인하고 있습니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-border bg-canvas-soft px-3 py-2 font-mono text-xs text-ink-secondary">
            {formatWalletAddress(walletAddress)}
          </div>
          <Button variant="outline" onClick={onGoHome}>
            랜딩으로
          </Button>
        </CardContent>
      </Card>
    </section>
  )
}

function SlushInstitutionRegistrationPanel({
  errorMessage,
  isSaving,
  onGoHome,
  onRegister,
  onSignOut,
  walletAddress,
}: {
  errorMessage: string
  isSaving: boolean
  onGoHome: () => void
  onRegister: (input: { institutionName: string; websiteUrl?: string }) => void
  onSignOut: () => void
  walletAddress: string
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    onRegister({
      institutionName: String(formData.get('institutionName') ?? '').trim(),
      websiteUrl: String(formData.get('websiteUrl') ?? '').trim(),
    })
  }

  return (
    <section className="flex min-h-screen items-center justify-center bg-page px-6">
      <Card className="w-full max-w-md rounded-lg border-border shadow-sm">
        <CardHeader>
          <CardTitle>기관 등록</CardTitle>
          <CardDescription>이 Slush 지갑으로 연구를 만들려면 먼저 기관명을 등록해야 합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 rounded-md border border-border bg-canvas-soft px-3 py-2">
            <p className="text-xs text-ink-mute">연결된 Slush 지갑</p>
            <p className="mt-1 font-mono text-xs text-ink">{formatWalletAddress(walletAddress)}</p>
          </div>
          {errorMessage ? (
            <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-ink">
              기관명
              <input
                className="mt-2 h-11 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-brand"
                name="institutionName"
                placeholder="예: MODi Research Lab"
                required
              />
            </label>
            <label className="block text-sm font-medium text-ink">
              웹사이트
              <input
                className="mt-2 h-11 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-brand"
                name="websiteUrl"
                placeholder="https://example.org"
                type="url"
              />
            </label>
            <Button className="w-full" type="submit" disabled={isSaving}>
              {isSaving ? '등록 중' : '기관 등록하기'}
            </Button>
          </form>
          <div className="mt-5 flex items-center justify-between text-sm">
            <button className="text-ink-secondary" type="button" onClick={onGoHome}>
              랜딩으로
            </button>
            <button className="font-medium text-brand-dark" type="button" onClick={onSignOut}>
              다른 지갑으로 연결
            </button>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function AuthForm({ onDemoLogin, onGoHome }: { onDemoLogin: (loginId: string) => void; onGoHome: () => void }) {
  const storedProfile = getStoredSlushInstitutionProfile()
  const examples = storedProfile ? [storedProfile.institutionName, ...institutionExampleIds] : institutionExampleIds
  const [loginId, setLoginId] = useState(examples[0])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!supabase) {
      return
    }

    setIsSubmitting(true)

    const normalizedLoginId =
      storedProfile && loginId.trim() === storedProfile.institutionName ? storedProfile.institutionSlug : normalizeDemoLoginId(loginId)

    window.localStorage.setItem(demoInstitutionStorageKey, normalizedLoginId)
    onDemoLogin(normalizedLoginId)
    setIsSubmitting(false)
  }

  return (
    <section className="flex min-h-screen items-center justify-center bg-page px-6">
      <Card className="w-full max-w-md rounded-lg border-border shadow-sm">
        <CardHeader>
          <CardTitle>기관명 로그인</CardTitle>
          <CardDescription>등록한 기관명을 입력해 운영 콘솔로 들어갑니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-ink">
              기관명
              <input
                className="mt-2 h-11 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-brand"
                type="text"
                value={loginId}
                onChange={(event) => setLoginId(event.target.value)}
                autoCapitalize="none"
                autoComplete="username"
                required
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {institutionExampleIds.map((exampleId) => (
                <button
                  key={exampleId}
                  className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-ink-secondary transition hover:bg-canvas-soft"
                  type="button"
                  onClick={() => setLoginId(exampleId)}
                >
                  {exampleId}
                </button>
            ))}
            </div>
            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? '확인 중' : '대시보드 들어가기'}
            </Button>
          </form>
          <div className="mt-5 flex items-center justify-end text-sm">
            <button className="text-ink-secondary" type="button" onClick={onGoHome}>
              랜딩으로
            </button>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function getStoredInstitutionSlug() {
  const storedDemoId = window.localStorage.getItem(demoInstitutionStorageKey)

  if (storedDemoId) {
    return storedDemoId
  }

  return getStoredSlushInstitutionProfile()?.institutionSlug ?? null
}

function getStoredSlushInstitutionProfile() {
  const value = window.localStorage.getItem(registeredSlushInstitutionStorageKey)

  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(value) as Partial<SlushInstitutionProfile>

    if (
      typeof parsed.institutionId !== 'string' ||
      typeof parsed.institutionName !== 'string' ||
      typeof parsed.institutionSlug !== 'string' ||
      typeof parsed.walletAddress !== 'string'
    ) {
      return null
    }

    return {
      institutionId: parsed.institutionId,
      institutionName: parsed.institutionName,
      institutionSlug: parsed.institutionSlug,
      walletAddress: parsed.walletAddress,
    }
  } catch {
    return null
  }
}

function storeSlushInstitutionProfile(profile: SlushInstitutionProfile) {
  window.localStorage.setItem(registeredSlushInstitutionStorageKey, JSON.stringify(profile))
}

function normalizeDemoLoginId(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '-')
}

function formatWalletAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
