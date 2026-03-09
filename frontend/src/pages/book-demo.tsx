import Head from 'next/head'
import Link from 'next/link'
import { useEffect } from 'react'
import { Sparkles, MessageSquare, CheckCircle } from 'lucide-react'
import { LogoIcon } from '@/components/Logo'

declare global {
  interface Window {
    Cal: any
  }
}

export default function BookDemo() {
  useEffect(() => {
    // Cal.com inline embed initialization
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

    // Wait for Cal to be loaded, then initialize
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

    // Try to initialize, or wait for script to load
    setTimeout(initCal, 100);
  }, [])

  return (
    <>
      <Head>
        <title>Book a Demo - Evols</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-violet-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
        {/* Header */}
        <header className="container mx-auto px-6 py-8">
          <nav className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <LogoIcon size={60} />
              <span className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">Evols</span>
            </Link>
            <div className="flex items-center space-x-6">
              <Link href="/login" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Login</Link>
              <Link href="/register" className="bg-gradient-to-r from-purple-400 to-blue-500 hover:from-pink-500 hover:to-purple-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transform transition-all duration-500 ease-in-out hover:scale-110 hover:brightness-110 hover:animate-pulse active:animate-bounce">
                Get Started
              </Link>
            </div>
          </nav>
        </header>

        <div className="container mx-auto px-6 py-12">
          <div className="w-full max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12">
              {/* Left - Info */}
              <div className="flex flex-col justify-center">
                <svg viewBox="0 0 400 300" className="w-full max-w-md mx-auto mb-10 drop-shadow-lg">
                  <defs>
                    <linearGradient id="calPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                    <linearGradient id="calSecondary" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ec4899" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                    <filter id="calGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="8" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                    <filter id="badgeShadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.2" />
                    </filter>
                  </defs>

                  {/* Background Element */}
                  <circle cx="200" cy="150" r="110" fill="url(#calSecondary)" opacity="0.1" filter="url(#calGlow)">
                    <animate attributeName="r" values="100;110;100" dur="4s" repeatCount="indefinite" />
                  </circle>

                  {/* Floating Elements (Background) */}
                  <path d="M70,100 L90,120 L70,140 Z" fill="#3b82f6" opacity="0.4" transform="rotate(15 80 120)">
                    <animateTransform attributeName="transform" type="translate" values="0,0; 0,-15; 0,0" dur="4s" repeatCount="indefinite" additive="sum" />
                  </path>
                  <circle cx="330" cy="80" r="14" fill="#ec4899" opacity="0.5">
                    <animateTransform attributeName="transform" type="translate" values="0,0; -10,10; 0,0" dur="5s" repeatCount="indefinite" />
                  </circle>

                  {/* Main Calendar Base */}
                  <rect x="110" y="80" width="180" height="160" rx="16" fill="white" className="dark:fill-gray-800" stroke="url(#calPrimary)" strokeWidth="4" />
                  <rect x="110" y="80" width="180" height="45" rx="12" fill="url(#calPrimary)" />

                  {/* Calendar Rings */}
                  <rect x="140" y="60" width="14" height="34" rx="7" fill="#ec4899" />
                  <rect x="140" y="65" width="14" height="24" rx="7" fill="white" opacity="0.6" />
                  <rect x="246" y="60" width="14" height="34" rx="7" fill="#ec4899" />
                  <rect x="246" y="65" width="14" height="24" rx="7" fill="white" opacity="0.6" />

                  {/* Calendar Grid */}
                  <g opacity="0.5" className="dark:opacity-30" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="130" y1="145" x2="160" y2="145" />
                    <line x1="175" y1="145" x2="205" y2="145" />
                    <line x1="220" y1="145" x2="250" y2="145" />
                    <line x1="265" y1="145" x2="280" y2="145" />

                    <line x1="130" y1="175" x2="160" y2="175" />
                    <line x1="175" y1="175" x2="205" y2="175" />
                    <line x1="220" y1="175" x2="250" y2="175" />
                    <line x1="265" y1="175" x2="280" y2="175" />

                    <line x1="130" y1="205" x2="160" y2="205" />
                    <line x1="175" y1="205" x2="205" y2="205" />
                    <line x1="220" y1="205" x2="250" y2="205" />
                    <line x1="265" y1="205" x2="280" y2="205" />
                  </g>

                  {/* Selected Date Highlight */}
                  <rect x="170" y="163" width="40" height="24" rx="8" fill="url(#calPrimary)" opacity="0.2" />
                  <rect x="170" y="163" width="40" height="24" rx="8" stroke="url(#calPrimary)" strokeWidth="2" fill="none" />

                  {/* Floating Chat Bubble */}
                  <g filter="url(#calGlow)" transform="translate(15, -10)">
                    <path d="M 230 190 Q 230 160 260 160 L 300 160 Q 330 160 330 190 L 330 220 Q 330 250 300 250 L 270 250 L 240 270 L 250 240 Q 230 220 230 190 Z" fill="url(#calSecondary)" />
                    <circle cx="260" cy="205" r="5" fill="white" />
                    <circle cx="280" cy="205" r="5" fill="white" />
                    <circle cx="300" cy="205" r="5" fill="white" />
                    <animateTransform attributeName="transform" type="translate" values="15,-10; 15,-18; 15,-10" dur="3s" repeatCount="indefinite" />
                  </g>

                  {/* Checkmark Badge */}
                  <g transform="translate(85, 180)">
                    <circle cx="24" cy="24" r="24" fill="#10b981" filter="url(#badgeShadow)" />
                    <path d="M 15 24 L 21 30 L 33 18" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    <animateTransform attributeName="transform" type="translate" values="85,180; 85,175; 85,180" dur="4s" repeatCount="indefinite" />
                  </g>
                </svg>
                <h1 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-white">See Evols in Action</h1>
                <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
                  Book a 30-minute personalized demo to see how Evols can transform your product decision-making.
                </p>
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1 text-gray-900 dark:text-white">AI-Powered Insights</h3>
                      <p className="text-gray-600 dark:text-gray-400">See how AI clustering and digital twin personas work with your data</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1 text-gray-900 dark:text-white">Tailored to Your Needs</h3>
                      <p className="text-gray-600 dark:text-gray-400">We'll customize the demo based on your specific use case and goals</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1 text-gray-900 dark:text-white">No Pressure</h3>
                      <p className="text-gray-600 dark:text-gray-400">Just a friendly conversation about how we can help you make better product decisions</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right - Calendar Embed */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
                <div
                  id="my-cal-inline"
                  style={{ width: '100%', height: '100%', overflow: 'auto' }}
                  className="min-h-[600px]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="container mx-auto px-6 py-12 text-center text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 mt-12">
          <p>© 2026 Evols. Evolve your product roadmap.</p>
        </footer>
      </div>
    </>
  )
}
