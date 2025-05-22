# Setup environment and start services for RCM Portal development

# Step 1: Copy the root .env file to both frontend and backend
Write-Host "Copying .env file to both frontend and backend..." -ForegroundColor Yellow
Copy-Item -Path ".env" -Destination "backend/.env" -Force
Copy-Item -Path ".env" -Destination "frontend/.env" -Force

# Step 2: Add the VITE_API_BASE_URL to the frontend .env file if it doesn't exist
$frontendEnvPath = "frontend/.env"
$frontendEnvContent = Get-Content $frontendEnvPath -Raw

if (-not ($frontendEnvContent -match "VITE_API_BASE_URL")) {
    Write-Host "Adding VITE_API_BASE_URL to frontend .env file..." -ForegroundColor Yellow
    Add-Content -Path $frontendEnvPath -Value "`nVITE_API_BASE_URL=http://localhost:5000/api"
}

# Step 3: Set environment variables for CORS
$env:CORS_ORIGIN = 'http://localhost:5173'

# Step 4: Start the backend server
Write-Host "Starting backend server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-Command cd backend; npm run dev"

# Give the backend a moment to start
Start-Sleep -Seconds 3

# Step 5: Start the frontend server
Write-Host "Starting frontend server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-Command cd frontend; npm run dev"

Write-Host "Both servers are now running." -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Yellow
Write-Host "Backend: http://localhost:5000" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop all servers" -ForegroundColor Red

# Keep the script running
while ($true) {
    Start-Sleep -Seconds 1
}
