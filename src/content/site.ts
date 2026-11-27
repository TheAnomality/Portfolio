/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  EDIT ME. Every word, link and project on the site comes from this file.
 * ─────────────────────────────────────────────────────────────────────────────
 *  After changing something, save: `npm run dev` reloads the page instantly.
 *  This file is also read at build time (page title, meta tags, sitemap).
 */

export type ShapeId = 'singularity' | 'atom' | 'sakura' | 'galaxy' | 'portal';

export interface Stat {
  value: number;
  /** Text shown before/after the number, e.g. "~" or "+". */
  prefix?: string;
  suffix?: string;
  label: string;
}

export interface Project {
  id: string;
  index: string;
  title: string;
  tagline: string;
  summary: string;
  year: string;
  role: string;
  /** Main colour of the project (used for its section, buttons and particles). */
  accent: string;
  /** Particle shape shown behind this project. */
  shape: ShapeId;
  /** Where the project is served from inside this portfolio (folder in public/). */
  path: string;
  /** Source code. */
  repo: string;
  /** "owner/name" on GitHub, used to show live stars and last-update time. */
  githubRepo: string;
  /** Short looping preview video + its first frame. */
  video: { src: string; poster: string };
  gallery: { src: string; alt: string }[];
  stats: Stat[];
  highlights: string[];
  stack: string[];
}

export interface Capability {
  title: string;
  description: string;
  tools: string[];
}

export interface SiteConfig {
  name: string;
  handle: string;
  url: string;
  title: string;
  description: string;
  roles: string[];
  heroIntro: string;
  availability: string;
  manifesto: string;
  email: string;
  socials: { label: string; href: string }[];
  contactEndpoint: string;
  showreel: { src: string; poster: string; seconds: number };
  projects: Project[];
  capabilities: Capability[];
  marquee: string[];
  about: { paragraphs: string[]; facts: Stat[]; now: string[] };
}

