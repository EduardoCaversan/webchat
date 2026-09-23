import { access } from 'node:fs/promises';

try {
  await access('/tmp/entre-ready');
  for (const url of ['http://127.0.0.1:5173', 'http://127.0.0.1:4400/emulators']) {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  }
} catch {
  process.exitCode = 1;
}
