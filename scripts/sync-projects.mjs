#!/usr/bin/env node
/**
 * Copies the latest version of each project site from GitHub into public/.
 *
 *   npm run sync:projects            -> sync every project
 *   npm run sync:projects -- atom    -> sync one project
 *
 * Vite copies public/ into dist/ when you build, so after a sync the projects
 * are served by the portfolio at /atom/ and /animewiki/ (on Vercel too).
 * The commit each copy came from is written to projects.lock.json.
 *
 * Needs git on your PATH.
 */
import { execFileSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const LOCK = join(ROOT, 'projects.lock.json');

/** Add a project here and it is synced into public/<dir>. */
const PROJECTS = [
  {
    id: 'atom',
    repo: 'https://github.com/TheAnomality/Atom-Anomality.git',
    branch: 'main',
    dir: 'public/atom',
    // Development-only files that the live site never loads.
    exclude: ['.git', '.github', 'tools', 'README.md'],
  },
  {
    id: 'animewiki',
    repo: 'https://github.com/TheAnomality/AnimeWiki.git',
    branch: 'main',
    dir: 'public/animewiki',
    // README-only images are left out; the app itself never requests them.
    exclude: [
      '.git',
      '.github',
      'README.md',
      'assets/screenshots',
      'assets/demo.webp',
      'assets/banner.svg',
      'assets/divider.svg',
    ],
  },
];

function git(args, cwd) {
  return execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();
}

function syncProject(project) {
  const target = join(ROOT, project.dir);
  const temp = mkdtempSync(join(tmpdir(), `portfolio-${project.id}-`));
  try {
    console.log(`\n→ ${project.id}: cloning ${project.repo} (${project.branch})`);
    git(['clone', '--depth', '1', '--branch', project.branch, project.repo, temp]);
    const commit = git(['rev-parse', 'HEAD'], temp);

    const excluded = project.exclude.map((p) => join(temp, p));
    rmSync(target, { recursive: true, force: true });
    cpSync(temp, target, {
      recursive: true,
      filter: (src) => !excluded.some((ex) => src === ex || src.startsWith(ex + sep)),
    });
    chmodSync(target, 0o755); // the temp folder was private; the copy should not be

    console.log(`  copied into ${relative(ROOT, target)} @ ${commit.slice(0, 7)}`);
    return { repo: project.repo, branch: project.branch, commit, syncedAt: new Date().toISOString() };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

try {
  execFileSync('git', ['--version'], { stdio: 'ignore' });
} catch {
  console.error('git was not found. Install it from https://git-scm.com and run this again.');
  process.exit(1);
}

const only = process.argv.slice(2);
const selected = only.length ? PROJECTS.filter((p) => only.includes(p.id)) : PROJECTS;
if (!selected.length) {
  console.error(`Unknown project. Choose from: ${PROJECTS.map((p) => p.id).join(', ')}`);
  process.exit(1);
}

const lock = existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, 'utf8')) : {};
for (const project of selected) lock[project.id] = syncProject(project);
writeFileSync(LOCK, JSON.stringify(lock, null, 2) + '\n');
console.log('\nDone. Run `npm run dev` and open /atom/ or /animewiki/ to check them.');
