import { useState } from "react";
import { fileToContent, extract } from "../../lib/smartImport";
import { newReminder } from "../../api/plannerApi";
import { createGrade, updateGrade } from "../../api/gradesApi";
import { updateCourse } from "../../api/coursesApi";
import { createNode } from "../../api/brainApi";
import { uploadDocument } from "../../api/documentsApi";
import { toDateStr } from "../../utils/plannerUtils";
import { Modal } from "../ui";
import { useToast } from "../../contexts/ToastContext";
import "../budget/statementImport.css";

/**
 * School Import — drop an announcement, syllabus, or grade release and the
 * School space learns it: new deadlines (as course-tagged reminders, so Plan
 * and Today update too), grade rows created or updated, course details fixed,
 * and a summary filed into the Brain so the agents know it as well.
 * Same trust pipeline as banking: AI proposes → you approve → it writes.
 */

const SCHOOL_TOOL = {
  name: "parse_school_doc",
  description: "Extract actionable school knowledge from a course document.",
  input_schema: {
    type: "object",
    properties: {
      course_id: { type: "string", description: "id of the matching course from the provided list, or omit if unclear" },
      title: { type: "string", description: "Short title for this document (e.g. 'Week 10 announcement')" },
      summary: { type: "string", description: "3-5 sentence summary of what changed / what matters" },
      deadlines: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD" },
            detail: { type: "string" },
            already_tracked: { type: "boolean", description: "true if it matches an existing deadline provided" },
          },
          required: ["name", "date"],
        },
      },
      grade_updates: {
        type: "array",
        description: "Assessments mentioned with weights or scores. match_name = the existing assessment it refers to, if any.",
        items: {
          type: "object",
          properties: {
            match_name: { type: "string" }, name: { type: "string" },
            earned: { type: "number" }, max: { type: "number" }, weight: { type: "number" },
            feedback: { type: "string" },
          },
          required: ["name"],
        },
      },
      course_updates: {
        type: "object",
        properties: { instructor: { type: "string" }, name: { type: "string" } },
      },
    },
    required: ["title", "summary"],
  },
};

