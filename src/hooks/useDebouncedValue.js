import { useEffect, useState } from "react";

/** `value`, but only after it has stopped changing for `ms` — for inputs that hit the network. */
export function useDebouncedValue(value, ms = 250) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}
