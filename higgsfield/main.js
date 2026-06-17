/* ============================================================
   Higgsfield — interactions (vanilla JS, no dependencies)
   ============================================================ */
(function () {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Footer year ---- */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---- Navbar: scrolled state ---- */
  const nav = document.getElementById("nav");
  const onScroll = () => {
    if (!nav) return;
    nav.classList.toggle("is-scrolled", window.scrollY > 12);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---- Mobile menu ---- */
  const toggle = document.getElementById("navToggle");
  const mobile = document.getElementById("navMobile");
  if (toggle && mobile) {
    const setOpen = (open) => {
      toggle.classList.toggle("is-open", open);
      mobile.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      mobile.hidden = !open;
    };
    toggle.addEventListener("click", () =>
      setOpen(!toggle.classList.contains("is-open"))
    );
    mobile.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => setOpen(false))
    );
  }

  /* ---- Scroll reveal ---- */
  const reveals = document.querySelectorAll(".reveal");
  if (prefersReduced || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("is-in"));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, i) => {
          if (entry.isIntersecting) {
            // small stagger for groups
            const delay = Math.min(i * 60, 240);
            entry.target.style.transitionDelay = delay + "ms";
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    reveals.forEach((el) => io.observe(el));
  }

  /* ---- Animated counters ---- */
  const counters = document.querySelectorAll("[data-count]");
  const animateCount = (el) => {
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || "";
    const duration = 1600;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = target + suffix;
    };
    requestAnimationFrame(tick);
  };
  if (prefersReduced || !("IntersectionObserver" in window)) {
    counters.forEach((el) => (el.textContent = el.dataset.count + (el.dataset.suffix || "")));
  } else {
    const cio = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            cio.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach((el) => cio.observe(el));
  }

  /* ---- Hero tilt (pointer parallax) ---- */
  const tilt = document.querySelector("[data-tilt] .studio");
  const tiltWrap = document.querySelector("[data-tilt]");
  if (tilt && tiltWrap && !prefersReduced && window.matchMedia("(pointer: fine)").matches) {
    const max = 7;
    tiltWrap.addEventListener("mousemove", (e) => {
      const r = tiltWrap.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      tilt.style.transform = `rotateY(${x * max}deg) rotateX(${-y * max}deg)`;
    });
    tiltWrap.addEventListener("mouseleave", () => {
      tilt.style.transform = "rotateY(0) rotateX(0)";
    });
  }

  /* ---- FAQ: keep it a single-open accordion (optional nicety) ---- */
  const faqItems = document.querySelectorAll(".faq__item");
  faqItems.forEach((item) => {
    item.addEventListener("toggle", () => {
      if (item.open) {
        faqItems.forEach((other) => {
          if (other !== item) other.open = false;
        });
      }
    });
  });
})();
