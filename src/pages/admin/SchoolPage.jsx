import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadCourses, createCourse, updateCourse, deleteCourse } from "../../api/coursesApi";
import { loadGrades, gradeStats } from "../../api/gradesApi";
import { loadReminders, newReminder, completeReminder } from "../../api/plannerApi";
import { toDateStr } from "../../utils/plannerUtils";
import { Card, StatTile, Badge, Modal, PageHeader } from "../../components/ui";
import GradeTracker from "../../components/tools/GradeTracker";
import { useToast } from "../../contexts/ToastContext";
import { useConfirm } from "../../hooks/useConfirm";
import "./school.css";

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
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(null);           // expanded course id
  const [courseForm, setCourseForm] = useState(null); // null | {…} (modal)
  const [deadlineFor, setDeadlineFor] = useState(null); // course object (modal)
  const [dl, setDl] = useState({ name: "", date: toDateStr(new Date()) });

  const refresh = async () => {
    try {
      const [c, g, r] = await Promise.all([loadCourses(), loadGrades(), loadReminders()]);
      setCourses(c); setGrades(g); setReminders(r);
    } catch (e) { addToast(e.message, "error"); }
    setReady(true);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const courseGrades = (c) => grades.filter((g) => g.course_id === c.id || (g.course && g.course === c.code));
  const courseStats = useMemo(() => Object.fromEntries(courses.map((c) => [c.id, gradeStats(courseGrades(c))])), [courses, grades]);

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
    if (!f.code.trim() || !f.name.trim()) { addToast("Code and name are required.", "error"); return; }
    const payload = { code: f.code.trim(), name: f.name.trim(), term: f.term.trim(), instructor: f.instructor.trim(), target_grade: f.target_grade === "" ? null : Number(f.target_grade) };
    try {
      if (f.id) await updateCourse(f.id, payload); else await createCourse(payload);
      setCourseForm(null); refresh();
    } catch (e) { addToast(e.message, "error"); }
  };

  const removeCourse = async (c) => {
    if (!await confirm(`Delete ${c.code} and its grades?`, { title: "Delete course", confirmLabel: "Delete" })) return;
    try { await deleteCourse(c.id); refresh(); } catch (e) { addToast(e.message, "error"); }
  };

  const addDeadline = async () => {
    if (!dl.name.trim()) { addToast("Name the deadline.", "error"); return; }
    try {
      await newReminder({ name: `🎓 ${dl.name.trim()}`, date: dl.date, course_id: deadlineFor.id, description: `${deadlineFor.code} deadline` });
      addToast(`Deadline added — it's on your Plan too.`, "success");
      setDeadlineFor(null); setDl({ name: "", date: toDateStr(new Date()) });
      refresh();
    } catch (e) { addToast(e.message, "error"); }
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
        const cg = courseGrades(c);
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

  return (
    <div className="module-page">
      {dialog}
      <PageHeader
        icon="fa-graduation-cap"
        title={`School${term ? ` · ${term}` : ""}`}
        exporter={exporter}
        actions={
          <button className="btn btn-sm" onClick={() => setCourseForm({ ...EMPTY_COURSE })}>
            <i className="fa-solid fa-plus" /> Add course
          </button>
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
            <button type="button" className="school-course-head" onClick={() => setOpen(expanded ? null : c.id)}>
              <span className="school-course-code" style={{ background: c.color || "var(--accent)" }}>{c.code}</span>
              <span className="school-course-main">
                <span className="school-course-name">{c.name}</span>
                <span className="school-course-meta">
                  {c.instructor && <>{c.instructor} · </>}
                  Current {fmtPct(st.currentPct)} · Projected {fmtPct(st.projectedFinal)}
                  {c.target_grade != null && <> · Target {c.target_grade}%</>}
                </span>
              </span>
              <span className="school-course-side">
                {onTarget != null && <Badge tone={onTarget ? "good" : "bad"}>{onTarget ? "On target" : "Below target"}</Badge>}
                {next && <Badge tone={daysUntil(next.date) <= 3 ? "warn" : "default"} icon="fa-clock">{next.date}</Badge>}
                <i className={`fa-solid fa-chevron-${expanded ? "up" : "down"}`} />
              </span>
            </button>

            {expanded && (
              <div className="school-course-body">
                <div className="school-course-actions">
                  <button className="btn btn-sm btn-secondary-sm" onClick={() => setDeadlineFor(c)}><i className="fa-solid fa-calendar-plus" /> Add deadline</button>
                  <button className="btn btn-sm btn-secondary-sm" onClick={() => setCourseForm({ ...c, target_grade: c.target_grade ?? "" })}><i className="fa-solid fa-pen" /> Edit course</button>
                  <button className="btn btn-sm btn-secondary-sm" onClick={() => removeCourse(c)} style={{ color: "var(--red)" }}><i className="fa-solid fa-trash" /> Delete</button>
                </div>
                {cds.length > 0 && (
                  <div className="school-deadlines-inline">
                    {cds.map((r) => (
                      <div key={r.id} className="school-deadline-row">
                        <button className="school-deadline-done" title="Mark done" onClick={() => completeDeadline(r)}><i className="fa-regular fa-circle" /></button>
                        <span className="school-deadline-name">{r.name}</span>
                        <span className={`school-deadline-date${daysUntil(r.date) < 0 ? " overdue" : daysUntil(r.date) <= 3 ? " soon" : ""}`}>{r.date}</span>
                      </div>
                    ))}
                  </div>
                )}
                <GradeTracker courseId={c.id} courseCode={c.code} />
              </div>
            )}
          </Card>
        );
      })}

      {/* Deadlines rail */}
      {deadlines.length > 0 && (
        <Card title="All deadlines" icon="fa-flag-checkered">
          {deadlines.map((r) => (
            <div key={r.id} className="school-deadline-row">
              <button className="school-deadline-done" title="Mark done" onClick={() => completeDeadline(r)}><i className="fa-regular fa-circle" /></button>
              <Badge>{courseById[r.course_id]?.code || "?"}</Badge>
              <Link to={`/admin/tasks/${r.id}`} className="school-deadline-name">{r.name}</Link>
              <span className={`school-deadline-date${daysUntil(r.date) < 0 ? " overdue" : daysUntil(r.date) <= 3 ? " soon" : ""}`}>
                {r.date} ({daysUntil(r.date) < 0 ? `${-daysUntil(r.date)}d overdue` : daysUntil(r.date) === 0 ? "today" : `${daysUntil(r.date)}d`})
              </span>
            </div>
          ))}
        </Card>
      )}

      {/* Course add/edit modal */}
      {courseForm && (
        <Modal title={courseForm.id ? `Edit ${courseForm.code}` : "Add course"} onClose={() => setCourseForm(null)}
          footer={<>
            <button className="btn btn-sm btn-secondary-sm" onClick={() => setCourseForm(null)}>Cancel</button>
            <button className="btn btn-sm" onClick={saveCourse}>Save</button>
          </>}>
          <div className="school-form">
            <input placeholder="Code (CP 2315) *" value={courseForm.code} onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })} />
            <input placeholder="Name (Cloud Developer Capstone) *" value={courseForm.name} onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })} />
            <input placeholder="Term (Spring 2026)" value={courseForm.term} onChange={(e) => setCourseForm({ ...courseForm, term: e.target.value })} />
            <input placeholder="Instructor" value={courseForm.instructor} onChange={(e) => setCourseForm({ ...courseForm, instructor: e.target.value })} />
            <input type="number" placeholder="Target grade % (e.g. 80)" value={courseForm.target_grade} onChange={(e) => setCourseForm({ ...courseForm, target_grade: e.target.value })} />
          </div>
        </Modal>
      )}

      {/* Quick-deadline modal */}
      {deadlineFor && (
        <Modal title={`New ${deadlineFor.code} deadline`} onClose={() => setDeadlineFor(null)}
          footer={<>
            <button className="btn btn-sm btn-secondary-sm" onClick={() => setDeadlineFor(null)}>Cancel</button>
            <button className="btn btn-sm" onClick={addDeadline}>Add</button>
          </>}>
          <div className="school-form">
            <input placeholder="What's due? (Lab 3, Final report…) *" value={dl.name} onChange={(e) => setDl({ ...dl, name: e.target.value })} />
            <input type="date" value={dl.date} onChange={(e) => setDl({ ...dl, date: e.target.value })} />
            <p className="school-form-hint">Deadlines are reminders under the hood — they'll show on Plan and Today automatically.</p>
          </div>
        </Modal>
      )}
    </div>
  );
}
