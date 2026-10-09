import assert from "node:assert/strict";
import test from "node:test";
import { readUploadedDocument } from "./documentText.js";

function documentHarness(doc, content = "") {
  const calls = [];
  return {
    calls,
    read: (input) => readUploadedDocument(input, {
      getDocument: async (id) => { calls.push(["metadata", id]); return doc; },
      downloadDocument: async (path) => { calls.push(["download", path]); return new Blob([content]); },
    }),
  };
}

test("TXT reading returns question-relevant lines with source labels", async () => {
  const { read, calls } = documentHarness({ id: "resume-1", name: "Resume", filename: "resume.txt", mime_type: "text/plain", size_bytes: 160, storage_path: "owner/resume.txt" }, [
    "Professional Experience",
    "Store Manager — North Foods (2021–2023)",
    "Sales Associate — Harbour Market (2017–2020)",
    "Education",
  ].join("\n"));
  const result = await read({ id: "resume-1", question: "What was my first job?" });
  assert.equal(result.document, "Resume");
  assert.equal(result.format, "TEXT");
  assert.ok(result.excerpts.some(({ text }) => text.includes("Sales Associate")));
  assert.ok(result.excerpts.some(({ source }) => source === "line 3"));
  assert.deepEqual(calls, [["metadata", "resume-1"], ["download", "owner/resume.txt"]]);
});

test("reading requires a question and a real document id", async () => {
  const { read, calls } = documentHarness(null);
  assert.match((await read({ id: "", question: "job" })).error, /id is required/);
  assert.match((await read({ id: "doc-1", question: " " })).error, /question is required/);
  assert.deepEqual(calls, []);
});

test("unsupported files are rejected before storage download", async () => {
  const { read, calls } = documentHarness({ id: "doc-1", filename: "resume.doc", mime_type: "application/msword", size_bytes: 10, storage_path: "owner/doc" });
  assert.match((await read({ id: "doc-1", question: "job" })).error, /Supported formats: PDF, DOCX and TXT/);
  assert.deepEqual(calls, [["metadata", "doc-1"]]);
});

test("oversized uploads are rejected before storage download", async () => {
  const { read, calls } = documentHarness({ id: "doc-1", filename: "resume.txt", mime_type: "text/plain", size_bytes: 15 * 1024 * 1024 + 1, storage_path: "owner/doc" });
  assert.match((await read({ id: "doc-1", question: "job" })).error, /15 MB reading limit/);
  assert.deepEqual(calls, [["metadata", "doc-1"]]);
});

test("empty and corrupted files return readable errors", async () => {
  const empty = documentHarness({ id: "doc-1", filename: "resume.txt", mime_type: "text/plain", size_bytes: 1, storage_path: "owner/doc" }, "");
  assert.match((await empty.read({ id: "doc-1", question: "job" })).error, /file is empty/);

  const corrupt = documentHarness({ id: "doc-2", filename: "resume.docx", mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size_bytes: 3, storage_path: "owner/docx" }, "bad");
  assert.match((await corrupt.read({ id: "doc-2", question: "job" })).error, /Couldn't read this file/);
});
