#!/bin/sh

echo "--- Starting backend service ---"
# Ensure execution from the WORKDIR (/app) or adjust paths accordingly
cd /app/backend
node dist/index.js &
BACKEND_PID=$!
echo "Backend service started with PID $BACKEND_PID, listening internally on port 5000."

# Start nginx in the foreground
echo "--- Starting nginx ---"
nginx -g 'daemon off;'