import { Link } from "react-router-dom";

const GAMES = [
  {
    id: "minecraft-trivia",
    emoji: "⛏️",
    title: "Minecraft Trivia",
    desc: "Test your Minecraft knowledge. Blocks, mobs, biomes, crafting — how much do you actually know?",
    bg: "linear-gradient(135deg, #2d5016 0%, #1a3a0a 100%)",
    to: "/games/minecraft-trivia",
    label: "Play Trivia",
  },
  {
    id: "monopoly-banker",
    emoji: "🎩",
    title: "Monopoly Banker",
    desc: "The digital Monopoly bank. Manage everyone's money without the paper bills and arguments.",
    bg: "linear-gradient(135deg, #1a2a6c 0%, #b21f1f 50%, #fdbb2d 100%)",
    to: "/games/monopoly-banker",
    label: "Open Banker",
  },
  {
    id: "tictactoe",
    emoji: "⭕",
    title: "Tic-Tac-Toe",
    desc: "Classic Tic-Tac-Toe. Two players, score tracking, and the eternal question: X or O?",
    bg: "linear-gradient(135deg, #0d0d2b 0%, #1a1a4a 100%)",
    to: "/games/tictactoe",
    label: "Play Game",
  },
];

export default function GamesPage() {
  return (
    <main className="games-page">
      <div className="container">
        <div className="section-label">Play</div>
        <h1 className="section-title">Games</h1>
        <p className="section-desc" style={{ marginBottom: "0" }}>
          Built for fun. These are small projects I made to sharpen my skills — and because
          building things you&apos;d actually use is the best way to learn.
        </p>

        <div className="games-grid">
          {GAMES.map((g) => (
            <Link to={g.to} className="game-card" key={g.id} style={{ textDecoration: "none" }}>
              <div className="game-card-preview" style={{ background: g.bg }}>
                <span>{g.emoji}</span>
                <div style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,0.2)",
                  transition: "background 0.3s",
                }} />
              </div>
              <div className="game-card-body">
                <div className="game-card-title">{g.title}</div>
                <div className="game-card-desc">{g.desc}</div>
                <span className="card-btn-primary" style={{
                  display: "inline-block",
                  padding: "0.5rem 1rem",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.875rem",
                  fontWeight: "600",
                }}>
                  <i className="fa-solid fa-play" style={{ marginRight: "0.375rem" }} />
                  {g.label}
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div style={{ marginTop: "4rem", textAlign: "center" }}>
          <Link to="/" className="btn-secondary">
            <i className="fa-solid fa-arrow-left" /> Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
