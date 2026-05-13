import Head from 'next/head'
import Link from 'next/link'
import Footer from '@/components/Footer'
import { LogoWordmark } from '@/components/Logo'

const LAST_UPDATED = 'May 12, 2026'

const sections = [
  {
    id: 'overview',
    title: 'Overview',
    content: `This Privacy Policy describes how Evols AI ("Evols", "we", "us", or "our") collects, uses, and shares information when you use our website at evols.ai and all associated products and services (collectively, the "Service"). By using the Service, you agree to the practices described in this policy.`,
  },
  {
    id: 'data-we-collect',
    title: 'Data We Collect',
    items: [
      {
        label: 'Account information',
        description: 'Name, email address, and password when you register for an account.',
      },
      {
        label: 'Session and knowledge content',
        description: 'AI coding session summaries, work context entries, knowledge graph entries, and other content you or your team contribute to the Service. This content is used to power the shared knowledge graph and to improve the Service.',
      },
      {
        label: 'Usage data',
        description: 'Pages visited, features used, interactions with the Service, and session metadata. We use this to understand how the product is used and to improve it.',
      },
      {
        label: 'Integration data',
        description: 'If you connect third-party integrations (Slack, GitHub, Notion, etc.), we collect the data required to sync context from those sources, limited to what you explicitly authorize.',
      },
      {
        label: 'Error and diagnostic logs',
        description: 'Technical error information collected separately from your content, used solely to identify and resolve issues with the Service.',
      },
      {
        label: 'Payment information',
        description: 'Billing details are processed by our payment provider and are not stored on our servers.',
      },
    ],
  },
  {
    id: 'how-we-use-data',
    title: 'How We Use Your Data',
    content: `We use the information we collect to: provide, operate, and improve the Service; personalize your experience; communicate with you about your account, updates, and support requests; detect, investigate, and prevent fraudulent or unauthorized activity; comply with legal obligations; and, where you have given consent, to train and improve our AI models. We do not use your private content to train models shared with other tenants without your explicit opt-in.`,
  },
  {
    id: 'team-sharing',
    title: 'Team Data Sharing',
    content: `Evols is a collaborative platform. Content you contribute to a team workspace — including knowledge entries, session summaries, and work context — is visible to other members of your team on that workspace. You are responsible for ensuring that any content you contribute to a shared workspace is appropriate to share. If you are a team admin, you have additional controls over what data is accessible within your workspace.`,
  },
  {
    id: 'data-retention',
    title: 'Data Retention',
    content: `We retain your data for as long as your account is active or as needed to provide you with the Service. If you delete your account, we will delete your personal data within 30 days, subject to legal retention obligations. Knowledge entries contributed to a shared team workspace may persist if other team members remain active. You can configure retention policies for your workspace in the Settings page.`,
  },
  {
    id: 'data-sharing',
    title: 'Data Sharing and Disclosure',
    content: `We do not sell your personal data. We may share your data with: infrastructure and service providers who process data on our behalf under confidentiality obligations; law enforcement or government agencies when required by law or to protect the rights and safety of our users; and acquirers in the event of a merger, acquisition, or asset sale, subject to standard confidentiality protections. We will notify you of any such transfer where required by law.`,
  },
  {
    id: 'security',
    title: 'Security',
    content: `We use industry-standard security measures to protect your data, including TLS encryption in transit and AES-256 encryption at rest. Data is stored in secure cloud infrastructure in the United States. While we take security seriously, no system is completely secure, and we cannot guarantee the absolute security of your data. You are responsible for maintaining the security of your account credentials.`,
  },
  {
    id: 'your-rights',
    title: 'Your Rights',
    content: `Depending on your location, you may have the right to access, correct, export, or delete your personal data. To exercise these rights, contact us at privacy@evols.ai. We will respond to your request within 30 days. Account deletion removes your personal profile and private content immediately. Team-shared data may persist as described in the Data Retention section above. If you are located in the European Economic Area, you have additional rights under the GDPR, including the right to lodge a complaint with your local supervisory authority.`,
  },
  {
    id: 'cookies',
    title: 'Cookies and Tracking',
    content: `We use cookies and similar tracking technologies to operate the Service, maintain your session, and understand how the Service is used. We use analytics tools (including Amplitude) to collect anonymized usage data. You can control cookie settings through your browser, but disabling cookies may affect your ability to use certain features of the Service.`,
  },
  {
    id: 'third-party',
    title: 'Third-Party Services',
    content: `The Service may contain links to or integrations with third-party websites and services. This Privacy Policy does not apply to those third parties, and we are not responsible for their privacy practices. We encourage you to review the privacy policies of any third-party services you connect.`,
  },
  {
    id: 'changes',
    title: 'Changes to This Policy',
    content: `We may update this Privacy Policy from time to time. When we make material changes, we will update the "Last Updated" date and, where appropriate, notify you by email. Your continued use of the Service after the changes take effect constitutes your acceptance of the revised policy.`,
  },
  {
    id: 'contact',
    title: 'Contact',
    content: `If you have questions or concerns about this Privacy Policy, or to exercise your data rights, contact us at privacy@evols.ai.`,
  },
]

export default function Privacy() {
  return (
    <>
      <Head>
        <title>Privacy Policy | Evols AI</title>
        <meta name="description" content="Evols AI Privacy Policy — how we collect, use, and protect your data." />
      </Head>

      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/"><LogoWordmark iconSize={28} /></Link>
            <nav className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <Link href="/acceptable-use" className="hover:text-foreground transition-colors">Acceptable Use</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-16">
          {/* Header */}
          <div className="mb-12">
            <p className="text-sm text-muted-foreground mb-3">Last updated: {LAST_UPDATED}</p>
            <h1 className="text-4xl font-medium text-foreground mb-4">Privacy Policy</h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              We believe in transparency about how your data is collected and used.
            </p>
          </div>

          {/* Quick-nav */}
          <nav className="mb-12 p-5 rounded-lg border border-border bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">On this page</p>
            <ol className="space-y-1">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {i + 1}. {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {/* Sections */}
          <div className="space-y-10">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id}>
                <h2 className="text-xl font-medium text-foreground mb-3">
                  {i + 1}. {s.title}
                </h2>
                {'items' in s ? (
                  <ul className="space-y-3">
                    {s.items!.map(item => (
                      <li key={item.label} className="flex gap-2 text-muted-foreground leading-relaxed">
                        <span className="font-medium text-foreground whitespace-nowrap">{item.label}:</span>
                        <span>{item.description}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground leading-relaxed">{s.content}</p>
                )}
              </section>
            ))}
          </div>

        </main>

        <Footer />
      </div>
    </>
  )
}
