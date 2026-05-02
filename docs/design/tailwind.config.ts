/**
 * Evols Tailwind config — drop-in replacement for frontend/tailwind.config.ts
 *
 * Wires our CSS tokens into Tailwind utilities so Claude Code can write
 * `bg-bg-raised`, `text-brand-iris`, `border-border-default`, etc.
 *
 * Tokens live in styles/tokens.css and are imported in app/globals.css.
 */

import type { Config } from "tailwindcss";
import animatePlugin from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class", "[data-theme='dark']"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", sm: "1.5rem", lg: "2rem" },
      screens: { "2xl": "1280px" },
    },
    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      colors: {
        // Surfaces
        bg: {
          base:    "var(--bg-base)",
          raised:  "var(--bg-raised)",
          overlay: "var(--bg-overlay)",
          subtle:  "var(--bg-subtle)",
          inverse: "var(--bg-inverse)",
        },
        // Borders
        border: {
          DEFAULT: "var(--border-default)",
          subtle:  "var(--border-subtle)",
          strong:  "var(--border-strong)",
        },
        // Text
        text: {
          primary:   "var(--text-primary)",
          secondary: "var(--text-secondary)",
          tertiary:  "var(--text-tertiary)",
          disabled:  "var(--text-disabled)",
          inverse:   "var(--text-inverse)",
        },
        // Brand
        brand: {
          iris:      "var(--brand-iris)",
          "iris-hover": "var(--brand-iris-hover)",
          "iris-press": "var(--brand-iris-press)",
          mint:      "var(--brand-mint)",
          "mint-hover": "var(--brand-mint-hover)",
        },
        // Semantic
        success: { DEFAULT: "var(--success)", bg: "var(--success-bg)" },
        warning: { DEFAULT: "var(--warning)", bg: "var(--warning-bg)" },
        danger:  { DEFAULT: "var(--danger)",  bg: "var(--danger-bg)"  },
        info:    { DEFAULT: "var(--info)",    bg: "var(--info-bg)"    },

        // shadcn compatibility shims — map to our tokens
        background: "var(--bg-base)",
        foreground: "var(--text-primary)",
        card:       { DEFAULT: "var(--bg-raised)",  foreground: "var(--text-primary)"   },
        popover:    { DEFAULT: "var(--bg-overlay)", foreground: "var(--text-primary)"   },
        primary:    { DEFAULT: "var(--brand-iris)", foreground: "var(--text-inverse)"   },
        secondary:  { DEFAULT: "var(--bg-subtle)",  foreground: "var(--text-primary)"   },
        muted:      { DEFAULT: "var(--bg-subtle)",  foreground: "var(--text-secondary)" },
        accent:     { DEFAULT: "var(--brand-mint)", foreground: "var(--text-inverse)"   },
        destructive:{ DEFAULT: "var(--danger)",     foreground: "var(--text-inverse)"   },
        input:      "var(--border-default)",
        ring:       "var(--ring)",
      },
      borderRadius: {
        sm:  "var(--radius-sm)",
        md:  "var(--radius-md)",
        lg:  "var(--radius-lg)",
        xl:  "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
      },
      fontFamily: {
        sans:    ["var(--font-sans)",    "ui-sans-serif", "system-ui", "sans-serif"],
        mono:    ["var(--font-mono)",    "ui-monospace", "monospace"],
        display: ["var(--font-display)", "ui-serif", "serif"],
      },
      fontSize: {
        // [size, line-height, letterSpacing]
        "display-2xl": ["4rem",    { lineHeight: "4.5rem",  letterSpacing: "-0.03em"  }],
        "display-xl":  ["3rem",    { lineHeight: "3.5rem",  letterSpacing: "-0.025em" }],
        h1:    ["2rem",     { lineHeight: "2.5rem",  letterSpacing: "-0.02em"  }],
        h2:    ["1.5rem",   { lineHeight: "2rem",    letterSpacing: "-0.015em" }],
        h3:    ["1.125rem", { lineHeight: "1.625rem",letterSpacing: "-0.01em"  }],
        h4:    ["0.9375rem",{ lineHeight: "1.375rem",letterSpacing: "-0.005em" }],
        "body-lg":  ["1rem",     { lineHeight: "1.625rem" }],
        body:       ["0.875rem", { lineHeight: "1.375rem" }],
        "body-sm":  ["0.8125rem",{ lineHeight: "1.25rem"  }],
        caption:    ["0.75rem",  { lineHeight: "1.125rem", letterSpacing: "0.005em" }],
        overline:   ["0.6875rem",{ lineHeight: "1rem",     letterSpacing: "0.08em"  }],
        "mono-sm":  ["0.8125rem",{ lineHeight: "1.25rem", fontFamily: "var(--font-mono)" }],
      },
      fontWeight: {
        normal: "400",
        medium: "500",
        semibold: "600", // reserved for very rare data-emphasis only
      },
      backgroundImage: {
        pulse:  "var(--brand-pulse)",
        aurora: "var(--aurora)",
      },
      boxShadow: {
        "elev-1": "var(--elev-1)",
        "elev-2": "var(--elev-2)",
        "elev-3": "var(--elev-3)",
      },
      backdropBlur: {
        glass: "20px",
      },
      transitionTimingFunction: {
        out:       "cubic-bezier(0.16, 1, 0.3, 1)",
        "in-out":  "cubic-bezier(0.4, 0, 0.2, 1)",
        spring:    "cubic-bezier(0.34, 1.56, 0.64, 1)",
        emphasize: "cubic-bezier(0.2, 0, 0, 1)",
      },
      transitionDuration: {
        micro: "120ms",
        fast:  "180ms",
        base:  "240ms",
        mod:   "360ms",
        slow:  "600ms",
        epic:  "900ms",
      },
      keyframes: {
        "aurora-drift": {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%":      { transform: "translate3d(2%,1%,0) scale(1.04)" },
        },
        "stream-pass": {
          "0%":   { transform: "scaleX(0)", opacity: "0" },
          "40%":  { opacity: "1" },
          "100%": { transform: "scaleX(1)", opacity: "0" },
        },
        "thinking-pulse": {
          "0%, 100%": { opacity: "0.3" },
          "50%":      { opacity: "1" },
        },
        "score-fill": {
          "0%":   { width: "0%" },
          "100%": { width: "var(--target-width, 100%)" },
        },
      },
      animation: {
        "aurora-drift":   "aurora-drift 28s ease-in-out infinite",
        "stream-pass":    "stream-pass 600ms cubic-bezier(0.16, 1, 0.3, 1)",
        "thinking-pulse-1": "thinking-pulse 1.2s ease-in-out 0ms infinite",
        "thinking-pulse-2": "thinking-pulse 1.2s ease-in-out 200ms infinite",
        "thinking-pulse-3": "thinking-pulse 1.2s ease-in-out 400ms infinite",
        "score-fill":     "score-fill 600ms cubic-bezier(0.2, 0, 0, 1) forwards",
      },
      zIndex: {
        topbar:   "10",
        sidebar:  "20",
        dropdown: "30",
        popover:  "40",
        scrim:    "50",
        modal:    "51",
        toast:    "60",
        cmdk:     "70",
        dock:     "80",
      },
    },
  },
  plugins: [animatePlugin],
};

export default config;
