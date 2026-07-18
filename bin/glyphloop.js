#!/usr/bin/env node
import { tsImport } from 'tsx/esm/api';
import { createRequire } from 'node:module';

const { version: GLYPHLOOP_VERSION } = createRequire(import.meta.url)('../package.json');

const [command, ...args] = process.argv.slice(2);

function help() {
  process.stdout.write(`Glyphloop ${GLYPHLOOP_VERSION}\n\nUsage:\n  glyphloop render --preset <name-or-file> --out <dir>\n  glyphloop render --json '<preset-json>' --out <dir>\n  glyphloop mcp\n\nBuilt-in preset example:\n  glyphloop render --preset flowfield-hero --out hero\n`);
}

if (!command || command === '--help' || command === '-h') {
  help();
  process.exit(0);
}

if (command === '--version' || command === '-v') {
  process.stdout.write(`${GLYPHLOOP_VERSION}\n`);
  process.exit(0);
}

if (command !== 'render' && command !== 'mcp') {
  process.stderr.write(`error: unknown command "${command}". Valid: render, mcp\n`);
  process.exit(1);
}

process.argv = [process.argv[0], process.argv[1], ...args];
await tsImport(command === 'render' ? '../src/cli/render.ts' : '../src/mcp/server.ts', import.meta.url);
