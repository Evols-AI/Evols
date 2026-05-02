/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Geist', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['"Instrument Serif"', 'Newsreader', 'ui-serif', 'Georgia', 'serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
        serif: ['"Instrument Serif"', 'Newsreader', 'Georgia', 'serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
        // Brand tokens — direct hex via CSS vars for the iris/mint pulse
        brand: {
          iris: "var(--brand-iris)",
          'iris-hover': "var(--brand-iris-hover)",
          'iris-press': "var(--brand-iris-press)",
          mint: "var(--brand-mint)",
          'mint-hover': "var(--brand-mint-hover)",
        },
      },
      backgroundImage: {
        pulse: 'var(--brand-pulse)',
        'pulse-soft': 'var(--brand-pulse-soft)',
        aurora: 'var(--aurora)',
      },
      boxShadow: {
        'elev-1': 'var(--elev-1)',
        'elev-2': 'var(--elev-2)',
        'elev-3': 'var(--elev-3)',
        'pulse-glow': '0 0 0 1px rgba(111,91,255,0.35), 0 8px 32px -8px rgba(111,91,255,0.45)',
      },
      backdropBlur: {
        glass: '20px',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        sm: "0.375rem",
        md: "0.5rem",
        lg: "0.75rem",
        xl: "0.875rem",
        '2xl': "1.125rem",
        '3xl': "1.5rem",
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1.1' }],
        '6xl': ['3.75rem', { lineHeight: '1.05' }],
        '7xl': ['4.5rem', { lineHeight: '1.04' }],
        '8xl': ['6rem', { lineHeight: '1.0' }],
      },
      transitionTimingFunction: {
        'evol-out':       'cubic-bezier(0.16, 1, 0.3, 1)',
        'evol-in-out':    'cubic-bezier(0.4, 0, 0.2, 1)',
        'evol-spring':    'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'evol-emphasize': 'cubic-bezier(0.2, 0, 0, 1)',
      },
      transitionDuration: {
        'micro': '120ms',
        'fast':  '180ms',
        'mod':   '360ms',
        'slow':  '600ms',
        'epic':  '900ms',
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "fade-up": {
          from: { opacity: 0, transform: "translateY(16px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        "pulse-slow": {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.4 },
        },
        "aurora-drift": {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%":      { transform: "translate3d(2%,1%,0) scale(1.04)" },
        },
        "thinking-pulse": {
          "0%, 100%": { opacity: "0.3" },
          "50%":      { opacity: "1" },
        },
        "score-fill": {
          "0%":   { width: "0%" },
          "100%": { width: "var(--target-width, 100%)" },
        },
        "halo-spin": {
          "0%":   { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        "fade-up":        "fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-in":        "fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "pulse-slow":     "pulse-slow 3s ease-in-out infinite",
        "aurora-drift":   "aurora-drift 28s ease-in-out infinite",
        "thinking-1":     "thinking-pulse 1.2s ease-in-out 0ms infinite",
        "thinking-2":     "thinking-pulse 1.2s ease-in-out 200ms infinite",
        "thinking-3":     "thinking-pulse 1.2s ease-in-out 400ms infinite",
        "score-fill":     "score-fill 600ms cubic-bezier(0.2, 0, 0, 1) forwards",
        "halo-spin":      "halo-spin 12s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
