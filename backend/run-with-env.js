#!/usr/bin/env node
/**
 * This script runs the server using the main .env file in the root directory
 * without copying it to the backend directory
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { existsSync } from 'fs';

// Get current script directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define paths
const mainEnvPath = join(__dirname, '../.env');

// Check if the main .env file exists
if (!existsSync(mainEnvPath)) {
  console.error(`Main .env file not found at: ${mainEnvPath}`);
  process.exit(1);
}

console.log(`Using main .env file from root directory: ${mainEnvPath}`);

// Run the server with environment pointing to the root .env
const server = exec('NODE_ENV_PATH=../.env node --loader ts-node/esm src/index.ts', (error, stdout, stderr) => {
  if (error) {
    console.error(`exec error: ${error}`);
    return;
  }
  console.log(`stdout: ${stdout}`);
    console.error(`stderr: ${stderr}`);
  });

  // Forward stdout and stderr
  server.stdout.on('data', (data) => {
    process.stdout.write(data);
  });

  server.stderr.on('data', (data) => {
    process.stderr.write(data);
  });
} catch (error) {
  console.error('Error:', error);
}
