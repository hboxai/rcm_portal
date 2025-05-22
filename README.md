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
