import { useState, useEffect } from "react";
import { NavLink, Link } from "react-router-dom";

/* Attio-style mega-menu nav: top-level triggers open a categorized dropdown of
 * sub-pages (icon + title + description), with an optional quick-links aside.
 * `to` = internal route, `href` = external site (opens in a new tab). */
const MENUS = [
  {
    id: "work",
    label: "Work",
    groups: [
      {
        heading: "Products",
        items: [
          { title: "NEVER86", desc: "Restaurant platform for independents", icon: "fa-utensils", to: "/never86" },
          { title: "St. John's Hike Club", desc: "A Newfoundland community movement", icon: "fa-person-hiking", to: "/sjhc" },
        ],
      },
      {
        heading: "Client sites",
        items: [
          { title: "eliquinn.space", desc: "Architecture portfolio — built for Eli Quinn", icon: "fa-compass-drafting", href: "https://eliquinn.space" },
        ],
      },
    ],
    aside: { heading: "Explore", links: [{ label: "All projects", to: "/#work" }] },
  },
  {
    id: "games",
    label: "Games",
    groups: [
      {
        heading: "Arcade",
        items: [
          { title: "Minecraft Trivia", desc: "Blocks, mobs, biomes & more", icon: "fa-cube", to: "/games/minecraft-trivia" },
          { title: "Monopoly Banker", desc: "The digital Monopoly bank", icon: "fa-sack-dollar", to: "/games/monopoly-banker" },
          { title: "Tic-Tac-Toe", desc: "Classic, with score tracking", icon: "fa-hashtag", to: "/games/tictactoe" },
        ],
      },
    ],
    aside: { heading: "More", links: [{ label: "All games", to: "/games" }] },
  },
  {
    id: "guide",
    label: "Guide",
    groups: [
      {
        heading: "Vibrant software guide",
        items: [
          { title: "Get started", desc: "Why and how it works", icon: "fa-flag", to: "/guide" },
          { title: "Set up accounts", desc: "Tools and logins you'll need", icon: "fa-user-gear", to: "/guide/setup" },
          { title: "The toolkit", desc: "What I build with", icon: "fa-toolbox", to: "/guide/toolkit" },
          { title: "Help & FAQ", desc: "Common questions, answered", icon: "fa-circle-question", to: "/guide/help" },
        ],
      },
    ],
    aside: null,
  },
];

function MegaItem({ it, onPick }) {
  const inner = (
    <>
      <span className="nav-mega-ico"><i className={`fa-solid ${it.icon}`} /></span>
      <span>
        <span className="nav-mega-t">
          {it.title}
          {it.href && <i className="fa-solid fa-arrow-up-right-from-square nav-mega-ext" />}
        </span>
        <span className="nav-mega-d">{it.desc}</span>
      </span>
    </>
  );
  return it.href
    ? <a className="nav-mega-item" href={it.href} target="_blank" rel="noreferrer" onClick={onPick}>{inner}</a>
    : <Link className="nav-mega-item" to={it.to} onClick={onPick}>{inner}</Link>;
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);   // mobile drawer
  const [openMenu, setOpenMenu] = useState(null);     // desktop mega-menu id

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeAll = () => { setMenuOpen(false); setOpenMenu(null); };
  const active = MENUS.find((m) => m.id === openMenu);

  return (
    <>
      <nav className={`navbar${scrolled ? " scrolled" : ""}`}>
        <div className="nav-inner" onMouseLeave={() => setOpenMenu(null)}>
          <Link to="/" className="nav-logo" onClick={closeAll}>
            hey<span>Scotty</span>Bro
          </Link>

          {/* Desktop nav */}
          <ul className="nav-links">
            {MENUS.map((m) => (
              <li key={m.id} onMouseEnter={() => setOpenMenu(m.id)}>
                <button
                  className={`nav-trigger${openMenu === m.id ? " open" : ""}`}
                  aria-expanded={openMenu === m.id}
                  onClick={() => setOpenMenu(openMenu === m.id ? null : m.id)}
                >
                  {m.label} <i className="fa-solid fa-chevron-down" />
                </button>
              </li>
            ))}
          </ul>

          <div className="nav-right">
            <NavLink to="/admin/login" className="nav-cta" onClick={closeAll}>
              <i className="fa-solid fa-lock" /> Admin
            </NavLink>
          </div>

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

          {/* Desktop mega-menu panel */}
          {active && (
            <div className="nav-mega" onMouseEnter={() => setOpenMenu(active.id)}>
              <div className="nav-mega-main">
                {active.groups.map((g) => (
                  <div key={g.heading}>
                    <div className="nav-mega-heading">{g.heading}</div>
                    <div className="nav-mega-grid">
                      {g.items.map((it) => <MegaItem key={it.title} it={it} onPick={closeAll} />)}
                    </div>
                  </div>
                ))}
              </div>
              {active.aside && (
                <div className="nav-mega-aside">
                  <div className="nav-mega-heading">{active.aside.heading}</div>
                  {active.aside.links.map((l) => (
                    <Link key={l.label} to={l.to} onClick={closeAll}>{l.label}</Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Mobile menu — grouped sections */}
      <div className={`nav-mobile${menuOpen ? " open" : ""}`}>
        {MENUS.map((m) => (
          <div key={m.id} className="nav-mobile-group">
            <div className="nav-mobile-heading">{m.label}</div>
            {m.groups.flatMap((g) => g.items).map((it) => (
              it.href
                ? <a key={it.title} href={it.href} target="_blank" rel="noreferrer" onClick={closeAll}><i className={`fa-solid ${it.icon}`} /> {it.title}</a>
                : <NavLink key={it.title} to={it.to} onClick={closeAll}><i className={`fa-solid ${it.icon}`} /> {it.title}</NavLink>
            ))}
          </div>
        ))}
        <div className="nav-mobile-group">
          <NavLink to="/admin/login" onClick={closeAll}><i className="fa-solid fa-lock" /> Admin</NavLink>
        </div>
      </div>
    </>
  );
}
