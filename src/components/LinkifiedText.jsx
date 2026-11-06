import { linkifySegments } from "../utils/linkify";

/**
 * A paragraph of plain text whose URLs are real links (BUG-082).
 * Segments render as React nodes, never HTML, so note text stays inert.
 */
export default function LinkifiedText({ text, className }) {
  const segments = linkifySegments(text);
  return (
    <p className={className}>
      {segments.map((seg, i) =>
        seg.href ? (
          <a key={i} href={seg.href} target="_blank" rel="noreferrer">
            {seg.text}
          </a>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </p>
  );
}
