import { useState } from "react";
import { Link } from "react-router-dom";
import PublicLoader from "../components/public/PublicLoader.jsx";

export default function GameEmbed({ src, title }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <main className="game-embed-page" id="main" tabIndex={-1}>
      <div className="game-embed-bar">
        <h1 className="game-embed-title">{title}</h1>
        <Link to="/games">
          <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Back to Games
        </Link>
      </div>
      <div className="game-embed-stage" aria-busy={!loaded}>
        {!loaded && <PublicLoader variant="plain" fullscreen={false} label={`Loading ${title}…`} />}
        <iframe
          className="game-embed-frame"
          src={src}
          title={title}
          allow="autoplay"
          sandbox="allow-scripts allow-same-origin allow-forms"
          onLoad={() => setLoaded(true)}
        />
      </div>
    </main>
  );
}
