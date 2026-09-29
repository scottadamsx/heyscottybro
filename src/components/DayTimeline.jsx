import { useEffect, useMemo, useRef } from "react";
import { formatTime12 } from "../utils/plannerUtils";
import { fromMinutes, layoutTimelineBlocks } from "../utils/reschedule";
import "./day-timeline.css";

const DEFAULT_PX_PER_MIN = 1;
const nowMinutes = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};
const timeLabel = (minutes) => formatTime12(fromMinutes(minutes));

function setRef(ref, value) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

/**
 * Shared hour rail for the Planner day view and Fit it in.
 *
 * Minutes since midnight are the component boundary. `candidate` is optional
 * and makes the rail interactive without changing how existing blocks render.
 */
export default function DayTimeline({
  date,
  today,
  blocks = { timed: [], allDay: [] },
  startMinute = 0,
  endMinute = 24 * 60,
  disabled = false,
  readOnly = true,
  emptyLabel,
  clashes = [],
  candidate,
  railRef,
  innerRef,
  onRailClick,
  autoScrollMinute,
  autoScrollKey,
  pxPerMinute = DEFAULT_PX_PER_MIN,
}) {
  const localRailRef = useRef(null);
  const localInnerRef = useRef(null);
  const laidOut = useMemo(() => layoutTimelineBlocks(blocks.timed), [blocks.timed]);
  const clashIds = useMemo(() => new Set(clashes.map((block) => block.id)), [clashes]);
  const hours = [];
  for (let minute = startMinute; minute <= endMinute; minute += 60) hours.push(minute);

  useEffect(() => {
    if (autoScrollMinute == null || !localRailRef.current) return;
    localRailRef.current.scrollTop = Math.max(0, (autoScrollMinute - startMinute) * pxPerMinute);
  }, [autoScrollMinute, autoScrollKey, date, startMinute, pxPerMinute]);

  const connectRail = (node) => {
    localRailRef.current = node;
    setRef(railRef, node);
  };
  const connectInner = (node) => {
    localInnerRef.current = node;
    setRef(innerRef, node);
  };
  const visibleBlocks = laidOut.filter((block) => block.end > startMinute && block.start < endMinute);
  const currentMinute = nowMinutes();
  const isEmpty = blocks.timed.length === 0 && blocks.allDay.length === 0;

  return (
    <div className="day-timeline">
      {blocks.allDay.length > 0 && (
        <div className="tl-allday" aria-label="All day and anytime">
          {blocks.allDay.map((block) => (
            <span key={block.id} className={`tl-pill kind-${block.kind}`}>{block.title}</span>
          ))}
        </div>
      )}
      {isEmpty && emptyLabel && <p className="tl-empty">{emptyLabel}</p>}
      <div
        className={`tl${disabled ? " is-off" : ""}${readOnly ? " is-readonly" : ""}`}
        ref={connectRail}
        onClick={onRailClick}
        aria-label={`Hourly schedule for ${date}`}
      >
        <div className="tl-inner" ref={connectInner} style={{ height: `${(endMinute - startMinute) * pxPerMinute}px` }}>
          {hours.map((minute) => (
            <div key={minute} className="tl-hour" style={{ top: `${(minute - startMinute) * pxPerMinute}px` }} aria-hidden="true">
              <span className="tl-hour-label">{timeLabel(minute).replace(":00", "")}</span>
            </div>
          ))}
          {date === today && currentMinute > startMinute && currentMinute < endMinute && (
            <div className="tl-now" style={{ top: `${(currentMinute - startMinute) * pxPerMinute}px` }} aria-hidden="true" />
          )}
          {visibleBlocks.map((block) => {
            const visibleStart = Math.max(block.start, startMinute);
            const visibleEnd = Math.min(block.end, endMinute);
            const laneWidth = 100 / block.laneCount;
            return (
              <div
                key={block.id}
                className={`tl-block kind-${block.kind}${clashIds.has(block.id) ? " is-clash" : ""}`}
                style={{
                  top: `${(visibleStart - startMinute) * pxPerMinute}px`,
                  height: `${Math.max((visibleEnd - visibleStart) * pxPerMinute, 18)}px`,
                  left: `calc(${block.lane * laneWidth}% + 4px)`,
                  width: `calc(${laneWidth}% - 6px)`,
                }}
                aria-label={`${block.title}, ${timeLabel(block.start)} to ${timeLabel(block.end)}`}
              >
                <span className="tl-block-title">{block.title}</span>
                <span className="tl-block-time">{timeLabel(block.start)}–{timeLabel(block.end)}</span>
              </div>
            );
          })}
          {candidate && !disabled && (
            <div
              className={`tl-candidate${candidate.hasClash ? " is-clash" : ""}`}
              style={{
                top: `${(candidate.start - startMinute) * pxPerMinute}px`,
                height: `${candidate.duration * pxPerMinute}px`,
              }}
              role="slider"
              tabIndex={0}
              aria-label={candidate.ariaLabel}
              aria-valuemin={startMinute}
              aria-valuemax={endMinute - candidate.duration}
              aria-valuenow={candidate.start}
              aria-valuetext={`${timeLabel(candidate.start)} to ${timeLabel(candidate.start + candidate.duration)}`}
              onPointerDown={candidate.onPointerDown}
              onPointerMove={candidate.onPointerMove}
              onPointerUp={candidate.onPointerUp}
              onPointerCancel={candidate.onPointerCancel}
              onKeyDown={candidate.onKeyDown}
            >
              <span className="tl-block-title">{candidate.title}</span>
              <span className="tl-block-time">{candidate.subtitle}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
