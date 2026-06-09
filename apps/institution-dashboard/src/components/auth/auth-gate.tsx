import type { Session } from '@supabase/supabase-js'
import { ArrowLeft, LogOut } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

type AuthGateProps = {
  children: ReactNode
  onGoHome: () => void
}

export function AuthGate({ children, onGoHome }: AuthGateProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured)

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

  if (!isSupabaseConfigured) {
    return <SupabaseConfigRequired onGoHome={onGoHome} />
  }

  if (isLoading) {
    return (
      <section className="flex min-h-screen items-center justify-center bg-page px-6">
        <div className="text-sm font-medium text-ink-secondary">기관 세션을 확인하고 있습니다.</div>
      </section>
    )
  }

  if (!session) {
    return <AuthForm onGoHome={onGoHome} />
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
            <Button variant="ghost" size="sm" onClick={onGoHome}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              랜딩으로
            </Button>
            <Button variant="outline" size="sm" onClick={() => supabase?.auth.signOut()}>
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

function AuthForm({ onGoHome }: { onGoHome: () => void }) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!supabase) {
      return
    }

    setIsSubmitting(true)
    setMessage('')

    const authAction =
      mode === 'sign-in'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password })

    const { error } = await authAction

    if (error) {
      setMessage(error.message)
    } else if (mode === 'sign-up') {
      setMessage('가입 요청을 보냈습니다. 이메일 인증이 켜져 있다면 인증 후 다시 로그인해 주세요.')
    }

    setIsSubmitting(false)
  }

  return (
    <section className="flex min-h-screen items-center justify-center bg-page px-6">
      <Card className="w-full max-w-md rounded-lg border-border shadow-sm">
        <CardHeader>
          <CardTitle>기관 운영자 로그인</CardTitle>
          <CardDescription>Supabase Auth 계정으로 대시보드와 연구 데이터를 관리합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-ink">
              이메일
              <input
                className="mt-2 h-11 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-brand"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label className="block text-sm font-medium text-ink">
              비밀번호
              <input
                className="mt-2 h-11 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-brand"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                required
              />
            </label>
            {message ? <div className="rounded-md bg-muted px-3 py-2 text-sm text-ink-secondary">{message}</div> : null}
            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? '처리 중' : mode === 'sign-in' ? '로그인' : '계정 만들기'}
            </Button>
          </form>
          <div className="mt-5 flex items-center justify-between text-sm">
            <button className="font-medium text-brand-dark" type="button" onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>
              {mode === 'sign-in' ? '계정 만들기' : '로그인으로 돌아가기'}
            </button>
            <button className="text-ink-secondary" type="button" onClick={onGoHome}>
              랜딩으로
            </button>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
