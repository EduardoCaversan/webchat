import { spawnSync } from 'node:child_process';
// One emulator lifecycle; sequential runs prevent the rules suite clearing data
// while the integration/browser suites are using it.
for (const args of [
  ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.rules.config.ts'],
  ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.integration.config.ts'],
  ['node_modules/playwright/cli.js', 'test'],
]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
