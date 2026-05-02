# Evols — Design Handoff v1.0

> **For:** Claude Code (and any human collaborator).
> **Goal:** Replace the current fragmented UI with a single, opinionated, AI-first B2B SaaS design language. Dark-first, light-parity, mobile + desktop.
> **Stack assumed:** Next.js 14 (App Router) · React 18 · Tailwind CSS · shadcn/ui · Radix UI · Framer Motion · Recharts · D3.js · `next/font`.
> **Reference inspiration:** kore.ai (gradient meshes, glassy panels, conversational chrome), Linear (information density), Vercel/Geist (typography rigor), Arc Browser (motion expressiveness).

---

## 0. North star

### 0.1 Mission of the design system

Make Evols feel like *a calm, expensive, AI-native instrument*. The product is "your team's AI brain" — the UI should literally feel like thought taking shape: layered, luminous, responsive, never noisy.

### 0.2 Three design rules

1. **AI is chrome, not a feature.** Every screen has a conversational affordance. The AI is never a separate place you go — it's the connective tissue.
2. **Calm density.** Show a lot, but layer it with hierarchy and air. Density without anxiety. Borrow Linear's information rigor, kore.ai's atmosphere.
3. **Motion = meaning.** Movement narrates state changes (streaming, thinking, syncing, scoring). It is never decorative. Every animation has a job.

### 0.3 Voice for UI copy

- Crisp, declarative, second-person.
- "Drop a meeting. We'll wire it into the graph." — not "Upload your meeting transcript to add it to the knowledge graph."
- Empty states give one verb and one promise.
- No emojis in product chrome. Emojis fine in user-generated content only.

---

## 1. Brand identity (proposed)

### 1.1 Name interpretation
**Evols** ≈ *evolves*. Momentum, learning, intelligence accreting. The system gets smarter with you.

### 1.2 Logomark — "the aperture"
A halo torus. Read as: an "o" / an eye / a pulse / a synapse loop. Stroked, not filled. Inside the torus, a thin arc traces from upper-left to lower-right — that's the *thought-line*.

```
  ╭─────╮
 ╱   ╲    ╲
│  ◜  ◝   │       ← halo
 ╲   ╱   ╱
  ╰─────╯
```

- Single-color version: `--brand-primary` on transparent.
- Pulse version: gradient-stroked from `--brand-iris` → `--brand-mint`. Used in marketing, login, splash, and the AI Workbench launcher.
- Min size 16px (favicon mark only). Min size 24px when paired with wordmark.

### 1.3 Wordmark
Lowercase `evols` in **Geist Sans**, weight 500, tracking `-0.02em`. Optical kerning preserved. The "o" letter aligns optically with the halo when paired.

### 1.4 Color story
A duotone pulse — **Iris violet → Mint teal** — laid over deep ink. Iris carries trust + intelligence. Mint carries activation, freshness, "alive." The gradient between them is *the* brand signature, used sparingly: brand mark, primary CTA fills on hover, AI streaming indicators, and selected state on the most important elements.

Avoid using the gradient on text below 24px. Avoid more than one gradient surface per viewport.

---

## 2. Design tokens — the source of truth

All values below ship as CSS custom properties (see `tokens.css`) and Tailwind theme extensions (see `tailwind.config.ts`). **Code references tokens, never raw values.**

### 2.1 Color — dark theme (default)

| Token | Hex | Usage |
|---|---|---|
| `--bg-base` | `#07080F` | Page background, behind everything |
| `--bg-raised` | `#0E1020` | Cards, panels, sheet bodies |
| `--bg-overlay` | `#161A2E` | Modals, dropdowns, command palette |
| `--bg-subtle` | `#1B1F36` | Chips, hover wash, sidebar item rest |
| `--bg-inverse` | `#F4F5FA` | Light pills/buttons against dark |
| `--border-subtle` | `#1F2240` | Default divider |
| `--border-default` | `#2A2F4F` | Card outline, input rest |
| `--border-strong` | `#3A4070` | Input focus ring base, hover divider |
| `--text-primary` | `#F4F5FA` | Body and headings |
| `--text-secondary` | `#A8AEC9` | Supporting copy, labels |
| `--text-tertiary` | `#6E7596` | Hints, timestamps, disabled labels |
| `--text-disabled` | `#4B526E` | Disabled UI text |
| `--brand-iris` | `#6F5BFF` | Primary brand, primary CTA, links |
| `--brand-iris-hover` | `#8474FF` | Primary CTA hover |
| `--brand-iris-press` | `#5A48E8` | Primary CTA active |
| `--brand-mint` | `#5EEAD4` | Accent, AI streaming pulse |
| `--brand-mint-hover` | `#7FF0DD` | Accent hover |
| `--brand-pulse` | `linear-gradient(135deg, #6F5BFF 0%, #5EEAD4 100%)` | Brand mark, AI streaming, hero strokes |
| `--success` | `#34D399` | Confirmations, "boulder shipped" |
| `--warning` | `#F4B445` | Warnings, attention |
| `--danger` | `#FB7185` | Destructive, errors, retention delete |
| `--info` | `#60A5FA` | Neutral notice |
| `--success-bg` | `rgba(52, 211, 153, 0.12)` | Toast / chip background |
| `--warning-bg` | `rgba(244, 180, 69, 0.12)` |  |
| `--danger-bg` | `rgba(251, 113, 133, 0.12)` |  |
| `--info-bg` | `rgba(96, 165, 250, 0.12)` |  |
| `--ring` | `rgba(111, 91, 255, 0.55)` | 2px focus ring |
| `--scrim` | `rgba(7, 8, 15, 0.72)` | Modal scrim, behind sheets |

### 2.2 Color — light theme (parity)

| Token | Hex | Usage |
|---|---|---|
| `--bg-base` | `#FAFAFE` |  |
| `--bg-raised` | `#FFFFFF` |  |
| `--bg-overlay` | `#FFFFFF` | with elevation-2 shadow |
| `--bg-subtle` | `#F1F2F8` |  |
| `--border-subtle` | `#E5E7F0` |  |
| `--border-default` | `#D4D7E5` |  |
| `--border-strong` | `#9CA3B8` |  |
| `--text-primary` | `#0E1020` |  |
| `--text-secondary` | `#4B526E` |  |
| `--text-tertiary` | `#6E7596` |  |
| `--brand-iris` | `#5B47E5` | Slightly darkened for AAA on white |
| `--brand-mint` | `#3FC5AE` | Slightly darkened for contrast |
| `--scrim` | `rgba(14, 16, 32, 0.45)` |  |

> All other dark tokens have an equivalent in light. See `tokens.css` for the complete pair.

