import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { Courgette } from 'next/font/google'

const courgette = Courgette({ 
  weight: '400', 
  subsets: ['latin'], 
  variable: '--font-courgette',
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
    <div className={`${courgette.variable}`}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <Component {...pageProps} />
        </ThemeProvider>
      </QueryClientProvider>
    </div>
  )
}
