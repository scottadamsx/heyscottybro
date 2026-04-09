import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          {/* Brand */}
          <div>
            <div className="footer-brand">hey<span>Scotty</span>Bro</div>
            <p className="footer-tagline">
              Developer, founder, and creator out of St. John&apos;s, NL.
              Building things that make life smoother — one line at a time.
            </p>
            <div className="footer-socials">
              <a href="https://github.com/scotty3xe" target="_blank" rel="noreferrer" title="GitHub">
                <i className="fa-brands fa-github" />
              </a>
              <a href="https://instagram.com/scotty3xe" target="_blank" rel="noreferrer" title="Instagram">
                <i className="fa-brands fa-instagram" />
              </a>
              <a href="https://linkedin.com/in/scottadams" target="_blank" rel="noreferrer" title="LinkedIn">
                <i className="fa-brands fa-linkedin-in" />
              </a>
              <a href="https://open.spotify.com/artist/2cLUqlaPtqUPBAMn5gdRbe" target="_blank" rel="noreferrer" title="Spotify">
                <i className="fa-brands fa-spotify" />
              </a>
            </div>
          </div>

          {/* Projects */}
          <div>
            <div className="footer-col-title">Projects</div>
            <div className="footer-links">
              <a href="https://never86.ca" target="_blank" rel="noreferrer">NEVER86</a>
              <a href="https://stjohnshikeclub.com" target="_blank" rel="noreferrer">St. John&apos;s Hike Club</a>
              <Link to="/games">Games</Link>
            </div>
          </div>

          {/* Contact */}
          <div>
            <div className="footer-col-title">Contact</div>
            <div className="footer-links">
              <a href="mailto:scottadamsx@gmail.com">scottadamsx@gmail.com</a>
              <a href="tel:7097302937">709-730-2937</a>
              <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>St. John&apos;s, NL</span>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} Scott Adams. Coded from the Rock.</p>
          <p>
            <Link to="/admin/login" style={{ color: "var(--text-muted)" }}>
              <i className="fa-solid fa-lock" /> Admin
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
