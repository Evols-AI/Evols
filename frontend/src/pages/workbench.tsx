/**
 * Workbench — LibreChat iframe shell
 *
 * In production, this page renders the Evols header + a full-height LibreChat iframe.
 * Silent auth flow:
 *   1. POST /api/v1/oidc/one-time-token with the user's JWT
 *   2. Receive a 30-second single-use token
 *   3. Pass it to LibreChat as /workbench/app/?ott=<token>
 *   4. The LibreChat fork exchanges it on load — user never sees a login screen
 *
 * Theme sync:
 *   - On mount and whenever Evols theme changes, posts a message to the iframe
 *   - The LibreChat fork listens and applies the matching class
 *
 * Empty state:
 *   - If the LibreChat fork isn't reachable (local design-review setup, or a
 *     misconfigured production deploy), we render a beautiful empty state with
 *     the halo logomark instead of a 404 inside the iframe.
 */

import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { Sparkles, ExternalLink, Settings, RefreshCw } from 'lucide-react'
import { isAuthenticated } from '@/utils/auth'
import { apiClient } from '@/services/api'
import Header from '@/components/Header'
import { Loading } from '@/components/PageContainer'
import { LogoIcon } from '@/components/Logo'
import { useTheme } from '@/contexts/ThemeContext'

type Status = 'pending' | 'ready' | 'unavailable' | 'error'

export default function Workbench() {
  const router                = useRouter()
  const { theme }             = useTheme()
  const [user, setUser]       = useState<{ full_name?: string; email?: string } | null>(null)
  const [iframeSrc, setIframeSrc] = useState<string | null>(null)
  const [status, setStatus]   = useState<Status>('pending')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const iframeRef             = useRef<HTMLIFrameElement>(null)

  // ── Auth guard + resolve iframe URL ───────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }

    const stored = localStorage.getItem('user')
    if (stored) setUser(JSON.parse(stored))

    const devUrl = process.env.NEXT_PUBLIC_LIBRECHAT_URL
    if (devUrl) {
      setIframeSrc(`${devUrl}/c/new`)
      setStatus('ready')
      return
    }

    async function mintToken() {
      try {
        const res = await apiClient.post('/api/v1/oidc/one-time-token', {})
        const { token } = res.data

        // Probe the proxy. If nginx isn't fronting LibreChat at /workbench/app,
        // we'll get a 404 from Next.js itself — show the empty state instead of
        // letting the iframe render a meaningless 404.
        const probe = await fetch(
          `/workbench/app/api/auth/evols-ott?ott=${encodeURIComponent(token)}`,
          { credentials: 'include', redirect: 'follow' }
        )

        if (!probe.ok || probe.url.includes('/_next/') || probe.headers.get('content-type')?.includes('text/html')) {
          // The proxy isn't forwarding — Next.js 404 came back instead.
          setStatus('unavailable')
          return
        }

        setIframeSrc('/workbench/app/')
        setStatus('ready')
      } catch (e: any) {
        // OIDC route 404 → backend doesn't have OIDC enabled, or LibreChat just isn't there.
        if (e?.response?.status === 404 || e?.code === 'ERR_NETWORK') {
          setStatus('unavailable')
        } else {
          console.error('Failed to mint one-time token', e)
          setErrorMessage('Could not load the Workbench. Please refresh the page.')
          setStatus('error')
        }
      }
    }

    mintToken()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Theme sync — tell the iframe whenever theme changes ───────────────────
  useEffect(() => {
    if (status !== 'ready') return
    const iframe = iframeRef.current
    if (!iframe) return

    const iframeOrigin = process.env.NEXT_PUBLIC_LIBRECHAT_URL || window.location.origin

    const sendTheme = () => {
      iframe.contentWindow?.postMessage({ type: 'evols:theme', theme }, iframeOrigin)
    }

    iframe.addEventListener('load', sendTheme)
    sendTheme()
    return () => iframe.removeEventListener('load', sendTheme)
  }, [theme, iframeSrc, status])

  // ── Open settings tab if requested via query param ────────────────────────
  useEffect(() => {
    const settingsTab = router.query.openSettings as string | undefined
    if (!settingsTab || !iframeSrc || status !== 'ready') return

    const iframe = iframeRef.current
    if (!iframe) return

    const iframeOrigin = process.env.NEXT_PUBLIC_LIBRECHAT_URL || window.location.origin

    const sendOpenSettings = () => {
      iframe.contentWindow?.postMessage({ type: 'evols:openSettings', tab: settingsTab }, iframeOrigin)
    }

    iframe.addEventListener('load', sendOpenSettings)
    return () => iframe.removeEventListener('load', sendOpenSettings)
  }, [router.query.openSettings, iframeSrc, status])

  return (
    <>
      <Head><title>Workbench · Evols</title></Head>

      <div className="aurora-bg flex flex-col" style={{ height: '100vh' }}>
        <Header user={user} currentPage="workbench" />

        <div className="flex-1 relative overflow-hidden">
          {status === 'pending' && (
            <div className="flex items-center justify-center h-full">
              <Loading text="Loading Workbench…" />
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-center justify-center h-full px-6">
              <div className="text-center max-w-md">
                <p className="text-destructive mb-4">{errorMessage}</p>
                <button onClick={() => window.location.reload()} className="btn-secondary">
                  <RefreshCw className="w-4 h-4" strokeWidth={1.75} />
                  Retry
                </button>
              </div>
            </div>
          )}

          {status === 'unavailable' && <WorkbenchUnavailable />}

          {status === 'ready' && iframeSrc && (
            <iframe
              ref={iframeRef}
              src={iframeSrc}
              className="absolute inset-0 w-full h-full border-0"
              allow="clipboard-read; clipboard-write; microphone"
              title="Evols AI Workbench"
            />
          )}
        </div>
      </div>
    </>
  )
}

