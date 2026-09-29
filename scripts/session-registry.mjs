import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ID_PATTERN = /^SAI(\d{8})$/;
const THREAD_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENTS = new Set(["reserved", "bound", "activated", "closed", "abandoned"]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export function parseRegistry(text) {
  return text.split(/\r?\n/).flatMap((line, index) => {
    if (!line.trim()) return [];
    try {
      return [{ ...JSON.parse(line), _line: index + 1 }];
    } catch (error) {
      throw new Error(`registry line ${index + 1} is not valid JSON: ${error.message}`);
    }
  });
}

function parseGlossary(text) {
  const rows = new Map();
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!/^\|\s*`SAI\d{8}`\s*\|/.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    invariant(cells.length === 7, `glossary line ${index + 1} must contain seven columns`);
    const id = cells[0].replaceAll("`", "");
    invariant(!rows.has(id), `glossary lists ${id} more than once`);
    rows.set(id, {
      id,
      title: cells[1].replaceAll("`", ""),
      status: cells[2],
      threadId: cells[5].replaceAll("`", ""),
    });
  }
  return rows;
}

function formatId(number) {
  return `SAI${String(number).padStart(8, "0")}`;
}

/**
 * Validates the immutable SAI event history and its human-readable projection.
 * Returns the current sessions and the only ID that may be reserved next.
 */
export function validateSessionRegistry(registryText, glossaryText) {
  const records = parseRegistry(registryText);
  invariant(records[0]?.type === "registry_metadata", "registry metadata must be the first record");
  const metadata = records.filter((record) => record.type === "registry_metadata");
  invariant(metadata.length === 1, "registry must contain exactly one metadata record");
  invariant(metadata[0].sequence_start === 1, "registry sequence must start at 1");
  invariant(metadata[0].id_format === "SAI########", "registry ID format must be SAI########");
  invariant(metadata[0].title_format === "Bonsai Chat SAI########", "registry title format is invalid");

  const sessions = new Map();
  const boundThreads = new Map();
  let reservationCount = 0;

  for (const record of records) {
    if (record.type === "registry_metadata") continue;
    invariant(record.type === "session_event", `registry line ${record._line} has an unknown record type`);
    invariant(record.schema_version === 1, `registry line ${record._line} has an unsupported schema version`);
    invariant(EVENTS.has(record.event), `registry line ${record._line} has an unknown lifecycle event`);
    invariant(/^\d{4}-\d{2}-\d{2}$/.test(record.occurred_on ?? ""), `registry line ${record._line} has an invalid event date`);
    invariant(record.actor === "Project Manager", `registry line ${record._line} was not recorded by the Project Manager`);
    const match = ID_PATTERN.exec(record.sai_id ?? "");
    invariant(match, `registry line ${record._line} has an invalid SAI ID`);

    if (record.event === "reserved") {
      reservationCount += 1;
      const expectedId = formatId(reservationCount);
      invariant(record.sai_id === expectedId, `reservation ${record.sai_id} is out of sequence; expected ${expectedId}`);
      invariant(!sessions.has(record.sai_id), `${record.sai_id} is reserved more than once`);
      invariant(/^\d{4}-\d{2}-\d{2}$/.test(record.started_on ?? ""), `${record.sai_id} has an invalid start date`);
      invariant(typeof record.project === "string" && record.project.length > 0, `${record.sai_id} has no project`);
      invariant(typeof record.purpose === "string" && record.purpose.length > 0, `${record.sai_id} has no purpose`);
      invariant(Object.hasOwn(record, "parent_sai_id"), `${record.sai_id} has no parent-session field`);
      if (record.parent_sai_id !== null) {
        invariant(sessions.has(record.parent_sai_id), `${record.sai_id} references an unknown parent ${record.parent_sai_id}`);
      }
      sessions.set(record.sai_id, { id: record.sai_id, status: "Reserved", title: null, threadId: null });
      continue;
    }

    const session = sessions.get(record.sai_id);
    invariant(session, `${record.event} for ${record.sai_id} appears before its reservation`);
    invariant(session.status !== "Abandoned", `${record.sai_id} has lifecycle events after abandonment`);

    if (record.event === "bound") {
      invariant(!session.threadId, `${record.sai_id} is bound more than once`);
      invariant(THREAD_PATTERN.test(record.thread_id ?? ""), `${record.sai_id} has an invalid Codex thread ID`);
      invariant(record.title === `Bonsai Chat ${record.sai_id}`, `${record.sai_id} has an invalid exact chat title`);
      invariant(!boundThreads.has(record.thread_id), `Codex thread ${record.thread_id} is bound to more than one SAI ID`);
      invariant(typeof record.archive_path === "string" && record.archive_path.length > 0, `${record.sai_id} has no archive path`);
      invariant(typeof record.summary_path === "string" && record.summary_path.length > 0, `${record.sai_id} has no summary path`);
      session.threadId = record.thread_id;
      session.title = record.title;
      boundThreads.set(record.thread_id, record.sai_id);
    } else if (record.event === "activated") {
      invariant(session.threadId, `${record.sai_id} is activated before it is bound`);
      session.status = "Active";
    } else if (record.event === "closed") {
      invariant(session.threadId, `${record.sai_id} is closed before it is bound`);
      session.status = "Closed";
    } else if (record.event === "abandoned") {
      session.status = "Abandoned";
    }
  }

  const glossary = parseGlossary(glossaryText);
  invariant(glossary.size === sessions.size, "glossary and registry contain different numbers of SAI IDs");
  for (const session of sessions.values()) {
    const row = glossary.get(session.id);
    invariant(row, `glossary is missing ${session.id}`);
    invariant(row.status === session.status, `glossary status for ${session.id} must be ${session.status}`);
    if (session.title) invariant(row.title === session.title, `glossary title for ${session.id} does not match its binding`);
    if (session.threadId) invariant(row.threadId === session.threadId, `glossary thread for ${session.id} does not match its binding`);
  }
  for (const id of glossary.keys()) invariant(sessions.has(id), `glossary contains unreserved ID ${id}`);

  return {
    sessions: [...sessions.values()],
    nextId: formatId(reservationCount + 1),
  };
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === modulePath) {
  const registryUrl = new URL("../docs/sessions/registry.jsonl", import.meta.url);
  const glossaryUrl = new URL("../docs/sessions/GLOSSARY.md", import.meta.url);
  const result = validateSessionRegistry(readFileSync(registryUrl, "utf8"), readFileSync(glossaryUrl, "utf8"));
  console.log(`Session registry valid: ${result.sessions.length} ID(s); next ${result.nextId}.`);
}
