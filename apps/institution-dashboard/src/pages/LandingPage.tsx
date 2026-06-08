import {
  Activity,
  ArrowRight,
  LockKeyhole,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { applicants, capabilities, metrics, pipelineEvents, studies, trustSignals } from '@/data/landing'

type LandingPageProps = {
  onCreateResearch: () => void
}

export function LandingPage({ onCreateResearch }: LandingPageProps) {
  return (
    <>
      <HeroSection onCreateResearch={onCreateResearch} />
      <CapabilitiesSection />
      <WorkflowSection />
      <Footer />
    </>
  )
}

function HeroSection({ onCreateResearch }: LandingPageProps) {
  return (
    <section id="top" className="relative overflow-hidden bg-canvas-soft">
      <div className="mesh-band absolute inset-x-0 top-0 h-[58%]" aria-hidden="true" />
      <div className="container relative py-10 sm:py-12 lg:py-14">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="secondary">기관 연구 운영 콘솔</Badge>
          <h1 className="mt-6 text-4xl font-light leading-tight text-ink sm:text-5xl lg:text-[56px]">
            연구 생성부터 참여자 데이터 운영까지 한 화면에서 관리하세요
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base font-light leading-7 text-ink-secondary sm:text-lg">
            MODi 기관 대시보드는 건강 데이터 연구를 만드는 팀이 모집 조건, 참여 신청, 동의 상태, Walrus 데이터
            접근, 보상 지급까지 이어지는 운영 흐름을 확인하도록 설계되었습니다.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" onClick={onCreateResearch}>
              새 연구 만들기
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="secondary" size="lg" onClick={onCreateResearch}>
              운영 데모 보기
            </Button>
          </div>
        </div>

        <DashboardPreview />
      </div>
    </section>
  )
}

function DashboardPreview() {
  return (
    <div className="mt-10 overflow-hidden rounded-lg bg-[#0d253d] p-3 text-white shadow-dashboard sm:p-4 lg:mt-12">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-2 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white/10">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium">Research Operations</p>
            <p className="text-xs text-white/60">기관용 데이터 연구 관리</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PreviewIconButton label="검색" icon={Search} />
          <PreviewIconButton label="설정" icon={Settings} />
        </div>
      </div>

      <div className="grid min-w-0 gap-4 pt-4 lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="min-w-0 rounded-lg border border-white/10 bg-white/[0.06] p-4">
          <Badge variant="dark">모집 현황</Badge>
          <div className="mt-5 space-y-4">
            {metrics.map((metric) => (
              <div key={metric.label}>
                <p className="text-xs text-white/55">{metric.label}</p>
                <p className="tabular mt-1 text-2xl font-light leading-none text-white">{metric.value}</p>
                <p className="mt-1 text-xs text-white/55">{metric.detail}</p>
              </div>
            ))}
          </div>
        </aside>

        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
          <div className="min-w-0 rounded-lg border border-white/10 bg-white p-4 text-ink">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">진행 중인 연구</p>
                <p className="text-xs text-ink-mute">참여 신청, 승인, 데이터 범위를 함께 확인</p>
              </div>
              <Button variant="outline" size="sm">
                <Plus className="mr-2 h-3.5 w-3.5" />
                연구 추가
              </Button>
            </div>
            <ResearchTable />
          </div>

          <div className="min-w-0 space-y-4">
            <ApplicantQueue />
            <DataPolicyPanel />
          </div>
        </div>
      </div>
    </div>
  )
}

function PreviewIconButton({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <button
      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
      type="button"
      aria-label={label}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

function ResearchTable() {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="text-xs text-ink-mute">
          <tr className="border-b border-border">
            <th className="py-3 font-medium">연구</th>
            <th className="py-3 font-medium">상태</th>
            <th className="py-3 font-medium">신청/승인</th>
            <th className="py-3 font-medium">데이터 범위</th>
            <th className="py-3 text-right font-medium">예치 보상</th>
          </tr>
        </thead>
        <tbody>
          {studies.map((study) => (
            <tr key={study.id} className="border-b border-border last:border-0">
              <td className="py-3 pr-5">
                <p className="font-medium text-ink">{study.title}</p>
                <p className="tabular mt-1 text-xs text-ink-mute">{study.id}</p>
              </td>
              <td className="py-3 pr-5">
                <span className="inline-flex rounded-full bg-[#b9b9f9] px-2.5 py-1 text-xs font-medium text-[#4434d4]">
                  {study.status}
                </span>
              </td>
              <td className="tabular py-3 pr-5 text-ink-secondary">
                {study.applicants} / {study.approved}
                <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-canvas-soft">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(study.approved / study.applicants) * 100}%` }} />
                </div>
              </td>
              <td className="py-3 pr-5 text-ink-secondary">{study.dataScope}</td>
              <td className="tabular py-3 text-right text-ink">{study.rewardPool}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ApplicantQueue() {
  return (
    <div className="rounded-lg border border-white/10 bg-white p-4 text-ink">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="whitespace-nowrap text-sm font-medium">참여 신청 큐</p>
          <p className="text-xs text-ink-mute">심사 결과 기반 승인</p>
        </div>
        <Badge variant="outline">96 대기</Badge>
      </div>
      <div className="mt-4 space-y-3">
        {applicants.map((applicant) => (
          <div key={applicant.code} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
            <div>
              <p className="tabular text-sm font-medium">{applicant.code}</p>
              <p className="mt-1 text-xs text-ink-mute">{applicant.consent}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-ink-secondary">{applicant.state}</p>
              <p className="tabular mt-1 text-lg font-light text-ink">{applicant.score}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DataPolicyPanel() {
  return (
    <div className="rounded-lg border border-white/10 bg-[#f5e9d4] p-4 text-ink">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white/70">
          <LockKeyhole className="h-4 w-4 text-[#533afd]" />
        </div>
        <div>
          <p className="text-sm font-medium">데이터 접근 정책</p>
          <p className="mt-1 text-xs leading-5 text-ink-secondary">
            원본 건강 데이터가 아니라 범주화된 연구 제공 필드만 Seal policy와 연결됩니다.
          </p>
        </div>
      </div>
    </div>
  )
}

function CapabilitiesSection() {
  return (
    <section id="capabilities" className="bg-white py-16 sm:py-20">
      <div className="container">
        <div className="max-w-2xl">
          <Badge variant="outline">Core workflows</Badge>
          <h2 className="mt-5 text-3xl font-light leading-tight text-ink sm:text-4xl">기관 연구자가 매일 쓰는 운영 기능</h2>
          <p className="mt-4 text-base font-light leading-7 text-ink-secondary">
            사용자 앱에서 들어오는 참여 흐름을 기관 관점으로 뒤집어, 연구 생성과 신청 검토, 데이터 제공 로그를 한
            콘솔에서 이어줍니다.
          </p>
        </div>

        <div className="mt-9 grid gap-4 md:grid-cols-3">
          {capabilities.map((capability) => {
            const Icon = capability.icon

            return (
              <Card key={capability.title}>
                <CardHeader>
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-canvas-soft">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase text-ink-mute">{capability.meta}</p>
                    <CardTitle>{capability.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{capability.description}</CardDescription>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function WorkflowSection() {
  return (
    <section id="workflow" className="bg-canvas-soft py-16 sm:py-20">
      <div className="container grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <Badge variant="secondary">Data governance</Badge>
          <h2 className="mt-5 text-3xl font-light leading-tight text-ink sm:text-4xl">
            동의, 접근, 보상을 추적하는 데이터 운영 흐름
          </h2>
          <p className="mt-4 text-base font-light leading-7 text-ink-secondary">
            연구 참여가 승인되면 ConsentGrant, AccessGrant, DataAsset, RewardPaid 이벤트를 순서대로 확인할 수
            있도록 설계합니다. 랜딩 이후 실제 대시보드 화면은 이 파이프라인을 기준으로 확장하면 됩니다.
          </p>
          <div id="security" className="mt-6 flex flex-wrap gap-2">
            {trustSignals.map((signal) => {
              const Icon = signal.icon

              return (
                <span
                  key={signal.label}
                  className="inline-flex items-center rounded-full border border-border bg-white px-3 py-2 text-sm text-ink-secondary"
                >
                  <Icon className="mr-2 h-4 w-4 text-primary" />
                  {signal.label}
                </span>
              )
            })}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-white p-5 shadow-surface">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink">Pipeline monitor</p>
              <p className="text-xs text-ink-mute">연구별 데이터 제공 상태</p>
            </div>
            <Badge variant="outline">Live preview</Badge>
          </div>
          <Separator className="my-5" />
          <div className="grid gap-3 sm:grid-cols-2">
            {pipelineEvents.map((event) => {
              const Icon = event.icon

              return (
                <div key={event.label} className="rounded-md border border-border p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-canvas-soft">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="tabular text-sm font-medium text-ink">{event.label}</p>
                      <p className="mt-1 text-sm leading-6 text-ink-mute">{event.detail}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-5 rounded-lg bg-brand-dark p-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">정책 통과율</p>
                <p className="mt-1 text-xs text-white/60">wearable_health_record schema 기준</p>
              </div>
              <p className="tabular text-3xl font-light">99.2%</p>
            </div>
            <div className="mt-4 grid grid-cols-12 gap-1">
              {Array.from({ length: 12 }).map((_, index) => (
                <span
                  key={index}
                  className="h-2 rounded-full"
                  style={{ backgroundColor: index > 9 ? '#b9b9f9' : '#533afd' }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-border bg-white py-8">
      <div className="container flex flex-col gap-4 text-sm text-ink-mute sm:flex-row sm:items-center sm:justify-between">
        <p>MODi Institution Dashboard</p>
        <div className="flex items-center gap-2 text-ink-secondary">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span>Consent-first research operations</span>
        </div>
      </div>
    </footer>
  )
}
