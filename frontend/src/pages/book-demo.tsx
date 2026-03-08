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
                <svg viewBox="0 0 300 300" className="w-full max-w-sm mx-auto mb-8 drop-shadow-lg">
                  <defs>
                    <linearGradient id="calGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style={{stopColor:'#6366f1',stopOpacity:1}} />
                      <stop offset="100%" style={{stopColor:'#8b5cf6',stopOpacity:1}} />
                    </linearGradient>
                  </defs>
                  <rect x="60" y="60" width="180" height="200" rx="8" fill="url(#calGrad)" opacity="0.9"/>
                  <rect x="60" y="60" width="180" height="40" rx="8" fill="white" opacity="0.2"/>
                  <rect x="80" y="45" width="20" height="30" rx="4" fill="url(#calGrad)"/>
                  <rect x="200" y="45" width="20" height="30" rx="4" fill="url(#calGrad)"/>
                  {[0,1,2,3].map(row => [0,1,2,3].map(col => (
                    <rect key={`${row}-${col}`} x={85 + col * 40} y={120 + row * 30} width="30" height="20" rx="3" fill="white" opacity="0.3"/>
                  )))}
                  <rect x="85" y="210" width="30" height="20" rx="3" fill="#10b981"/>
                  <circle cx="260" cy="220" r="25" fill="#10b981"/>
                  <path d="M 250 220 L 257 227 L 270 212" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round"/>
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
