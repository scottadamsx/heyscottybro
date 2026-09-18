import { MotionConfig } from "framer-motion";

/**
 * reducedMotion="user" → respects prefers-reduced-motion. Lives inside the lazy areas that
 * animate (the admin shell, the public pages with motion) so framer-motion isn't part of the
 * startup bundle for pages that never animate.
 */
export default function MotionScope({ children }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
