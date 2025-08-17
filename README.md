# RCM Portal Setup and Run Instructions

This document provides instructions for setting up and running the RCM Portal application using Docker or directly on your machine.

## Prerequisites

- Docker and Docker Compose (for containerized approach)
- Node.js v18+ (for non-containerized approach)
- npm v8+ (for non-containerized approach)

## Option 1: Running with Docker (Recommended)

This approach uses a single Docker container to run both the frontend and backend services.

### Step 1: Build the Docker image

```bash
npm run docker:build
```

### Step 2: Start the application

```bash
npm run docker:start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api

### Step 3: Stop the application

```bash
npm run docker:stop
```

## Option 2: Running Directly on Your Machine

### Step 1: Install dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### Step 2: Fix TypeScript imports in the backend

```bash
cd backend
node fix-imports.js
cd ..
```

### Step 3: Build the application

```bash
npm run build
```

### Step 4: Run the application

```bash
# Start both frontend and backend
npm run dev:all

# Or start them separately
npm run dev:backend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173 (Vite dev server)
- Backend API: http://localhost:5000/api

## Environment Configuration

All environment variables are consolidated in a single `.env` file in the root directory. This file is automatically copied to the appropriate locations when running with Docker.

### Key Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| DATABASE_URL | Postgres connection string (if used instead of discrete vars) | (none) |
| PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD | Individual Postgres connection components | (none) |
| PGSSLMODE | SSL mode for Postgres (require / disable) | require |
| CLAIMS_TABLE | Source table/view for claims data | upl_billing_reimburse |
| CLAIM_HISTORY_TABLE | Table for change log entries | upl_change_logs |
| CLAIMS_ID_COLUMN | Physical PK/unique column to alias as `id` (e.g. cpt_id, oa_visit_id) | id |
| JWT_SECRET | Secret for signing auth tokens | (none) |
| JWT_EXPIRES_IN | Token lifetime | 24h |
| RATE_LIMIT_WINDOW_MS | Login rate limiter window ms | 300000 |
| RATE_LIMIT_MAX | Max attempts per window | 10 |

If your external claims table does not have a generic `id` column, set `CLAIMS_ID_COLUMN` to the correct unique column name (for example `cpt_id` or `oa_visit_id`). The backend will alias this to `id` in API responses so the frontend continues to function without modification.

## Authentication & Performance Notes

- Login endpoint now rate-limited: max 10 attempts / 5 min per IP.
- Emails normalized (trim + lowercase) before DB lookup.
- Recommend adding an index on LOWER(email) for table `api_hboxuser`:
	```sql
	CREATE INDEX IF NOT EXISTS idx_api_hboxuser_lower_email ON api_hboxuser (LOWER(email));
	```
- For faster claims queries once schema stabilized, create composite indexes (example):
	```sql
	CREATE INDEX IF NOT EXISTS idx_claims_patient ON api_bil_claim_reimburse (patient_id);
	CREATE INDEX IF NOT EXISTS idx_claims_service_end ON api_bil_claim_reimburse (service_end DESC);
	```
