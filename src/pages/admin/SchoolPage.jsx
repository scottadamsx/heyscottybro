import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadCourses, createCourse, updateCourse, deleteCourse } from "../../api/coursesApi";
import { loadGrades, gradeStats } from "../../api/gradesApi";
import { loadReminders, newReminder, completeReminder } from "../../api/plannerApi";
import { toDateStr } from "../../utils/plannerUtils";
import { Card, StatTile, Badge, FormModal, Field, PageHeader } from "../../components/ui";
import GradeTracker from "../../components/tools/GradeTracker";
import SchoolImport from "../../components/school/SchoolImport";
import { loadBrain, deleteNode } from "../../api/brainApi";
import { useToast } from "../../contexts/ToastContext";
import { useConfirm } from "../../hooks/useConfirm";
import "./school.css";
import DatePicker from "../../components/DatePicker";

/**
 * SCHOOL — the semester at a glance. Courses are first-class; deadlines are
 * ordinary reminders tagged with a course_id, so they show up here AND in Plan
 * (one source of truth). Grades reuse the GradeTracker engine per course.
 * Answers one question: "am I passing?"
 */
const EMPTY_COURSE = { code: "", name: "", term: "", instructor: "", target_grade: "" };
const fmtPct = (v) => (v == null ? "—" : `${v.toFixed(1)}%`);
const daysUntil = (d) => Math.ceil((new Date(`${d}T12:00:00`) - new Date()) / 86400000);

