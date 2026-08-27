import { useEffect, useMemo, useState } from "react";
import { KIWI_GAMES } from "../../games/kiwi/registry";
import { KIWI_OPPORTUNITIES } from "../../games/kiwi/stub";
import GameFrame from "../../components/arcade/GameFrame";
import { bestScores, recordScore, breakTokens, spendBreak, earnBreak } from "../../lib/breaks";
import { Badge } from "../../components/ui";
import { useToast } from "../../contexts/ToastContext";
import "./arcade.css";

/**
 * The Arcade — ALL of Kiwi's engage library, ported byte-identical:
 * 50 games, 45 quick surveys (by life area), the scroll-to-read article
 * activity, Quick Pulse questions, and (honestly labeled) the two lab stubs.
 * One frame runs everything through Kiwi's own dispatcher.
 */
const QUICK_IDS = ["reaction", "stroop", "wordle", "memory", "snake", "2048", "simon", "typing", "higher", "whack", "colorpick", "aim"];

const PULSES = [
  { id: "pulse-study", label: "How's studying going?", spec: { type: "rating", prompt: "How's studying going today?" } },
  { id: "pulse-why", label: "What's blocking you?", spec: { type: "reason", prompt: "What's slowing you down right now?", whyOptions: ["Distractions", "Too tired", "Material is hard", "Not sure where to start", "Nothing — flowing"] } },
  { id: "pulse-interests", label: "What to study next?", spec: { type: "interests", prompt: "Which areas need the most work?", options: ["Cloud / AWS", "Java", "Android", "Databases", "Networking", "Math"] } },
];

const AREA_META = {
  psychology: { label: "Psychology", icon: "fa-brain" },
  health:     { label: "Health",     icon: "fa-heart-pulse" },
  nutrition:  { label: "Nutrition",  icon: "fa-apple-whole" },
  fitness:    { label: "Fitness",    icon: "fa-dumbbell" },
  finance:    { label: "Finance",    icon: "fa-wallet" },
};

