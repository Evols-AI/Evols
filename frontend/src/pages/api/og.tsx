import { ImageResponse } from 'next/og'

export const config = { runtime: 'edge' }

export default function handler(req: Request) {
  const { searchParams } = new URL(req.url)
  const title = searchParams.get('title') ?? 'Evols AI'
  const description = searchParams.get('description') ?? 'The team AI brain for every AI session'

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: '#09090b',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Subtle grid background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        {/* Glow */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '700px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(139,92,246,0.15) 0%, transparent 70%)',
          }}
        />

        {/* Top: wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '18px',
              fontWeight: 700,
            }}
          >
            E
          </div>
          <span style={{ color: '#fff', fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em' }}>
            Evols AI
          </span>
        </div>

        {/* Middle: title + description */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', maxWidth: '900px' }}>
          <div
            style={{
              color: '#ffffff',
              fontSize: title.length > 50 ? '48px' : '58px',
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
            }}
          >
            {title}
          </div>
          {description && (
            <div
              style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: '22px',
                lineHeight: 1.4,
                letterSpacing: '-0.01em',
              }}
            >
              {description.length > 120 ? description.slice(0, 117) + '…' : description}
            </div>
          )}
        </div>

        {/* Bottom: tagline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#8b5cf6' }} />
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '16px', letterSpacing: '0.02em' }}>
            evols.ai
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
