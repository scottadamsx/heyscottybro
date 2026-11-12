import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./DocLinks.jsx", import.meta.url), "utf8");

test("linked files open in the in-app DocumentViewer modal, not a new tab", () => {
  assert.match(src, /import DocumentViewer from "\.\.\/documents\/DocumentViewer";/);
  assert.match(src, /const \[viewing, setViewing\] = useState\(null\)/);
  assert.match(src, /\{viewing && <DocumentViewer doc=\{viewing\} onClose=\{\(\) => setViewing\(null\)\} \/>\}/);
  assert.match(src, /setViewing\(\{ \.\.\.link\.document, name: link\.document\.name \|\| link\.node_title \}\)/);
  assert.doesNotMatch(src, /window\.open/);
  assert.doesNotMatch(src, /fileLinkUrl/);
});

test("a file link with nothing behind it toasts instead of opening an empty viewer", () => {
  assert.match(src, /if \(!link\.document\?\.storage_path\) \{ addToast\("This link has no file behind it", "error"\); return; \}/);
});

test("opening a file marks the link read, like note links already do", () => {
  assert.match(src, /if \(!link\.read\) \{\s*\n\s*try \{\s*\n\s*const updated = await setDocRead\(link\.id, true\);/);
});

test("brain note links still open in the full-page reader", () => {
  assert.match(src, /navigate\(`\/admin\/read\/\$\{encodeURI\(link\.node_slug\)\}\?link=\$\{link\.id\}`\)/);
});