export default function ArcadePage() {
  const { addToast } = useToast();
  const [playing, setPlaying] = useState(null);   // { opp, kiwiQ?, title }
  const [best, setBest] = useState(bestScores);
  const [tokens, setTokens] = useState(breakTokens);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const onB = () => setTokens(breakTokens());
    window.addEventListener("hsb-breaks", onB);
    return () => window.removeEventListener("hsb-breaks", onB);
  }, []);

  const quick = useMemo(() => QUICK_IDS.map((q) => KIWI_GAMES.find((g) => g.id === q)).filter(Boolean), []);
  const rest = useMemo(() => {
    const quickSet = new Set(quick.map((g) => g.id));
    const q = search.trim().toLowerCase();
    return KIWI_GAMES.filter((g) => !quickSet.has(g.id) &&
      (!q || g.title.toLowerCase().includes(q) || g.ruleLine.toLowerCase().includes(q)));
  }, [quick, search]);

  const surveysByArea = useMemo(() => {
    const map = {};
    for (const o of KIWI_OPPORTUNITIES) {
      if (o.kind !== "survey") continue;
      (map[o.area] = map[o.area] || []).push(o);
    }
    return map;
  }, []);
  const articleOpp = useMemo(() => KIWI_OPPORTUNITIES.find((o) => o.kind === "article-summary") || { id: "sim-article-1", kind: "article-summary", title: "Reading break" }, []);
  const labOpps = useMemo(() => KIWI_OPPORTUNITIES.filter((o) => o.kind === "opt-in-ad" || o.kind === "video-pick"), []);

  const playGame = (g) => { spendBreak(); setTokens(breakTokens()); setPlaying({ opp: { id: g.id, kind: "puzzle", title: g.title }, title: g.title, gameId: g.id }); };
  const playOpp = (opp) => { spendBreak(); setTokens(breakTokens()); setPlaying({ opp, title: opp.title }); };
  const playPulse = (p) => setPlaying({ opp: { id: p.id, kind: "kiwi-question", title: p.label }, kiwiQ: p.spec, title: p.label });

  const onComplete = ({ bonus, score, won }) => {
    if (!playing) return;
    if (playing.gameId) setBest(recordScore(playing.gameId, score));
    const bits = [];
    if (won === true) bits.push("won");
    if (score != null) bits.push(`score ${score}`);
    if (bonus > 0) bits.push(`+${bonus} bonus`);
    addToast(`${playing.title}: ${bits.join(" · ") || "done"} — back to it!`, "success");
  };

  const Tile = ({ g }) => (
    <button type="button" className="arcade-tile" onClick={() => playGame(g)}>
      <span className="arcade-tile-title">{g.title}</span>
      <span className="arcade-tile-rule">{g.ruleLine}</span>
      {best[g.id] > 0 && <span className="arcade-tile-best">BEST {best[g.id]}</span>}
    </button>
  );

  return (
    <div className="module-page arcade-page">
      <div className="module-header">
        <h1><i className="fa-solid fa-gamepad" /> Arcade</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Badge tone={tokens > 0 ? "accent" : "default"} icon="fa-ticket">
            {tokens > 0 ? `${tokens} break${tokens === 1 ? "" : "s"} earned` : "free play"}
          </Badge>
          {import.meta.env.DEV && (
            <button className="btn btn-sm btn-secondary-sm" onClick={() => { earnBreak(1, "dev"); setTokens(breakTokens()); }} title="Dev: grant a break token">+1 token</button>
          )}
        </div>
      </div>
      <p className="no-entries" style={{ marginTop: "-0.4rem" }}>
        The full Kiwi engage library — games, check-ins, and reading breaks between study blocks.
        When Learn ships, getting things right earns break tickets.
      </p>

      <div className="arcade-sh">Quick breaks · 1–3 minutes</div>
      <div className="arcade-grid">
        {quick.map((g) => <Tile key={g.id} g={g} />)}
        <button type="button" className="arcade-tile arcade-tile-read" onClick={() => playOpp(articleOpp)}>
          <span className="arcade-tile-title"><i className="fa-solid fa-book-open" /> Reading break</span>
          <span className="arcade-tile-rule">A short piece — scroll to the end to finish</span>
        </button>
        {PULSES.map((p) => (
          <button key={p.id} type="button" className="arcade-tile arcade-tile-pulse" onClick={() => playPulse(p)}>
            <span className="arcade-tile-title"><i className="fa-solid fa-bolt" /> {p.label}</span>
            <span className="arcade-tile-rule">Quick Pulse · 20 seconds</span>
          </button>
        ))}
      </div>

      <div className="arcade-sh">Check-ins · Kiwi's quick surveys</div>
      <div className="arcade-areas">
        {Object.entries(surveysByArea).map(([area, opps]) => {
          const meta = AREA_META[area] || { label: area, icon: "fa-circle-question" };
          return (
            <div key={area} className="arcade-area">
              <div className="arcade-area-h"><i className={`fa-solid ${meta.icon}`} /> {meta.label} <span className="arcade-area-n">{opps.length}</span></div>
              <div className="arcade-chiprow">
                {opps.map((o) => (
                  <button key={o.id} type="button" className="arcade-chip" title={o.description} onClick={() => playOpp(o)}>
                    {o.title} <em>{o.estMinutes}m</em>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="arcade-sh" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        The full cabinet ({rest.length})
        <input className="arcade-search" placeholder="Search games…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="arcade-grid">
        {rest.map((g) => <Tile key={g.id} g={g} />)}
      </div>

      {labOpps.length > 0 && (
        <>
          <div className="arcade-sh">From Kiwi's lab · monetization stubs, kept for completeness</div>
          <div className="arcade-grid">
            {labOpps.map((o) => (
              <button key={o.id} type="button" className="arcade-tile arcade-tile-lab" onClick={() => playOpp(o)}>
                <span className="arcade-tile-title">{o.title}</span>
                <span className="arcade-tile-rule">{o.kind === "video-pick" ? "Kiwi's video slot (marked 'coming soon' upstream)" : "Kiwi's simulated opt-in ad"}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {playing && (
        <div className="arcade-overlay" onClick={() => setPlaying(null)}>
          <div className="arcade-stage" onClick={(e) => e.stopPropagation()}>
            <div className="arcade-stage-bar">
              <span className="arcade-stage-title">{playing.title}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button className="btn btn-sm btn-secondary-sm" onClick={() => setPlaying({ ...playing })} title="Restart"><i className="fa-solid fa-rotate-right" /></button>
                <button className="btn btn-sm btn-secondary-sm" onClick={() => setPlaying(null)}><i className="fa-solid fa-xmark" /> Done</button>
              </div>
            </div>
            <GameFrame opp={playing.opp} kiwiQ={playing.kiwiQ} best={playing.gameId ? best[playing.gameId] || 0 : 0} onComplete={onComplete} />
          </div>
        </div>
      )}
    </div>
  );
}
