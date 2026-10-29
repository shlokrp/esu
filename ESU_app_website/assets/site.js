/* ===========================================================
   PayRight — Website script (shared by every page)
   Theme, nav, footer, smooth scroll, scroll animations.
   =========================================================== */

/* Address of the PayRight app — it lives in the app/ folder next to these pages */
const APP_URL = "app/";
const appLink = (hash = "") => APP_URL + hash;

/* ---------- Theme ---------- */
function getTheme() {
  try { return localStorage.getItem("pr-theme"); } catch (e) { return null; }
}
function applyTheme(t) {
  if (t) document.documentElement.setAttribute("data-theme", t);
}
(function initTheme() {
  const saved = getTheme();
  if (saved) applyTheme(saved);
  else applyTheme(matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
})();
function toggleTheme() {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(next);
  try { localStorage.setItem("pr-theme", next); } catch (e) {}
}

/* ---------- Shared header + footer ---------- */
const LOGO = `<svg viewBox="0 0 40 40" aria-hidden="true">
  <path d="M8 4h24a2 2 0 0 1 2 2v30l-4-3-4 3-4-3-4 3-4-3-4 3-4-3V6a2 2 0 0 1 2-2z" fill="var(--ink)"/>
  <path d="M13 19.5l5 5 9.5-10" stroke="var(--accent)" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const NAV_LINKS = [
  ["index.html#how", "How it works"],
  ["index.html#features", "Features"],
  ["check.html", "Check a bill"],
  ["rights.html", "Consumer rights"],
  ["pricing.html", "Pricing"],
  ["about.html", "About"],
];

function buildChrome() {
  const here = location.pathname.split("/").pop() || "index.html";
  const nav = document.getElementById("nav");
  if (nav) {
    nav.className = "nav";
    nav.innerHTML = `
      <div class="wrap nav-in">
        <a href="index.html" class="logo" aria-label="PayRight home">${LOGO}<span>Pay<b>Right</b></span></a>
        <nav class="nav-links">
          ${NAV_LINKS.map(([h, t]) => `<a href="${h}" class="${h === here ? "active" : ""}">${t}</a>`).join("")}
        </nav>
        <div class="nav-cta">
          <button class="theme-btn" id="themeBtn" aria-label="Switch light or dark theme">
            <svg class="moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
            <svg class="sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
          </button>
          <a href="login.html" class="btn btn-ghost btn-sm">Log in</a>
          <a href="login.html?mode=signup" class="btn btn-primary btn-sm">Get started</a>
          <button class="burger" id="burger" aria-label="Open menu"><span></span><span></span></button>
        </div>
      </div>`;
    const mm = document.createElement("div");
    mm.className = "mobile-menu";
    mm.innerHTML = NAV_LINKS.map(([h, t]) => `<a href="${h}">${t}</a>`).join("") +
      `<div style="display:flex;gap:10px;margin-top:30px"><a href="login.html" class="btn btn-ghost">Log in</a><a href="login.html?mode=signup" class="btn btn-primary">Get started</a></div>`;
    document.body.appendChild(mm);
    mm.querySelectorAll("a").forEach(a => a.addEventListener("click", () => document.body.classList.remove("menu-open")));
    document.getElementById("burger").onclick = () => document.body.classList.toggle("menu-open");
    document.getElementById("themeBtn").onclick = toggleTheme;
  }

  const foot = document.getElementById("foot");
  if (foot) {
    foot.innerHTML = `
      <div class="wrap">
        <div class="foot-grid">
          <div>
            <a href="index.html" class="logo">${LOGO}<span>Pay<b>Right</b></span></a>
            <p class="muted" style="margin-top:16px;max-width:34ch">Scan before you pay. Know what every rupee is for.</p>
            <a href="${APP_URL}" class="btn btn-accent btn-sm" style="margin-top:22px">Open the app <span class="arr">→</span></a>
          </div>
          <div><h5>Product</h5>
            <a href="index.html#how">How it works</a><a href="index.html#features">Features</a>
            <a href="check.html">Bill checker</a><a href="pricing.html">Pricing</a></div>
          <div><h5>Learn</h5>
            <a href="rights.html">Consumer rights hub</a><a href="pricing.html#faq">FAQ</a>
            <a href="about.html">About us</a><a href="about.html#contact">Contact</a></div>
          <div><h5>Legal</h5>
            <a href="legal.html#privacy">Privacy policy</a><a href="legal.html#terms">Terms of service</a>
            <a href="legal.html#disclaimer">Disclaimer</a></div>
        </div>
        <div class="foot-legal">
          <span>© 2026 PayRight. All rights reserved.</span>
          <span>PayRight is not a law firm, regulator or payment institution.</span>
        </div>
        <div class="foot-big">PayRight</div>
      </div>`;
  }
}

/* ---------- Toast ---------- */
function toast(msg) {
  let t = document.querySelector(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ---------- Smooth scroll (Lenis, if it loaded) ---------- */
let lenis = null;
function initSmooth() {
  if (window.Lenis && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
  } else {
    document.documentElement.style.scrollBehavior = "smooth";
  }
  // in-page anchors
  document.addEventListener("click", e => {
    const a = e.target.closest("a[href*='#']");
    if (!a) return;
    const [path, hash] = a.getAttribute("href").split("#");
    const here = location.pathname.split("/").pop() || "index.html";
    if (path && path !== here) return;
    const el = document.getElementById(hash);
    if (!el) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(el, { offset: -70 }); else el.scrollIntoView();
  });
}

/* ---------- Nav state on scroll ---------- */
function initNavScroll() {
  const nav = document.getElementById("nav");
  if (!nav) return;
  let last = 0;
  addEventListener("scroll", () => {
    const y = scrollY;
    nav.classList.toggle("scrolled", y > 20);
    nav.classList.toggle("hide", y > last && y > 500 && !document.body.classList.contains("menu-open"));
    last = y;
  }, { passive: true });
}

/* ---------- Reveal on scroll ---------- */
function splitWords() {
  document.querySelectorAll(".split-words").forEach(el => {
    if (el.dataset.done) return;
    el.dataset.done = 1;
    let i = 0;
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const w = document.createElement("span");
            w.className = "w";
            w.innerHTML = `<span style="--i:${i++}">${part}</span>`;
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== "BR") {
          walk(n);
        }
      });
    };
    walk(el);
  });
}
function initReveal() {
  splitWords();
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
  document.querySelectorAll("[data-reveal], .split-words, .underline-draw").forEach(el => io.observe(el));
}

/* ---------- Scroll-driven sections ---------- */
function sectionProgress(el) {
  const r = el.getBoundingClientRect();
  const total = el.offsetHeight - innerHeight;
  return Math.min(1, Math.max(0, -r.top / total));
}
function isDesktop() { return innerWidth > 1020; }

function initStory() {
  const story = document.querySelector(".story");
  if (!story) return;
  const steps = story.querySelectorAll(".story-step");
  const bars = story.querySelectorAll(".story-progress b");
  const n = steps.length;
  function update() {
    if (!isDesktop()) { steps.forEach(s => s.classList.add("on")); return; }
    const p = sectionProgress(story);
    const idx = Math.min(n - 1, Math.floor(p * n));
    story.dataset.step = idx;
    steps.forEach((s, i) => s.classList.toggle("on", i === idx));
    bars.forEach((b, i) => {
      const local = Math.min(1, Math.max(0, p * n - i));
      b.style.transform = `scaleX(${local})`;
    });
  }
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", update);
  update();
}

function initHScroll() {
  const sec = document.querySelector(".hscroll");
  if (!sec) return;
  const track = sec.querySelector(".htrack");
  const count = sec.querySelector(".hscroll-count b");
  const panels = track.children.length;
  function update() {
    if (!isDesktop()) { track.style.transform = ""; return; }
    const p = sectionProgress(sec);
    const max = track.scrollWidth - innerWidth + 40;
    track.style.transform = `translate3d(${-p * max}px,0,0)`;
    if (count) count.textContent = String(Math.min(panels, Math.floor(p * panels) + 1)).padStart(2, "0");
  }
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", update);
  update();
}

/* statement where words light up as you scroll past */
function initLightWords() {
  document.querySelectorAll(".statement[data-light]").forEach(st => {
    const words = [];
    st.childNodes.forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(w => {
          if (/^\s*$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
          const s = document.createElement("span"); s.className = "dim"; s.textContent = w; words.push(s); frag.appendChild(s);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) { n.classList.add("dim"); words.push(n); }
    });
    function update() {
      const r = st.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight * .85 - r.top) / (r.height + innerHeight * .35)));
      const lit = Math.round(p * words.length);
      words.forEach((w, i) => w.classList.toggle("lit", i < lit));
    }
    addEventListener("scroll", update, { passive: true });
    update();
  });
}

/* gentle parallax: data-speed="0.1" */
function initParallax() {
  const els = document.querySelectorAll("[data-speed]");
  if (!els.length) return;
  function update() {
    els.forEach(el => {
      const r = el.getBoundingClientRect();
      const c = r.top + r.height / 2 - innerHeight / 2;
      el.style.transform = `translate3d(0, ${c * -parseFloat(el.dataset.speed)}px, 0)`;
    });
  }
  addEventListener("scroll", update, { passive: true });
  update();
}

/* ---------- Accordions ---------- */
function initAccordions() {
  document.querySelectorAll(".acc-q").forEach(q => {
    q.addEventListener("click", () => q.parentElement.classList.toggle("open"));
  });
}

/* ---------- Counters: <span data-count="1886" data-prefix="₹"> ---------- */
function initCounters() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target; io.unobserve(el);
      const end = parseFloat(el.dataset.count); const pre = el.dataset.prefix || ""; const t0 = performance.now();
      const step = now => {
        const k = Math.min(1, (now - t0) / 1400); const e = 1 - Math.pow(1 - k, 3);
        el.textContent = pre + Math.round(end * e).toLocaleString("en-IN");
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  });
  document.querySelectorAll("[data-count]").forEach(el => io.observe(el));
}

/* ---------- Boot ---------- */
buildChrome();
document.addEventListener("DOMContentLoaded", () => {
  initSmooth();
  initNavScroll();
  initReveal();
  initStory();
  initHScroll();
  initLightWords();
  initParallax();
  initAccordions();
  initCounters();
  // every <a data-app="#screen"> opens that screen in the PayRight app
  document.querySelectorAll("a[data-app]").forEach(a => a.href = appLink(a.dataset.app));
});
