import {
  ArrowRight,
  BookOpen,
  DatabaseZap,
  LockKeyhole,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'

type LandingPageProps = {
  onCreateResearch: () => void
  onViewDocs: () => void
}

export function LandingPage({ onCreateResearch, onViewDocs }: LandingPageProps) {
  return (
    <>
      <HeroSection onCreateResearch={onCreateResearch} onViewDocs={onViewDocs} />
      <DirectParticipantAccessSection />
      <PrivacySafeIntakeSection />
      <ReadyDatasetsSection />
      <Footer />
    </>
  )
}

function HeroSection({ onCreateResearch, onViewDocs }: LandingPageProps) {
  return (
    <section id="top" className="relative overflow-hidden bg-canvas-soft">
      <div className="mesh-band absolute inset-x-0 top-0 h-[58%]" aria-hidden="true" />
      <div className="container relative py-10 sm:py-12 lg:py-14">
        <div className="mx-auto max-w-6xl text-center">
          <h1 className="mx-auto text-center text-4xl font-bold leading-tight text-ink sm:text-5xl lg:text-[40px]">
            Health data people can actually share.
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-base font-light leading-7 text-ink-secondary sm:text-lg">
            <span className="block">Participants pick the records.</span>
            <strong className="block font-semibold text-ink">MODi turns them into verified, privacy-ready datasets for your company.</strong>
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" onClick={onCreateResearch}>
              Start Collecting Data
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="secondary" size="lg" onClick={onViewDocs}>
              <BookOpen className="mr-2 h-4 w-4" />
              View More
            </Button>
          </div>
        </div>

        <DataFlowIllustration />
      </div>
    </section>
  )
}

function DataFlowIllustration() {
  return (
    <div className="mx-auto mt-10 max-w-5xl rounded-lg border border-border bg-white p-5 shadow-dashboard lg:mt-12">
      <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
        <FlowNode
          icon={Users}
          title="Participant"
          detail="Picks what to share"
          items={['Wearables', 'Medical records', 'Wellness logs']}
        />
        <FlowArrow />
        <FlowNode
          dark
          icon={LockKeyhole}
          title="MODi"
          detail="Redacts, checks, verifies"
          items={['Privacy-safe', 'Policy-matched', 'Agent-signed']}
        />
        <FlowArrow />
        <FlowNode
          icon={DatabaseZap}
          title="Company"
          detail="Gets usable data"
          items={['Encrypted file', 'Audit trail']}
        />
      </div>
    </div>
  )
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center text-primary md:px-1">
      <ArrowRight className="hidden h-7 w-7 md:block" strokeWidth={2.2} />
      <div className="h-8 w-px bg-border md:hidden" />
    </div>
  )
}

