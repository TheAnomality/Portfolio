#!/usr/bin/env node
/**
 * Renders the HyperFrames showreel and puts a web-ready copy on the site.
 *
 *   npm run showreel:render
 *
 * 1. `hyperframes render` turns showreel/index.html into a high-quality MP4
 *    (showreel/renders/showreel.mp4). Needs Node 22+, FFmpeg and Chrome;
 *    run `npx hyperframes doctor` inside showreel/ if something is missing.
 * 2. FFmpeg compresses it for the web (public/media/showreel.mp4) and grabs a
 *    poster frame (public/media/showreel-poster.webp).
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SHOWREEL = join(ROOT, 'showreel');
const MASTER = join(SHOWREEL, 'renders', 'showreel.mp4');
const MEDIA = join(ROOT, 'public', 'media');
const WEB = join(MEDIA, 'showreel.mp4');
const POSTER = join(MEDIA, 'showreel-poster.webp');
const HYPERFRAMES = 'hyperframes@0.9.102';

const run = (cmd, args, cwd = ROOT) => execFileSync(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, HYPERFRAMES_SKIP_SKILLS: '1' } });
const hasFfmpeg = () => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};
const mb = (file) => `${(statSync(file).size / 1024 / 1024).toFixed(1)} MB`;

mkdirSync(join(SHOWREEL, 'renders'), { recursive: true });
mkdirSync(MEDIA, { recursive: true });

console.log('→ Rendering the composition with HyperFrames…');
run('npx', ['--yes', HYPERFRAMES, 'render', '--output', MASTER, '--fps', '30', '--quality', 'delivery'], SHOWREEL);
if (!existsSync(MASTER)) throw new Error(`Render finished but ${MASTER} was not created.`);
console.log(`  master: ${mb(MASTER)}`);

if (hasFfmpeg()) {
  console.log('→ Compressing for the web…');
  run('ffmpeg', ['-loglevel', 'error', '-y', '-i', MASTER, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', WEB]);
  console.log('→ Saving the poster frame…');
  run('ffmpeg', ['-loglevel', 'error', '-y', '-ss', '2.4', '-i', MASTER, '-frames:v', '1', '-vf', 'scale=1280:-2', '-c:v', 'libwebp', '-quality', '80', POSTER]);
} else {
  console.log('FFmpeg not found: copying the master as-is (bigger file, no poster).');
  copyFileSync(MASTER, WEB);
}
console.log(`\nDone: public/media/showreel.mp4 (${mb(WEB)})${existsSync(POSTER) ? ' + showreel-poster.webp' : ''}`);
