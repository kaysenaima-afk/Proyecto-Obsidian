#!/usr/bin/env node
// Live preview server: node scripts/serve.mjs [port]
// Open http://localhost:5173/comps/<name>/  (Space = play, ←/→ = frame step, S = safe zones, G = grid)
import fs from 'node:fs';
import path from 'node:path';
import { startServer, ROOT } from '../lib/server.mjs';

const { port } = await startServer(Number(process.argv[2]) || 5173);
console.log(`motion-studio preview → http://localhost:${port}/`);
for (const name of fs.readdirSync(path.join(ROOT, 'comps'))) {
  if (fs.existsSync(path.join(ROOT, 'comps', name, 'index.html'))) console.log(`  • http://localhost:${port}/comps/${name}/`);
}
