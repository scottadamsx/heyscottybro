/**
 * The "who's at this event" indicator (DR-033). Renders the event's linked
 * Orbit people, resolved from ids at render time so Orbit renames show up
 * with no event edit. Two shapes:
 *   - "dots" (default): up to three initial circles plus a +N overflow.
 *   - "names": one chip per person with initials and full name (day sheet).
 * Renders nothing when nobody is linked or every linked person is gone
 * from Orbit.
 */
import { resolveAttendees, attendeeNamesLabel } from "../lib/attendees";

export default function AttendeeChips({ personIds, byId, variant = "dots", max = 3 }) {
  const resolved = resolveAttendees(personIds, byId);
  if (resolved.length === 0) return null;
  const label = `With ${attendeeNamesLabel(resolved)}`;
  if (variant === "names") {
    return (
      <span className="attendee-names" role="img" aria-label={label} title={label}>
        {resolved.map((a) => (
          <span className="attendee-name-chip" key={a.id}>
            <span className="attendee-dot" style={{ background: a.color }} aria-hidden="true">{a.initials}</span>
            {a.name}
          </span>
        ))}
      </span>
    );
  }
  const shown = resolved.slice(0, max);
  const extra = resolved.length - shown.length;
  return (
    <span className="attendee-dots" role="img" aria-label={label} title={label}>
      {shown.map((a) => (
        <span className="attendee-dot" style={{ background: a.color }} key={a.id} aria-hidden="true">{a.initials}</span>
      ))}
      {extra > 0 && <span className="attendee-dot attendee-dot--more" aria-hidden="true">+{extra}</span>}
    </span>
  );
}
