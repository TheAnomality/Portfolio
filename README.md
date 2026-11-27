# TheAnomality · Portfolio

A portfolio for a developer who does everything. One WebGL particle system morphs as you scroll: from a black hole, into an atom, into a sakura flower, into a galaxy, into a portal. Two real projects, **Atom** and **AnimeWiki**, run live inside the site.

**Stack:** React 19 · TypeScript · Vite · Three.js with React Three Fiber and custom GLSL shaders · Motion (Framer Motion) · Lenis smooth scrolling · Tailwind CSS v4 · Zustand · a HyperFrames showreel · Vercel (hosting, contact-form function, analytics).

## What's inside

- **Morphing particle universe**: up to 20,000 particles, five shapes and custom shaders. Particles swirl between shapes, scatter from your cursor, and burst when you click the hero. It adapts to the device (fewer particles on phones, lower resolution when frames drop), stays still for reduced motion, and falls back to CSS without WebGL.
- **Projects inside the portfolio**: Atom and AnimeWiki are served by this site at `/atom/` and `/animewiki/`. **Launch inside portfolio** opens them full-screen without leaving the page (Back closes it), and `/#view-atom` links straight to one.
- **Motion everywhere**: a preloader where two orbs merge into the anomaly, letter-by-letter reveals, a scroll-revealed manifesto, magnetic buttons, a custom cursor, tilting browser mock-ups with looping previews, count-up stats, a ticker that reacts to scroll speed, and a hero title whose letters get bolder near your cursor.
- **Showreel**: a 26-second video written in HTML and GSAP and rendered with [HyperFrames](https://hyperframes.heygen.com) (`showreel/`).
- **Contact form**: a Vercel Function that emails you through Resend, with spam protection.
- **Production polish**: SEO and social-share tags, a Content Security Policy, self-hosted fonts, long-term caching of hashed files, a custom 404, keyboard and screen-reader support, and live GitHub stars on each project.

## Change the content

Almost everything you'd want to change is in **[`src/content/site.ts`](src/content/site.ts)**: your name, the roles the hero cycles through, the intro, manifesto, projects, stats, skills, about text, email and social links. Save the file and the dev server updates instantly.

- **Add social links:** uncomment the LinkedIn, Instagram and X lines in `socials`.
- **Show an email address:** set `email`. Leave it empty to hide it; the form still works.
- **Add a project:** add its repository to `scripts/sync-projects.mjs`, run `npm run sync:projects`, add an entry to `projects` in `site.ts` (screenshots go in `public/media/<id>/`), and add a redirect for it in `vercel.json`.

## Commands

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies (once) |
| `npm run dev` | Local dev server at http://localhost:5173 |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run check` | TypeScript type check |
| `npm run sync:projects` | Copy the latest Atom and AnimeWiki from GitHub into `public/` |
| `npm run showreel:preview` | Open the HyperFrames editor preview for the showreel |
| `npm run showreel:render` | Render the showreel and update `public/media/showreel.mp4` |

## Deploy

See **[docs/DEPLOY-VERCEL.md](docs/DEPLOY-VERCEL.md)**. In short: merge into `main`, import the repository at vercel.com (the settings are detected), click **Deploy**, then add `RESEND_API_KEY` and `CONTACT_TO_EMAIL` for the contact form. Every push to `main` redeploys.

## Project layout

```
├── src/
│   ├── content/site.ts      ← all text, links and projects
│   ├── App.tsx              page structure
│   ├── sections/            Hero, Manifesto, Work, Showreel, Capabilities, About, Contact, Footer
│   ├── components/          Preloader, Cursor, Nav, ProjectViewer, shared UI
│   ├── three/               the WebGL scene: shapes.ts, shaders.ts, Scene.tsx
│   ├── lib/                 state (zustand), hooks, smooth scrolling
│   └── styles/index.css     Tailwind theme and design tokens
├── public/
│   ├── atom/, animewiki/    the two projects (from npm run sync:projects)
│   └── media/               screenshots, preview loops, showreel
├── api/contact.js           contact form → email (Vercel Function)
├── showreel/                HyperFrames composition for the showreel video
├── scripts/                 sync-projects.mjs, render-showreel.mjs
├── vercel.json              redirects, caching and security headers
└── docs/DEPLOY-VERCEL.md    step-by-step deployment guide
```

## Credits

Three.js and React Three Fiber (MIT), Motion (MIT), GSAP (GreenSock standard license), Lenis (MIT), fonts Unbounded, Geist, Geist Mono and Instrument Serif (SIL Open Font License). Atom and AnimeWiki keep their own credits and data-source notes in their folders.
