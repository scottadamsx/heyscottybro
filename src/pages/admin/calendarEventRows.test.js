import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("./CalendarPage.jsx", import.meta.url), "utf8");
const timeline = readFileSync(new URL("../../components/DayTimeline.jsx", import.meta.url), "utf8");
const planCss = readFileSync(new URL("./plan.css", import.meta.url), "utf8");

test("day events open and collapse through openEventId (BUG-080)", () => {
  assert.match(page, /const \[openEventId, setOpenEventId\] = useState\(null\)/);
  assert.match(page, /className="day-event-head"/);
  assert.match(page, /setOpenEventId\(isOpen \? null : e\.id\)/);
  assert.match(page, /aria-expanded=\{isOpen\}/);
});

test("upcoming event rows open the day with that event expanded (BUG-080)", () => {
  assert.match(page, /openDay\(e\.date, e\.id\)/);
  assert.match(page, /const openDay = \(date, eventId = null\)/);
});

test("documents render only inside the opened event detail, never in the collapsed row (BUG-080)", () => {
  const docUsages = page.match(/<DocLinks/g) || [];
  assert.equal(docUsages.length, 1);
  assert.ok(page.indexOf("<DocLinks") > page.indexOf("day-event-detail"));
  assert.match(page, /className="day-event-meta"/);
});

test("schedule timeline blocks open events and tasks (BUG-080)", () => {
  assert.match(page, /onBlockClick=\{onScheduleBlockClick\}/);
  assert.match(page, /navigate\(`\/admin\/tasks\/\$\{rawId\}`\)/);
  assert.match(timeline, /onBlockClick/);
  assert.match(timeline, /tl-block-btn/);
  assert.match(timeline, /tl-pill-btn/);
  assert.match(timeline, /ev\.stopPropagation\(\); onBlockClick\(block\)/);
});

test("compact event row styles cap title and meta at one line (BUG-080)", () => {
  assert.match(planCss, /\.day-event \{ display: block; \}/);
  assert.match(planCss, /\.day-event-meta \{[^}]*text-overflow: ellipsis/);
  assert.match(planCss, /\.day-event-main \.day-item-title \{[^}]*text-overflow: ellipsis/);
});
