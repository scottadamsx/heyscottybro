import { Link } from "react-router-dom";

export default function GameEmbed({ src, title }) {
  return (
    <div className="game-embed-page">
      <div className="game-embed-bar">
        <h2>{title}</h2>
        <Link to="/games">
          <i className="fa-solid fa-arrow-left" /> Back to Games
        </Link>
      </div>
      <iframe
        className="game-embed-frame"
        src={src}
        title={title}
        allow="autoplay"
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
    </div>
  );
}
