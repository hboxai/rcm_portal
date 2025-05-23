# Multi-stage build for RCM Portal application
FROM node:20-alpine AS base

# Add common build dependencies to the base image
RUN apk add --no-cache python3 make g++ 

# Build stage for backend
FROM base AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./ 
RUN npm install # Ensure this installs all deps including @types/multer
COPY backend/ ./ 
RUN npm run build

# Build stage for frontend
FROM base AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./ 
RUN npm install
COPY frontend/ ./ 
COPY .env ./
RUN npm run build

# Production stage
FROM base AS production

# Install nginx for the production image
USER root
RUN apk add --no-cache nginx

WORKDIR /app

# Copy built backend
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=backend-build /app/backend/package*.json ./backend/
WORKDIR /app/backend
# Install production dependencies
RUN npm install --omit=dev

# Copy built frontend
WORKDIR /app
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Copy .env file from the build context root to /app/.env (single source of env variables)
COPY .env .env
# Ensure the .env file has the correct permissions
RUN chmod 644 .env

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy start script
COPY start.sh ./start.sh 
RUN sed -i 's/\r$//' ./start.sh
RUN chmod +x ./start.sh

# Diagnostic: List files to verify start.sh is present
RUN ls -l /app

# Expose port 8082 for nginx
EXPOSE 8082

# Command to run both services and nginx
CMD ["sh", "-c", "./start.sh"]
