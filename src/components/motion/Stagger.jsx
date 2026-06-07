import { motion } from "framer-motion";
import { staggerVariants, itemVariants } from "../../lib/motion";

// Parent: orchestrates a staggered entrance for its <Item> children.
// `as` lets it keep the original element's grid/flex class (e.g. "db-grid").
export function Stagger({ children, className, style }) {
  return (
    <motion.div
      className={className}
      style={style}
      variants={staggerVariants}
      initial="initial"
      animate="animate"
    >
      {children}
    </motion.div>
  );
}

// Child: one revealing block. Keeps whatever className it's given
// (so grid placement like "db-card col-8" is preserved).
export function Item({ children, className, style, ...rest }) {
  return (
    <motion.div className={className} style={style} variants={itemVariants} {...rest}>
      {children}
    </motion.div>
  );
}