### 2.3 Aurora gradient — the signature atmosphere

Used **only** behind app shell and key empty states. Not on every page. Not in dense data views.

```css
--aurora-1: radial-gradient(60% 40% at 15% 0%, rgba(111, 91, 255, 0.18) 0%, transparent 60%);
--aurora-2: radial-gradient(50% 35% at 85% 10%, rgba(94, 234, 212, 0.14) 0%, transparent 65%);
--aurora-3: radial-gradient(40% 30% at 50% 100%, rgba(111, 91, 255, 0.10) 0%, transparent 70%);
--aurora: var(--aurora-1), var(--aurora-2), var(--aurora-3);
```

Apply to the html or body element with very long, slow animation (see §4.4).

### 2.4 Typography

**Families** (loaded via `next/font`):

| Token | Stack | Weight |
|---|---|---|
| `--font-sans` | Geist Sans, ui-sans-serif, system-ui | 400, 500, 600 |
| `--font-mono` | Geist Mono, ui-monospace | 400, 500 |
| `--font-display` | Instrument Serif, ui-serif | 400 (regular only) |

**Weights are restricted to the above three.** No 700/800/900. Heaviness comes from contrast (size, color), not weight.

**Type scale** (mobile in parens where it differs):

| Token | Size / line-height | Tracking | Use |
|---|---|---|---|
| `text-display-2xl` | 64/72 (44/52) | -0.03em | Marketing hero only |
| `text-display-xl` | 48/56 (36/42) | -0.025em | Editorial empty states |
| `text-h1` | 32/40 (28/36) | -0.02em | Page title |
| `text-h2` | 24/32 (22/30) | -0.015em | Section title |
| `text-h3` | 18/26 | -0.01em | Card title, drawer title |
| `text-h4` | 15/22 | -0.005em | Subsection |
| `text-body-lg` | 16/26 | 0 | Long-form reading (chat assistant) |
| `text-body` | 14/22 | 0 | Default UI body |
| `text-body-sm` | 13/20 | 0 | Dense lists, tables |
| `text-caption` | 12/18 | +0.005em | Metadata, timestamps |
| `text-overline` | 11/16 | +0.08em | UPPERCASE only when used as overline; otherwise sentence-case caption |
| `text-mono-sm` | 13/20 | 0 | Code, IDs, IDs in citations |

Editorial moments (empty states, success confirms, "evols thinks…" prompts) may use **Instrument Serif** at the display sizes. One serif moment per screen, max.

### 2.5 Spacing scale (4px base)

```
space-0   0px
space-px  1px
space-0.5 2px
space-1   4px
space-1.5 6px
space-2   8px
space-3   12px
space-4   16px
space-5   20px
space-6   24px
space-8   32px
space-10  40px
space-12  48px
space-16  64px
space-20  80px
space-24  96px
```

Tailwind defaults are mostly fine; this just confirms. **Component padding lives on the [4, 8, 12, 16, 24] track.** Section gaps use [32, 48, 64].

### 2.6 Radii

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 6px | Chips, inline tags |
| `--radius-md` | 10px | Buttons, inputs, small cards |
| `--radius-lg` | 14px | Cards, panels, modals |
| `--radius-xl` | 20px | Hero surfaces, AI Workbench dock |
| `--radius-2xl` | 28px | Marketing hero |
| `--radius-full` | 9999px | Avatars, pills |

Default for a card is `lg`. shadcn defaults skew small — bump them.

### 2.7 Elevation (shadows in light mode, glow + border in dark)

Dark mode does NOT use drop shadows for depth. It uses **layered backgrounds + 1px borders + a barely-there inner highlight**. This is the kore.ai trick and it's why the UI reads "premium."

```css
/* Dark elevation pattern */
.elev-1 { background: var(--bg-raised); border: 1px solid var(--border-subtle);
          box-shadow: inset 0 1px 0 0 rgba(255,255,255,0.03); }
.elev-2 { background: var(--bg-overlay); border: 1px solid var(--border-default);
          box-shadow: inset 0 1px 0 0 rgba(255,255,255,0.04),
                      0 8px 24px -12px rgba(0,0,0,0.6); }
.elev-3 { /* modals */
          background: var(--bg-overlay); border: 1px solid var(--border-default);
          box-shadow: inset 0 1px 0 0 rgba(255,255,255,0.05),
                      0 24px 64px -24px rgba(0,0,0,0.75); }

/* Light elevation pattern — actual shadows */
.elev-1-light { background: #fff; border: 1px solid var(--border-subtle);
                box-shadow: 0 1px 2px rgba(14,16,32,0.04); }
.elev-2-light { background: #fff;
                box-shadow: 0 4px 16px -4px rgba(14,16,32,0.08),
                            0 1px 2px rgba(14,16,32,0.04); }
.elev-3-light { background: #fff;
                box-shadow: 0 16px 48px -12px rgba(14,16,32,0.18),
                            0 2px 4px rgba(14,16,32,0.05); }
```

### 2.8 Glass panels

For drawers, command palette, AI Workbench dock, persona detail, and graph filter rail:

```css
.glass {
  background: color-mix(in srgb, var(--bg-overlay) 72%, transparent);
  backdrop-filter: blur(20px) saturate(140%);
  border: 1px solid color-mix(in srgb, var(--border-default) 80%, transparent);
}
```

**Rule:** glass surface only over the aurora background or over content. Never glass-on-glass.

### 2.9 Z-index map

```
0      base
10     sticky topbar
20     sidebar
30     dropdown
40     popover
50     modal scrim
51     modal content
60     toast
70     command palette
80     "Ask Evols" dock (always on top of content, below modal)
```

### 2.10 Breakpoints

```
sm   ≥ 640px    Large phone landscape, small tablet
md   ≥ 768px    Tablet
lg   ≥ 1024px   Small laptop — primary collapsed-sidebar threshold
xl   ≥ 1280px   Desktop default — primary expanded-sidebar threshold
2xl  ≥ 1536px   Large desktop, extra side rails
```

**Mobile = `< md`.** Below `md`, the sidebar collapses to a bottom-tab nav (5 tabs). The right context drawer becomes a full-height sheet. Three-pane layouts collapse to single-pane with a tab switcher at the top.

---

## 3. Layout system

### 3.1 App shell anatomy

```
┌────────────────────────────────────────────────────────────┐
│  topbar (h=56)  · workspace · breadcrumbs · ∙ · ⌘K · user  │
├──────┬─────────────────────────────────────────────┬───────┤
│      │                                             │       │
│ side │              content canvas                 │ rail  │
│ nav  │      (page-specific layouts live here)      │ (opt) │
│ 264  │                                             │ 360   │
│      │                                             │       │
├──────┴─────────────────────────────────────────────┴───────┤
│      "Ask Evols" floating dock — bottom right (96 from edge)│
└────────────────────────────────────────────────────────────┘
```

