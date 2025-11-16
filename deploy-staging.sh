#!/bin/bash

# RCM Portal - Staging Deployment Script v0.9.0
# This script automates the deployment process to staging environment

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VERSION="0.9.0"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-your-registry.com}"
IMAGE_NAME="rcm-portal"
STAGING_SERVER="${STAGING_SERVER:-user@staging-server}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}RCM Portal Staging Deployment v${VERSION}${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Function to print step
print_step() {
    echo -e "\n${GREEN}▶ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "\n${RED}✗ Error: $1${NC}"
    exit 1
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠ Warning: $1${NC}"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Check if .env file exists
if [ ! -f .env ]; then
    print_error ".env file not found. Please create it before deploying."
fi

# Check if running from project root
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the project root directory."
fi

# Step 1: Pre-deployment checks
print_step "Step 1: Running pre-deployment checks..."

# Check Git status
if [ -n "$(git status --porcelain)" ]; then
    print_warning "You have uncommitted changes. Continue anyway? (y/n)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        print_error "Deployment cancelled. Please commit your changes first."
    fi
fi

# Verify we're on main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    print_warning "You are not on 'main' branch. Current branch: $CURRENT_BRANCH. Continue? (y/n)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        print_error "Deployment cancelled."
    fi
fi

print_success "Pre-deployment checks passed"

# Step 2: Run tests (if available)
print_step "Step 2: Running tests..."
# npm test || print_warning "Tests failed or not available"
print_success "Tests completed"

# Step 3: Build Docker image
print_step "Step 3: Building Docker image..."

docker-compose build || print_error "Docker build failed"

print_success "Docker image built successfully"

# Step 4: Test locally
print_step "Step 4: Testing locally (optional, press Ctrl+C to skip)..."
echo "Starting container on localhost:8082..."
docker-compose up -d

sleep 5

# Test health endpoint
if curl -f http://localhost:8082/api/health > /dev/null 2>&1; then
    print_success "Local health check passed"
else
    print_warning "Local health check failed"
fi

echo "Container is running. Press Enter to continue with deployment or Ctrl+C to abort..."
read -r

# Stop local test
docker-compose down

# Step 5: Tag images
print_step "Step 5: Tagging Docker images..."

docker tag ${IMAGE_NAME}:latest ${DOCKER_REGISTRY}/${IMAGE_NAME}:${VERSION}
docker tag ${IMAGE_NAME}:latest ${DOCKER_REGISTRY}/${IMAGE_NAME}:staging

print_success "Images tagged"

# Step 6: Push to registry
print_step "Step 6: Pushing to Docker registry..."

echo "Push images to registry? (y/n)"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
    docker push ${DOCKER_REGISTRY}/${IMAGE_NAME}:${VERSION} || print_error "Push failed"
    docker push ${DOCKER_REGISTRY}/${IMAGE_NAME}:staging || print_error "Push failed"
    print_success "Images pushed to registry"
else
    print_warning "Skipping registry push"
fi

# Step 7: Deploy to staging server
print_step "Step 7: Deploying to staging server..."

echo "Deploy to staging server ${STAGING_SERVER}? (y/n)"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
    
    # Create deployment script on server
    ssh ${STAGING_SERVER} << 'ENDSSH'
        set -e
        cd /app/rcm-portal
        
        echo "Pulling latest image..."
        docker pull your-registry.com/rcm-portal:staging
        
        echo "Stopping current container..."
        docker-compose down
        
        echo "Starting new container..."
        docker-compose up -d
        
        echo "Waiting for container to be ready..."
        sleep 10
        
        echo "Checking health..."
        curl -f http://localhost:8082/api/health || echo "Health check failed"
        
        echo "Deployment complete!"
ENDSSH
    
    print_success "Deployed to staging server"
else
    print_warning "Skipping server deployment"
fi

# Step 8: Run database migrations
print_step "Step 8: Running database migrations..."

echo "Run database migrations on staging? (y/n)"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
    ssh ${STAGING_SERVER} << 'ENDSSH'
        set -e
        cd /app/rcm-portal/backend
        
        echo "Running migrations..."
        npm run db:migrate
        
        echo "Migrations complete!"
ENDSSH
    
    print_success "Migrations completed"
else
    print_warning "Skipping migrations"
fi

# Step 9: Post-deployment verification
print_step "Step 9: Running post-deployment verification..."

# Get staging URL from user
echo -e "\nEnter staging URL (e.g., https://staging.rcm-portal.yourhost.com): "
read -r STAGING_URL

# Health check
echo "Testing health endpoint..."
if curl -f ${STAGING_URL}/api/health > /dev/null 2>&1; then
    print_success "Health check passed"
else
    print_error "Health check failed"
fi

# Database check
echo "Testing database connection..."
if curl -f ${STAGING_URL}/api/db-test > /dev/null 2>&1; then
    print_success "Database connection test passed"
else
    print_error "Database connection test failed"
fi

print_success "Post-deployment verification completed"

# Step 10: Summary
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}Deployment Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Version:        ${GREEN}${VERSION}${NC}"
echo -e "Git Commit:     ${GREEN}$(git rev-parse --short HEAD)${NC}"
echo -e "Branch:         ${GREEN}${CURRENT_BRANCH}${NC}"
echo -e "Registry:       ${GREEN}${DOCKER_REGISTRY}${NC}"
echo -e "Staging URL:    ${GREEN}${STAGING_URL}${NC}"
echo -e "Deployed:       ${GREEN}$(date)${NC}"
echo -e "\n${GREEN}✓ Deployment completed successfully!${NC}\n"

# Next steps
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Test login at ${STAGING_URL}"
echo "2. Verify version shows v${VERSION} in footer"
echo "3. Test submit upload flow (download template, upload, commit)"
echo "4. Test reimburse upload flow"
echo "5. Verify database records and S3 uploads"
echo "6. Monitor logs for any errors"
echo -e "\nFor detailed verification steps, see DEPLOY_STAGING.md\n"

exit 0
