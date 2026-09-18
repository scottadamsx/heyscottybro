/**
 * Remember the last call: while the arguments are the same values (Object.is),
 * return the previous result instead of recomputing. For pure, costly derivations
 * that run on every render (e.g. the Today page's money snapshot, re-rendered each minute).
 */
export function memoLast(fn) {
  let lastArgs = null;
  let lastResult;
  return (...args) => {
    if (lastArgs && args.length === lastArgs.length && args.every((a, i) => Object.is(a, lastArgs[i]))) return lastResult;
    lastResult = fn(...args);
    lastArgs = args;
    return lastResult;
  };
}