- **Sidebar widths:** expanded `264px`, collapsed `64px` (icon-only). Toggle persists per user.
- **Right rail:** optional, page-driven, `360px`. Used for context inspector, persona traits, graph node detail.
- **Content max-width:** `1280px` for reading-heavy views (workbench message column, decision log). Otherwise fluid.
- **Page padding:** `space-6` on `lg+`, `space-4` on `md`, `space-3` on `<md`.
- **Topbar is sticky** with backdrop-filter blur 14px when content scrolls beneath it.

### 3.2 Density modes

User-toggleable in Settings.

- `comfortable` (default): row heights 44px, padding `space-3`.
- `compact`: row heights 36px, padding `space-2`. For data-heavy users running large feedback datasets.

Implement as a `data-density` attribute on `<html>` plus Tailwind variants `density-compact:`.

---

## 4. Motion language

Motion is *expressive* per spec — but every animation answers "why?" State change, attention, narrative continuity.

### 4.1 Easings

```ts
export const ease = {
  out:      [0.16, 1, 0.3, 1],        // entrance, default
  inOut:    [0.4, 0, 0.2, 1],         // hover, color change
  spring:   [0.34, 1.56, 0.64, 1],    // success pop, success toast
  emphasize:[0.2, 0, 0, 1],           // page-level reveal
} as const;
```

### 4.2 Durations

```ts
export const dur = {
  micro: 120,   // icon swap, focus, color
  fast:  180,   // hover, toggle
  base:  240,   // panel slide, modal in
  mod:   360,   // tab change, route soft
  slow:  600,   // hero reveal, section in
  epic:  900,   // first-paint reveal, login → app
} as const;
```

### 4.3 Spring presets (Framer Motion)

```ts
export const spring = {
  ui:         { type: "spring", stiffness: 320, damping: 30, mass: 0.8 },
  panel:      { type: "spring", stiffness: 220, damping: 28, mass: 1.0 },
  expressive: { type: "spring", stiffness: 180, damping: 22, mass: 1.0 },
  bounce:     { type: "spring", stiffness: 360, damping: 18, mass: 0.6 },
} as const;
```

### 4.4 Aurora drift

```css
@keyframes aurora-drift {
  0%   { transform: translate3d(0, 0, 0)   scale(1); }
  50%  { transform: translate3d(2%, 1%, 0) scale(1.04); }
  100% { transform: translate3d(0, 0, 0)   scale(1); }
}
.aurora-bg::before {
  content: ""; position: fixed; inset: -10%;
  background: var(--aurora);
  animation: aurora-drift 28s ease-in-out infinite;
  pointer-events: none; z-index: 0;
}
```

Pause when the user enables `prefers-reduced-motion`. Replace with a static version of frame 0.

### 4.5 AI motion patterns (the soul)

These are unique to Evols and used everywhere AI is happening. Implement once in `<AIShimmer>`, `<AIThinking>`, `<AIStream>` components.

#### a. Stream shimmer (text streaming in)

A 1.5px horizontal sliver of `--brand-pulse` slides left → right under the *current* line being streamed, then fades. Looks like a reading line. Re-emit per line.

```ts
// pseudo
function StreamLine({ text }) {
  return (
    <span className="relative inline-block">
      {text}
      <motion.span
        className="absolute -bottom-0.5 left-0 h-px w-full bg-pulse-gradient"
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: [0, 1, 0] }}
        transition={{ duration: 0.6, ease: ease.out }}
        style={{ transformOrigin: "left" }}
      />
    </span>
  );
}
```

#### b. Thinking pulse

Three dots, but each dot is a tiny 4px circle that goes from 30% → 100% opacity in stagger. Color: `--brand-mint`. Used while `streaming === false && pending === true`.

#### c. Tool-use ribbon

When the assistant invokes a tool (e.g. `get_team_context`), inline a 1px-tall ribbon under the message that fills left-to-right with `--brand-pulse` while the tool runs, then collapses to a labeled chip.

```
┌──────────────────────────────────────┐
│ Calling get_team_context…            │  ← while running
│ ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░             │
└──────────────────────────────────────┘

Becomes:

🔧 get_team_context · 142ms · 3 results       ← chip after
```

#### d. Citation lift

Citation pills (e.g. `[3]`) lift `2px` and gain a `--brand-iris` 1px outline on hover, with a 220ms cross-fade preview popover.

#### e. Score reveal

When a RICE score lands on a project card, the bar fills left-to-right over 600ms with `ease.emphasize`, and the number counts up from 0 to its final value over the same window. One-shot per mount; ignore on re-renders.

#### f. Reduced motion

When `prefers-reduced-motion: reduce`:
- aurora freezes to a static frame
- shimmer becomes a static 1px line, no movement
- thinking pulse becomes a static "Thinking…" label
- tool ribbon becomes a static chip from the start
- score bar fills instantly without count-up

### 4.6 Page transitions

`AnimatePresence` mode `wait`. New page fades in (opacity 0 → 1) and slides up 8px over `dur.mod` with `ease.out`. Outgoing page fades out over `dur.fast`. Drawers/sheets slide in with `spring.panel`.

### 4.7 Hover affordances

- Buttons: background lighten + 1px border tighten over 180ms.
- Cards: `translateY(-2px)`, border goes from `subtle` → `default`, inner highlight strengthens. Pointer cursor.
- List rows: background fade to `--bg-subtle` over 120ms.

Never use `transform: scale()` on hover for cards. It causes blurry text on subpixel AA.

---

## 5. Iconography & illustration

### 5.1 Icons
- **Set:** Lucide (already in shadcn ecosystem).
- **Stroke:** 1.5px **only**. Override Lucide's default 2px globally.
- **Size:** 16 / 20 / 24. 16 in compact UI, 20 in default UI, 24 in hero/empty.
- **Color:** inherits `currentColor`.
- **Never fill.** Outline only. The brand reads as drawn, not stamped.

### 5.2 Illustration
- Line-only with **soft gradient fill** (the pulse, at 18% opacity).
- For empty states, a single editorial line drawing — about 240×180 — placed above the editorial-serif headline.
- Avoid 3D, isometric, or stocky illustrations. Avoid mascots.

### 5.3 Avatars
- 24 / 32 / 40 px.
- For users: initials over a deterministic gradient pick from a 5-stop palette derived from `--brand-iris` and `--brand-mint`. Hash userId → palette index.
- For personas: initials inside the halo logomark variant, scaled.

