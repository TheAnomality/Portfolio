import { existsSync, statSync } from 'node:fs';
import { join, normalize, resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { site } from './src/content/site.ts';

/**
 * In production, Vercel answers /atom/ with /atom/index.html, and vercel.json
 * redirects /atom to /atom/. Vite's dev and preview servers do not do this for
 * folders in public/, so this plugin adds the same behaviour locally.
 */
function folderIndex(): Plugin {
  const middleware =
    (getRoot: () => string) => (req: IncomingMessage, res: ServerResponse, next: () => void) => {
      const [pathname, query] = (req.url ?? '/').split('?');
      if (!pathname || pathname === '/' || pathname.startsWith('/@') || pathname.startsWith('/src/')) return next();
      let decoded: string;
      try {
        decoded = decodeURIComponent(pathname);
      } catch {
        return next();
      }
      const root = getRoot();
      const abs = normalize(join(root, decoded));
      if (!abs.startsWith(root)) return next();
      if (!existsSync(abs) || !statSync(abs).isDirectory()) return next();
      const suffix = query ? `?${query}` : '';
      if (!pathname.endsWith('/')) {
        res.statusCode = 301;
        res.setHeader('Location', `${pathname}/${suffix}`);
        res.end();
        return;
      }
      if (existsSync(join(abs, 'index.html'))) req.url = `${pathname}index.html${suffix}`;
      next();
    };

  return {
    name: 'folder-index',
    configureServer(server) {
      server.middlewares.use(middleware(() => resolve(server.config.publicDir)));
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware(() => resolve(server.config.root, server.config.build.outDir)));
    },
  };
}

/**
 * The public address of the site, in this order: `url` in src/content/site.ts,
 * a SITE_URL environment variable, then the production domain Vercel provides
 * at build time (your custom domain once you add one, otherwise *.vercel.app).
 */
function resolveSiteUrl(): string {
  const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const url = site.url || process.env.SITE_URL || (vercelDomain ? `https://${vercelDomain}` : 'http://localhost:5173');
  return url.replace(/\/+$/, '');
}

/** Fills the %SITE_*% placeholders in index.html and writes robots.txt + sitemap.xml. */
function siteMeta(): Plugin {
  const url = resolveSiteUrl();
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: site.name,
    alternateName: site.handle,
    url: `${url}/`,
    jobTitle: site.roles[0],
    sameAs: site.socials.map((s) => s.href),
    knowsAbout: site.capabilities.flatMap((c) => c.tools),
  }).replace(/</g, '\\u003c');

  return {
    name: 'site-meta',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html
          .replaceAll('%SITE_URL%', url)
          .replaceAll('%SITE_TITLE%', escape(site.title))
          .replaceAll('%SITE_DESCRIPTION%', escape(site.description))
          .replaceAll('%SITE_NAME%', escape(site.name))
          .replace('%SITE_JSONLD%', jsonLd);
      },
    },
    generateBundle() {
      const pages = ['/', ...site.projects.map((p) => p.path)];
      const today = new Date().toISOString().slice(0, 10);
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source:
          '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          pages.map((p) => `  <url><loc>${url}${p}</loc><lastmod>${today}</lastmod></url>`).join('\n') +
          '\n</urlset>\n',
      });
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${url}/sitemap.xml\n`,
      });
    },
  };
}

/**
 * A strict Content Security Policy for the portfolio page itself (production
 * only: the dev server needs inline scripts). Atom and AnimeWiki keep their own
 * policies because this is a <meta> tag in the portfolio's index.html only.
 */
function contentSecurityPolicy(): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self'",
    "connect-src 'self' https://api.github.com",
    "frame-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  return {
    name: 'csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), folderIndex(), siteMeta(), contentSecurityPolicy()],
  build: {
    // A unique folder name for hashed build files, so .htaccess can cache them
    // forever without touching the (unhashed) Atom and AnimeWiki files.
    assetsDir: '_app',
    target: 'es2022',
    // The 3D scene (three.js + React Three Fiber) is lazy-loaded into its own
    // chunk, which is larger than Vite's default warning size.
    chunkSizeWarningLimit: 1200,
  },
});
