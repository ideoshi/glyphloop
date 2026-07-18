import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const temp = mkdtempSync(join(tmpdir(), 'glyphloop-public-snapshot-'));
const archive = join(temp, 'snapshot.tar');
const treeish = process.argv[2] || 'HEAD';
if (treeish.startsWith('-')) {
  console.error('Invalid treeish: revisions cannot start with a hyphen.');
  process.exit(1);
}

try {
  execFileSync('git', ['archive', '--format=tar', `--output=${archive}`, treeish]);
  const files = execFileSync('tar', ['-tf', archive], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);

  const required = [
    '.github/workflows/ci.yml',
    'AGENTS.md',
    'CLAUDE.md',
    'CONTRIBUTING.md',
    'LICENSE',
    'README.md',
    'SECURITY.md',
    'site/index.html',
    'site/sitemap.xml',
    'src/core/state.ts',
  ];

  const forbiddenPrefixes = [
    '.git/',
    '.gitattributes',
    '.superpowers/',
    '.wrangler/',
    'demo/',
    'deploy/',
    'docs/',
    'node_modules/',
  ];
  const forbidden = files.filter((path) =>
    forbiddenPrefixes.some((prefix) => path === prefix || path.startsWith(prefix)),
  );
  const missing = required.filter((path) => !files.includes(path));

  if (forbidden.length || missing.length) {
    if (forbidden.length) console.error(`Private paths in public snapshot: ${forbidden.join(', ')}`);
    if (missing.length) console.error(`Required public paths missing: ${missing.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`Verified public snapshot boundary: ${files.length} archived paths from ${treeish}.`);
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}
