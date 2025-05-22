#!/usr/bin/env node
/**
 * This script copies the main .env file to the backend directory
 * and then runs the server
 */

import { copyFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

// Get current script directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define paths
const mainEnvPath = join(__dirname, '../.env');
const backendEnvPath = join(__dirname, '.env');

try {
  // Copy the main .env file to the backend directory
  await copyFile(mainEnvPath, backendEnvPath);
  console.log('Successfully copied main .env file to backend directory');
  
  // Run the server
  const server = exec('node --loader ts-node/esm src/index.ts', (error, stdout, stderr) => {
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
