# Multi-stage build for RCM Portal application
FROM node:20-alpine AS base

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
# Update the API URL to point to the container's backend
RUN sed -i 's|VITE_API_BASE_URL=.*|VITE_API_BASE_URL=http://localhost:5000/api|' .env
RUN npm run build

# Production stage
FROM base AS production

# Install Python, build tools, and nginx
USER root
RUN apk add --no-cache python3 make g++ nginx

WORKDIR /app

# Copy built backend
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=backend-build /app/backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install --omit=dev

# Copy built frontend
WORKDIR /app
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Copy .env file from the build context root to /app/.env
COPY .env .env

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy start script
COPY start.sh ./ 
RUN chmod +x ./start.sh

# Diagnostic: List files to verify start.sh is present
RUN ls -l /app

# Expose port 8082 for nginx
EXPOSE 8082

# Command to run both services and nginx
CMD ["sh", "-c", "./start.sh"]
