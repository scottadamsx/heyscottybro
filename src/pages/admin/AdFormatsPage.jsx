import { useState } from "react";
import { AD_FORMATS, filterAdFormats } from "../../lib/adFormats";
import "./ad-formats.css";

/**
 * Ad Formats — a static library of short-form ad format ideas (docs/features/
 * ad-formats-library.md). Content lives in src/lib/adFormats.js; the only
 * state here is the filter text, kept local so typing never re-renders
 * anything outside this page.
 */
export default function AdFormatsPage() {
  const [query, setQuery] = useState("");
  const filtering = query.trim().length > 0;
  const shown = filterAdFormats(AD_FORMATS, query);

  return (
    <div className="module-page ad-formats-page">
      <div className="module-header">
        <h1>
          Ad Formats
          <span className="ad-formats-count">
            {filtering ? `${shown.length} of ${AD_FORMATS.length}` : AD_FORMATS.length}
          </span>
        </h1>
      </div>

      <p className="vault-intro">
        <i className="fa-solid fa-rectangle-ad" aria-hidden="true" /> Short-form ad formats worth
        stealing, one card each: how the format works, plus an example written for the Lift Club,
        myBackyard, BONSAI, or the websites service. Numbered as in the reel they came from.
      </p>

      <div className="ad-formats-filter">
        <label className="ad-formats-filter-label" htmlFor="ad-formats-filter">Filter formats</label>
        <input
          id="ad-formats-filter"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try “receipt”, “quiz”, or a business name"
          autoComplete="off"
        />
      </div>

      {shown.length === 0 ? (
        <p className="no-entries">No formats match “{query.trim()}”. Clear the filter to see all {AD_FORMATS.length}.</p>
      ) : (
        <div className="ad-formats-grid">
          {shown.map((f) => (
            <article className="ad-format-card" key={f.n}>
              <div className="ad-format-head">
                <span className="ad-format-number">{f.n}</span>
                <span className="ad-format-business">{f.business}</span>
              </div>
              <h2 className="ad-format-name">{f.name}</h2>
              <p className="ad-format-description">{f.description}</p>
              <p className="ad-format-example-label">Example</p>
              <p className="ad-format-example">{f.example}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