---

## 6. AI-first interaction patterns (the moat)

These are the patterns that make Evols *feel* AI-native instead of "a SaaS app with a chatbot bolted on."

### 6.1 Conversational chrome — present everywhere

Every page has an **"Ask Evols" dock**: a 360×56px pill bottom-right, 24px from edges, glass surface, with a `--brand-pulse` outer ring (1px). Clicking expands it into a focused composer that floats above content (z=80). Hitting `⌘ K` from anywhere opens the command palette which sits one tier higher and includes "Ask Evols" as the first option.

Mobile: the dock becomes a fullwidth sticky composer above the bottom-tab bar, height 48px, with a "compose" expansion to fullscreen.

The dock should be **context-aware**: it knows what page the user is on and what's selected. Examples:

- On a Theme: "Ask about this theme…" placeholder.
- On a Project: "Refine, score, or explain this project…"
- On the Workbench: hidden (the page itself is the chat).

### 6.2 Inline AI affordance — the "shimmer slot"

Anywhere the AI can act on the page's primary object, render a 1px-tall horizontal slot at the top of the card. On hover, it pulses with `--brand-pulse` and exposes 3-5 inline actions: "Summarize", "Find similar feedback", "Draft initiative", "Score it", etc. Idle state is invisible.

```
┌──────────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ ← shimmer slot, idle
│                                      │
│ Theme: "CSV export limitations"      │
│ 47 feedback items · 12 accounts      │
│ ...                                  │
└──────────────────────────────────────┘

On hover:
┌──────────────────────────────────────┐
│  ✨ Summarize | Find similar | Draft init …│
│                                      │
│ Theme: "CSV export limitations"      │
│ ...                                  │
└──────────────────────────────────────┘
```

### 6.3 Citation system

Every assistant response that grounds in evidence shows numbered citations `[1]`, `[2]`, etc., inline. Each citation:

- Pill: `--bg-subtle` background, `--brand-iris` text, 11px, mono.
- Hover → 320×120 popover with: source title, source type icon (CSV/Slack/PDF/etc.), 2-line excerpt, "Open in graph →" link.
- Click → opens the Knowledge Graph zoomed and pinned to that node.

### 6.4 Confidence signals

When the AI returns a quantitative thing (RICE score, persona match %, theme confidence), show the value and a 2px-tall confidence bar beneath:

- 0–40%: `--warning`
- 40–70%: `--info`
- 70–100%: `--brand-mint`

Bar fills with the score-reveal animation (§4.5e).

### 6.5 Streaming states

Three states of an AI response:

1. **Pending** — thinking pulse + "Reading your context" / "Searching feedback" / etc. (rotates short status messages emitted by the backend; hard-coded fallback "Thinking…").
2. **Streaming** — text streaming in token-by-token, stream shimmer under the active line, current line height stable to prevent reflow jitter.
3. **Done** — citations resolve in (cross-fade), tool-use chips collapse, "Was this helpful? 👍 👎" appears with `--brand-pulse` ring on hover.

### 6.6 The "thinking surface"

A reusable card that wraps any AI-generated content. It's a `--bg-raised` card with a 1px gradient border (using `border-image`, mask trick) that *only* lights up while streaming. Once done, the gradient fades to `--border-default`.

```css
.thinking-surface[data-state="streaming"] {
  background-image:
    linear-gradient(var(--bg-raised), var(--bg-raised)),
    var(--brand-pulse);
  background-origin: border-box;
  background-clip: padding-box, border-box;
  border: 1px solid transparent;
}
```

### 6.7 Skill switching

In the AI Workbench, the active skill is a pill at the top of the composer. Clicking it opens a Cmd-K-style picker. Switching mid-conversation triggers a small "Switched to *Sprint planning*" toast inline in the message stream — not a global toast.

---

## 7. Component library

### 7.1 Strategy
Extend shadcn/ui — don't replace it. Override defaults with our tokens, then add Evols-specific composite components on top.

### 7.2 Primitives (shadcn overrides)

| Component | Key overrides |
|---|---|
| `Button` | sizes: sm 32, md 36, lg 44; radii md (10); primary uses `--brand-iris` solid, hover lifts to `--brand-iris-hover`; destructive uses `--danger`; ghost uses transparent → `--bg-subtle`; new `pulse` variant uses `--brand-pulse` gradient + a 1px inner highlight |
| `Input` | h 40, radius md, border `--border-default`, focus ring 2px `--ring`, placeholder `--text-tertiary`; mono variant uses `--font-mono`; AI variant has the streaming shimmer slot at top |
| `Card` | radius lg, elev-1; a `glass` variant per §2.8; `interactive` variant adds hover lift |
| `Tabs` | underline indicator with `--brand-pulse` gradient, animated x-position via Framer layout |
| `Dialog` | radius xl on lg+, full-sheet on `<md`; scrim 72%; entrance: scale 0.96 → 1 + opacity over `spring.panel` |
| `DropdownMenu` | popover-style with elev-2 + glass; min-w 200; section overlines in `--text-tertiary` |
| `Badge` | sizes sm/md; variants neutral, info, success, warning, danger, **pulse** (gradient outline) |
| `Tooltip` | 12px text, `--bg-overlay` bg, `--border-default` border, 220ms in |
| `Toast` | bottom-right; slides in from 24px below, opacity 0→1; auto-dismiss 5s; success uses `spring.bounce` |

### 7.3 Composite components (Evols-specific)

| Component | Purpose | Anatomy |
|---|---|---|
| `<AskEvolsDock>` | Floating AI affordance | Pill (collapsed) ↔ Composer (expanded). Always present. |
| `<ChatBubble>` | Workbench message | Author chip · streaming state · content · citations · actions · timestamp |
| `<ToolUseChip>` | Inline tool call | Icon · name · duration · result count |
| `<CitationPill>` | `[n]` reference | Number · hover popover with source preview |
| `<ConfidenceBar>` | Quant viz | Value · 2px bar · color by threshold |
| `<RICEMeter>` | RICE viz | 4 micro-bars (R, I, C, E) stacked horizontal · weighted total to right |
| `<ThemeCard>` | Theme tier | Title · feedback count · account count · urgency dot · evidence chips · shimmer slot |
| `<InitiativeCard>` | Strategic tier | Title · linked themes count · aggregate metrics · linked projects · status |
| `<ProjectCard>` | Execution tier | Boulder/Pebble icon · title · RICE bar · effort · acceptance preview · status |
| `<EvidenceList>` | Source list | Source type icon · title · 2-line excerpt · timestamp · open-in-graph |
| `<GraphCanvas>` | KG visualization | D3 force layout · type-colored nodes · hover halo · click → drawer |
| `<NodeDrawer>` | Right-rail detail | Type · label · attributes · 1-hop neighbors · "Ask Evols about this" |
| `<RoadmapLane>` | Now/Next/Later | Lane header · drop zone · stacked initiative chips |
| `<PersonaTile>` | Persona gallery | Halo avatar · name · ARR weight · 3 trait pills · "Ask twin" CTA |
| `<DecisionItem>` | Decision log row | Date · title · context tags · linked artifact |
| `<EmptyState>` | Default empty | Editorial-serif headline · 1-line body · single CTA · line illustration |
| `<SkillCard>` | Skills library tile | Icon · name · 1-line desc · A/B badge · "Open" CTA |
| `<AIShimmerSlot>` | Inline action surface | 1px slot, hover reveals quick actions |

