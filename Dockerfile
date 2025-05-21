# Base image
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (or yarn.lock)
COPY backend/package.json backend/package-lock.json* ./

# Install dependencies
RUN npm install --production

# Copy tsconfig.json
COPY backend/tsconfig.json ./

# Copy application source code
COPY backend/src ./src

# Build TypeScript
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# --- Production image ---
FROM node:18-alpine

# Set NODE_ENV to production
ENV NODE_ENV=production

# Set working directory
WORKDIR /usr/src/app

# Copy built application and node_modules from builder stage
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package.json ./

# Expose port (as specified in your backend/src/index.ts or default)
# The prompt asks for 8083, but the app itself listens on process.env.PORT || 5000
# We will map this in docker-compose.yml
EXPOSE 5000

# Add wait-for-it.sh script
COPY wait-for-it.sh .
RUN chmod +x ./wait-for-it.sh

# Command to run the application
# The original start script is "node dist/index.js"
CMD ["./wait-for-it.sh", "db:5432", "--", "node", "dist/index.js"]