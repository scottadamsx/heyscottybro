import { test } from "node:test";
import assert from "node:assert/strict";
import { memoLast } from "./memoLast.js";

test("memoLast reuses the result while arguments are identical", () => {
  let calls = 0;
  const f = memoLast((list, day) => { calls++; return list.filter((x) => x.day === day); });
  const list = [{ day: "a" }, { day: "b" }];
  const r1 = f(list, "a");
  assert.equal(f(list, "a"), r1);
  assert.equal(calls, 1);
  f(list, "b");
  assert.equal(calls, 2);
  f([...list], "b"); // new array identity → recompute
  assert.equal(calls, 3);
});

test("memoLast does not cache a throw", () => {
  let n = 0;
  const f = memoLast(() => { n++; if (n === 1) throw new Error("x"); return n; });
  assert.throws(() => f(1));
  assert.equal(f(1), 2);
});
