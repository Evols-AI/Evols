# Evols — Design Refresh Smoke Tests

> **Purpose:** Walk through these in order on `http://localhost:3000` to verify the
> design refresh preserved every existing piece of functionality. Report any
> regression so we can fix before commit.
>
> **Estimated time:** 12–15 minutes.

---

## 0 · Pre-flight

- [ ] Dev server is reachable at <http://localhost:3000> (no compile errors in the terminal).
- [ ] Open DevTools → Console. There should be no red errors on any page below.

---

## 1 · Marketing landing (unauthenticated) — `/`

- [ ] Aurora atmosphere visible behind hero (subtle iris/mint glows, slow drift).
- [ ] Hero headline reads **"Your team's AI brain, _taking shape._"** — italic serif on "_taking shape._"
- [ ] **"Get early access"** button has an iris→mint gradient fill. Hover lifts it 1px.
- [ ] **"Book a demo"** button is a solid card with a hairline border.
- [ ] Hero terminal mock renders inside a glow halo. The dot row at the top is red / amber / mint (not red/yellow/green).
- [ ] Stats strip (`84%`, `75%`, `~300K`, `+15%`) renders below the hero with subtle backdrop blur.
- [ ] Scrolling **past the hero**: the topbar gets a glass blur (border + backdrop-filter).
- [ ] Section labels show a small mint dot before the label ("· The problem", "· The solution", etc.).
- [ ] Problems / Features cards have hover spotlight (cursor-tracking gradient highlight).
- [ ] Final CTA section shows a halo-ringed aperture mark above the headline.
- [ ] **Footer** has 3 columns (logo+tagline / Product / More), bottom row says `© 2026 Evols. Build calmly. Ship the brain.` with a mint dot + "All systems normal".
- [ ] **Theme toggle** (top-right): clicking it flips the page to light mode. All colors stay legible. Click again → back to dark.

## 2 · Auth pages

- [ ] `/login` — left column shows halo logomark + italic headline _"Welcome back to your team's brain."_ Right column is the sign-in card.
- [ ] Password / email fields have icon prefix; focus shows a 2px iris ring.
- [ ] Submit button is the iris→mint gradient pill with an arrow at the right.
- [ ] `/register` — same shape, with bullet list and 4 fields. "Create account" gradient button.
- [ ] Bad credentials still produce the existing inline error banner (red, AlertCircle icon).
- [ ] Already-authenticated visit redirects to `/workbench` (or `/admin/tenants` if SUPER_ADMIN) — same as before.
- [ ] `/auth/verify-email` still renders without console errors.

## 3 · Header / global shell

On any authenticated page:

- [ ] Topbar shows the wordmark on the left, primary nav (Workbench · Work Context · Knowledge · Skills) in the middle.
- [ ] Active nav item has a subtle background fill **and** a thin gradient underline below the topbar.
- [ ] Theme toggle is the moon/sun icon button.
- [ ] User menu (right side) shows a gradient avatar circle with initials + name + chevron. Dropdown opens with a glass surface; entries: Tenant switcher, Team (admins), Settings, Logout.
- [ ] As a SUPER_ADMIN, the nav switches to "Admin Panel · Support" instead.

## 4 · AskEvolsDock (the floating AI affordance)

The dock is **only** visible on authenticated product pages — not on `/`, `/login`, `/register`, `/workbench`, `/blog/*`, `/docs/*`, `/auth/*`, or `/admin-setup`.

- [ ] On `/dashboard` (or any product page) the dock appears bottom-right as a glass pill with a halo gradient ring, sparkle icon, "Ask Evols" label, and a `⌘K` keyboard chip.
- [ ] **Press ⌘K (or Ctrl-K)** — it expands into a focused composer above a scrim.
- [ ] **Esc** closes the composer. Clicking the scrim closes it.
- [ ] Type a query, press Enter — the page navigates to `/workbench?q=…` and the dock closes. (The Workbench iframe doesn't yet read the `q` param, but the navigation should still work cleanly.)
- [ ] **Important:** the dock must NOT appear on `/workbench` (the workbench page is itself the chat).

## 5 · Product pages — render-only check

For each, confirm the page loads, header/footer look right, and the existing functionality works:

- [ ] `/dashboard` — stat cards, page header.
- [ ] `/work-context` — tabs (overview · tasks · decisions · meetings · weekly-focus · strategy · ai-sessions). Click each tab — they switch correctly.
- [ ] `/work-context` — open the **"+"** action on Tasks. Modal still opens. Submitting it still creates the task.
- [ ] `/work-context` — Decisions tab → "+" → Decision modal opens; Weekly focus modal opens.
- [ ] `/context` — tabs (knowledge graph + strategy). Knowledge graph still renders.
- [ ] `/skills` — skills grid renders. Clicking a skill still opens its drawer.
- [ ] `/settings` — tabs (profile · team · notifications). Each tab switches and forms render.
- [ ] `/team-intelligence` — page renders.
- [ ] `/support` — page renders.

## 6 · Workbench iframe

- [ ] `/workbench` loads. Header shows the user.
- [ ] Loading state shows "Loading Workbench…" briefly.
- [ ] Iframe loads the LibreChat surface (assuming backend is running). If backend isn't reachable, the existing error message + Retry button shows up — that's expected, not a regression.
- [ ] **Theme sync:** toggle theme on the Evols topbar. The iframe's body class should flip too (this depends on the LibreChat fork being deployed; if you don't see it locally, that's not a regression caused by this PR).

## 7 · Blog & Docs

- [ ] `/blog` — list of posts renders.
- [ ] `/blog/<any-slug>` — markdown content renders with editorial serif headings (Instrument Serif), readable body. Code blocks, tables, lists all formatted.
- [ ] `/docs` and `/docs/workbench` — render correctly.

## 8 · Admin (SUPER_ADMIN only)

- [ ] Sign in as SUPER_ADMIN.
- [ ] `/admin/tenants` — list of tenants. Search / filter / pagination still work.
- [ ] `/admin/tenants/[id]/users` — user list.
- [ ] `/admin/support` — support panel.
- [ ] `/admin-setup` — initial setup wizard.

## 9 · Theme & motion edge cases

- [ ] In **System Preferences → Reduce Motion**: the aurora should freeze; transitions should snap. Re-enable motion to confirm aurora drift returns.
- [ ] In **light mode**: every page is still legible. Cards, text, icons all have sufficient contrast. CTAs use the lighter iris→mint variant.
- [ ] Resize the window to mobile width (<768px). Header collapses gracefully (logo + theme + avatar). Page content stacks. The AskEvolsDock pill should disappear on mobile (it has `hidden md:flex`), so this is intentional — the user can still navigate.

---

## What "pass" means

Every checkbox checked **and** no console errors. If something looks visually off but functionally works, jot it down with a screenshot — those are polish items I'll address in the second pass. If something is **broken** (modal won't open, form won't submit, redirect chain wrong), flag it as a hard regression and I'll fix before commit.

---

*If you complete the smoke tests and approve, I'll commit & open the PR.*
