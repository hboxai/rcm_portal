#!/bin/sh

echo "--- Starting backend service ---"
# Ensure execution from the WORKDIR (/app) or adjust paths accordingly
cd /app/backend
node dist/index.js &
BACKEND_PID=$!
echo "Backend service started with PID $BACKEND_PID, listening internally on port 5000."

# This script will now exit, and CMD will proceed to start nginx.
# No need to wait or manage frontend PIDs here.
