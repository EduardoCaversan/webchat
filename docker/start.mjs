import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const project = 'demo-entre';
const ready = '/tmp/entre-ready';
const children = new Set();
let stopping = false;

async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  await rm(ready, { force: true });
  const exits = [...children].map(
    (child) =>
      new Promise((resolve) => {
        child.once('exit', resolve);
        // The Firebase CLI handles SIGINT by exporting Auth and Firestore to /data.
        child.kill('SIGINT');
      }),
  );
  const timeout = setTimeout(() => {
    for (const child of children) child.kill('SIGKILL');
    process.exit(1);
  }, 75000);
  await Promise.all(exits);
  clearTimeout(timeout);
  process.exit(code);
}

function launch(args, critical = true) {
  const child = spawn(process.execPath, args, { stdio: 'inherit', env: process.env });
  children.add(child);
  child.once('error', (error) => {
    console.error(error);
    children.delete(child);
    void shutdown(1);
  });
  child.once('exit', (code) => {
    children.delete(child);
    if (critical && !stopping) void shutdown(code || 1);
  });
  return child;
}

async function waitFor(check, label) {
  const deadline = Date.now() + 180000;
  while (!stopping && Date.now() < deadline) {
    try {
      if (await check()) return;
    } catch {
      /* Service is still starting. */
    }
    await delay(1000);
  }
  throw new Error(`Tempo esgotado esperando ${label}. Confira docker compose logs.`);
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

try {
  await rm(ready, { force: true });
  await mkdir('/data', { recursive: true });
  const config = JSON.parse(await readFile('firebase.json', 'utf8'));
  for (const service of ['auth', 'firestore', 'ui']) {
    config.emulators[service].host = '0.0.0.0';
  }
  config.emulators.hub = { host: '0.0.0.0', port: 4400 };
  config.emulators.logging = { host: '0.0.0.0', port: 4500 };
  await writeFile('firebase.docker.json', JSON.stringify(config, null, 2));
  const args = [
    'node_modules/firebase-tools/lib/bin/firebase.js',
    'emulators:start',
    '--config',
    'firebase.docker.json',
    '--project',
    project,
    '--only',
    'auth,firestore',
    '--export-on-exit',
    '/data/export',
  ];
  if (existsSync('/data/export/firebase-export-metadata.json'))
    args.push('--import', '/data/export');
  launch(args);

  await waitFor(async () => {
    const response = await fetch('http://127.0.0.1:4400/emulators', {
      signal: AbortSignal.timeout(3000),
    });
    const services = await response.json();
    return !!services.auth && !!services.firestore;
  }, 'Auth e Firestore locais');

  const seed = launch(['docker/seed.mjs'], false);
  const seedCode = await new Promise((resolve) => seed.once('exit', resolve));
  if (seedCode !== 0) throw new Error('Não foi possível preparar as contas de teste.');

  launch([
    'node_modules/vite/bin/vite.js',
    'preview',
    '--host',
    '0.0.0.0',
    '--port',
    '5173',
    '--strictPort',
  ]);
  await waitFor(
    async () => (await fetch('http://127.0.0.1:5173', { signal: AbortSignal.timeout(2000) })).ok,
    'o chat',
  );
  await writeFile(ready, 'ready\n');
  console.log(
    '\nEntre pronto: http://localhost:5173\nPainel Firebase local: http://localhost:4000\nContas: marina@entre.test, pedro@entre.test, luiza@entre.test\nNenhuma conta Google real ou credencial de produção é usada.\n',
  );
} catch (error) {
  console.error(error);
  await shutdown(1);
}
