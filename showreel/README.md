# Showreel (HyperFrames)

The video in the portfolio's **Showreel** section is written as a web page: `index.html` here is plain HTML, CSS and a [GSAP](https://gsap.com) timeline. [HyperFrames](https://hyperframes.heygen.com) by HeyGen steps through that timeline frame by frame in headless Chrome and encodes it to MP4.

Needs Node.js 22+, FFmpeg and Chrome. `npx hyperframes doctor` (run in this folder) checks them.

## Edit it

```bash
cd showreel
```

```bash
npx --yes hyperframes@0.9.102 preview
```

The preview opens in your browser and reloads as you edit `index.html`. Things you'll most likely change:

- **Text**: the scene markup (`#intro`, `#atom`, `#anime`, `#outro`).
- **Timing**: each scene's `data-start` / `data-duration`, and the times passed to `tl.fromTo(…, time)` in the script.
- **Screenshots**: files in `assets/`.

Rules HyperFrames needs: one paused GSAP timeline registered on `window.__timelines`, `data-start`/`data-duration` on every timed element, and no `Math.random()`, `Date.now()` or network requests (the composition uses a seeded random generator instead).

```bash
npx --yes hyperframes@0.9.102 check
```

`check` validates the composition: layout, readability, contrast and timing.

## Render it into the site

From the repository root:

```bash
npm run showreel:render
```

This renders `showreel/renders/showreel.mp4` (full quality, not committed), then writes a compressed `public/media/showreel.mp4` and a poster image for the website. Commit those two files and push.

If you change the length, update `showreel.seconds` in `src/content/site.ts` too.

Fonts (SIL Open Font License) and GSAP are bundled in `fonts/` and `vendor/`, so rendering never depends on a CDN.
