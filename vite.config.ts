import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

/** Dev-only: browser pages POST generated demo files into the repo. */
function demoSave(): Plugin {
  return {
    name: 'demo-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__demo-save', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('POST only'); return; }
        const q = new URL(req.url ?? '/', 'http://localhost').searchParams;
        const name = path.basename(q.get('file') ?? '');
        if (!name || !/^[\w][\w.-]*$/.test(name)) { res.statusCode = 400; res.end('bad file name'); return; }
        const dir = path.resolve(process.cwd(), 'demo/jellyfish/out');
        fs.mkdirSync(dir, { recursive: true });
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const body = Buffer.concat(chunks);
          fs.writeFileSync(path.join(dir, name), body);
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ saved: name, bytes: body.length }));
        });
      });
    },
  };
}

export default defineConfig({
  server: { port: 5199 },
  plugins: [demoSave()],
});
