# RCM Portal Staging Deployment - PowerShell Script v0.9.0
# This script automates the deployment process to staging environment on Windows

param(
    [string]$DockerRegistry = "your-registry.com",
    [string]$StagingServer = "user@staging-server",
    [string]$StagingUrl = "https://staging.rcm-portal.yourhost.com",
    [switch]$SkipBuild,
    [switch]$SkipTests,
    [switch]$SkipPush
)

$ErrorActionPreference = "Stop"
$VERSION = "0.9.0"
$IMAGE_NAME = "rcm-portal"

# Colors
function Write-Step { Write-Host "`n▶ $args" -ForegroundColor Green }
function Write-Error-Custom { Write-Host "`n✗ Error: $args" -ForegroundColor Red; exit 1 }
function Write-Warning-Custom { Write-Host "⚠ Warning: $args" -ForegroundColor Yellow }
function Write-Success { Write-Host "✓ $args" -ForegroundColor Green }

Write-Host "========================================" -ForegroundColor Blue
Write-Host "RCM Portal Staging Deployment v$VERSION" -ForegroundColor Blue
Write-Host "========================================`n" -ForegroundColor Blue

# Step 1: Pre-deployment checks
Write-Step "Step 1: Running pre-deployment checks..."

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Error-Custom ".env file not found. Please create it before deploying."
}

# Check if package.json exists
if (-not (Test-Path "package.json")) {
    Write-Error-Custom "Please run this script from the project root directory."
}

# Check Git status
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Warning-Custom "You have uncommitted changes."
    $response = Read-Host "Continue anyway? (y/n)"
    if ($response -ne "y") {
        Write-Error-Custom "Deployment cancelled. Please commit your changes first."
    }
}

# Verify branch
$currentBranch = git rev-parse --abbrev-ref HEAD
if ($currentBranch -ne "main") {
    Write-Warning-Custom "You are not on 'main' branch. Current branch: $currentBranch"
    $response = Read-Host "Continue? (y/n)"
    if ($response -ne "y") {
        Write-Error-Custom "Deployment cancelled."
    }
}

Write-Success "Pre-deployment checks passed"

# Step 2: Build Docker image
if (-not $SkipBuild) {
    Write-Step "Step 2: Building Docker image..."
    
    docker-compose build
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "Docker build failed"
    }
    
    Write-Success "Docker image built successfully"
} else {
    Write-Warning-Custom "Skipping Docker build"
}

# Step 3: Test locally
if (-not $SkipTests) {
    Write-Step "Step 3: Testing locally..."
    
    Write-Host "Starting container on localhost:8082..."
    docker-compose up -d
    
    Start-Sleep -Seconds 5
    
    # Test health endpoint
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8082/api/health" -UseBasicParsing
        Write-Success "Local health check passed"
    } catch {
        Write-Warning-Custom "Local health check failed: $_"
    }
    
    Write-Host "`nContainer is running. Press Enter to continue with deployment or Ctrl+C to abort..."
    Read-Host
    
    # Stop local test
    docker-compose down
} else {
    Write-Warning-Custom "Skipping local tests"
}

# Step 4: Tag images
Write-Step "Step 4: Tagging Docker images..."

docker tag "${IMAGE_NAME}:latest" "${DockerRegistry}/${IMAGE_NAME}:${VERSION}"
docker tag "${IMAGE_NAME}:latest" "${DockerRegistry}/${IMAGE_NAME}:staging"

Write-Success "Images tagged"

# Step 5: Push to registry
if (-not $SkipPush) {
    Write-Step "Step 5: Pushing to Docker registry..."
    
    $response = Read-Host "Push images to registry? (y/n)"
    if ($response -eq "y") {
        docker push "${DockerRegistry}/${IMAGE_NAME}:${VERSION}"
        if ($LASTEXITCODE -ne 0) {
            Write-Error-Custom "Push failed"
        }
        
        docker push "${DockerRegistry}/${IMAGE_NAME}:staging"
        if ($LASTEXITCODE -ne 0) {
            Write-Error-Custom "Push failed"
        }
        
        Write-Success "Images pushed to registry"
    } else {
        Write-Warning-Custom "Skipping registry push"
    }
} else {
    Write-Warning-Custom "Skipping registry push"
}

