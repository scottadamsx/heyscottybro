import GradeTracker from "../../components/tools/GradeTracker";

/** SCHOOL — seed shell (Phase 2); Phase 3 brings courses + deadlines + semester view. */
export default function SchoolPage() {
  return (
    <div className="module-page">
      <div className="module-header">
        <h1><i className="fa-solid fa-graduation-cap" /> School</h1>
      </div>
      <GradeTracker />
    </div>
  );
}
