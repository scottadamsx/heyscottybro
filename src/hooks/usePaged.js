import { useEffect, useState } from "react";

/**
 * Show a long list a page at a time: `visible` is the first N items, `showMore()` adds a page.
 * Resets to the first page when `resetKey` changes (e.g. a new search or filter).
 */
export function usePaged(items, pageSize = 50, resetKey = "") {
  const [count, setCount] = useState(pageSize);
  useEffect(() => { setCount(pageSize); }, [resetKey, pageSize]);
  const list = items || [];
  return {
    visible: list.length > count ? list.slice(0, count) : list,
    remaining: Math.max(0, list.length - count),
    showMore: () => setCount((c) => c + pageSize),
  };
}
