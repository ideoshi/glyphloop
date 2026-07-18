import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import packageJson from '../package.json';

const commandFiles = [
  'README.md',
  'AGENTS.md',
  'CLAUDE.md',
  'site/index.html',
  'src/mcp/server.ts',
];

describe('beta release channel', () => {
  it('publishes prereleases to the beta dist-tag', () => {
    expect(packageJson.version).toContain('-beta.');
    expect(packageJson.publishConfig.tag).toBe('beta');
  });

  it('pins every public npx command to the beta channel', () => {
    for (const file of commandFiles) {
      const text = readFileSync(resolve(file), 'utf8');
      expect(text, file).not.toMatch(/\bnpx(?:\s+-y)?\s+glyphloop(?!@beta)\b/);
    }
  });
});
