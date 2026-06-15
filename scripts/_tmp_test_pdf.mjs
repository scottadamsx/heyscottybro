import { markdownToPdfBlob } from "../src/lib/markdownToPdf.js";
import { writeFileSync } from "node:fs";

const md = `# Project Status — Aulë

This is a **demo** of the agent PDF generator with _inline emphasis_, \`inline code\`,
a [link](https://example.com), and a long paragraph that should wrap nicely across
multiple lines without ever spilling past the right margin of the generated page.

## What I did
- Implemented the dependency-free generator
- Wired it into the Command Center
- Upgraded the Documents viewer too
  - nested bullet item
1. First numbered step
2. Second numbered step with a fairly long description that needs wrapping to verify list hanging indents behave

### Code sample
\`\`\`
function hello(name) {
  return "a very long line of source code that must be hard-wrapped by character because it cannot be split on spaces alone xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
}
\`\`\`

### A table
| Task | Owner | Status |
|------|-------|--------|
| Generator | Aulë | done |
| Viewer | Aulë | done |
| Wiring | Aulë | done |

---

Smart quotes “like this” and an em — dash and a bullet • should all sanitize. ${"Filler ".repeat(120)}
End.`;

const blob = markdownToPdfBlob(md, { title: "Agent Work — Demo", subtitle: "Galadriel · Overseer", footer: "heyscottybro · Command Center" });
const buf = Buffer.from(await blob.arrayBuffer());
writeFileSync(new URL("./_tmp_agent_demo.pdf", import.meta.url), buf);
const head = buf.subarray(0, 8).toString("latin1");
const tail = buf.subarray(buf.length - 8).toString("latin1");
console.log("bytes:", buf.length, "| head:", JSON.stringify(head), "| tail:", JSON.stringify(tail.trim()));
