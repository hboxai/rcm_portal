#!/bin/sh

echo "--- Starting backend service ---"
# Start from app root where .env is located
cd /app
# Export environment variables from .env to make them available to backend
export $(grep -v '^#' .env | xargs)
# Now change to backend directory and start the service
cd /app/backend
node dist/index.js &
BACKEND_PID=$!
echo "Backend service started with PID $BACKEND_PID, listening internally on port 5000."

# Start nginx in the foreground
echo "--- Starting nginx ---"
nginx -g 'daemon off;'