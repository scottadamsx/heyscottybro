import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const source = (await readFile(new URL("./DueHabitReminders.jsx", import.meta.url), "utf8"))
  .replace('from "react"', `from ${JSON.stringify(import.meta.resolve("react"))}`);
const { code } = await transform(source, { loader: "jsx", format: "esm", jsx: "transform" });
const { default: DueHabitReminders, UpcomingHabitRow } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const tracker = { id: "laundry", name: "Laundry" };
const row = { tracker, dueDate: "2026-09-12", overdue: true };

const collectButtons = (element) => {
  const buttons = [];
  const walk = node => {
    if (!React.isValidElement(node)) return;
    if (node.type === "button") buttons.push(node);
    React.Children.forEach(node.props.children, walk);
  };
  walk(element);
  return buttons;
};

test("due habit rows carry a Habit tag and disable completion while saving", () => {
  const html = renderToStaticMarkup(React.createElement(DueHabitReminders, { rows: [row], busyId: tracker.id }));
  assert.match(html, /habit-tag/);
  assert.match(html, />Habit</);
  assert.match(html, /Overdue/);
  assert.match(html, /2026-09-12/);
  assert.match(html, /disabled=""/);
  assert.match(html, /Saving…/);
  assert.match(html, /aria-label="Mark Laundry done today"/);
});

test("habit controls target the original tracker and its schedule", () => {
  let completed, edited;
  const element = DueHabitReminders({ rows: [row], onDone: value => completed = value, onEdit: value => edited = value });
  const buttons = collectButtons(element);
  buttons.find(button => button.props.children === "Schedule").props.onClick();
  buttons.find(button => button.props["aria-label"]).props.onClick();
  assert.equal(completed, tracker);
  assert.equal(edited, tracker.id);
});

test("empty due list renders no rows; the page owns the empty state", () => {
  const html = renderToStaticMarkup(React.createElement(DueHabitReminders, { rows: [] }));
  assert.doesNotMatch(html, /<button/);
  assert.doesNotMatch(html, /No unfinished habits due today/);
});

test("Missed it crosses a habit out; crossed-out habits stay listed with Undo", () => {
  let missed, unmissed;
  const element = DueHabitReminders({ rows: [row], missedRows: [{ tracker: { id: "gym", name: "Gym" }, date: "2026-09-14" }], onDone() {}, onEdit() {}, onMiss: v => missed = v, onUnmiss: v => unmissed = v });
  const buttons = collectButtons(element);
  buttons.find(b => b.props["aria-label"] === "Mark Laundry missed today").props.onClick();
  buttons.find(b => b.props["aria-label"] === "Undo missed for Gym").props.onClick();
  assert.equal(missed, tracker);
  assert.equal(unmissed.id, "gym");
  const html = renderToStaticMarkup(React.createElement(DueHabitReminders, { rows: [], missedRows: [{ tracker: { id: "gym", name: "Gym" } }], onUnmiss() {} }));
  assert.match(html, /is-missed/);
  assert.match(html, /Missed/);
  assert.match(html, /habit-tag/);
});

test("upcoming habit rows show the Habit tag and next due label, with Schedule only", () => {
  let edited;
  const element = UpcomingHabitRow({ tracker, label: "Due Friday, Sep 18th", onEdit: v => edited = v });
  const buttons = collectButtons(element);
  assert.equal(buttons.length, 1);
  buttons[0].props.onClick();
  assert.equal(edited, tracker.id);
  const html = renderToStaticMarkup(React.createElement(UpcomingHabitRow, { tracker, label: "Due Friday, Sep 18th", onEdit() {} }));
  assert.match(html, /habit-tag/);
  assert.match(html, /Due Friday, Sep 18th/);
  assert.doesNotMatch(html, /Done/);
});
