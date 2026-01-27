import { Router, Request, Response } from 'express';
import pool from '../config/db.js';
import os from 'os';

const router = Router();

// Track server start time for uptime calculation
const startTime = Date.now();

/**
 * Basic health check - always returns 200 if server is running
 * Use for: Load balancer health checks, basic liveness probes
 */
router.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Detailed health check with system info
 * Use for: Monitoring dashboards, debugging
 */
router.get('/detailed', async (req: Request, res: Response) => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  const memoryUsage = process.memoryUsage();
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: uptimeSeconds,
      formatted: formatUptime(uptimeSeconds),
    },
    memory: {
      heapUsed: formatBytes(memoryUsage.heapUsed),
      heapTotal: formatBytes(memoryUsage.heapTotal),
      rss: formatBytes(memoryUsage.rss),
      external: formatBytes(memoryUsage.external),
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      cpuCount: os.cpus().length,
      freeMemory: formatBytes(os.freemem()),
      totalMemory: formatBytes(os.totalmem()),
    },
    environment: process.env.NODE_ENV || 'development',
  };

  res.status(200).json(health);
});

/**
 * Readiness check - verifies database connectivity
 * Use for: Kubernetes readiness probes, deployment verification
 * Returns 503 if database is not available
 */
router.get('/ready', async (req: Request, res: Response) => {
  const checks = {
    database: false,
    timestamp: new Date().toISOString(),
  };

  try {
    // Test database connection with a simple query
    const client = await pool.connect();
    const result = await client.query('SELECT 1 as test');
    client.release();
    
    checks.database = result.rows[0]?.test === 1;
  } catch (error) {
    checks.database = false;
  }

  const isReady = checks.database;
  
  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not_ready',
    checks,
    message: isReady 
      ? 'All systems operational' 
      : 'One or more dependencies are not available',
  });
});

/**
 * Liveness check - simple check that server is responding
 * Use for: Kubernetes liveness probes
 */
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Database-specific health check with connection pool info
 */
router.get('/db', async (req: Request, res: Response) => {
  try {
    const queryStart = Date.now();
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as time, current_database() as database');
    client.release();
    const queryTime = Date.now() - queryStart;

    res.status(200).json({
      status: 'connected',
      timestamp: new Date().toISOString(),
      database: {
        name: result.rows[0]?.database,
        serverTime: result.rows[0]?.time,
        responseTimeMs: queryTime,
      },
      pool: {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'disconnected',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown database error',
    });
  }
});

// Helper functions
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  
  return parts.join(' ');
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let size = bytes;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

export default router;