/* ────────────────────────────────────────────────────────────
   Empty state — shown when the LibreChat fork isn't deployed
   ──────────────────────────────────────────────────────────── */

function WorkbenchUnavailable() {
  return (
    <div className="relative h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        {/* Halo aperture */}
        <div className="flex justify-center mb-8">
          <div className="grid place-items-center w-20 h-20 rounded-full halo-ring">
            <LogoIcon size={44} variant="pulse" strokeWidth={2} />
          </div>
        </div>

        <h1
          className="font-display text-4xl md:text-5xl text-foreground mb-4"
          style={{ fontStyle: 'italic', letterSpacing: '-0.025em', lineHeight: 1.06 }}
        >
          The Workbench is{' '}
          <span className="text-pulse" style={{ fontStyle: 'italic' }}>
            still warming up.
          </span>
        </h1>

        <p className="text-base md:text-lg text-muted-foreground/90 leading-relaxed mb-10 max-w-lg mx-auto">
          The chat surface (a LibreChat fork branded as the Evols AI Workbench) runs
          as a separate service. It isn't deployed in this environment — but every
          other surface in Evols is fully functional.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 mb-10">
          <Link href="/work-context" className="card card-hover p-5 text-left group">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="w-4 h-4 text-primary" strokeWidth={1.75} />
              <span className="text-sm font-medium text-foreground">Work Context</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Today's situation, projects, decisions, weekly focus.
            </p>
          </Link>

          <Link href="/context" className="card card-hover p-5 text-left">
            <div className="flex items-center gap-2 mb-1.5">
              <Settings className="w-4 h-4 text-primary" strokeWidth={1.75} />
              <span className="text-sm font-medium text-foreground">Knowledge</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The team graph + strategy editor.
            </p>
          </Link>
        </div>

        <details className="text-left rounded-xl border border-border bg-card/60 backdrop-blur-sm p-4">
          <summary className="cursor-pointer text-sm font-medium text-foreground inline-flex items-center gap-1.5 select-none">
            <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} />
            How to enable the Workbench
          </summary>
          <div className="mt-3 text-sm text-muted-foreground space-y-2 leading-relaxed">
            <p>
              The Workbench is a fork of <a href="https://github.com/danny-avila/LibreChat" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">LibreChat</a> that
              authenticates via Evols' OIDC bridge and proxies all LLM calls through your tenant's BYOK keys.
            </p>
            <p>
              In production, an nginx reverse proxy in front of Evols routes <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">/workbench/app/*</code>{' '}
              to the LibreChat container.
            </p>
            <p>
              For local development, set <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">NEXT_PUBLIC_LIBRECHAT_URL</code> in <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">frontend/.env.local</code> to your
              running LibreChat instance (typically <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">http://localhost:3080</code>).
            </p>
          </div>
        </details>
      </div>
    </div>
  )
}
