/**
 * Ask Evols Dock
 * ──────────────
 * A small floating launcher pinned to the bottom-right of the viewport. Press
 * `⌘K` / `Ctrl+K` (or click) to open a composer; submit jumps to the Workbench
 * with the query pre-loaded as a URL param.
 *
 * The dock is hidden on routes where it would be redundant or in the way:
 *   - /login, /register, /auth/*
 *   - /admin-setup
 *   - /workbench (the chat surface itself)
 *
 * Single-color UI — uses the existing `.card`, primary/muted/border tokens.
 * No gradients.
 */

import { useEffect, useRef, useState, FormEvent } from 'react'
import { useRouter } from 'next/router'
import { Sparkles, ArrowUp, X } from 'lucide-react'
import clsx from 'clsx'
import { isAuthenticated } from '@/utils/auth'

const HIDDEN_ROUTES = ['/login', '/register', '/admin-setup', '/workbench']
const HIDDEN_PREFIXES = ['/auth/']

function isHidden(pathname: string): boolean {
  if (HIDDEN_ROUTES.includes(pathname)) return true
  return HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))
}

export default function AskEvolsDock() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Mount guard (avoid SSR/CSR mismatch on auth state)
  useEffect(() => {
    setMounted(true)
    setAuthed(isAuthenticated())
  }, [])

  // Re-check auth when route changes (login/logout)
  useEffect(() => {
    const handler = () => setAuthed(isAuthenticated())
    router.events.on('routeChangeComplete', handler)
    return () => router.events.off('routeChangeComplete', handler)
  }, [router.events])

  // ⌘K / Ctrl+K to open, Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (!isHidden(router.pathname) && authed) setOpen(true)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router.pathname, authed, open])

  // Focus the textarea whenever the composer opens
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  if (!mounted || !authed) return null
  if (isHidden(router.pathname)) return null

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const q = value.trim()
    if (!q) return
    setOpen(false)
    setValue('')
    router.push({ pathname: '/workbench', query: { q } })
  }

  return (
    <div className="ask-evols-dock-wrapper" aria-live="polite">
      {open ? (
        <form
          onSubmit={handleSubmit}
          className="card ask-evols-composer p-3"
          role="dialog"
          aria-label="Ask Evols"
        >
          <div className="flex items-start gap-2">
            <Sparkles
              className="w-4 h-4 mt-2 ml-1 text-primary flex-shrink-0"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <textarea
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e as unknown as FormEvent)
                }
              }}
              placeholder="Ask Evols anything…"
              rows={1}
              className={clsx(
                'flex-1 resize-none bg-transparent outline-none border-0',
                'text-sm text-foreground placeholder:text-muted-foreground/70',
                'py-1.5 px-1 max-h-32',
              )}
            />
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setValue('')
              }}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
            <button
              type="submit"
              disabled={!value.trim()}
              className={clsx(
                'p-1.5 rounded-md transition-colors',
                value.trim()
                  ? 'bg-primary text-primary-foreground hover:bg-primary/85'
                  : 'bg-muted text-muted-foreground/50 cursor-not-allowed',
              )}
              aria-label="Send"
            >
              <ArrowUp className="w-3.5 h-3.5" strokeWidth={2.25} />
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 px-1">
            <span className="text-[0.6875rem] text-muted-foreground/70">
              Opens in the Workbench
            </span>
            <span className="text-[0.6875rem] text-muted-foreground/70">
              ⏎ to send · ⇧⏎ for newline · Esc to close
            </span>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ask-evols-pill card"
          aria-label="Ask Evols (Ctrl+K)"
          title="Ask Evols (Ctrl+K)"
        >
          <Sparkles className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
          <span className="text-sm text-foreground">Ask Evols</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[0.6875rem] font-mono bg-muted text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      )}
    </div>
  )
}