### 7.4 Component spec template (use this for every new component)

```
<ComponentName>
  Anatomy:    <slots>
  Props:      <typed contract>
  States:     idle / hover / focus / active / loading / disabled / error / empty
  Variants:   <list>
  Sizes:      sm / md / lg (where applicable)
  Density:    comfortable / compact behavior
  Motion:     entrance / hover / exit
  A11y:       role · keyboard · ARIA · screen-reader announcements
  Mobile:     differences below `md`
```

Every component PR must include this block in its README.

---

## 8. Screen specs

For each screen: **Goal · Layout · Component map · States · Motion · Mobile · Edge cases · A11y notes.**

> Convention: I describe the dark mode; light mode mirrors using the parity tokens.

---

### 8.1 App shell + navigation

#### Goal
A persistent shell that frames the entire product, makes the AI omnipresent, and keeps navigation predictable as the surface scales.

#### Desktop layout (≥ lg)

- **Topbar** (h=56, sticky, backdrop blur on scroll):
  - Left: workspace switcher (logomark + workspace name + chevron) → opens dropdown with workspaces, "New workspace", and settings.
  - Center: breadcrumbs from route (auto-generated from the route segment manifest).
  - Right: `⌘ K` chip · notifications bell · avatar menu.
- **Sidebar** (w=264, collapsible to 64):
  - Workspace name micro-header.
  - Primary nav (icons + labels): *Workbench, Knowledge, Themes, Initiatives, Projects, Roadmap, Personas, Work Context*.
  - Divider.
  - Secondary: *Skills, Settings*.
  - Sticky bottom: usage meter (token quota), upgrade CTA.
- **Content canvas**: page-driven.
- **Right rail** (optional, 360, page-driven).
- **AskEvolsDock**: bottom-right, z=80.

#### Mobile layout (< md)

- **Topbar** collapses to 48px: hamburger · workspace name · avatar.
- **Bottom-tab nav** (5 tabs, h=64): Workbench · Knowledge · Projects · Roadmap · More.
  - "More" opens a sheet listing the rest.
- Sidebar becomes a left-side sheet (drag to open, close on tap-outside).
- Right rail becomes a full-height bottom sheet.
- AskEvolsDock becomes a sticky composer above the bottom tabs.

#### Component map
- `<TopBar />`, `<Sidebar />`, `<MobileTabBar />`, `<CommandPalette />`, `<AskEvolsDock />`.

#### States
- Sidebar: expanded / collapsed / mobile-open.
- Topbar: at-top (no blur) / scrolled (blur 14px).
- Active nav item: `--bg-subtle` background, `--brand-iris` 2px left edge accent, `--text-primary` text.
- Hover nav item: `--bg-subtle`, no accent.
- Quota meter: nominal / warning (>80%) / danger (>95%).

#### Motion
- Sidebar collapse: width animates over `dur.base` with `ease.inOut`. Labels fade out over `dur.fast` (faster than width).
- Active nav transition: the 2px left accent slides between items using Framer `layoutId`.
- Topbar blur: cross-fade in over `dur.base`.

#### Edge cases
- Workspace name overflow: middle-ellipsis with tooltip on hover.
- 0 workspaces: shell hides workspace switcher; topbar becomes "Create your workspace" CTA only.
- Quota exceeded: meter goes danger, bottom CTA changes to "Upgrade"; AskEvolsDock disabled with tooltip "Quota reached — upgrade to keep asking."

#### A11y
- Skip link "Skip to content" first focus on `Tab`.
- Sidebar nav is `<nav role="navigation" aria-label="Primary">`.
- Active item has `aria-current="page"`.
- Cmd-K palette: `role="dialog"`, traps focus, returns focus to invoker on close.
- Bottom-tab on mobile: each tab announces "X tab, Y of 5".

---

### 8.2 AI Workbench (chat) — the flagship surface

#### Goal
Deliver the most thoughtful AI conversation surface in B2B SaaS. Make context, citations, and tool use legible. Make streaming feel alive.

#### Layout (≥ lg) — three panes
```
┌─Skills (240)─┬───Conversation (fluid, max 880)───┬─Context (360)─┐
│              │                                    │                │
│ pinned       │   message stream                   │ active context │
│ skills       │                                    │ · graph nodes  │
│              │                                    │ · attached     │
│ recent       │                                    │   files        │
│              │                                    │ · personas     │
│              │                                    │   in scope     │
│              │                                    │                │
│              │   composer (sticky bottom)         │                │
└──────────────┴────────────────────────────────────┴────────────────┘
```

#### Layout (md) — two panes
- Skills collapses into a top-of-conversation skill switcher pill.
- Context drawer becomes right-side push drawer, toggled by a button.

#### Layout (< md) — single pane + tabs
- Tabs at top: `Chat · Skills · Context`.
- Composer sticky at bottom (above the bottom-tab nav).
- Tab change uses Framer layout slide.

#### Message anatomy

User message (right-aligned):
```
┌──────────────────────────────────────┐
│                  9:42 AM             │
│                ┌────────────────────┐│
│                │ "Help me plan      ││
│                │  next sprint"       ││
│                └────────────────────┘│
└──────────────────────────────────────┘
```

Assistant message (left-aligned, full-width):
```
┌──────────────────────────────────────┐
│  ◜◝ evols · sprint planning · 9:42 AM│
│  ─────────────────────────────────── │
│  🔧 get_work_context · 142ms · 4 ctx │
│  🔧 list_active_projects · 98ms · 7  │
│  ─────────────────────────────────── │
│  Here's a draft sprint plan based on │  ← streaming, with shimmer
│  your active priorities [1].         │
│                                      │
│  ① Pebble — fix CSV truncation [2]   │
│  ② Boulder — advanced export engine  │
│     [3] · RICE 156.3                 │
│  ...                                 │
│  ─────────────────────────────────── │
│  [1] [2] [3]                         │
│  👍 👎 · ⤴ Save to Decisions · ↻      │
└──────────────────────────────────────┘
```

