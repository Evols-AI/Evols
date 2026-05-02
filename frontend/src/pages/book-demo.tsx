import Head from 'next/head'
import { useEffect } from 'react'
import { Brain, GitMerge, Activity } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

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
          calLink: "evols/demo",
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
        <title>Book a demo · Evols</title>
      </Head>
      <div className={`min-h-screen transition-colors bg-background`}>
        <Header variant="landing" />

        <div className="container mx-auto px-6 py-12">
          <div className="w-full max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12">
              {/* Left - Info */}
              <div className="flex flex-col justify-center">
                <img
                  src="/book-demo.svg"
                  alt="Team collaboration illustration"
                  className="w-full max-w-md mx-auto mb-10 drop-shadow-lg"
                />
                <h1 className={`text-4xl md:text-5xl font-medium mb-6 ${textPrimary}`}>See the team AI brain in action</h1>
                <p className={`text-xl mb-8 ${textMuted}`}>
                  Book a 30-minute demo to see how Evols turns every AI session your team runs into shared, compounding intelligence.
                </p>
                <div className="space-y-6">
                  {[
                    { icon: GitMerge, color: 'text-primary', bg: 'bg-primary/10', title: 'Zero cold start', desc: 'Watch a new teammate inherit the full team knowledge graph on day one — no setup, no accumulation period' },
                    { icon: Brain, color: 'text-primary', bg: 'bg-primary/10', title: 'Auto-compiled knowledge base', desc: 'See every AI session contribute to a shared knowledge base automatically — queried at 8× fewer tokens than rebuilding' },
                    { icon: Activity, color: 'text-primary', bg: 'bg-primary/10', title: 'Quota visibility & redundancy prevention', desc: 'See duplicate work caught before tokens are burned, and expiring quota redirected to real backlog tasks' },
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

        <Footer />
      </div>
    </>
  )
}
