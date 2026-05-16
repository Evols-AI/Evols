import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { Expletus_Sans } from 'next/font/google'
import { analytics, identifyUser, trackPage } from '@/lib/analytics'


const exletusSans = Expletus_Sans({
  weight: '500',
  subsets: ['latin'],
  variable: '--font-expletus-sans',
  display: 'swap',
})

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }))

  useEffect(() => {
    const timer = setTimeout(() => {
      const initAnalytics = () => {
        try {
          analytics.init()

          const token = localStorage.getItem('token')
          if (token) {
            const userData = localStorage.getItem('user')
            if (userData) {
              const user = JSON.parse(userData)
              identifyUser({
                id: user.user_id || user.id,
                email: user.email,
                tenant_id: user.tenant_id,
                role: user.role,
                full_name: user.full_name,
              })
            }
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Analytics initialization failed:', error)
          }
        }
      }

      if ('requestIdleCallback' in window) {
        requestIdleCallback(initAnalytics, { timeout: 5000 })
      } else {
        initAnalytics()
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY) {
      const handleRouteChange = (url: string) => {
        setTimeout(() => trackPage(url), 100)
      }

      router.events.on('routeChangeComplete', handleRouteChange)
      setTimeout(() => trackPage(router.pathname), 3000)

      return () => {
        router.events.off('routeChangeComplete', handleRouteChange)
      }
    }
  }, [router])

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className={`${exletusSans.variable}`}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <Component {...pageProps} />
          </ThemeProvider>
        </QueryClientProvider>
      </div>
    </>
  )
}
