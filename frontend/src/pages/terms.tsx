import Head from 'next/head'
import Link from 'next/link'
import Footer from '@/components/Footer'
import { LogoWordmark } from '@/components/Logo'

const LAST_UPDATED = 'May 12, 2026'

const sections = [
  {
    id: 'overview',
    title: 'Overview',
    content: `These Terms of Service ("Terms") govern your access to and use of Evols AI ("Evols", "we", "us", or "our"), including our website at evols.ai and all associated products and services (collectively, the "Service"). By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.`,
  },
  {
    id: 'the-service',
    title: 'The Service',
    content: `Evols provides a team AI brain platform that helps engineering and product teams capture, share, and retrieve knowledge across AI coding sessions. This includes our web application, MCP integrations, CLI tools, and any associated APIs. We reserve the right to modify, suspend, or discontinue any aspect of the Service at any time, with or without notice.`,
  },
  {
    id: 'your-account',
    title: 'Your Account',
    content: `You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You must be at least 18 years old to use the Service. You agree to notify us immediately of any unauthorized use of your account. We are not liable for any loss or damage arising from your failure to protect your credentials.`,
  },
  {
    id: 'your-responsibilities',
    title: 'Your Responsibilities',
    content: `You agree to use the Service only for lawful purposes and in accordance with these Terms. You must not: violate any applicable laws or regulations; infringe the intellectual property rights of others; transmit malicious code, viruses, or harmful software; attempt to gain unauthorized access to any part of the Service or its infrastructure; disrupt or interfere with the security or integrity of the Service; use the Service to harass, abuse, or harm any individual; or reverse-engineer, decompile, or attempt to extract the source code of the Service.`,
  },
  {
    id: 'your-content',
    title: 'Your Content',
    content: `You retain ownership of all content, data, and materials you submit to the Service ("Your Content"). By submitting content, you grant Evols a worldwide, non-exclusive, royalty-free license to use, store, process, and display Your Content solely to operate and improve the Service. You represent that you have all necessary rights to grant this license and that Your Content does not violate any third-party rights or applicable law.`,
  },
  {
    id: 'team-access',
    title: 'Team Access',
    content: `Evols is designed for team collaboration. When you use the Service within a team workspace, other team members on your account may access shared knowledge entries, session summaries, and context you contribute to the shared knowledge graph. You are responsible for ensuring that any content you share within a team workspace is appropriate to share with your team members.`,
  },
  {
    id: 'intellectual-property',
    title: 'Intellectual Property',
    content: `Evols retains all rights, title, and interest in and to the Service, including all software, designs, text, graphics, and other content created by Evols. Nothing in these Terms grants you any right to use our trademarks, logos, or brand elements without our prior written consent. Open-source components of the Service are governed by their respective licenses.`,
  },
  {
    id: 'payment',
    title: 'Payment and Subscriptions',
    content: `Certain features of the Service require a paid subscription. By subscribing, you authorize us to charge your payment method on a recurring basis at the then-current subscription rate. All fees are non-refundable except as required by law or as explicitly stated in our refund policy. We reserve the right to change our pricing with reasonable advance notice. Failure to pay may result in suspension or termination of your access.`,
  },
  {
    id: 'disclaimer',
    title: 'Disclaimer of Warranties',
    content: `The Service is provided "as is" and "as available" without warranties of any kind, either express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement. We do not warrant that the Service will be uninterrupted, error-free, or free of viruses or other harmful components. You use the Service at your own risk.`,
  },
  {
    id: 'liability',
    title: 'Limitation of Liability',
    content: `To the maximum extent permitted by applicable law, Evols and its affiliates, officers, employees, and licensors shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, goodwill, or other intangible losses, arising out of or in connection with your use of the Service, even if we have been advised of the possibility of such damages. Our total liability to you for any claims arising from or related to the Service shall not exceed the amount you paid us in the twelve months preceding the claim, or $100, whichever is greater.`,
  },
  {
    id: 'termination',
    title: 'Termination',
    content: `We may suspend or terminate your access to the Service at any time, with or without cause or notice, including for violation of these Terms, non-payment, or conduct we determine to be harmful to other users or the Service. Upon termination, your right to use the Service ceases immediately. Provisions that by their nature should survive termination will survive, including ownership provisions, disclaimer of warranties, and limitation of liability.`,
  },
  {
    id: 'governing-law',
    title: 'Governing Law',
    content: `These Terms are governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law principles. Any disputes arising under these Terms shall be resolved exclusively in the state or federal courts located in Delaware, and you consent to personal jurisdiction in those courts.`,
  },
  {
    id: 'changes',
    title: 'Changes to These Terms',
    content: `We may update these Terms from time to time. When we make material changes, we will notify you by updating the "Last Updated" date at the top of this page and, where appropriate, by sending a notification to your registered email. Your continued use of the Service after changes take effect constitutes your acceptance of the revised Terms.`,
  },
  {
    id: 'contact',
    title: 'Contact',
    content: `If you have questions about these Terms, please contact us at legal@evols.ai.`,
  },
]

export default function Terms() {
  return (
    <>
      <Head>
        <title>Terms of Service | Evols AI</title>
        <meta name="description" content="Evols AI Terms of Service — the rules that govern your use of the Evols platform." />
      </Head>

      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/"><LogoWordmark iconSize={28} /></Link>
            <nav className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/acceptable-use" className="hover:text-foreground transition-colors">Acceptable Use</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-16">
          {/* Header */}
          <div className="mb-12">
            <p className="text-sm text-muted-foreground mb-3">Last updated: {LAST_UPDATED}</p>
            <h1 className="text-4xl font-medium text-foreground mb-4">Terms of Service</h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              These terms govern your use of Evols AI. Please read them carefully before using the Service.
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
                <p className="text-muted-foreground leading-relaxed">{s.content}</p>
              </section>
            ))}
          </div>

        </main>

        <Footer />
      </div>
    </>
  )
}
