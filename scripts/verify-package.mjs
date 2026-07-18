import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cache = mkdtempSync(join(tmpdir(), 'glyphloop-npm-cache-'));
let pack;

try {
  const raw = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    encoding: 'utf8',
    env: { ...process.env, npm_config_cache: cache },
  });
  [pack] = JSON.parse(raw);
} finally {
  rmSync(cache, { recursive: true, force: true });
}

const files = new Set(pack.files.map(({ path }) => path));

const required = [
  'AGENTS.md',
  'LICENSE',
  'LICENSES/ASSETS.md',
  'README.md',
  'bin/glyphloop.js',
  'package.json',
  'src/cli/render.ts',
  'src/mcp/server.ts',
];

const forbiddenPrefixes = [
  '.git/',
  '.github/',
  '.superpowers/',
  '.wrangler/',
  'deploy/',
  'docs/product/',
  'node_modules/',
  'site/',
];

const missing = required.filter((path) => !files.has(path));
const forbidden = [...files].filter((path) =>
  forbiddenPrefixes.some((prefix) => path === prefix || path.startsWith(prefix)),
);

if (missing.length || forbidden.length) {
  if (missing.length) console.error(`Missing required package files: ${missing.join(', ')}`);
  if (forbidden.length) console.error(`Private or site files in package: ${forbidden.join(', ')}`);
  process.exit(1);
}

console.log(`Verified glyphloop@${pack.version}: ${files.size} package files.`);