#### Composer
- Multi-line, autosizing 56px → 240px max.
- Left of input: skill pill (current skill).
- Right of input: attach (paperclip), `⏎` send.
- `Shift+Enter` newline; `Enter` send.
- Slash commands: `/` opens an inline menu (Skills, Personas, Work Context items).
- Drag-drop file → attaches to next message; preview chip above composer.

#### States
- **Empty conversation**: editorial-serif headline "Where should we begin?" with three suggested prompts (per active skill) as `<SkillCard>` thumbnails.
- **Streaming**: §6.5.
- **Tool use in progress**: ribbon (§4.5c).
- **Error**: assistant message becomes a danger-bordered card with retry. Error copy: "Couldn't reach the model. Retry, or switch model in settings."
- **Quota exceeded**: composer disabled with inline upgrade CTA.

#### Motion
- Each new message slides up 8px and fades in over `dur.base` with `ease.out`.
- Stream shimmer per §4.5a.
- Citation pills resolve via cross-fade after stream completes.
- Skill switch toast appears inline mid-stream (per §6.7) using `spring.ui`.

#### Edge cases
- **Long message > 5000 tokens**: clamp to 1200px height with "Show full" expander.
- **Code blocks**: `--font-mono`, `--bg-base` background (1 step deeper than `--bg-raised`), copy button top-right that fades in on hover.
- **Tables in stream**: render with `<DataTable>` primitive; horizontal scroll on `<md`.
- **Reasoning trace** (when surfaced): collapsed by default behind a "Show thinking" toggle that expands a `--bg-subtle` block.
- **Network drop mid-stream**: pause at last token, show pulse "Connection paused…", auto-resume on reconnect. After 30s, offer "Restart from here".

