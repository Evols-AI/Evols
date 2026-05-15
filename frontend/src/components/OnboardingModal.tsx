import { useState } from 'react'
import { X } from 'lucide-react'

const STORAGE_KEY = 'evols_onboarding_dismissed'

interface OnboardingModalProps {
  onClose: () => void
}

export default function OnboardingModal({ onClose }: OnboardingModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false)

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, 'true')
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl max-w-3xl w-full shadow-xl border border-border flex flex-col">
        <div className="flex items-center justify-end px-4 pt-4">
          <button
            onClick={handleClose}
            className="p-2 hover:bg-muted rounded-lg transition text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-6">
          <div style={{ position: 'relative', paddingBottom: 'calc(59% + 41px)', height: 0, width: '100%' }}>
            <iframe
              src="https://demo.arcade.software/lZQbjF6HsletKGKInPtt?embed&embed_mobile=tab&embed_desktop=inline"
              title="Getting started with Evols AI"
              frameBorder="0"
              loading="lazy"
              allowFullScreen
              allow="clipboard-write"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                colorScheme: 'light',
                borderRadius: '8px',
              }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded border-border accent-primary"
            />
            Don't show this again
          </label>
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-lg transition"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}

export function shouldShowOnboarding(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(STORAGE_KEY) !== 'true'
}
