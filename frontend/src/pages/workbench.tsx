/**
 * Workbench — LibreChat iframe shell
 *
 * Renders the Evols header + a full-height LibreChat iframe.
 * Silent auth flow:
 *   1. This page calls POST /api/v1/oidc/one-time-token with the user's JWT
 *   2. Receives a 30-second single-use token
 *   3. Passes it to LibreChat as /workbench/app/?ott=<token>
 *   4. The LibreChat fork exchanges it on load — user never sees a login screen
 *
 * Theme sync:
 *   - On mount and whenever Evols theme changes, posts a message to the iframe
 *   - The LibreChat fork listens and applies the matching class
 */

import Head from 'next/head'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { isAuthenticated } from '@/utils/auth'
import { apiClient } from '@/services/api'
import Header from '@/components/Header'
import { Loading } from '@/components/PageContainer'
import { useTheme } from '@/contexts/ThemeContext'

export default function Workbench() {
  const router = useRouter()
  const { theme } = useTheme()
  const [user, setUser] = useState<{ full_name?: string; email?: string } | null>(null)
  const [iframeSrc, setIframeSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

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
      return
    }

    async function mintToken() {
      try {
        const res = await apiClient.post('/api/v1/oidc/one-time-token', {})
        const { token } = res.data
        // Exchange the OTT from the top-level frame (not inside the iframe) so the
        // auth cookie is set on evols.ai before the iframe loads — eliminates the
        // race condition where the iframe redirects before the cookie is persisted.
        await fetch(`/workbench/app/api/auth/evols-ott?ott=${encodeURIComponent(token)}`, {
          credentials: 'include',
          redirect: 'follow',
        })
        setIframeSrc('/workbench/app/')
      } catch (e) {
        console.error('Failed to mint one-time token', e)
        setError('Could not load the Workbench. Please refresh the page.')
      }
    }

    mintToken()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Theme sync — tell the iframe whenever theme changes ───────────────────
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const iframeOrigin = process.env.NEXT_PUBLIC_LIBRECHAT_URL || window.location.origin

    const sendTheme = () => {
      iframe.contentWindow?.postMessage(
        { type: 'evols:theme', theme },
        iframeOrigin
      )
    }

    // Send once iframe loads, then on every change
    iframe.addEventListener('load', sendTheme)
    sendTheme()
    return () => iframe.removeEventListener('load', sendTheme)
  }, [theme, iframeSrc])

  // ── Open settings tab if requested via query param ────────────────────────
  useEffect(() => {
    const settingsTab = router.query.openSettings as string | undefined
    if (!settingsTab || !iframeSrc) return

    const iframe = iframeRef.current
    if (!iframe) return

    const iframeOrigin = process.env.NEXT_PUBLIC_LIBRECHAT_URL || window.location.origin

    const sendOpenSettings = () => {
      iframe.contentWindow?.postMessage(
        { type: 'evols:openSettings', tab: settingsTab },
        iframeOrigin
      )
    }

    iframe.addEventListener('load', sendOpenSettings)
    return () => iframe.removeEventListener('load', sendOpenSettings)
  }, [router.query.openSettings, iframeSrc])

  return (
    <>
      <Head><title>Workbench — Evols</title></Head>
      <div className="flex flex-col" style={{ height: '100vh', background: 'hsl(var(--background))' }}>
        <Header user={user} currentPage="workbench" />

        <div className="flex-1 relative overflow-hidden">
          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-8">
                <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="btn-secondary"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {!error && !iframeSrc && (
            <div className="flex items-center justify-center h-full">
              <Loading text="Loading Workbench…" />
            </div>
          )}

          {iframeSrc && (
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
