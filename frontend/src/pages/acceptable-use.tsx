import Head from 'next/head'
import Link from 'next/link'
import Footer from '@/components/Footer'
import { LogoWordmark } from '@/components/Logo'

const LAST_UPDATED = 'May 12, 2026'

const allowed = [
  'Software engineering and product development workflows',
  'Capturing and sharing team knowledge, decisions, and context',
  'Integrating with AI coding tools (Claude Code, Cursor, Zed, VS Code) to build a shared team knowledge graph',
  'Analysing customer feedback, feature requests, and competitive intelligence',
  'Running product management workflows including PRDs, OKRs, and sprint planning',
  'Any lawful purpose aligned with the intended function of the Service',
]

const prohibited = [
  {
    category: 'Illegal activity',
    description: 'Using the Service to violate any applicable local, national, or international law or regulation.',
  },
  {
    category: 'Intellectual property infringement',
    description: 'Uploading or sharing content that infringes patents, copyrights, trademarks, trade secrets, or other proprietary rights.',
  },
  {
    category: 'Malicious software',
    description: 'Introducing viruses, worms, trojans, ransomware, spyware, or any other malicious or harmful code.',
  },
  {
    category: 'Unauthorized access',
    description: 'Attempting to gain unauthorized access to the Service, its infrastructure, other users\' accounts, or any connected systems.',
  },
  {
    category: 'Service disruption',
    description: 'Interfering with or disrupting the integrity, performance, or availability of the Service, including through denial-of-service attacks or excessive automated requests.',
  },
  {
    category: 'Harassment and abuse',
    description: 'Using the Service to harass, threaten, intimidate, defame, or abuse any individual or group.',
  },
  {
    category: 'Deceptive content',
    description: 'Generating or distributing disinformation, fraudulent content, or impersonating individuals or organizations without authorization.',
  },
  {
    category: 'Privacy violations',
    description: 'Collecting, processing, or sharing personal data about individuals without a lawful basis or their consent, including non-consensual recording or transcription of third parties.',
  },
  {
    category: 'Security circumvention',
    description: 'Attempting to bypass, disable, or circumvent any security feature, access control, or authentication mechanism of the Service.',
  },
  {
    category: 'Scraping and data extraction',
    description: 'Automated scraping, crawling, or extraction of data from the Service without explicit written permission.',
  },
  {
    category: 'Resale without authorization',
    description: 'Reselling, sublicensing, or providing access to the Service to third parties without Evols\' prior written consent.',
  },
]

export default function AcceptableUse() {
  return (
    <>
      <Head>
        <title>Acceptable Use Policy | Evols AI</title>
        <meta name="description" content="Evols AI Acceptable Use Policy — what you can and cannot do on the platform." />
      </Head>

      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/"><LogoWordmark iconSize={28} /></Link>
            <nav className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-16">
          {/* Header */}
          <div className="mb-12">
            <p className="text-sm text-muted-foreground mb-3">Last updated: {LAST_UPDATED}</p>
            <h1 className="text-4xl font-medium text-foreground mb-4">Acceptable Use Policy</h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              This policy defines what you may and may not do when using Evols AI. By using the Service, you agree to follow it.
            </p>
          </div>

          {/* Overview */}
          <section id="overview" className="mb-10">
            <h2 className="text-xl font-medium text-foreground mb-3">1. Overview</h2>
            <p className="text-muted-foreground leading-relaxed">
              Evols is designed to help engineering and product teams build a shared AI knowledge graph that reduces context-switching and redundant work. This policy exists to ensure the platform remains safe, trustworthy, and valuable for all users. Violations may result in suspension or termination of your account.
            </p>
          </section>

          {/* Allowed */}
          <section id="allowed-use" className="mb-10">
            <h2 className="text-xl font-medium text-foreground mb-3">2. Allowed Use</h2>
            <p className="text-muted-foreground mb-4">You may use Evols for:</p>
            <ul className="space-y-2">
              {allowed.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-muted-foreground">
                  <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* Prohibited */}
          <section id="prohibited-use" className="mb-10">
            <h2 className="text-xl font-medium text-foreground mb-3">3. Prohibited Use</h2>
            <p className="text-muted-foreground mb-6">The following activities are strictly prohibited:</p>
            <div className="space-y-4">
              {prohibited.map((item) => (
                <div key={item.category} className="flex gap-4 p-4 rounded-lg border border-border bg-muted/20">
                  <div className="mt-0.5 flex-shrink-0 w-2 h-2 rounded-full bg-destructive/70 mt-2" />
                  <div>
                    <p className="text-sm font-medium text-foreground mb-0.5">{item.category}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Enforcement */}
          <section id="enforcement" className="mb-10">
            <h2 className="text-xl font-medium text-foreground mb-3">4. Enforcement</h2>
            <p className="text-muted-foreground leading-relaxed">
              Evols reserves the right to investigate any suspected violation of this policy. Upon finding a violation, we may, at our sole discretion: issue a warning; temporarily suspend access; permanently terminate your account; remove or disable access to violating content; and/or report the activity to relevant law enforcement authorities. We are not obligated to provide advance notice before taking these actions.
            </p>
          </section>

          {/* Reporting */}
          <section id="reporting" className="mb-10">
            <h2 className="text-xl font-medium text-foreground mb-3">5. Reporting Violations</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you become aware of any use of the Service that violates this policy, please report it to{' '}
              <a href="mailto:security@evols.ai" className="text-primary hover:underline">security@evols.ai</a>.
              We take all reports seriously and will investigate promptly.
            </p>
          </section>

          {/* Changes */}
          <section id="changes" className="mb-10">
            <h2 className="text-xl font-medium text-foreground mb-3">6. Changes</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this policy from time to time. Changes take effect when posted to this page. Your continued use of the Service constitutes acceptance of the revised policy.
            </p>
          </section>

        </main>

        <Footer />
      </div>
    </>
  )
}
