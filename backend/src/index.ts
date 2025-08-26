import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './config/db.js';
import initializeDatabase from './config/initDb.js';
import claimRoutes from './routes/claims.js';
import authRoutes from './routes/auth.js';
import historyRoutes from './routes/history.js'; // Import the new history routes
import userRoutes from './routes/users.js'; // Import the new user routes
import { authMiddleware } from './middleware/auth.js';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path'; // Added for static file serving
import { fileURLToPath } from 'url'; // Added for __dirname

// Added for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the correct path
const rootEnvPath = path.join(__dirname, '../../../.env');
dotenv.config({ path: rootEnvPath });

const app = express();

// Trust proxy headers - important for rate limiting and correct IP identification when behind a proxy like Nginx
app.set('trust proxy', 1); // Trusts the first hop (nginx)

const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet()); // Adds various HTTP headers for security
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
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
app.use(express.json());

// Serve static files from the 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'))); // Adjusted path for ES modules

// Basic route for testing
app.get('/', (req, res) => {
  res.send('API is running...');
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is healthy' });
});

// Database connection test
app.get('/api/db-test', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    
    res.status(200).json({
      status: 'success',
      message: 'Database connection successful',
      timestamp: result.rows[0].now
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Authentication routes (no auth required)
app.use('/api/auth', authRoutes);

// Protected routes (auth required)
app.use('/api/claims', authMiddleware, claimRoutes);
app.use('/api/history', authMiddleware, historyRoutes); // Add the history routes to the app
app.use('/api/users', authMiddleware, userRoutes); // Add the user routes to the app

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    status: 'error',
    message: 'Something went wrong on the server',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Initialize database before starting server
initializeDatabase()
  .then(result => {
    if (result.success) {
      console.log('Database initialization completed successfully');
    } else {
      console.warn('Database initialization failed, some features may not work properly');
      console.warn('Error:', result.error);
    }
    
    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    console.log('Starting server without database initialization...');
    
    // Start server anyway
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} (without database initialization)`);
    });
  });