function FlowNode({
  dark = false,
  detail,
  icon: Icon,
  items,
  title,
}: {
  dark?: boolean
  detail: string
  icon: LucideIcon
  items: string[]
  title: string
}) {
  return (
    <div className={dark ? 'rounded-lg bg-brand-dark p-5 text-white' : 'rounded-lg bg-canvas-soft p-5 text-ink'}>
      <div className="flex items-start gap-3">
        <div className={dark ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/10' : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white'}>
          <Icon className={dark ? 'h-5 w-5 text-white' : 'h-5 w-5 text-primary'} />
        </div>
        <div>
          <p className={dark ? 'text-base font-semibold text-white' : 'text-base font-semibold text-ink'}>{title}</p>
          <p className={dark ? 'mt-1 text-sm leading-5 text-white/65' : 'mt-1 text-sm leading-5 text-ink-secondary'}>{detail}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-2">
        {items.map((item) => (
          <div className={dark ? 'rounded-md bg-white/10 px-3 py-2 text-sm text-white/80' : 'rounded-md bg-white px-3 py-2 text-sm text-ink-secondary'} key={item}>
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}

function DirectParticipantAccessSection() {
  return (
    <section id="capabilities" className="bg-white py-16 sm:py-20">
      <div className="container grid gap-9 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="max-w-xl">
          <p className="text-sm font-medium text-ink-mute">No Privacy Drag</p>
          <h2 className="mt-4 text-3xl font-light leading-tight text-ink sm:text-4xl">Ask for the data, not the liability.</h2>
          <p className="mt-4 text-base font-light leading-7 text-ink-secondary">
            Participants clean sensitive fields before upload. Your team gets ready-to-use health data without becoming the first stop for raw personal records.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-canvas-soft p-5">
          <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <p className="text-sm font-medium text-ink">Live participant intake</p>
              <p className="text-xs text-ink-mute">Privacy-ready submissions</p>
            </div>
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-4 grid gap-3">
            {['Apple Health activity', 'Sleep recovery signals', 'Cardiovascular trends'].map((label, index) => (
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-md bg-white p-4" key={label}>
                <div>
                  <p className="text-sm font-medium text-ink">{label}</p>
                  <p className="mt-1 text-xs text-ink-mute">{index === 0 ? '184 participants connected' : index === 1 ? '156 participants connected' : '121 participants connected'}</p>
                </div>
                <p className="tabular text-sm text-ink-secondary">{index === 0 ? '128 ready' : index === 1 ? '74 ready' : '61 ready'}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function PrivacySafeIntakeSection() {
  return (
    <section id="workflow" className="bg-canvas-soft py-16 sm:py-20">
      <div className="container grid gap-9 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="order-2 rounded-lg border border-border bg-white p-5 shadow-surface lg:order-1">
          <div className="grid gap-3">
            <PrivacyStep title="Policy memory" detail="Your requirements become the live rulebook." />
            <PrivacyStep title="Local safety edit" detail="Sensitive details are stripped before upload." />
            <PrivacyStep title="Agent verification" detail="Hidden risk is checked before delivery." />
          </div>
        </div>

        <div className="order-1 max-w-xl lg:order-2">
          <p className="text-sm font-medium text-ink-mute">Agent Privacy Gate</p>
          <h2 className="mt-4 text-3xl font-light leading-tight text-ink sm:text-4xl">One more check before anything reaches you.</h2>
          <p className="mt-4 text-base font-light leading-7 text-ink-secondary">
            MODi's Security Agent reads your collection policy, spots hidden re-identification risk, and applies safer edits before delivery.
          </p>
        </div>
      </div>
    </section>
  )
}

function PrivacyStep({ detail, title }: { detail: string; title: string }) {
  return (
    <div className="flex items-start gap-4 rounded-md border border-border p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-canvas-soft">
        <LockKeyhole className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="mt-1 text-sm leading-6 text-ink-secondary">{detail}</p>
      </div>
    </div>
  )
}

function ReadyDatasetsSection() {
  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="container grid gap-9 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="max-w-xl">
          <p className="text-sm font-medium text-ink-mute">Proof-Ready Delivery</p>
          <h2 className="mt-4 text-3xl font-light leading-tight text-ink sm:text-4xl">Data your team can trust later.</h2>
          <p className="mt-4 text-base font-light leading-7 text-ink-secondary">
            Each package arrives encrypted, download-ready, and tied to Walrus-backed policy context with Agent receipts your team can inspect later.
          </p>
        </div>

        <div className="rounded-lg bg-brand-dark p-5 text-white shadow-dashboard">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <p className="text-sm font-medium">Dataset handoff</p>
              <p className="mt-1 text-xs text-white/60">Verified, encrypted, ready</p>
            </div>
            <DatabaseZap className="h-5 w-5 text-white" />
          </div>
          <div className="mt-5 grid gap-3">
            {['Encrypted health dataset', 'Security Agent receipt', 'Walrus audit trail'].map((item) => (
              <div className="flex items-center justify-between gap-3 rounded-md bg-white/10 p-4" key={item}>
                <p className="text-sm text-white">{item}</p>
                <p className="text-xs text-white/60">Ready</p>
              </div>
            ))}
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
          <span>Policy-adaptive healthcare MyData privacy workflow</span>
        </div>
      </div>
    </footer>
  )
}
