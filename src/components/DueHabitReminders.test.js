import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const source = (await readFile(new URL("./DueHabitReminders.jsx", import.meta.url), "utf8"))
  .replace('from "react"', `from ${JSON.stringify(import.meta.resolve("react"))}`);
const { code } = await transform(source, { loader: "jsx", format: "esm", jsx: "transform" });
const { default: DueHabitReminders } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const tracker = { id: "laundry", name: "Laundry" };
const row = { tracker, dueDate: "2026-09-12", overdue: true };

test("due habit cards label overdue work and disable completion while saving", () => {
  const html = renderToStaticMarkup(React.createElement(DueHabitReminders, { rows: [row], busyId: tracker.id }));
  assert.match(html, /Habits due \(1\)/);
  assert.match(html, /Overdue/);
  assert.match(html, /2026-09-12/);
  assert.match(html, /disabled=""/);
  assert.match(html, /Saving…/);
  assert.match(html, /aria-label="Mark Laundry done today"/);
});

test("habit controls target the original tracker and its schedule", () => {
  let completed, edited;
  const element = DueHabitReminders({ rows: [row], onDone: value => completed = value, onEdit: value => edited = value });
  const buttons = [];
  const walk = node => {
    if (!React.isValidElement(node)) return;
    if (node.type === "button") buttons.push(node);
    React.Children.forEach(node.props.children, walk);
  };
  walk(element);
  buttons.find(button => button.props.children === "Schedule").props.onClick();
  buttons.find(button => button.props["aria-label"]).props.onClick();
  assert.equal(completed, tracker);
  assert.equal(edited, tracker.id);
});

test("empty due list communicates no due habits rather than showing a fake task", () => {
  const html = renderToStaticMarkup(React.createElement(DueHabitReminders, { rows: [] }));
  assert.match(html, /No unfinished habits due today/);
  assert.doesNotMatch(html, /<button/);
});
