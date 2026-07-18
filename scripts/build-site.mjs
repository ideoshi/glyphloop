import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'vite';

const root = process.cwd();
const out = resolve(root, 'deploy');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(resolve(root, 'site'), out, { recursive: true });

await build({
  configFile: false,
  base: '/studio/',
  build: {
    outDir: resolve(out, 'studio'),
    emptyOutDir: true,
  },
});
