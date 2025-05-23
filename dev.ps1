# Setup environment and start services for RCM Portal development

# Use only the root .env file for the entire project
Write-Host "Using root .env file for the entire project..." -ForegroundColor Yellow

# Set environment variables for frontend API URL directly
$env:VITE_API_BASE_URL = 'http://localhost:5000/api'

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