export default function SchoolPage() {
  const { addToast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [courses, setCourses] = useState([]);
  const [grades, setGrades] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [open, setOpen] = useState(null);           // expanded course id
  const [courseForm, setCourseForm] = useState(null); // null | {…} (modal)
  const [deadlineFor, setDeadlineFor] = useState(null); // course object (modal)
  const [showImport, setShowImport] = useState(false);
  const [dl, setDl] = useState({ name: "", date: toDateStr(new Date()) });

  // ONE grades fetch for the whole page: the header stats, the course cards
  // and each course's GradeTracker all read `grades`, and GradeTracker calls
  // back here after every write so nothing goes stale.
  const refresh = async () => {
    try {
      // Follow-up (brainApi owner): loadBrain() pulls the ENTIRE brain to filter
      // source === "school" here — a source-filtered loader would cut that down.
      const [c, g, r, brain] = await Promise.all([loadCourses(), loadGrades(), loadReminders(), loadBrain().catch((e) => { addToast(`Announcements unavailable: ${e.message}`, "error"); return { nodes: [] }; })]);
      setCourses(c); setGrades(g); setReminders(r);
      // Imported school documents live in the Brain with source "school" —
      // surface them HERE so an announcement is never invisible after import.
      setAnnouncements((brain.nodes || [])
        .filter((n) => n.source === "school")
        .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))));
      setLoadError(null);
    } catch (e) { setLoadError(e.message); addToast(e.message, "error"); }
    setReady(true);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const courseGrades = (c) => grades.filter((g) => g.course_id === c.id || (g.course && g.course === c.code));
  const gradesByCourse = useMemo(() => Object.fromEntries(courses.map((c) => [c.id, courseGrades(c)])), [courses, grades]); // eslint-disable-line react-hooks/exhaustive-deps
  const courseStats = useMemo(() => Object.fromEntries(courses.map((c) => [c.id, gradeStats(gradesByCourse[c.id] || [])])), [courses, gradesByCourse]);

  // Deadlines = incomplete course-tagged reminders, soonest first.
  const deadlines = useMemo(() =>
    reminders
      .filter((r) => r.course_id && !r.completed && r.date)
      .sort((a, b) => a.date.localeCompare(b.date)),
    [reminders]);
  const courseById = Object.fromEntries(courses.map((c) => [c.id, c]));
  const thisWeek = deadlines.filter((r) => { const d = daysUntil(r.date); return d >= 0 && d <= 7; });
  const overdue = deadlines.filter((r) => daysUntil(r.date) < 0);

  // Semester average = mean of per-course current averages (graded courses only).
  const avgs = courses.map((c) => courseStats[c.id]?.currentPct).filter((v) => v != null);
  const semesterAvg = avgs.length ? avgs.reduce((s, v) => s + v, 0) / avgs.length : null;
  const term = courses[0]?.term || "";

  const saveCourse = async () => {
    const f = courseForm;
    if (!f.code.trim() || !f.name.trim()) throw new Error("Code and name are required.");
    const payload = { code: f.code.trim(), name: f.name.trim(), term: f.term.trim(), instructor: f.instructor.trim(), target_grade: f.target_grade === "" ? null : Number(f.target_grade) };
    if (f.id) await updateCourse(f.id, payload); else await createCourse(payload);
    refresh(); // FormModal closes on resolve; a thrown error stays in the modal
  };

  const removeCourse = async (c) => {
    if (!await confirm(`Delete ${c.code} and its grades?`, { title: "Delete course", confirmLabel: "Delete" })) return;
    try { await deleteCourse(c.id); refresh(); } catch (e) { addToast(e.message, "error"); }
  };

  const addDeadline = async () => {
    if (!dl.name.trim()) throw new Error("Name the deadline.");
    await newReminder({ name: `${dl.name.trim()}`, date: dl.date, course_id: deadlineFor.id, description: `${deadlineFor.code} deadline` });
    addToast(`Deadline added — it's on your Plan too.`, "success");
    setDl({ name: "", date: toDateStr(new Date()) });
    refresh();
  };

  const completeDeadline = async (r) => {
    try { await completeReminder(r.id); refresh(); } catch (e) { addToast(e.message, "error"); }
  };

  // ExportKit: the semester report.
  const exporter = {
    title: `Semester report${term ? ` — ${term}` : ""}`,
    filename: "semester-report",
    toMarkdown: () => {
      const L = [`# Semester report${term ? ` — ${term}` : ""}`, "", `_${new Date().toDateString()}_`, ""];
      L.push(`**Semester average:** ${fmtPct(semesterAvg)} · **Courses:** ${courses.length} · **Open deadlines:** ${deadlines.length}`, "");
      for (const c of courses) {
        const st = courseStats[c.id] || {};
        L.push(`## ${c.code} — ${c.name}`);
        if (c.instructor) L.push(`- Instructor: ${c.instructor}`);
        L.push(`- Current: ${fmtPct(st.currentPct)} · Projected final: ${fmtPct(st.projectedFinal)}${c.target_grade ? ` · Target: ${c.target_grade}%` : ""}`);
        const cg = gradesByCourse[c.id] || [];
        if (cg.length) {
          L.push("", "| Assessment | Score | Weight |", "|---|---|---|");
          cg.forEach((g) => L.push(`| ${g.name} | ${g.earned != null ? `${g.earned}/${g.max}` : "—"} | ${g.weight || 0}% |`));
        }
        const cds = deadlines.filter((r) => r.course_id === c.id);
        if (cds.length) { L.push("", "**Deadlines:**"); cds.forEach((r) => L.push(`- ${r.date} — ${r.name}`)); }
        L.push("");
      }
      return L.join("\n");
    },
    toRows: () => grades.map((g) => ({
      course: courseById[g.course_id]?.code || g.course || "", assessment: g.name,
      earned: g.earned ?? "", max: g.max ?? "", weight: g.weight ?? "", feedback: g.feedback || "",
    })),
  };

  if (!ready) return <div className="module-page"><p className="no-entries">Loading school…</p></div>;
  if (loadError) {
    return (
      <div className="module-page">
        <PageHeader icon="fa-graduation-cap" title="School" />
        <div className="load-error" role="alert">
          <p className="load-error-msg">{loadError}</p>
          <button type="button" className="btn btn-sm" onClick={() => { setReady(false); refresh(); }}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="module-page">
      {dialog}
      <PageHeader
        icon="fa-graduation-cap"
        title={`School${term ? ` · ${term}` : ""}`}
        exporter={exporter}
        actions={
          <>
            <button type="button" className="btn btn-sm btn-secondary-sm" onClick={() => setShowImport(true)}>
              <i className="fa-solid fa-file-import" aria-hidden="true" /> Import document
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setCourseForm({ ...EMPTY_COURSE })}>
              <i className="fa-solid fa-plus" aria-hidden="true" /> Add course
            </button>
          </>
        }
      />

      {/* Semester header */}
      <div className="school-stats">
        <StatTile label="Semester average" value={fmtPct(semesterAvg)} tone={semesterAvg == null ? "default" : semesterAvg >= 80 ? "good" : semesterAvg >= 70 ? "warn" : "bad"} sub={avgs.length ? `${avgs.length} graded course${avgs.length === 1 ? "" : "s"}` : "no grades yet"} />
        <StatTile label="Courses" value={courses.length} />
        <StatTile label="Due this week" value={thisWeek.length} tone={thisWeek.length ? "warn" : "good"} />
        <StatTile label="Overdue" value={overdue.length} tone={overdue.length ? "bad" : "good"} />
      </div>

      {courses.length === 0 && (
        <Card>
          <p className="no-entries">No courses yet — add your first one and School becomes your semester command center: weighted grades, projections, deadlines that sync with Plan, and AI catch-up plans.</p>
        </Card>
      )}

      {/* Course cards */}
      {courses.map((c) => {
        const st = courseStats[c.id] || {};
        const cds = deadlines.filter((r) => r.course_id === c.id);
        const next = cds[0];
        const expanded = open === c.id;
        const onTarget = st.projectedFinal != null && c.target_grade != null ? st.projectedFinal >= c.target_grade : null;
        return (
          <Card key={c.id} className="school-course">
            <button type="button" className="school-course-head" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : c.id)}>
              <span className="school-course-code" style={{ background: c.color || "var(--accent)" }}>{c.code}</span>
              <span className="school-course-main">
                <span className="school-course-name">{c.name}</span>
                <span className="school-course-meta">
                  {c.instructor && <>{c.instructor} · </>}
                  Current {fmtPct(st.currentPct)} · Projected {fmtPct(st.projectedFinal)}{st.projectionClamped ? "*" : ""}
                  {c.target_grade != null && <> · Target {c.target_grade}%</>}
                  {st.notes?.length > 0 && <> · <span title={st.notes.join("; ")}>{st.notes.length} note{st.notes.length === 1 ? "" : "s"}</span></>}
                </span>
              </span>
              <span className="school-course-side">
                {onTarget != null && <Badge tone={onTarget ? "good" : "bad"}>{onTarget ? "On target" : "Below target"}</Badge>}
                {next && <Badge tone={daysUntil(next.date) <= 3 ? "warn" : "default"} icon="fa-clock">{next.date}</Badge>}
                <i className={`fa-solid fa-chevron-${expanded ? "up" : "down"}`} aria-hidden="true" />
              </span>
            </button>

            {expanded && (
              <div className="school-course-body">
                <div className="school-course-actions">
                  <button type="button" className="btn btn-sm btn-secondary-sm" onClick={() => setDeadlineFor(c)}><i className="fa-solid fa-calendar-plus" aria-hidden="true" /> Add deadline</button>
                  <button type="button" className="btn btn-sm btn-secondary-sm" onClick={() => setCourseForm({ ...c, target_grade: c.target_grade ?? "" })}><i className="fa-solid fa-pen" aria-hidden="true" /> Edit course</button>
                  <button type="button" className="btn-delete" onClick={() => removeCourse(c)}><i className="fa-solid fa-trash" aria-hidden="true" /> Delete</button>
                </div>
                {cds.length > 0 && (
                  <div className="school-deadlines-inline">
                    {cds.map((r) => (
                      <div key={r.id} className="school-deadline-row">
                        <button type="button" className="school-deadline-done" title="Mark done" aria-label={`Mark ${r.name} done`} onClick={() => completeDeadline(r)}><i className="fa-regular fa-circle" aria-hidden="true" /></button>
                        <span className="school-deadline-name">{r.name}</span>
                        <span className={`school-deadline-date${daysUntil(r.date) < 0 ? " overdue" : daysUntil(r.date) <= 3 ? " soon" : ""}`}>
                          {r.date}{daysUntil(r.date) < 0 ? <span className="visually-hidden"> (overdue)</span> : daysUntil(r.date) <= 3 ? <span className="visually-hidden"> (due soon)</span> : null}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <GradeTracker courseId={c.id} courseCode={c.code} rows={gradesByCourse[c.id] || []} onChanged={refresh} />
              </div>
            )}
          </Card>
        );
      })}

      {/* Announcements & imported documents */}
      {announcements.length > 0 && (
        <Card title="Announcements & documents" icon="fa-bullhorn">
          {announcements.map((n) => {
            const codeTag = (n.tags || []).find((t) => courses.some((c) => c.code === t));
            return (
              <div key={n.slug} className="school-deadline-row">
                {codeTag && <Badge tone="accent">{codeTag}</Badge>}
                <Link
                  to={(n.tags || []).some((t) => t.startsWith("doc:"))
                    ? `/admin/school/doc/${String(n.slug).split("/").map(encodeURIComponent).join("/")}`
                    : `/admin/read/${String(n.slug).split("/").map(encodeURIComponent).join("/")}`}
                  className="school-deadline-name"
                  title="Open the document"
                >
                  {(n.tags || []).some((t) => t.startsWith("doc:")) && <i className="fa-solid fa-file-pdf school-doc-icon" aria-hidden="true" />}
                  {n.title}
                </Link>
                <span className="school-deadline-date">{String(n.created_at || "").slice(0, 10)}</span>
                <button
                  type="button"
                  className="school-deadline-done is-delete"
                  title="Delete this document"
                  aria-label={`Delete ${n.title}`}
                  onClick={async () => {
                    if (!await confirm(`Delete "${n.title}"?`, { title: "Delete document", confirmLabel: "Delete" })) return;
                    try { await deleteNode(n.id); refresh(); } catch (e) { addToast(e.message, "error"); }
                  }}
                >
                  <i className="fa-solid fa-trash" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </Card>
      )}

      {/* Deadlines rail */}
      {deadlines.length > 0 && (
        <Card title="All deadlines" icon="fa-flag-checkered">
          {deadlines.map((r) => (
            <div key={r.id} className="school-deadline-row">
              <button type="button" className="school-deadline-done" title="Mark done" aria-label={`Mark ${r.name} done`} onClick={() => completeDeadline(r)}><i className="fa-regular fa-circle" aria-hidden="true" /></button>
              <Badge>{courseById[r.course_id]?.code || "?"}</Badge>
              <Link to={`/admin/tasks/${r.id}`} className="school-deadline-name">{r.name}</Link>
              <span className={`school-deadline-date${daysUntil(r.date) < 0 ? " overdue" : daysUntil(r.date) <= 3 ? " soon" : ""}`}>
                {r.date} ({daysUntil(r.date) < 0 ? `${-daysUntil(r.date)}d overdue` : daysUntil(r.date) === 0 ? "today" : `${daysUntil(r.date)}d`})
              </span>
            </div>
          ))}
        </Card>
      )}

      {showImport && (
        <SchoolImport
          courses={courses}
          grades={grades}
          deadlines={deadlines}
          onClose={() => setShowImport(false)}
          onApplied={refresh}
        />
      )}

      {/* Course add/edit modal */}
      {courseForm && (
        <FormModal title={courseForm.id ? `Edit ${courseForm.code}` : "Add course"} onClose={() => setCourseForm(null)} onSubmit={saveCourse}
          submitDisabled={!courseForm.code.trim() || !courseForm.name.trim()}>
          <div className="school-form-row">
            <Field label="Code"><input placeholder="CP 2315" required value={courseForm.code} onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })} data-autofocus /></Field>
            <Field label="Term"><input placeholder="Spring 2026" value={courseForm.term} onChange={(e) => setCourseForm({ ...courseForm, term: e.target.value })} /></Field>
          </div>
          <Field label="Name"><input placeholder="Cloud Developer Capstone" required value={courseForm.name} onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })} /></Field>
          <div className="school-form-row">
            <Field label="Instructor"><input value={courseForm.instructor} onChange={(e) => setCourseForm({ ...courseForm, instructor: e.target.value })} /></Field>
            <Field label="Target grade %"><input type="number" inputMode="decimal" min="0" max="100" placeholder="e.g. 80" value={courseForm.target_grade} onChange={(e) => setCourseForm({ ...courseForm, target_grade: e.target.value })} /></Field>
          </div>
        </FormModal>
      )}

      {/* Quick-deadline modal */}
      {deadlineFor && (
        <FormModal title={`New ${deadlineFor.code} deadline`} submitLabel="Add deadline" onClose={() => setDeadlineFor(null)} onSubmit={addDeadline}
          submitDisabled={!dl.name.trim()}>
          <Field label="What's due?" hint="Deadlines are reminders under the hood — they'll show on Plan and Today automatically.">
            <input placeholder="Lab 3, Final report…" required value={dl.name} onChange={(e) => setDl({ ...dl, name: e.target.value })} data-autofocus />
          </Field>
          <div className="uik-field">
            <span className="field-label">Due date</span>
            <DatePicker value={dl.date} onChange={(v) => setDl({ ...dl, date: v })} />
          </div>
        </FormModal>
      )}
    </div>
  );
}
