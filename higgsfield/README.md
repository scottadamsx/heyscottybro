# Higgsfield — Cinematic AI Motion Studio (landing page)

A beautiful, fully responsive marketing landing page for a fictional AI video
studio called **Higgsfield**. Built as a self-contained static site — **zero
dependencies, zero build step**. Just open it in a browser.

> ⚠️ This is a concept/demo landing page for design purposes and is not
> affiliated with any real company.

## ✨ Highlights

- **Cinematic dark theme** with animated aurora orbs, grid + film-grain texture
- **Glassmorphism** studio mock-up with pointer parallax tilt
- **Scroll-reveal** animations + animated stat counters (IntersectionObserver)
- **Sticky navbar** with scroll state and a mobile hamburger menu
- **Sections:** hero, logo marquee, stats, features (bento grid), how-it-works,
  showcase gallery, pricing, FAQ accordion, CTA, footer
- **Accessible & performant:** semantic HTML, keyboard focus styles,
  `prefers-reduced-motion` support, no external JS/CSS frameworks
- **Responsive** from 320px phones to widescreen

## 🗂 Structure

```
higgsfield/
├── index.html       # markup + content
├── styles.css       # all styling (CSS custom properties, grid, animations)
├── main.js          # nav, scroll reveal, counters, tilt, FAQ accordion
├── assets/
│   └── favicon.svg   # gradient mark
└── README.md
```

## 🚀 Run it

No install needed. Either:

```bash
# Option A — just open the file
open index.html

# Option B — serve locally (nicer for relative paths)
python3 -m http.server 5173
# then visit http://localhost:5173
```

## ☁️ Deploy

It's static, so it deploys anywhere:

- **Vercel:** `vercel` (or drag-and-drop the folder)
- **Netlify:** drag the folder into the dashboard
- **GitHub Pages:** push and enable Pages on the repo

## 🎨 Customize

All colors, gradients, radii, and spacing live in CSS custom properties at the
top of `styles.css` (`:root`). Change `--grad`, `--bg`, and `--violet/--cyan/--magenta`
to re-theme the whole site in seconds.

---

Built with hand-written HTML, CSS, and vanilla JS.