#### A11y
- Message stream is `role="log"`, `aria-live="polite"`. Streaming chunks announced when stream completes (not per token — that's hostile to screen readers).
- Composer is `<textarea aria-label="Message Evols">`.
- Skill switcher `aria-label="Active skill"`.
- Keyboard: `j/k` move between messages, `c` copy focused message, `r` retry last assistant message.

---

### 8.3 Skills library

#### Goal
Browse and customize 80+ AI skills. Show A/B status. Make customization feel safe.

#### Layout
- Top: search + filter bar (category, role, recently used, A/B test).
- Grid: `<SkillCard>` 3 cols on `xl`, 2 on `lg`, 1 on `<md`. Card height fixed at 168px.
- Click → side drawer (480px, glass) with tabs: *Overview · Customize · History*.

#### SkillCard anatomy
```
┌──────────────────────────────────────┐
│ ⊚ Sprint planning            [A/B]   │  ← icon · name · A/B badge
│ Plan a sprint with your team         │  ← desc
│ ──                                   │
│ 142 runs this week · 4.6 ★           │  ← stats
│                                      │
│ [Open]                       ↗       │
└──────────────────────────────────────┘
```

#### Customize tab
- Sections: *Custom instructions · Context priors · Output format · Model & tools*.
- Live preview pane on the right showing how the skill responds to a stock prompt.
- "Reset to default" link. "Save as new variant" CTA.
- Diff indicator next to fields modified vs default.

#### States
- A/B active: pulse-gradient outlined badge.
- Skill running: card has live shimmer slot at top.
- Locked (admin-only): lock icon, tooltip explains.

#### Mobile
- Cards stack 1-up.
- Drawer becomes full sheet.

---

### 8.4 Knowledge graph

#### Goal
Make the team's institutional memory feel **alive and explorable** — not a dead diagram.

#### Layout
- Top: search bar with type filter chips (Persona / Pain / Use case / Account / Decision / etc.) + a time-range slider.
- Center: D3 force-directed canvas, fluid.
- Right rail: `<NodeDrawer>` when a node is selected (slide in from right, glass).
- Left rail (optional, collapsible): legend + saved views.

#### Canvas spec
- Background: `--bg-base` with very subtle radial vignette toward `--bg-raised` (no aurora — too noisy here).
- Nodes:
  - Size encodes degree (radius 4 → 18, sqrt-scaled).
  - Color encodes type (10-step semantic palette derived from the brand pulse). Same node-type → same color across all views.
  - Stroke: 1px `--border-default`. Active node: 2px `--brand-iris`. Hovered: 1.5px `--brand-mint`.
  - Label: 11px, `--text-secondary`, only for nodes with degree ≥ threshold (avoid clutter).
- Edges:
  - Default: 1px, `--border-subtle`, alpha 0.6.
  - Hovered (incident to hovered node): `--brand-iris`, alpha 0.9.
  - Bundled when n > 800 (use d3-force-bundle).
- Interactions:
  - Drag to reposition (sticky after release).
  - Wheel to zoom (40%–400%).
  - Click node → drawer.
  - Double-click node → focus + 1-hop ego graph.
  - Right-click → "Ask Evols about this" / "Pin" / "Hide".

#### Performance contract
- Render with canvas (not SVG) when n > 500.
- Lazy-load node attributes; drawer fetches on click.
- Show "X nodes, Y edges · sampled" subtitle when sampling is in effect.

#### Empty state
Editorial-serif headline: "Your brain is empty. Feed it." · CTA "Drop a meeting, doc, or transcript" → opens upload modal. Below it, an animated line illustration of a single arc curving into a halo (logomark animation, 3s loop).

#### Mobile
- Canvas fills the screen.
- Filters become a bottom sheet.
- Drawer becomes a bottom sheet.
- Pinch to zoom, drag to pan, tap to select.

#### A11y
- Provide a "List view" toggle that renders the same data as a typed, filterable list — graphs are inherently inaccessible to screen readers.
- Keyboard: arrow keys move focus between nodes (along edges); `Enter` opens drawer; `Esc` closes.

---

### 8.5 Themes → Initiatives → Projects

#### Goal
Make the three-tier hierarchy *legible at a glance* and traceable in either direction.

#### Layout — three-column tree (default on lg+)
```
┌─Themes────────┬─Initiatives───────┬─Projects──────┐
│ ◯ Theme A     │  ◯ Init 1         │  ⚡ Pebble #1 │
│   47 fb · 12a │   addr 3 themes   │   RICE 89.1   │
│                                      ...            │
│ ◯ Theme B     │  ◯ Init 2         │  🏔 Boulder #1│
│   88 fb · 22a │   addr 2 themes   │   RICE 156.3  │
│ ...           │  ...              │  ...          │
└───────────────┴───────────────────┴───────────────┘
```

- Click a Theme → middle column filters to its Initiatives.
- Click an Initiative → right column filters to its Projects.
- Breadcrumb above the columns updates: `All themes › "CSV export limits" › "Improve export"`.
- Each column has its own scroll, header (count + sort), and filter chip row.

#### ThemeCard
- Title (h4).
- Pills: feedback count, account count, ARR badge.
- Urgency: 4-segment dot row (filled per quartile).
- Confidence bar (§6.4).
- Footer: 3 micro-avatar chips of top accounts.

#### InitiativeCard
- Title (h4).
- "Addresses N themes" mini-row with linked theme chips.
- Aggregate metrics row (urgency, impact, confidence — averaged).
- Status badge: discovery / in-flight / shipped / paused.

#### ProjectCard
- Boulder/Pebble icon (left).
- Title (h4).
- RICE meter (§7.3) with weighted total to the right.
- Effort badge.
- Acceptance criteria preview (1 line, ellipsed).
- Status badge.

#### Alt views
- **Kanban** by status across each tier.
- **Table** with sortable columns.
- View switch top-right; remembered per user per tier.

#### States
- Loading: 6-row skeleton per column (each row shimmer 220ms loop).
- Empty: "No themes yet. Drop feedback to start." with CTA → opens upload.
- Generating (during async refresh): top of column shows a 1px-tall shimmer ribbon and a chip "Generating themes · 38%". Cards appear in-place as they're created (not all at once at the end).

#### Motion
- Score reveal on first paint (§4.5e).
- Selecting a theme animates the right column filter via `AnimatePresence` cross-fade.
- Card hover: §4.7.

#### Mobile
- Single column with a tier switcher tab at top: `Themes · Initiatives · Projects`.
- Drilling into an item navigates rather than filtering.

---

### 8.6 Roadmap

#### Goal
Communicate strategy in a glance. Now / Next / Later as the home view; quarterly grid as the tactical view.

#### Default view: Now / Next / Later swimlanes
```
┌─Now─────────┬─Next────────┬─Later──────┐
│ Init A      │ Init D      │ Init G     │
│ Init B      │ Init E      │ Init H     │
│ Init C      │ Init F      │            │
│             │             │            │
└─────────────┴─────────────┴────────────┘
```
- Swimlanes are full-height, scrollable, droppable.
- Each card is an `<InitiativeCard>` compact variant.
- Drag between lanes; landing animation `spring.bounce`.
- Lane header shows count + ARR-weighted sum of the linked themes.

#### Alt view: Quarterly grid
- Columns = quarters (current ± 4).
- Rows = strategic pillars (admin-configurable).
- Cards span quarters with a left-edge handle to resize.

#### Filters
- Filter bar above: by status, owner, persona, account.
- Saved views.

#### Mobile
- Each lane becomes a tab; horizontal swipe between Now/Next/Later.
- Drag-drop disabled; long-press → "Move to…" sheet.

---

### 8.7 Personas

#### Goal
Personas are first-class. Each one has weight, voice, and the ability to chat back via the digital twin.

#### Layout
- Top: search + filter (segment, ARR weight, last refreshed).
- Grid: `<PersonaTile>` 4 cols on xl, 3 on lg, 2 on md, 1 on `<md`.
- Click → persona detail page (full route).

#### PersonaTile
- Halo avatar (logomark variant, 56px, gradient stroke).
- Name + role.
- 3 trait pills (auto-extracted top traits).
- ARR weight badge (e.g. "32% of weighted ARR").
- "Ask twin →" CTA.

#### Persona detail
- Hero: large halo avatar (96), name as h1, subtitle = "Synthesized from N feedback items across M accounts".
- Tabs: *Profile · Twin chat · Trade-offs · Sources*.
- **Profile**: Traits cloud (sized by frequency), Pain points list, Use cases list, Goals list. Each item links to evidence in the graph.
- **Twin chat**: full-width chat with the persona digital twin. Composer bottom. Same chat patterns as the Workbench.
- **Trade-offs**: vote prompts ("If you had to choose between A and B…") with confidence-scored votes. Aggregate visualizations.
- **Sources**: list of feedback items grouped by account.

#### States
- Stale persona (no refresh in 30+ days): warning chip "Refresh from latest feedback" with one-click action.
- Empty (no feedback yet): empty state pointing to upload flow.

#### Motion
- Twin chat: same as Workbench but with the persona's halo as the assistant chip — gradient hue rotated by persona ID.

---

### 8.8 Work Context dashboard

#### Goal
The PM's morning page. Today's situation, this week's focus, blockers, recent decisions, and what the AI noticed.

#### Layout (lg+)
```
┌──────────────────────────┬─────────────────┐
│ Today canvas (60%)       │ Inbox (40%)     │
│  · Greeting + date       │  · @ mentions   │
│  · Weekly focus card     │  · AI noticed:  │
│  · Active projects (4)   │    redundancy,  │
│  · Decisions log (3)     │    drift, asks  │
│                          │                 │
└──────────────────────────┴─────────────────┘
```

#### Today canvas
- **Greeting**: editorial-serif "Good morning, Gyanesh." or similar contextual greeting (time-aware, but never twee).
- **Weekly focus card**: a single, prominent `<Card>` with the user's stated weekly focus + progress meter (% of linked tasks done). Editable inline.
- **Active projects strip**: 4 `<ProjectCard>` compact variants.
- **Decisions log**: last 5 `<DecisionItem>`s with "Open log" CTA.

#### Inbox (right column)
- Sources: assigned tasks, mentions, AI-detected redundancies, drift alerts (e.g. "Theme X grew 23% this week"), upcoming deadlines.
- Each row: icon · context line · source pill · timestamp.
- Click → opens the relevant entity inline in a drawer.

#### States
- Empty (first-week): editorial empty state "Your context starts here. Drop your first meeting." → opens upload.
- Quiet day: shows a card "Nothing new. Want to ask Evols what to focus on?" → opens AskEvolsDock with a prefilled prompt.

#### Mobile
- Single column, stacked: Greeting → Weekly focus → Active projects (horizontal scroll) → Decisions → Inbox.

---

## 9. Accessibility (the WCAG 2.1 AA floor)

- **Contrast**: every text color tested against its background to ≥ 4.5:1 (3:1 for ≥ 24px). The token pairs above are pre-vetted.
- **Focus rings**: 2px `--ring` outset by 2px (4px gap effect), visible on every interactive in both themes. Never `outline: none`.
- **Keyboard**:
  - `⌘ K` / `Ctrl K`: command palette
  - `⌘ /` / `Ctrl /`: AskEvolsDock open
  - `g w`: go to Workbench, `g k`: Knowledge, `g p`: Projects, `g r`: Roadmap, etc. (vim-style chord)
  - `?`: show shortcut reference modal
- **Reduced motion**: all the §4.5f rules apply. Test with `prefers-reduced-motion: reduce`.
- **Screen readers**:
  - Use semantic HTML where Radix doesn't already (it mostly does).
  - Live regions: `role="status"` for non-critical (toast), `role="alert"` for errors, `role="log"` + `aria-live="polite"` for chat stream.
  - Announce route changes via a polite live region.
- **Color is never the only signal**: status badges always have a label or shape in addition to color.
- **Targets**: ≥ 44×44 on touch, ≥ 32×32 on pointer.
- **Forms**: every input has a `<label>`. Errors render below the field with `aria-describedby` linkage.
- **Chat citations**: each pill is `<a>` with `aria-label="Citation 3, source: 2026-04-15 customer call with Acme"`.

---

## 10. Implementation handoff

### 10.1 Suggested repo structure (under `frontend/`)

```
frontend/
├── app/                        # Next.js App Router
│   ├── (auth)/login/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx          # AppShell
│   │   ├── workbench/page.tsx
│   │   ├── knowledge/page.tsx
│   │   ├── themes/page.tsx
│   │   ├── initiatives/page.tsx
│   │   ├── projects/page.tsx
│   │   ├── roadmap/page.tsx
│   │   ├── personas/page.tsx
│   │   ├── personas/[id]/page.tsx
│   │   ├── context/page.tsx
│   │   ├── skills/page.tsx
│   │   └── settings/page.tsx
│   ├── globals.css             # imports tokens.css
│   └── layout.tsx              # html · ThemeProvider · fonts · aurora
├── components/
│   ├── ui/                     # shadcn primitives (overridden)
│   ├── shell/                  # TopBar, Sidebar, MobileTabBar, AskEvolsDock, CommandPalette
│   ├── ai/                     # ChatBubble, ToolUseChip, CitationPill, AIShimmer, AIThinking, AIStream
│   ├── data/                   # ThemeCard, InitiativeCard, ProjectCard, RICEMeter, ConfidenceBar
│   ├── graph/                  # GraphCanvas, NodeDrawer
│   ├── personas/               # PersonaTile, TwinChat
│   ├── roadmap/                # RoadmapLane, RoadmapGrid
│   └── primitives/             # EmptyState, EvidenceList, DecisionItem
├── lib/
│   ├── motion.ts               # ease, dur, spring, variants
│   ├── tokens.ts               # token names exported as TS constants
│   ├── theme-provider.tsx
│   └── shortcuts.ts            # global keyboard map
├── styles/
│   ├── tokens.css              # CSS custom properties (dark + light)
│   └── aurora.css              # aurora keyframes
└── tailwind.config.ts
```

### 10.2 Setup sequence (Claude Code, do these in order)

1. **Install deps**:
   ```
   pnpm add framer-motion lucide-react clsx tailwind-merge
   pnpm add -D @types/d3
   pnpm add d3 recharts
   ```
2. **Fonts**: in `app/layout.tsx`, load `Geist Sans`, `Geist Mono`, and `Instrument Serif` via `next/font/google`. Map to `--font-sans`, `--font-mono`, `--font-display`.
3. **Drop in `tokens.css` and `tailwind.config.ts`** from this handoff package.
4. **Build the AppShell** (§8.1) before any feature pages. Stub each page route.
5. **Build the AI primitives** (`AIShimmer`, `AIThinking`, `AIStream`, `CitationPill`, `ToolUseChip`) — reused everywhere.
6. **Build the AskEvolsDock** + CommandPalette — they're shell-level.
7. **Then** build screens in this order: Workbench → Themes/Initiatives/Projects → Roadmap → Knowledge graph → Personas → Work Context → Skills → Settings.
8. **A11y pass per screen** before marking done. Run axe-core in dev.
9. **Reduced-motion pass** before marking done.

### 10.3 Theming

- Use `next-themes` for dark/light. Default to `dark`. Persist on user toggle.
- `data-theme="dark"` and `data-theme="light"` swap token sets in `tokens.css`.
- shadcn components consume tokens via Tailwind utility classes that already reference our HSL values — override their `--primary`, `--secondary`, etc. to map to our brand tokens.

### 10.4 D3 / Recharts theming

- Recharts: pass `axis.stroke=var(--border-default)`, `axis.tick.fill=var(--text-tertiary)`, series colors derived from a 6-stop palette spun from `--brand-iris` and `--brand-mint`.
- D3: read tokens at runtime via `getComputedStyle(document.documentElement).getPropertyValue(...)` so theme changes are reflected without remounting the canvas.

---

## 11. Don'ts (so the team doesn't drift)

1. **Don't use drop shadows in dark mode.** Use layered backgrounds + subtle inner highlight.
2. **Don't introduce a new color** outside the token set without updating this doc + `tokens.css`.
3. **Don't use Lucide icons at 2px stroke.** Always 1.5.
4. **Don't apply the brand pulse gradient to text below 24px.**
5. **Don't use `transform: scale` on hover for cards** (subpixel blur).
6. **Don't put more than one editorial-serif moment per screen.**
7. **Don't ship a screen without an empty state and an AI affordance.**
8. **Don't let a chat stream reflow** — keep the active line height stable.
9. **Don't put glass-on-glass surfaces.** One layer of frost only.
10. **Don't use 700/800 font weights.** Heaviness comes from contrast, not weight.
11. **Don't hide focus rings.** Ever.
12. **Don't animate without a job.** Every motion answers "what changed?"

---

## 12. Files included in this handoff

| File | Purpose |
|---|---|
| `EVOLS_DESIGN_HANDOFF.md` | This document |
| `tokens.css` | Drop-in CSS custom properties (dark + light) |
| `tailwind.config.ts` | Tailwind theme extension wired to tokens |
| `motion.ts` | Framer Motion easings, durations, springs, variants |

---

## 13. Open questions for the team (not blockers)

These don't block Claude Code from starting; they sharpen the second pass.

1. Logo: do we have anyone designing the halo mark, or should we ship an SVG draft from this spec and iterate?
2. Default greeting copy on Work Context: keep generic, or offer 3 personas (warm, dry, technical)?
3. Persona twin voice: do twins respond in their own voice, or always in Evols' voice "speaking as the persona"? (Recommendation: own voice, sourced from quotes.)
4. Pricing surface: should the upgrade CTA appear in the sidebar quota meter, or only on settings?
5. Marketing site: out of scope for this doc — same brand, separate handoff?

---

*End of handoff. Build calmly. Ship the brain.*
