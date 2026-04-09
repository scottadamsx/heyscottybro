import { useState, useEffect } from "react";
import { NavLink, Link } from "react-router-dom";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = () => setMenuOpen(false);

  return (
    <>
      <nav className={`navbar${scrolled ? " scrolled" : ""}`}>
        <div className="nav-inner">
          <Link to="/" className="nav-logo" onClick={close}>
            hey<span>Scotty</span>Bro
          </Link>

          {/* Desktop nav */}
          <ul className="nav-links">
            <li><NavLink to="/">Home</NavLink></li>
            <li><NavLink to="/never86">NEVER86</NavLink></li>
            <li><NavLink to="/sjhc">Hike Club</NavLink></li>
            <li><NavLink to="/games">Games</NavLink></li>
            <li>
              <NavLink to="/admin/login" className="nav-cta">
                <i className="fa-solid fa-lock" /> Admin
              </NavLink>
            </li>
          </ul>

          {/* Mobile hamburger */}
          <button
            className="nav-hamburger"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span style={menuOpen ? { transform: "rotate(45deg) translate(5px, 5px)" } : {}} />
            <span style={menuOpen ? { opacity: 0 } : {}} />
            <span style={menuOpen ? { transform: "rotate(-45deg) translate(5px, -5px)" } : {}} />
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div className={`nav-mobile${menuOpen ? " open" : ""}`}>
        <NavLink to="/" onClick={close}>Home</NavLink>
        <NavLink to="/never86" onClick={close}>NEVER86</NavLink>
        <NavLink to="/sjhc" onClick={close}>St. John&apos;s Hike Club</NavLink>
        <NavLink to="/games" onClick={close}>Games</NavLink>
        <NavLink to="/admin/login" onClick={close}>
          <i className="fa-solid fa-lock" /> Admin
        </NavLink>
      </div>
    </>
  );
}
