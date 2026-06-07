import { motion } from "framer-motion";
import { pageVariants } from "../../lib/motion";

// Wraps a route's content so it fades/slides on navigation.
// Use inside <AnimatePresence mode="wait"> keyed by location.pathname.
export default function PageTransition({ children, className, style }) {
  return (
    <motion.div
      className={className}
      style={style}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}
