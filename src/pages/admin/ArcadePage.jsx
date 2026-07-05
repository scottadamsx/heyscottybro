import { useEffect, useMemo, useState } from "react";
import { KIWI_GAMES } from "../../games/kiwi/registry";
import GameFrame from "../../components/arcade/GameFrame";
import { bestScores, recordScore, breakTokens, spendBreak, earnBreak } from "../../lib/breaks";
import { Badge } from "../../components/ui";
import { useToast } from "../../contexts/ToastContext";
import "./arcade.css";

/**
 * The Arcade — Kiwi's 50-game engage library, ported byte-identical (same
 * paper-&-clay skin, same completion contract) as heyscottybro's study-break
 * room. The Learn page will grant break tokens for getting study items right;
 * until it ships, play is free and best scores still count.
 */
const QUICK_IDS = ["reaction", "stroop", "wordle", "memory", "snake", "2048", "simon", "typing", "higher", "whack", "colorpick", "aim"];

export default function ArcadePage() {
  const { addToast } = useToast();
  const [playing, setPlaying] = useState(null);         // registry entry
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

  const play = (g) => {
    // Free play until Learn grants tokens; spending is soft for now.
    spendBreak();
    setTokens(breakTokens());
    setPlaying(g);
  };

  const onComplete = ({ bonus, score, won }) => {
    if (!playing) return;
    setBest(recordScore(playing.id, score));
    const bits = [];
    if (won === true) bits.push("won");
    if (score != null) bits.push(`score ${score}`);
    if (bonus > 0) bits.push(`+${bonus} bonus`);
    addToast(`${playing.title}: ${bits.join(" · ") || "done"} — back to it! 📚`, "success");
  };

  const Tile = ({ g }) => (
    <button type="button" className="arcade-tile" onClick={() => play(g)}>
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
            <button className="btn btn-sm btn-secondary-sm" onClick={() => { earnBreak(1, "dev"); setTokens(breakTokens()); }} title="Dev: grant a break token">
              +🎟
            </button>
          )}
        </div>
      </div>
      <p className="no-entries" style={{ marginTop: "-0.4rem" }}>
        Straight from the Kiwi engage library — quick brain-resets between study blocks.
        When Learn ships, getting things right earns break tickets.
      </p>

      <div className="arcade-sh">Quick breaks · 1–3 minutes</div>
      <div className="arcade-grid">
        {quick.map((g) => <Tile key={g.id} g={g} />)}
      </div>

      <div className="arcade-sh" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        The full cabinet ({rest.length})
        <input className="arcade-search" placeholder="Search games…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="arcade-grid">
        {rest.map((g) => <Tile key={g.id} g={g} />)}
      </div>

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
            <GameFrame game={playing} best={best[playing.id] || 0} onComplete={onComplete} />
          </div>
        </div>
      )}
    </div>
  );
}
