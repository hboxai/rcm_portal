import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './config/db.js';
import initializeDatabase from './config/initDb.js';
import claimRoutes from './routes/claims.js';
import uploadsRouter from './routes/uploads.js'; // Import the uploads router
import authRoutes from './routes/auth.js';
import historyRoutes from './routes/history.js'; // Import the new history routes
import userRoutes from './routes/users.js'; // Import the new user routes
import { authMiddleware } from './middleware/auth.js';
import auditRouter from './routes/audit.js';
import submitUploadsRouter from './routes/submitUploads.js';
import reimburseRouter from './routes/reimburse.js';
import officeAllyRouter from './routes/officeAlly.js';
import eraParseRouter from './routes/eraParse.js';
import healthRouter from './routes/health.js';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path'; // Added for static file serving
import { fileURLToPath } from 'url'; // Added for __dirname
import logger from './utils/logger.js'; // Structured logging
import { setupRequestLogging } from './middleware/requestLogging.js'; // Request logging middleware
import { setupSwagger } from './config/swagger.js'; // Swagger API documentation

// Added for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the repo root
const rootEnvPath = path.join(__dirname, '../../../.env');
dotenv.config({ path: rootEnvPath });

const app = express();

// Trust proxy headers - important for rate limiting and correct IP identification when behind a proxy like Nginx
app.set('trust proxy', 1); // Trusts the first hop (nginx)

const PORT = process.env.PORT || 60172;

// Security middleware
app.use(helmet()); // Adds various HTTP headers for security

// Apply rate limiting to most endpoints, but skip progress polling endpoints
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
    skip: (req) => {
      // Skip rate limiting for progress polling endpoints
      return req.path.includes('/progress');
    }
  })
);

// Standard middleware
const extraOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    ...extraOrigins
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Origin', 'Accept'],
  credentials: true
}));

// Add preflight handling
app.options('*', cors());

// Request logging - adds request ID and logs requests/responses
app.use(setupRequestLogging);

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Serve static files from the 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'))); // Adjusted path for ES modules

// Setup Swagger API documentation (available at /api-docs)
setupSwagger(app);

// Basic route for testing
app.get('/', (req, res) => {
  res.send('API is running... Visit /api-docs for API documentation.');
});

// Health check endpoints (no auth required)
// Available endpoints:
//   GET /api/health - Basic health check
//   GET /api/health/detailed - Detailed system info
//   GET /api/health/ready - Readiness probe (checks database)
//   GET /api/health/live - Liveness probe
//   GET /api/health/db - Database health with pool stats
app.use('/api/health', healthRouter);

// Authentication routes (no auth required)
app.use('/api/auth', authRoutes);
app.use('/api/audit', auditRouter);

// Protected routes (auth required)
app.use('/api/claims', authMiddleware, claimRoutes);
app.use('/api/uploads', uploadsRouter); // Mount the uploads router
app.use('/api/submit-uploads', submitUploadsRouter);
app.use('/api/reimburse', authMiddleware, reimburseRouter);
app.use('/api/office-ally', authMiddleware, officeAllyRouter); // Office Ally status upload
app.use('/api/history', authMiddleware, historyRoutes); // Add the history routes to the app
app.use('/api/users', userRoutes); // User routes - auth handled per-route in router
app.use('/api/era', (req, res, next) => {
  req.log.debug({ path: req.path }, 'ERA route accessed');
  next();
}, authMiddleware, eraParseRouter);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const log = req.log || logger;
  log.error({ err, requestId: req.requestId }, 'Unhandled error');
  res.status(500).json({
    status: 'error',
    message: 'Something went wrong on the server',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    requestId: req.requestId,
  });
});

// Initialize database before starting server
initializeDatabase()
  .then(result => {
    if (result.success) {
      logger.info('Database initialization completed successfully');
    } else {
      logger.warn({ error: result.error }, 'Database initialization failed, some features may not work properly');
    }
    
    // Start server
    app.listen(PORT, () => {
      logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'Server started');
    });
  })
  .catch(err => {
    logger.error({ err }, 'Failed to initialize database');
    logger.info('Starting server without database initialization...');
    
    // Start server anyway
    app.listen(PORT, () => {
      logger.warn({ port: PORT }, 'Server running without database initialization');
    });
  });