import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { Expletus_Sans } from 'next/font/google'

const exletusSans = Expletus_Sans({
  weight: '500',
  subsets: ['latin'],
  variable: '--font-expletus-sans',
  display: 'swap',
})

export default function App({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute, refetchOnWindowFocus: false,
      },
    },
  }))

  return (
    <div className={`${exletusSans.variable}`}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <Component {...pageProps} />
        </ThemeProvider>
      </QueryClientProvider>
    </div>
  )
}
