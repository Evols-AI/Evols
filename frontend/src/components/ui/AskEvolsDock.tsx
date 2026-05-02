/**
 * AskEvolsDock — context-aware floating AI affordance.
 *
 * Per the design language: "AI is chrome, not a feature."
 *
 * Anatomy:
 *   - Collapsed: pill, glass surface, gradient halo ring, bottom-right.
 *   - Expanded:  composer above content (z=80), focus-trapped textarea + send.
 *
 * Behavior:
 *   - Hidden on /workbench (the page IS the chat) and on auth/landing routes.
 *   - On submit, navigates to /workbench with the prompt as a query param so
 *     the existing iframe-based AI Workbench picks it up. This keeps wiring
 *     to existing functionality intact — the dock is an entry point, not a
 *     reimplementation of the chat surface.
 *   - ⌘K / Ctrl-K opens it from anywhere.
 *   - Esc closes it.
 *
 * Mobile:
 *   - Becomes a sticky bottom composer (full-width above the safe area).
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { Sparkles, ArrowUp, Command, X } from 'lucide-react'

const HIDDEN_ROUTES = ['/', '/login', '/register', '/book-demo', '/workbench']
const HIDDEN_PREFIXES = ['/blog', '/docs', '/auth', '/admin-setup']

interface AskEvolsDockProps {
  contextLabel?: string  // e.g. "Ask about this theme…" passed from the page
}

export function AskEvolsDock({ contextLabel }: AskEvolsDockProps) {
  const router = useRouter()
  const [open, setOpen]       = useState(false)
  const [value, setValue]     = useState('')
  const inputRef              = useRef<HTMLTextAreaElement>(null)

  const isHidden =
    HIDDEN_ROUTES.includes(router.pathname) ||
    HIDDEN_PREFIXES.some(p => router.pathname.startsWith(p))

  // ⌘K / Ctrl-K + Esc
  useEffect(() => {
    if (isHidden) return
    function onKey(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey
      if (isMod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isHidden, open])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  if (isHidden) return null

  const placeholder = contextLabel || 'Ask Evols anything…'

  function submit() {
    const q = value.trim()
    if (!q) return
    // Pass to /workbench via query so the chat surface can pick it up.
    router.push({ pathname: '/workbench', query: { q } })
    setOpen(false)
    setValue('')
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  // Collapsed pill
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[80] group hidden md:flex items-center gap-2 pl-3 pr-4 h-12 rounded-full glass shadow-elev-2 transition-transform duration-fast hover:-translate-y-0.5"
        style={{
          backgroundClip: 'padding-box',
        }}
        aria-label="Ask Evols (⌘K)"
      >
        {/* Halo ring */}
        <span
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background: 'var(--brand-pulse)',
            padding: 1,
            WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
        />
        <span className="grid place-items-center w-7 h-7 rounded-full text-white" style={{ background: 'var(--brand-pulse)' }}>
          <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />
        </span>
        <span className="text-sm font-medium text-foreground/90">Ask Evols</span>
        <span className="ml-1 hidden lg:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-muted-foreground bg-muted border border-border">
          <Command className="w-2.5 h-2.5" strokeWidth={2} />K
        </span>
      </button>
    )
  }

  // Expanded composer
  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 z-[79] bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-label="Ask Evols"
        className="fixed bottom-6 right-6 left-6 md:left-auto md:right-6 md:bottom-6 z-[80] md:w-[460px]"
      >
        <div className="relative rounded-2xl glass shadow-elev-3 animate-fade-up">
          {/* Halo ring */}
          <span
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{
              background: 'var(--brand-pulse)',
              padding: 1,
              WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
            }}
          />
          <div className="flex items-start gap-2 p-3">
            <span className="mt-1 grid place-items-center w-7 h-7 rounded-full text-white flex-shrink-0" style={{ background: 'var(--brand-pulse)' }}>
              <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />
            </span>
            <textarea
              ref={inputRef}
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              rows={2}
              className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none py-1"
              aria-label="Message Evols"
            />
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors duration-fast flex-shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
          <div className="flex items-center justify-between px-3 pb-3">
            <p className="text-[11px] text-muted-foreground">
              <kbd className="px-1 py-0.5 mx-0.5 rounded text-[10px] font-mono bg-muted border border-border">⏎</kbd>
              to send · <kbd className="px-1 py-0.5 mx-0.5 rounded text-[10px] font-mono bg-muted border border-border">Shift+⏎</kbd>
              for newline
            </p>
            <button
              onClick={submit}
              disabled={!value.trim()}
              className="grid place-items-center w-8 h-8 rounded-lg text-white disabled:opacity-40 disabled:cursor-not-allowed transition-transform duration-fast hover:-translate-y-px"
              style={{ background: 'var(--brand-pulse)' }}
              aria-label="Send"
            >
              <ArrowUp className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default AskEvolsDock
