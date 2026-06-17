import {
  BrainCircuit,
  DatabaseZap,
  FileKey2,
  HeartPulse,
  LockKeyhole,
  Network,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

const tocItems = [
  { id: 'why', label: 'Why MODi' },
  { id: 'product', label: 'Product Concept' },
  { id: 'demo-flow', label: 'Demo Flow' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'walrus', label: 'Walrus Memory' },
  { id: 'agent', label: 'Privacy Agent' },
  { id: 'seal', label: 'Seal Roadmap' },
  { id: 'deployment', label: 'Deployment' },
]

const architectureSteps = [
  {
    description: 'The institution creates a healthcare data request and publishes the request-specific policy pack to Walrus.',
    icon: FileKey2,
    title: 'Policy Pack',
  },
  {
    description: 'The user app fetches the Walrus policy memory, verifies the hash, and pseudonymizes health data locally.',
    icon: HeartPulse,
    title: 'Local Processing',
  },
  {
    description: 'The platform Privacy/Security Agent recalls the same policy memory and learned security memory before verification.',
    icon: BrainCircuit,
    title: 'Agent Verification',
  },
  {
    description: 'Only encrypted datasets, receipts, and workflow manifests are uploaded to Walrus for durable inspection.',
    icon: DatabaseZap,
    title: 'Walrus Artifacts',
  },
]

const demoSteps = [
  'Institution creates a healthcare data request.',
  'MODi turns the request into a Walrus policy memory.',
  'Participant applies and is approved by the institution.',
  'User app loads healthcare data and fetches the policy pack from Walrus.',
  'User app pseudonymizes locally and applies safety edits when needed.',
  'Privacy/Security Agent verifies the payload using Walrus policy memory and security memory.',
  'Encrypted dataset and audit artifacts are stored on Walrus.',
  'Institution downloads verified encrypted datasets and audit records from the dashboard.',
]

const memoryArtifacts = [
  {
    name: 'policy_pack',
    role: 'Public request policy',
    storedOn: 'Walrus before collection',
  },
  {
    name: 'pseudonymization_plan',
    role: 'Local safety edit recipe',
    storedOn: 'Walrus after user processing',
  },
  {
    name: 'privacy_verification_receipt',
    role: 'Privacy Agent decision record',
    storedOn: 'Walrus after Agent verification',
  },
  {
    name: 'security_memory',
    role: 'Reusable learned risk pattern',
    storedOn: 'Walrus only when risk is discovered',
  },
  {
    name: 'agent_workflow_manifest',
    role: 'End-to-end provenance chain',
    storedOn: 'Walrus after upload',
  },
]

export function DocsPage() {
  return (
    <div className="bg-white">
      <section className="border-b border-border bg-canvas-soft">
        <div className="container py-12 sm:py-16">
          <Badge variant="secondary">Project Documentation</Badge>
          <h1 className="mt-5 max-w-4xl text-4xl font-light leading-tight text-ink sm:text-5xl">
            Policy-adaptive privacy infrastructure for healthcare MyData
          </h1>
          <p className="mt-5 max-w-3xl text-base font-light leading-7 text-ink-secondary sm:text-lg">
            MODi is designed for the moment when people can send wearable data, recovery signals, and medical records directly to
            precision medicine or insurance wellness companies, but every company asks for different fields under changing privacy
            requirements.
          </p>
        </div>
      </section>

      <div className="container grid gap-10 py-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:py-14">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-lg border border-border bg-white p-4 shadow-surface">
            <p className="text-xs font-semibold uppercase text-ink-mute">Contents</p>
            <nav className="mt-4 grid gap-1 text-sm" aria-label="Documentation table of contents">
              {tocItems.map((item) => (
                <a
                  className="rounded-md px-3 py-2 text-ink-secondary transition-colors hover:bg-canvas-soft hover:text-ink"
                  href={`#${item.id}`}
                  key={item.id}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <article className="min-w-0 space-y-12">
          <DocsSection
            badge="Problem"
            id="why"
            title="Healthcare data sharing is becoming user-directed, but privacy work is still policy-specific"
          >
            <p>
              Wearables and medical records are becoming increasingly useful for precision medicine, risk modeling, insurance
              wellness, recovery coaching, and preventive care. The hard part is not only consent. A user may agree to share data,
              but the safe shape of that data changes depending on the institution, purpose, reward terms, requested fields, and
              latest privacy policy.
            </p>
            <p>
              A static app cannot safely cover every institution request. Sending raw data to a server for processing increases
              exposure. MODi moves the first safety step to the user app, then adds an Agent verification layer that can remember
              policy and prior risk patterns over time.
            </p>
          </DocsSection>

          <DocsSection badge="Concept" id="product" title="MODi turns institution requests into reusable privacy memory">
            <div className="grid gap-4 md:grid-cols-3">
              <InfoCard
                icon={FileKey2}
                title="Policy memory"
                text="Institution requirements become versioned Walrus policy packs that both user app and Agent can read."
              />
              <InfoCard
                icon={LockKeyhole}
                title="Local safety edits"
                text="The user app removes direct identifiers, generalizes risky values, and keeps raw health data off the platform server."
              />
              <InfoCard
                icon={ShieldCheck}
                title="Agent verification"
                text="The platform Privacy/Security Agent checks whether the submitted payload follows the latest policy memory."
              />
            </div>
          </DocsSection>

          <DocsSection badge="Live demo" id="demo-flow" title="The demo flow is intentionally simple">
            <ol className="grid gap-3">
              {demoSteps.map((step, index) => (
                <li className="flex gap-3 rounded-md border border-border bg-white p-4" key={step}>
                  <span className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <span className="text-sm leading-6 text-ink-secondary">{step}</span>
                </li>
              ))}
            </ol>
          </DocsSection>

          <DocsSection badge="System design" id="architecture" title="Architecture">
            <div className="grid gap-4 md:grid-cols-2">
              {architectureSteps.map((step) => (
                <InfoCard icon={step.icon} key={step.title} title={step.title} text={step.description} />
              ))}
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Data boundary</CardTitle>
                <CardDescription>
                  Raw HealthKit or medical-record style data is not sent to the platform for pseudonymization. The user app reads
                  policy memory, transforms data locally, and submits only the safety-checked encrypted result.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm text-ink-secondary sm:grid-cols-3">
                  <BoundaryItem label="User app" value="Policy fetch, local pseudonymization, encryption, Walrus upload" />
                  <BoundaryItem label="Platform Agent" value="Policy recall, payload verification, receipt generation" />
                  <BoundaryItem label="Institution dashboard" value="Policy creation, applicant review, encrypted data download" />
                </div>
              </CardContent>
            </Card>
          </DocsSection>

          <DocsSection badge="Walrus" id="walrus" title="Walrus is used as persistent, verifiable Agent memory">
            <p>
              MODi uses Walrus as more than file storage. Public policy packs, Privacy Agent receipts, security workflow manifests,
              and encrypted datasets become durable artifacts that can be inspected across sessions and reused by the Agent.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <InfoCard
                icon={DatabaseZap}
                title="Policy memory"
                text="The Agent does not rely only on app state or database rows. It fetches the Walrus policy pack and verifies hashes."
              />
              <InfoCard
                icon={BrainCircuit}
                title="Security memory"
                text="When a risky quasi-identifier combination is found, the finding becomes memory that can guide the next submission."
              />
            </div>
            <Card>
              <CardHeader>
                <CardTitle>memWal artifact chain</CardTitle>
                <CardDescription>
                  These artifacts let the Privacy Agent recall policy, remember risk patterns, and prove what happened without storing raw health data.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {memoryArtifacts.map((artifact) => (
                    <div className="grid gap-3 rounded-md border border-border bg-canvas-soft p-4 sm:grid-cols-[180px_minmax(0,1fr)_190px]" key={artifact.name}>
                      <p className="tabular text-sm font-semibold text-ink">{artifact.name}</p>
                      <p className="text-sm leading-6 text-ink-secondary">{artifact.role}</p>
                      <p className="text-sm leading-6 text-ink-mute">{artifact.storedOn}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </DocsSection>

          <DocsSection badge="Agent" id="agent" title="The Privacy/Security Agent is a verifier, not the data owner">
            <p>
              The Agent checks whether local pseudonymization was sufficient. If it finds direct identifiers, exact timestamps,
              contact patterns, wallet addresses, or risky field combinations, it returns findings and asks the user app to apply
              safer local edits. The Agent then re-verifies and writes an audit receipt.
            </p>
            <Separator />
            <div className="grid gap-4 md:grid-cols-2">
              <InfoCard
                icon={ShieldCheck}
                title="What it checks"
                text="Policy hash, forbidden fields, direct identifiers, precise dates, contact-like strings, and scope mismatch."
              />
              <InfoCard
                icon={Network}
                title="What it remembers"
                text="Policy references, receipt hashes, finding codes, safety edit summaries, and reusable risk signals."
              />
            </div>
          </DocsSection>

          <DocsSection badge="Roadmap" id="seal" title="Seal provides the production path for policy-gated decryption">
            <p>
              The demo emphasizes local encryption, Walrus storage, and Agent auditability. Seal is the production path for
              policy-gated decryption, where an institution would only receive key material when the access policy is satisfied.
            </p>
            <div className="rounded-lg border border-border bg-canvas-soft p-5">
              <p className="text-sm font-medium text-ink">Roadmap responsibilities</p>
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-ink-secondary">
                <li>Bind encrypted datasets to access conditions.</li>
                <li>Let key servers evaluate policy before returning key shares.</li>
                <li>Keep Walrus policy memory and Agent audit trails as the verification foundation.</li>
              </ul>
            </div>
          </DocsSection>

          <DocsSection badge="Deployment" id="deployment" title="Deployment model">
            <p>
              Both apps can be deployed as static frontends on Vercel. The user app is exported with Expo web, and the institution
              dashboard is built with Vite. Supabase, Walrus, Sui, Slush, and Enoki remain external HTTPS services.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <InfoCard icon={HeartPulse} title="User app web" text="Browser mode uses example healthcare data because Apple Health is native-only." />
              <InfoCard icon={Network} title="Dashboard web" text="The dashboard supports `/docs`, study creation, participant review, and Walrus downloads through SPA routing." />
            </div>
          </DocsSection>
        </article>
      </div>
    </div>
  )
}

function DocsSection({
  badge,
  children,
  id,
  title,
}: {
  badge: string
  children: ReactNode
  id: string
  title: string
}) {
  return (
    <section className="scroll-mt-24 space-y-5" id={id}>
      <div>
        <Badge variant="outline">{badge}</Badge>
        <h2 className="mt-4 text-3xl font-light leading-tight text-ink">{title}</h2>
      </div>
      <div className="space-y-5 text-base font-light leading-7 text-ink-secondary">{children}</div>
    </section>
  )
}

function InfoCard({ icon: Icon, text, title }: { icon: LucideIcon; text: string; title: string }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-canvas-soft">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription>{text}</CardDescription>
      </CardContent>
    </Card>
  )
}

function BoundaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-white p-4">
      <p className="text-sm font-medium text-ink">{label}</p>
      <p className="mt-2 leading-6">{value}</p>
    </div>
  )
}
