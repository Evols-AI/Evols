import Head from 'next/head'
import Link from 'next/link'
import { useEffect } from 'react'
import { Sparkles, MessageSquare, CheckCircle } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { LogoWordmark } from '@/components/Logo'

declare global {
  interface Window {
    Cal: any
  }
}

export default function BookDemo() {
  const { theme } = useTheme()
  const dark = theme === 'dark'

  useEffect(() => {
    document.body.style.background = ''
    document.body.style.backgroundImage = 'none'
  }, [dark])

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (function (C: any, A: string, L: string) {
      let p = function (a: any, ar: any) { a.q.push(ar); };
      let d = C.document;
      C.Cal = C.Cal || function () {
        let cal = C.Cal;
        let ar = arguments;
        if (!cal.loaded) {
          cal.ns = {};
          cal.q = cal.q || [];
          d.head.appendChild(d.createElement("script")).src = A;
          cal.loaded = true;
        }
        if (ar[0] === L) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const api: any = function () { p(api, arguments); };
          const namespace = ar[1];
          api.q = api.q || [];
          if (typeof namespace === "string") {
            cal.ns[namespace] = cal.ns[namespace] || api;
            p(cal.ns[namespace], ar);
            p(cal, ["initNamespace", namespace]);
          } else p(cal, ar);
          return;
        }
        p(cal, ar);
      };
    })(window, "https://app.cal.com/embed/embed.js", "init");
    const initCal = () => {
      if (window.Cal) {
        window.Cal("init", "demo", { origin: "https://app.cal.com" });
        window.Cal.ns.demo("inline", {
          elementOrSelector: "#my-cal-inline",
          config: { layout: "month_view", useSlotsViewOnSmallScreen: "true" },
          calLink: "akshaysaraswat/demo",
        });
        window.Cal.ns.demo("ui", { hideEventTypeDetails: false, layout: "month_view" });
      }
    };
    setTimeout(initCal, 100);
  }, [])

  const textPrimary = 'text-foreground'
  const textMuted = 'text-muted-foreground'

  return (
    <>
      <Head>
        <title>Book a Demo - Evols</title>
        <style>{`h1,h2,h3,h4,h5,h6{font-family:'Syne',system-ui,sans-serif!important}`}</style>
      </Head>
      <div className={`min-h-screen transition-colors bg-background`}>
        <header className="container mx-auto px-6 py-8">
          <nav className="flex items-center justify-between">
            <Link href="/">
              <LogoWordmark iconSize={44} />
            </Link>
            <div className="flex items-center space-x-6">
              <Link href="/login" className={`text-sm transition-colors ${textMuted} hover:text-primary`}>Login</Link>
              <Link href="/register" className="bg-primary hover:bg-primary/85 text-primary-foreground py-2 px-5 rounded-lg text-sm font-medium transition-colors">
                Get Early Access
              </Link>
            </div>
          </nav>
        </header>

        <div className="container mx-auto px-6 py-12">
          <div className="w-full max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12">
              {/* Left - Info */}
              <div className="flex flex-col justify-center">
                <img
                  src="/Features Overview-amico.svg"
                  alt="Features overview illustration"
                  className="w-full max-w-md mx-auto mb-10 drop-shadow-lg"
                />
                <h1 className={`text-4xl md:text-5xl font-medium mb-6 ${textPrimary}`}>See Your AI PM Copilot in Action</h1>
                <p className={`text-xl mb-8 ${textMuted}`}>
                  Book a 30-minute personalized demo to see how an AI copilot can become your PM operating system.
                </p>
                <div className="space-y-6">
                  {[
                    { icon: Sparkles, color: 'text-primary', bg: 'bg-primary/10', title: '80+ PM Skills', desc: 'See conversational AI execute strategy docs, PRDs, meeting prep, and weekly updates' },
                    { icon: MessageSquare, color: 'text-primary', bg: 'bg-primary/10', title: 'Auto Work Context', desc: 'Watch AI automatically capture your role, projects, and tasks from natural conversation' },
                    { icon: CheckCircle, color: 'text-primary', bg: 'bg-primary/10', title: 'Bring Your Docs', desc: 'See how Evols extracts intelligence from your actual documents and meeting notes' },
                  ].map(({ icon: Icon, color, bg, title, desc }) => (
                    <div key={title} className="flex items-start space-x-4">
                      <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-5 h-5 ${color}`} />
                      </div>
                      <div>
                        <h3 className={`text-base font-medium mb-1 ${textPrimary}`}>{title}</h3>
                        <p className={`text-sm ${textMuted}`}>{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right - Calendar Embed */}
              <div className={`rounded-2xl border overflow-hidden bg-card border-border`}>
                <div
                  id="my-cal-inline"
                  style={{ width: '100%', height: '100%', overflow: 'auto' }}
                  className="min-h-[600px]"
                />
              </div>
            </div>
          </div>
        </div>

        <footer className={`border-t border-border py-12 transition-colors duration-300`}>
          <div className={`max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-muted-foreground`}>
            <LogoWordmark iconSize={32} />
            <div className="flex items-center gap-6 flex-wrap justify-center">
              <Link href="/docs" className="text-sm transition-colors duration-150 hover:text-primary">Docs</Link>
              <Link href="/support" className="text-sm transition-colors duration-150 hover:text-primary">Support</Link>
              <Link href="/register" className="text-sm transition-colors duration-150 hover:text-primary">Sign Up</Link>
            </div>
            <p className="text-xs">© 2026 Evols AI</p>
          </div>
        </footer>
      </div>
    </>
  )
}