export const site: SiteConfig = {
  /** Shown as the big hero title and in the browser tab. */
  name: 'TheAnomality',
  handle: '@TheAnomality',

  /**
   * Your live address, without a trailing slash (used for the share preview,
   * canonical URL and sitemap). Leave it empty on Vercel: the build fills in
   * your production domain automatically. Set it to force a specific domain,
   * e.g. 'https://theanomality.com'.
   */
  url: '',

  title: 'TheAnomality | Creative Developer',
  description:
    'Portfolio of TheAnomality, a developer who does everything: 3D and WebGL, frontend, full-stack and motion. Featuring Atom, an interactive guide to the atom, and AnimeWiki, an anime discovery hub.',

  /** The hero cycles through these. */
  roles: [
    'Creative Developer',
    '3D & WebGL Engineer',
    'Frontend Developer',
    'Full-Stack Builder',
    'UI & Motion Designer',
    'Science Nerd',
    'Anime Enthusiast',
  ],

  heroIntro:
    'I design and build interactive worlds for the web: physics you can touch, anime you can explore, and everything in between.',

  /** Status pill in the hero and contact section. */
  availability: 'Open to projects & collaborations',

  /** Big scroll-revealed statement. Words wrapped in *stars* get the accent style. */
  manifesto:
    'I build small *universes* for the web. From the quantum shapes of an *atom* to the neon worlds of *anime*, I like the place where science, story and code collide. I don’t pick one lane. I do *everything*.',

  /**
   * Public email shown on the site. Leave it empty ('') to hide it. The
   * contact form works without it (see docs/DEPLOY-VERCEL.md).
   */
  email: '',

  /** Social links. Add or remove entries; empty arrays are fine. */
  socials: [
    { label: 'GitHub', href: 'https://github.com/TheAnomality' },
    // { label: 'LinkedIn', href: 'https://www.linkedin.com/in/your-name' },
    // { label: 'Instagram', href: 'https://www.instagram.com/your-handle' },
    // { label: 'X', href: 'https://x.com/your-handle' },
  ],

  /** The contact form posts here: a Vercel Function (see api/contact.js). */
  contactEndpoint: '/api/contact',

  showreel: {
    src: '/media/showreel.mp4',
    poster: '/media/showreel-poster.webp',
    seconds: 26,
  },

  projects: [
    {
      id: 'atom',
      index: '01',
      title: 'Atom',
      tagline: 'An interactive guide to the atom',
      summary:
        'Seven chapters and four tools that show what atoms are really like: how small they are, how we found out what is inside them, the true shapes of orbitals and what holds a nucleus together. Almost every figure is a live simulation computed from the laws of physics, fed by data from NIST, the IAEA and PubChem.',
      year: '2026',
      role: 'Design · Physics · Code',
      accent: '#f0804f',
      shape: 'atom',
      path: '/atom/',
      repo: 'https://github.com/TheAnomality/Atom-Anomality',
      githubRepo: 'TheAnomality/Atom-Anomality',
      video: { src: '/media/atom/preview.mp4', poster: '/media/atom/preview-poster.webp' },
      gallery: [
        { src: '/media/atom/home.webp', alt: 'Atom home page with a live 3D electron cloud of the 3d hydrogen orbital' },
        { src: '/media/atom/orbitals.webp', alt: 'The 3D orbital explorer showing a 3d z-squared orbital as 90,000 sampled points' },
        { src: '/media/atom/table.webp', alt: 'Interactive periodic table coloured by element category' },
        { src: '/media/atom/nuclides.webp', alt: 'Chart of nuclides coloured by decay mode' },
        { src: '/media/atom/spectra.webp', alt: 'Emission spectrum of neon from the NIST database' },
      ],
      stats: [
        { value: 31, label: 'interactive simulations' },
        { value: 118, label: 'elements, each with a full profile' },
        { value: 3400, prefix: '~', label: 'nuclides on a zoomable chart' },
        { value: 98, label: 'element spectra from NIST' },
      ],
      highlights: [
        'Exact hydrogen wavefunctions rendered as 3D electron clouds, isosurfaces and slices, sampled off the main thread in a Web Worker.',
        'A chart of every known nucleus with search, half-lives, decay modes and full decay chains.',
        'Emission and absorption spectra for 98 elements, with colours computed from the CIE 1931 colour-matching functions.',
        'No framework and no build step: plain ES modules, lazy-loaded figures that pause when off screen.',
      ],
      stack: ['Three.js', 'WebGL', 'Canvas 2D', 'Web Workers', 'ES Modules', 'Python data pipeline', 'GitHub Actions'],
    },
    {
      id: 'animewiki',
      index: '02',
      title: 'AnimeWiki',
      tagline: 'Anime Hub Dictionary',
      summary:
        'A fast, friendly way to explore anime and manga. Search titles and characters, see what is trending and airing with live countdowns, find where to watch, or drop in a single screenshot to find the exact anime, episode and timestamp. All of it runs on static files with no server, database or API key.',
      year: '2026',
      role: 'Design · Frontend · APIs',
      accent: '#ff6584',
      shape: 'sakura',
      path: '/animewiki/',
      repo: 'https://github.com/TheAnomality/AnimeWiki',
      githubRepo: 'TheAnomality/AnimeWiki',
      video: { src: '/media/animewiki/preview.mp4', poster: '/media/animewiki/preview-poster.webp' },
      gallery: [
        { src: '/media/animewiki/home.webp', alt: 'Anime Hub home page with search over a WebGL sakura scene' },
        { src: '/media/animewiki/trending-ring.webp', alt: 'The 3D ring of trending anime covers' },
        { src: '/media/animewiki/details.webp', alt: 'A details page with score, rankings and synopsis' },
      ],
      stats: [
        { value: 3, label: 'public APIs: AniList, Jikan, trace.moe' },
        { value: 6, label: 'discovery lists in a single request' },
        { value: 1, label: 'screenshot is all scene search needs' },
        { value: 0, label: 'servers, databases or API keys' },
      ],
      highlights: [
        'Scene search: drop in a screenshot and get the anime, the episode and the exact timestamp.',
        'AniList GraphQL with aliases loads the whole Discover page in one request, cached and polite to the rate limit.',
        'A WebGL sakura background and a true CSS 3D trending ring you can drag, swipe or step through.',
        'My List lives in your browser with file backup and restore, and every view has a shareable URL.',
      ],
      stack: ['JavaScript', 'GraphQL', 'REST APIs', 'Three.js', 'CSS 3D', 'Content Security Policy', 'localStorage'],
    },
  ],

  capabilities: [
    {
      title: 'Creative Development',
      description: '3D scenes, shaders and simulations that react to you. The kind of thing people stop scrolling for.',
      tools: ['Three.js', 'React Three Fiber', 'GLSL', 'WebGL', 'Canvas'],
    },
    {
      title: 'Frontend Engineering',
      description: 'Fast, accessible interfaces that feel right on a phone and on a widescreen, with performance budgets that hold.',
      tools: ['React', 'TypeScript', 'Vite', 'Tailwind CSS', 'Accessibility'],
    },
    {
      title: 'Full-Stack & Data',
      description: 'APIs, data pipelines and the plumbing underneath: GraphQL, REST, scripts that turn raw science data into something usable.',
      tools: ['GraphQL', 'REST', 'Node.js', 'Python', 'PHP'],
    },
    {
      title: 'Motion & Video',
      description: 'Animation with intent, from micro-interactions to full showreels rendered straight from HTML.',
      tools: ['Motion', 'GSAP', 'HyperFrames', 'Lenis', 'FFmpeg'],
    },
  ],

  /** The scrolling ticker in the "Everything" section. */
  marquee: [
    'React', 'Three.js', 'TypeScript', 'GLSL', 'WebGL', 'Motion', 'GSAP', 'HyperFrames', 'Vite',
    'Tailwind', 'GraphQL', 'Node.js', 'Python', 'PHP', 'Web Workers', 'Canvas', 'Lenis', 'Git',
  ],

  about: {
    paragraphs: [
      'I’m TheAnomality, a developer who can’t pick a single lane, so I take all of them. I’ve built a physics guide that computes real electron orbitals in your browser, and an anime hub that can name a show from one screenshot.',
      'I care about the details most people never notice: frame rates, accessibility, honest data, and the small animations that make a page feel alive. If it can be built on the web, I want to build it.',
    ],
    facts: [
      { value: 2, label: 'live projects inside this site' },
      { value: 31, label: 'physics simulations shipped' },
      { value: 5, label: 'public APIs wired up' },
      { value: 0, label: 'servers needed by either app' },
    ],
    now: [
      'Pushing React Three Fiber and custom shaders further',
      'Rendering motion design from code with HyperFrames',
      'Looking for the next weird, wonderful thing to build',
    ],
  },
};
