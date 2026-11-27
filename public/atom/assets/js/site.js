// Site-wide behaviour: navigation, theme, reading progress, lazy figures.

const root = document.documentElement;

/* ---------- Theme ---------- */
function systemDark() { return window.matchMedia('(prefers-color-scheme: dark)').matches; }
function currentDark() {
  const t = root.dataset.theme;
  return t ? t === 'dark' : systemDark();
}
function setTheme(t) {
  root.dataset.theme = t;
  try { localStorage.setItem('theme', t); } catch (e) { /* storage unavailable */ }
  const meta = document.querySelector('meta[name="theme-color"]:not([media])');
  if (meta) meta.content = t === 'dark' ? '#121211' : '#f5f2eb';
  document.dispatchEvent(new CustomEvent('themechange', { detail: { dark: t === 'dark' } }));
  syncThemeButton();
}
function syncThemeButton() {
  const b = document.querySelector('.theme-toggle');
  if (!b) return;
  const dark = currentDark();
  b.setAttribute('aria-pressed', String(dark));
  b.innerHTML = dark
    ? '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="3.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 1.8v2.1M10 16.1v2.1M1.8 10h2.1M16.1 10h2.1M4.2 4.2l1.5 1.5M14.3 14.3l1.5 1.5M4.2 15.8l1.5-1.5M14.3 5.7l1.5-1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
    : '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16.5 12.6A7 7 0 0 1 7.4 3.5a7 7 0 1 0 9.1 9.1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  b.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
}
document.querySelector('.theme-toggle')?.addEventListener('click', () => setTheme(currentDark() ? 'light' : 'dark'));
syncThemeButton();

/* ---------- Chapters dropdown ---------- */
for (const menu of document.querySelectorAll('[data-menu]')) {
  const btn = menu.querySelector('button');
  const close = () => { menu.dataset.open = 'false'; btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = menu.dataset.open !== 'true';
    menu.dataset.open = String(open);
    btn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (e) => { if (!menu.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { close(); } });
}

/* ---------- Mobile sheet ---------- */
const menuButton = document.querySelector('.menu-button');
if (menuButton) {
  let sheet;
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open));
    if (open) {
      if (!sheet) {
        sheet = document.createElement('div');
        sheet.className = 'mobile-sheet';
        sheet.id = 'mobile-sheet';
        const chapters = [...document.querySelectorAll('.nav-menu__panel a')].map((a) =>
          `<a href="${a.getAttribute('href')}"><span class="num">${a.querySelector('.num')?.textContent || ''}</span><span>${a.querySelector('.t')?.textContent || a.textContent}</span></a>`).join('');
        const tools = [...document.querySelectorAll('.site-nav > a')].map((a) => `<a href="${a.getAttribute('href')}">${a.textContent}</a>`).join('');
        sheet.innerHTML = `<h2>Chapters</h2>${chapters}<h2>Tools</h2>${tools}<a href="./">Home</a>`;
        document.body.appendChild(sheet);
      }
      sheet.hidden = false;
      document.body.style.overflow = 'hidden';
    } else if (sheet) {
      sheet.hidden = true;
      document.body.style.overflow = '';
    }
  });
}

/* ---------- Reading progress ---------- */
const progress = document.querySelector('.site-header .progress');
const article = document.querySelector('[data-progress]');
if (progress && article) {
  let ticking = false;
  const update = () => {
    ticking = false;
    const r = article.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
    progress.style.setProperty('--p', p.toFixed(4));
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
} else if (progress) {
  progress.remove();
}

/* ---------- Lazy figures ---------- */
const instances = new Map();
const visibility = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const inst = instances.get(e.target);
    if (!inst) continue;
    inst.__visible = e.isIntersecting;
    if (e.isIntersecting && !document.hidden) inst.resume?.();
    else inst.pause?.();
  }
}, { threshold: 0 });

async function mountFigure(el) {
  const name = el.dataset.figure;
  try {
    const mod = await import(`./figures/${name}.js`);
    const inst = await mod.mount(el, { ...el.dataset });
    el.dataset.mounted = 'true';
    if (inst && (inst.pause || inst.resume)) {
      instances.set(el, inst);
      visibility.observe(el);
    }
  } catch (err) {
    console.error(`Figure "${name}" failed`, err);
    const msg = document.createElement('p');
    msg.className = 'caption';
    msg.textContent = 'This interactive figure could not load in your browser.';
    el.appendChild(msg);
  }
}

const lazy = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) {
      lazy.unobserve(e.target);
      mountFigure(e.target);
    }
  }
}, { rootMargin: '700px 0px' });
for (const el of document.querySelectorAll('[data-figure]')) {
  if (el.dataset.eager !== undefined) mountFigure(el);
  else lazy.observe(el);
}

document.addEventListener('visibilitychange', () => {
  for (const inst of instances.values()) {
    if (document.hidden) inst.pause?.();
    else if (inst.__visible) inst.resume?.();
  }
});