# Step 6: Deploy to staging server
Write-Step "Step 6: Deploying to staging server..."

$response = Read-Host "Deploy to staging server $StagingServer? (y/n)"
if ($response -eq "y") {
    
    Write-Host "Connecting to staging server..."
    
    # Note: This requires SSH access from Windows (OpenSSH client)
    # You can also use Plink (from PuTTY) or other SSH clients
    
    $deployScript = @"
cd /app/rcm-portal
echo 'Pulling latest image...'
docker pull $DockerRegistry/$IMAGE_NAME:staging
echo 'Stopping current container...'
docker-compose down
echo 'Starting new container...'
docker-compose up -d
echo 'Waiting for container to be ready...'
sleep 10
echo 'Checking health...'
curl -f http://localhost:8082/api/health || echo 'Health check failed'
echo 'Deployment complete!'
"@
    
    ssh $StagingServer $deployScript
    
    Write-Success "Deployed to staging server"
} else {
    Write-Warning-Custom "Skipping server deployment"
}

# Step 7: Run database migrations
Write-Step "Step 7: Running database migrations..."

$response = Read-Host "Run database migrations on staging? (y/n)"
if ($response -eq "y") {
    
    $migrateScript = @"
cd /app/rcm-portal/backend
echo 'Running migrations...'
npm run db:migrate
echo 'Migrations complete!'
"@
    
    ssh $StagingServer $migrateScript
    
    Write-Success "Migrations completed"
} else {
    Write-Warning-Custom "Skipping migrations"
}

# Step 8: Post-deployment verification
Write-Step "Step 8: Running post-deployment verification..."

# Get staging URL if not provided
if (-not $StagingUrl) {
    $StagingUrl = Read-Host "Enter staging URL (e.g., https://staging.rcm-portal.yourhost.com)"
}

# Health check
Write-Host "Testing health endpoint..."
try {
    $response = Invoke-WebRequest -Uri "$StagingUrl/api/health" -UseBasicParsing
    Write-Success "Health check passed"
} catch {
    Write-Error-Custom "Health check failed: $_"
}

# Database check
Write-Host "Testing database connection..."
try {
    $response = Invoke-WebRequest -Uri "$StagingUrl/api/db-test" -UseBasicParsing
    Write-Success "Database connection test passed"
} catch {
    Write-Error-Custom "Database connection test failed: $_"
}

Write-Success "Post-deployment verification completed"

# Step 9: Summary
$gitCommit = git rev-parse --short HEAD
$deployTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

Write-Host "`n========================================" -ForegroundColor Blue
Write-Host "Deployment Summary" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host "Version:        " -NoNewline; Write-Host "$VERSION" -ForegroundColor Green
Write-Host "Git Commit:     " -NoNewline; Write-Host "$gitCommit" -ForegroundColor Green
Write-Host "Branch:         " -NoNewline; Write-Host "$currentBranch" -ForegroundColor Green
Write-Host "Registry:       " -NoNewline; Write-Host "$DockerRegistry" -ForegroundColor Green
Write-Host "Staging URL:    " -NoNewline; Write-Host "$StagingUrl" -ForegroundColor Green
Write-Host "Deployed:       " -NoNewline; Write-Host "$deployTime" -ForegroundColor Green

Write-Host "`n✓ Deployment completed successfully!`n" -ForegroundColor Green

# Next steps
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Test login at $StagingUrl"
Write-Host "2. Verify version shows v$VERSION in footer"
Write-Host "3. Test submit upload flow (download template, upload, commit)"
Write-Host "4. Test reimburse upload flow"
Write-Host "5. Verify database records and S3 uploads"
Write-Host "6. Monitor logs for any errors"
Write-Host "`nFor detailed verification steps, see DEPLOY_STAGING.md`n"

exit 0
