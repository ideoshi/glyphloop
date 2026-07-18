import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function parseObjectJson(path: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(resolve(path), 'utf8'));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Invalid ${path}`);
  }
  return parsed as Record<string, unknown>;
}

describe('MCP Registry metadata', () => {
  it('stays aligned with the published npm package', () => {
    const packageJson = parseObjectJson('package.json');
    const serverJson = parseObjectJson('server.json');

    expect(serverJson).toMatchObject({
      name: packageJson.mcpName,
      version: packageJson.version,
      repository: {
        url: 'https://github.com/ideoshi/glyphloop',
        source: 'github',
      },
      packages: [
        {
          registryType: 'npm',
          identifier: packageJson.name,
          version: packageJson.version,
          runtimeHint: 'npx',
          packageArguments: [{ type: 'positional', value: 'mcp' }],
          transport: { type: 'stdio' },
        },
      ],
    });
  });

  it('uses a registry description within the schema limit', () => {
    const serverJson = parseObjectJson('server.json');
    expect(typeof serverJson.description).toBe('string');
    expect((serverJson.description as string).length).toBeLessThanOrEqual(100);
  });
});
