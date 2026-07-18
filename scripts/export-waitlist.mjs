#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const wrangler = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function readOutputPath(argv) {
  const index = argv.indexOf('--out');
  if (index === -1) return resolve(root, '.private/glyphloop-waitlist.csv');
  if (!argv[index + 1]) fail('--out requires a file path');
  return resolve(process.cwd(), argv[index + 1]);
}

if (process.argv.includes('--help')) {
  console.log('Export the production Glyphloop launch-email list to a private CSV.');
  console.log('');
  console.log('Usage: npm run waitlist:export -- [--out path/to/waitlist.csv]');
  process.exit(0);
}

const result = spawnSync(
  process.execPath,
  [wrangler, 'kv', 'key', 'list', '--binding', 'WAITLIST', '--remote'],
  { cwd: root, encoding: 'utf8' },
);

if (result.error) fail(result.error.message);
if (result.status !== 0) fail(result.stderr.trim() || 'Wrangler could not read the waitlist');

let records;
try {
  records = JSON.parse(result.stdout);
} catch {
  fail('Wrangler returned an unexpected response');
}

if (!Array.isArray(records)) fail('Wrangler returned an unexpected response');

const emails = records
  .map((record) => record?.name)
  .filter((name) => typeof name === 'string' && name.includes('@'))
  .sort((a, b) => a.localeCompare(b));

const csvCell = (value) => `"${value.replaceAll('"', '""')}"`;
const csv = ['email', ...emails.map(csvCell)].join('\n') + '\n';
const outputPath = readOutputPath(process.argv.slice(2));

mkdirSync(dirname(outputPath), { recursive: true, mode: 0o700 });
writeFileSync(outputPath, csv, { encoding: 'utf8', mode: 0o600 });
chmodSync(outputPath, 0o600);

console.log(`Exported ${emails.length} signup${emails.length === 1 ? '' : 's'} to ${outputPath}`);
