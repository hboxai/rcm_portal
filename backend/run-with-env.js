#!/usr/bin/env node
/**
 * Run backend using root .env without copying.
 */
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { existsSync } from 'fs';

try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const mainEnvPath = join(__dirname, '../.env');

  if (!existsSync(mainEnvPath)) {
    console.error(`Main .env file not found at: ${mainEnvPath}`);
    process.exit(1);
  }

  console.log(`Using main .env file from root directory: ${mainEnvPath}`);

  const child = spawn('node', ['--loader', 'ts-node/esm', 'src/index.ts'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV_PATH: '../.env' }
  });

  child.on('exit', (code) => process.exit(code || 0));
} catch (err) {
  console.error('Error starting server:', err);
  process.exit(1);
}
