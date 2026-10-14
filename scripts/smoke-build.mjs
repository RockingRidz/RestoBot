import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const env = { ...process.env, NODE_ENV: 'production', RESTOBOT_LOAD_ENV: 'false', RESTOBOT_TEST_BUILD: 'true', HOST: '127.0.0.1', PORT: '0' };
for (const key of Object.keys(env)) if (/^(VITE_)?SUPABASE_|^GEMINI_/.test(key)) delete env[key];
const child = spawn(process.execPath, ['dist/server.mjs'], { cwd: process.cwd(), env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
let output = '';
try {
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Build server did not become ready: ' + output)), 15000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Build server exited (${code}): ${output}`)); });
    child.stderr.on('data', chunk => { output += chunk.toString(); });
    child.stdout.on('data', chunk => {
      output += chunk.toString();
      const match = output.match(/listening on (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  const health = await fetch(url + '/healthz').then(r => r.json());
  assert.equal(health.status, 'ok');
  assert.equal((await fetch(url + '/api/health')).status, 401, 'Production API requires a Supabase session');
  const page = await fetch(url).then(r => r.text());
  assert.match(page, /id="root"/);
  const script = page.match(/src="([^"]+\.js)"/);
  assert.ok(script, 'Frontend script must be referenced');
  assert.equal((await fetch(url + script[1])).status, 200);
  const entryPath = fileURLToPath(new URL(`../dist${script[1]}`, import.meta.url));
  const entryBytes = (await stat(entryPath)).size;
  assert.ok(entryBytes < 500_000, `Initial JavaScript entry is ${entryBytes} bytes; keep route screens lazy-loaded below 500 KB`);
  const stylesheet = page.match(/href="([^"]+\.css)"/);
  assert.ok(stylesheet);
  const css = await fetch(url + stylesheet[1]).then(r => r.text());
  assert.ok(css.includes('.bg-slate-900'), 'Tailwind utilities must be compiled');
  assert.equal((await fetch(url + '/api/missing')).status, 401);
  console.log(`Production build smoke test passed: ESM startup, health, HTML, JS (${entryBytes} byte entry), CSS and JSON 404.`);
} finally {
  if (child.exitCode === null) {
    await new Promise(resolve => { child.once('exit', resolve); child.kill(); });
  }
}
