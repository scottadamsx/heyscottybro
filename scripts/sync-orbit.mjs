// node scripts/sync-orbit.mjs — copy Orbit (../orbit) into orbit/ for the People space.
// Orbit is developed in its own repo; this folder is a read-only copy. Change Orbit there,
// commit, then re-run this script. The copy keeps Orbit's layout (server/ imports ../src/lib).
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const HERE = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.resolve(process.env.ORBIT_REPO || path.join(HERE, "..", "orbit"));
const DEST = path.join(HERE, "orbit");

const dirty = execSync("git status --porcelain -- server src", { cwd: SRC }).toString().trim();
if (dirty && !process.argv.includes("--allow-dirty")) {
  console.error(`Orbit has uncommitted changes; commit them first (or pass --allow-dirty):\n${dirty}`);
  process.exit(1);
}
const commit = execSync("git rev-parse --short HEAD", { cwd: SRC }).toString().trim();

// Server files the hosted API needs (not the CLI tools, seeds or the local entry point).
const SERVER = ["app.js", "cloudStore.js", "hosted.js", "importer.js", "repo.js", "store.js", "ai"];
const skip = (name) => /\.test\.js$/.test(name) || name === "main.jsx";

function copy(from, to) {
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const name of fs.readdirSync(from)) if (!skip(name)) copy(path.join(from, name), path.join(to, name));
  } else {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
}

fs.rmSync(DEST, { recursive: true, force: true });
for (const name of SERVER) copy(path.join(SRC, "server", name), path.join(DEST, "server", name));
copy(path.join(SRC, "src"), path.join(DEST, "src"));
fs.writeFileSync(
  path.join(DEST, "VENDORED.md"),
  `# Orbit (copied, do not edit)\n\nCopied from \`${path.basename(SRC)}\` at commit \`${commit}\` by \`node scripts/sync-orbit.mjs\`.\n` +
    `Change Orbit in its own repo, commit, and re-run the script. Used by the People space\n` +
    `(src/pages/admin/PeoplePage.jsx) and the /api/orbit function (api/orbit.js).\n`,
);
console.log(`orbit/ now matches ${path.basename(SRC)}@${commit}`);
