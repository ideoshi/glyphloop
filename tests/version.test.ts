import { describe, expect, it } from 'vitest';
import packageJson from '../package.json';
import { GLYPHLOOP_VERSION } from '../src/version';

describe('version', () => {
  it('keeps the package, CLI, and MCP version source aligned', () => {
    expect(GLYPHLOOP_VERSION).toBe(packageJson.version);
  });
});