export default function SchoolImport({ courses, grades, deadlines, onClose, onApplied }) {
  const { addToast } = useToast();
  const [phase, setPhase] = useState("idle");
  const [paste, setPaste] = useState("");
  const [courseId, setCourseId] = useState("");
  const [out, setOut] = useState(null);
  const [sourceText, setSourceText] = useState("");
  const [sourceFile, setSourceFile] = useState(null);
  const [checks, setChecks] = useState({});

  const analyze = async (content) => {
    setPhase("busy");
    setSourceText(content.text || "");
    try {
      const result = await extract({
        system:
          "You read school documents (announcements, syllabi, grade releases) and extract only what is actually stated — never invent dates, weights, or scores. Dates resolve to YYYY-MM-DD; if a date is ambiguous or relative without an anchor, omit that deadline. Today is " + toDateStr(new Date()) + ".",
        prompt:
          "Extract deadlines, grade information, and course corrections from this document.\n\nMY COURSES:\n" +
          JSON.stringify(courses.map((c) => ({ id: c.id, code: c.code, name: c.name, instructor: c.instructor }))) +
          "\n\nEXISTING DEADLINES (mark matches already_tracked):\n" +
          JSON.stringify(deadlines.map((d) => ({ name: d.name, date: d.date }))) +
          "\n\nEXISTING ASSESSMENTS:\n" +
          JSON.stringify(grades.map((g) => ({ name: g.name, earned: g.earned, max: g.max, weight: g.weight }))),
        tool: SCHOOL_TOOL,
        content,
      });
      setOut(result);
      if (result.course_id && courses.some((c) => c.id === result.course_id)) setCourseId(result.course_id);
      else if (courses.length === 1) setCourseId(courses[0].id);
      // default checks: new deadlines on, already-tracked off, grades on, course updates on
      const c = {};
      (result.deadlines || []).forEach((d, i) => { c[`d${i}`] = !d.already_tracked; });
      (result.grade_updates || []).forEach((_, i) => { c[`g${i}`] = true; });
      if (result.course_updates && Object.keys(result.course_updates).length) c.course = true;
      c.brain = true;
      setChecks(c);
      setPhase("review");
    } catch (e) {
      addToast(e.message, "error");
      setPhase("idle");
    }
  };

  const onFile = async (f) => {
    if (!f) return;
    setSourceFile(f);
    try { await analyze(await fileToContent(f)); }
    catch (e) { addToast(e.message, "error"); setPhase("idle"); }
  };

  const apply = async () => {
    const course = courses.find((c) => c.id === courseId);
    if (!course) { addToast("Pick which course this document belongs to.", "error"); return; }
    setPhase("busy");
    let made = 0;
    try {
      for (const [i, d] of (out.deadlines || []).entries()) {
        if (!checks[`d${i}`]) continue;
        await newReminder({ name: `${d.name}`, date: d.date, course_id: course.id, description: d.detail || `${course.code} — from imported document` });
        made++;
      }
      for (const [i, g] of (out.grade_updates || []).entries()) {
        if (!checks[`g${i}`]) continue;
        const existing = grades.find((x) => (x.course_id === course.id || x.course === course.code) &&
          x.name.toLowerCase() === (g.match_name || g.name).toLowerCase());
        const fields = {};
        if (g.earned != null) fields.earned = g.earned;
        if (g.max != null) fields.max = g.max;
        if (g.weight != null) fields.weight = g.weight;
        if (g.feedback) fields.feedback = g.feedback;
        if (existing) await updateGrade(existing.id, fields);
        else await createGrade({ course_id: course.id, course: course.code, name: g.name, earned: g.earned ?? null, max: g.max ?? 100, weight: g.weight ?? 0, feedback: g.feedback || "" });
        made++;
      }
      if (checks.course && out.course_updates) {
        const cu = {};
        if (out.course_updates.instructor) cu.instructor = out.course_updates.instructor;
        if (out.course_updates.name) cu.name = out.course_updates.name;
        if (Object.keys(cu).length) { await updateCourse(course.id, cu); made++; }
      }
      if (checks.brain) {
        const stamp = toDateStr(new Date());
        // Save the ACTUAL document into the vault so the School split view can
        // show it side-by-side with this note. The note carries a doc:<id> tag.
        let docTag = null;
        if (sourceFile) {
          try {
            const docRow = await uploadDocument(sourceFile, { name: `${course.code} — ${out.title}`, tags: ["school", course.code] });
            docTag = `doc:${docRow.id}`;
          } catch { /* the note still saves without the file */ }
        }
        await createNode({
          slug: `school/${course.code.toLowerCase().replace(/\s+/g, "-")}-${stamp}-${(out.title || "doc").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}`,
          title: `${course.code}: ${out.title}`,
          body: `# ${out.title}\n\n${out.summary}${!docTag && sourceText ? `\n\n---\n\n## Original document\n\n${sourceText.slice(0, 6000)}` : ""}\n\n_(imported into School on ${stamp})_`,
          type: "note",
          tags: ["school", course.code, ...(docTag ? [docTag] : [])],
          source: "school",
        }).catch(() => {}); // brain filing is best-effort, never blocks the real updates
      }
      addToast(`Applied ${made} change${made === 1 ? "" : "s"} from "${out.title}".`, "success");
      onApplied?.();
      onClose();
    } catch (e) {
      addToast(e.message, "error");
      setPhase("review");
    }
  };

  return (
    <Modal title="Import a school document" onClose={onClose} width={640}
      footer={phase === "review" ? (
        <>
          <button className="btn btn-sm btn-secondary-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-sm" onClick={apply}><i className="fa-solid fa-check" /> Apply selected</button>
        </>
      ) : null}>
      {phase === "idle" && (
        <div className="si-body" style={{ padding: 0 }}>
          <p className="si-note" style={{ marginBottom: 4 }}>Announcements, syllabi, grade releases — deadlines land in School <em>and</em> Plan, grades update the tracker, and a summary is filed to the Brain so your agents know too.</p>
          <label className="si-drop">
            <input type="file" accept=".pdf,.txt,.md,image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            <i className="fa-solid fa-cloud-arrow-up" /> Drop or choose a document (PDF · image · text)
          </label>
          <div className="si-or">or paste it</div>
          <textarea rows={5} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste the announcement / syllabus section…" />
          <button className="btn btn-sm" disabled={!paste.trim()} onClick={() => analyze({ text: paste.trim().slice(0, 24000) })}>
            <i className="fa-solid fa-graduation-cap" /> Analyze
          </button>
        </div>
      )}

      {phase === "busy" && <p className="si-busy"><i className="fa-solid fa-spinner fa-spin" /> Reading the document…</p>}

      {phase === "review" && out && (
        <div className="si-body" style={{ padding: 0 }}>
          <div className="si-group">
            <div className="si-group-title"><i className="fa-solid fa-book" /> {out.title}</div>
            <p className="si-note" style={{ fontStyle: "italic" }}>{out.summary}</p>
          </div>

          <div className="si-group">
            <div className="si-group-title"><i className="fa-solid fa-graduation-cap" /> Course</div>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">— pick the course —</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
            </select>
          </div>

          {(out.deadlines || []).length > 0 && (
            <div className="si-group">
              <div className="si-group-title"><i className="fa-solid fa-flag-checkered" /> Deadlines → School + Plan</div>
              {(out.deadlines || []).map((d, i) => (
                <label key={i} className="si-row">
                  <input type="checkbox" checked={!!checks[`d${i}`]} onChange={() => setChecks((c) => ({ ...c, [`d${i}`]: !c[`d${i}`] }))} />
                  <span className="si-row-main">
                    <span className="si-row-title">{d.name}</span>
                    <span className="si-diff">{d.date}{d.detail ? ` · ${d.detail}` : ""}</span>
                    {d.already_tracked && <span className="si-warn"><i className="fa-solid fa-circle-info" /> looks already tracked — left unchecked</span>}
                  </span>
                </label>
              ))}
            </div>
          )}

          {(out.grade_updates || []).length > 0 && (
            <div className="si-group">
              <div className="si-group-title"><i className="fa-solid fa-percent" /> Grade tracker</div>
              {(out.grade_updates || []).map((g, i) => (
                <label key={i} className="si-row">
                  <input type="checkbox" checked={!!checks[`g${i}`]} onChange={() => setChecks((c) => ({ ...c, [`g${i}`]: !c[`g${i}`] }))} />
                  <span className="si-row-main">
                    <span className="si-row-title">{g.match_name ? `Update: ${g.match_name}` : `New: ${g.name}`}</span>
                    <span className="si-diff">
                      {g.earned != null && <>score <strong>{g.earned}{g.max ? `/${g.max}` : ""}</strong> · </>}
                      {g.weight != null && <>weight <strong>{g.weight}%</strong></>}
                    </span>
                    {g.feedback && <span className="si-reason">{g.feedback}</span>}
                  </span>
                </label>
              ))}
            </div>
          )}

          {out.course_updates && Object.keys(out.course_updates).length > 0 && (
            <div className="si-group">
              <label className="si-row">
                <input type="checkbox" checked={!!checks.course} onChange={() => setChecks((c) => ({ ...c, course: !c.course }))} />
                <span className="si-row-main">
                  <span className="si-row-title">Course details</span>
                  <span className="si-diff">{Object.entries(out.course_updates).map(([k, v]) => `${k}: ${v}`).join(" · ")}</span>
                </span>
              </label>
            </div>
          )}

          <div className="si-group">
            <label className="si-row">
              <input type="checkbox" checked={!!checks.brain} onChange={() => setChecks((c) => ({ ...c, brain: !c.brain }))} />
              <span className="si-row-main">
                <span className="si-row-title">File summary into the Brain</span>
                <span className="si-diff">so Frodo & the agents know about this too</span>
              </span>
            </label>
          </div>
        </div>
      )}
    </Modal>
  );
}
