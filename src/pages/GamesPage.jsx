import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ease } from "../lib/motion";
import { ScrollProgress, Reveal } from "../components/Reveal";

const GAMES = [
  {
    id: "minecraft-trivia",
    icon: "fa-cube",
    title: "Minecraft Trivia",
    desc: "Test your Minecraft knowledge. Blocks, mobs, biomes, crafting — how much do you actually know?",
    bg: "linear-gradient(135deg, #1a2e1a 0%, #0f1f0f 100%)",
    to: "/games/minecraft-trivia",
    label: "Play Trivia",
  },
  {
    id: "monopoly-banker",
    icon: "fa-building-columns",
    title: "Monopoly Banker",
    desc: "The digital Monopoly bank. Manage everyone's money without the paper bills and arguments.",
    bg: "linear-gradient(135deg, #14213a 0%, #0d1526 100%)",
    to: "/games/monopoly-banker",
    label: "Open Banker",
  },
  {
    id: "tictactoe",
    icon: "fa-hashtag",
    title: "Tic-Tac-Toe",
    desc: "Classic Tic-Tac-Toe. Two players, score tracking, and the eternal question: X or O?",
    bg: "linear-gradient(135deg, #0d0d2b 0%, #15152e 100%)",
    to: "/games/tictactoe",
    label: "Play Game",
  },
];

export default function GamesPage() {
  return (
    <div className="lp">
      <ScrollProgress />

      {/* Hero */}
      <header className="lp-subhero">
        <span className="lp-kicker">ls ~/games</span>
        <h1 className="lp-subhero-title"><em>Games</em></h1>
        <p className="lp-subhero-sub">
          Built for fun. These are small projects I made to sharpen my skills — and because
          building things you&apos;d actually use is the best way to learn.
        </p>
        <div className="lp-subhero-cta">
          <Link to="/" className="pill pill-ghost"><i className="fa-solid fa-arrow-left" /> back home</Link>
        </div>
      </header>

      {/* Games grid */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-work-grid" style={{ marginTop: 0 }}>
          {GAMES.map((g, i) => (
            <motion.div key={g.id}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.5, ease: ease.out, delay: (i % 3) * 0.06 }}>
              <Link className="lp-card" to={g.to}>
                <div className="lp-card-media ph" style={{ background: g.bg }}>
                  <i className={`fa-solid ${g.icon}`} style={{ fontSize: "2.6rem", color: "var(--green)", opacity: 0.9 }} />
                </div>
                <div className="lp-card-body">
                  <span className="lp-tag">Game</span>
                  <h3 className="lp-card-title">{g.title}</h3>
                  <p className="lp-card-desc">{g.desc}</p>
                  <span className="lp-card-link">{g.label} <i className="fa-solid fa-play" /></span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
