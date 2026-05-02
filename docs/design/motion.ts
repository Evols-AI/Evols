/**
 * Evols motion presets — Framer Motion
 *
 * Drop in at lib/motion.ts. Every component that animates should import
 * `ease`, `dur`, `spring`, or one of the named variants from here.
 *
 * Rule of thumb: never inline numeric durations or eases in components.
 * Reach into this file. That's how the system stays cohesive.
 */

import type { Transition, Variants } from "framer-motion";

/* ============================================================
   Easing curves
   ============================================================ */

export const ease = {
  /** Smooth out — default for entrances. */
  out:       [0.16, 1, 0.3, 1] as const,
  /** Symmetric — hover, color, simple toggles. */
  inOut:     [0.4, 0, 0.2, 1] as const,
  /** Soft overshoot — success pop, "score landed". */
  spring:    [0.34, 1.56, 0.64, 1] as const,
  /** Strong out — page-level reveal, hero. */
  emphasize: [0.2, 0, 0, 1] as const,
};

/* ============================================================
   Durations (ms)
   ============================================================ */

export const dur = {
  micro: 0.12,  // icon swap, focus
  fast:  0.18,  // hover, toggle
  base:  0.24,  // panel slide, modal in
  mod:   0.36,  // tab change, route soft
  slow:  0.6,   // hero reveal, section in
  epic:  0.9,   // first-paint reveal, login → app
};

/* ============================================================
   Spring presets
   ============================================================ */

export const spring = {
  /** Snappy default for UI primitives. */
  ui:         { type: "spring" as const, stiffness: 320, damping: 30, mass: 0.8 },
  /** Calmer panel/drawer slide. */
  panel:      { type: "spring" as const, stiffness: 220, damping: 28, mass: 1.0 },
  /** Expressive — hero, persona detail entrance, drag landings. */
  expressive: { type: "spring" as const, stiffness: 180, damping: 22, mass: 1.0 },
  /** Bouncy — success toasts, drop landings. */
  bounce:     { type: "spring" as const, stiffness: 360, damping: 18, mass: 0.6 },
};

/* ============================================================
   Reduced-motion guard
   ============================================================ */

export function reduceMotionTransition(t: Transition): Transition {
  if (typeof window === "undefined") return t;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return reduce ? { duration: 0 } : t;
}

/* ============================================================
   Reusable variant sets
   ============================================================ */

/** Fade up — most cards, list items, page content. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show:   { opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } },
};

/** Fade only — subtle reveals (citations, tooltips). */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: dur.fast, ease: ease.inOut } },
};

/** Stagger container — for lists where children fadeUp in. */
export const stagger = (childDelay = 0.04): Variants => ({
  hidden: {},
  show: {
    transition: { staggerChildren: childDelay, delayChildren: 0.04 },
  },
});

/** Sheet from right — drawers (NodeDrawer, persona twin context). */
export const sheetFromRight: Variants = {
  hidden: { x: "100%" },
  show:   { x: 0, transition: spring.panel },
  exit:   { x: "100%", transition: { duration: dur.base, ease: ease.inOut } },
};

/** Sheet from bottom — mobile drawers, AskEvolsDock expand on mobile. */
export const sheetFromBottom: Variants = {
  hidden: { y: "100%" },
  show:   { y: 0, transition: spring.panel },
  exit:   { y: "100%", transition: { duration: dur.base, ease: ease.inOut } },
};

/** Modal — scale + fade. */
export const modal: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show:   { opacity: 1, scale: 1, transition: spring.panel },
  exit:   { opacity: 0, scale: 0.98, transition: { duration: dur.fast, ease: ease.inOut } },
};

/** Page transition — wrap each page in <motion.main variants={page}>. */
export const page: Variants = {
  hidden: { opacity: 0, y: 8 },
  show:   { opacity: 1, y: 0, transition: { duration: dur.mod, ease: ease.out } },
  exit:   { opacity: 0, transition: { duration: dur.fast, ease: ease.inOut } },
};

/** Card hover — apply via whileHover. */
export const cardHover = {
  whileHover: { y: -2, transition: { duration: dur.fast, ease: ease.inOut } },
  whileTap:   { y: 0,  transition: { duration: dur.micro, ease: ease.inOut } },
};

/* ============================================================
   AI-specific motion
   ============================================================ */

/** Thinking dots — render three <motion.span> with these props, indexed 0/1/2. */
export const thinkingDot = (index: 0 | 1 | 2) => ({
  animate: { opacity: [0.3, 1, 0.3] },
  transition: {
    duration: 1.2,
    ease: ease.inOut,
    repeat: Infinity,
    delay: index * 0.2,
  },
});

/** Tool-use ribbon fill while a tool runs. Set `key` to the toolId so each call re-fires. */
export const toolRibbon: Variants = {
  hidden: { scaleX: 0, opacity: 0 },
  show:   { scaleX: 1, opacity: 1, transition: { duration: dur.slow, ease: ease.emphasize } },
  exit:   { opacity: 0, transition: { duration: dur.fast } },
};

/** Score reveal — apply to the bar fill. Pass target via style { width: `${score}%` }. */
export const scoreFill: Variants = {
  hidden: { width: 0 },
  show:   (target: number) => ({
    width: `${target}%`,
    transition: { duration: dur.slow, ease: ease.emphasize },
  }),
};

/** Citation pill hover lift. */
export const citationLift = {
  whileHover: { y: -2, transition: { duration: dur.fast, ease: ease.inOut } },
};

/* ============================================================
   Layout transitions — pair with `layout` or `layoutId` on motion components
   ============================================================ */

export const layoutTransition: Transition = {
  duration: dur.base,
  ease: ease.out,
};

/* ============================================================
   Toast
   ============================================================ */

export const toast: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  show:   { opacity: 1, y: 0, scale: 1, transition: spring.bounce },
  exit:   { opacity: 0, y: 8, transition: { duration: dur.fast, ease: ease.inOut } },
};
