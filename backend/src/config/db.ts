import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// We need to go back 3 levels: config -> src -> backend -> repo root
const rootEnvPath = join(__dirname, '../../../.env');

// Load the environment variables from the root .env file (quiet)
dotenv.config({ path: rootEnvPath });

// Check for required environment variables
const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  console.error('Please set these variables in your .env file');
  // In production, you might want to exit the process here
  // process.exit(1);
}

// Database connection details - no hardcoded values
const DB_HOST = process.env.DB_HOST || '';
const DB_PORT = parseInt(process.env.DB_PORT || '5432');
const DB_NAME = process.env.DB_NAME || '';
const DB_USER = process.env.DB_USER || '';
const DB_PASSWORD = process.env.DB_PASSWORD || '';

// Create a single database pool for the entire application
let sslEnabled = process.env.DB_SSL_ENABLED === 'true';
// Auto-enable SSL for Aptible tunnels if not explicitly disabled
if (!sslEnabled && DB_HOST.endsWith('.aptible.in')) {
  console.log('Auto-enabling SSL because host appears to be an Aptible tunnel.');
  sslEnabled = true;
}
const pool = new Pool({  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,
  ssl: sslEnabled ? {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    require: true
  } : false,
  connectionTimeoutMillis: 30000,    // 30 second connect timeout
  idleTimeoutMillis: 30000,          // 30 second idle timeout
  max: 5,                            // Allow a few concurrent DB ops
  allowExitOnIdle: true,             // Allow pool to clean up idle connections
  application_name: 'project-bolt'   // Identify connections in pg_stat_activity
});

// Minimal, non-sensitive connection log
console.log(`DB connection config: sslEnabled=${sslEnabled}`);
if (!sslEnabled) {
  console.warn('WARNING: DB_SSL_ENABLED is not true; connection will be non-SSL.');
}

// Suppress TS7006 errors for implicit 'any' types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onClient(client: any) {}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onError(err: any, client: any) {}

// Silently track connection count with minimal logging
let connectionCount = 0;
let logThrottleTime = Date.now();
const logThrottleInterval = 60000; // Log at most once per minute

// Only log initial connection and throttle subsequent logs heavily
pool.on('connect', (client: any) => {
  connectionCount++;
  // Log only once at startup or very occasionally
  if (connectionCount === 1 || Date.now() - logThrottleTime > logThrottleInterval) {
  console.log(`DB pool connection established`);
    logThrottleTime = Date.now();
  }
  // Set per-session safety timeouts
  client.query("SET statement_timeout TO '60s'").catch(()=>{});
  client.query("SET idle_in_transaction_session_timeout TO '60s'").catch(()=>{});
});

// Handle connection errors
pool.on('error', (err: any, client: any) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

// Create a wrapper around the pool query with proper error handling
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

const query = async (text: string, params: any[] = []) => {
  let attempt = 0;
  let lastErr: any;
  while (attempt < 3) {
    let client;
    try {
      client = await pool.connect();
      const result = await client.query(text, params);
      client.release();
      return result;
    } catch (error: any) {
      lastErr = error;
      console.error('Database query error:', error.message);
      // Retry on connect timeouts or transient errors
      const msg = (error?.message || '').toLowerCase();
      if (msg.includes('timeout') || msg.includes('etimedout') || msg.includes('econnreset')) {
        attempt++;
        await sleep(500 * attempt);
        continue;
      }
      throw error;
    } finally {
      // Ensure client is released if acquired
      try { /* @ts-ignore */ if (client) client.release(); } catch {}
    }
  }
  throw lastErr;
};

// Export both the pool and the optimized query function
export default pool;
export { query };