// ═══════════════════════════════════════════
//  Motion tokens — shared easing/durations so every
//  animation in the app shares one rhythm.
//  Pair with <MotionConfig reducedMotion="user"> (see main.jsx):
//  transforms collapse to opacity (or nothing) when the user
//  prefers reduced motion — no per-component guards needed.
// ═══════════════════════════════════════════

export const ease = {
  out: [0.16, 1, 0.3, 1],   // entrances — decisive expo-out
  in: [0.7, 0, 0.84, 0],    // exits — quick getaway
  inOut: [0.65, 0, 0.35, 1],
};

export const dur = {
  micro: 0.14, // hovers, taps
  base: 0.4,   // entrances
  exit: 0.24,  // exits (~60% of base)
};

// Page-level transition (route changes)
export const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } },
  exit: { opacity: 0, y: -8, transition: { duration: dur.exit, ease: ease.in } },
};

// Container that staggers its <Item> children
export const staggerVariants = {
  animate: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};

// Individual revealing item
export const itemVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } },
};
