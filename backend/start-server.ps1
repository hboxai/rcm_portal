# Copy the main .env file to the backend directory
Copy-Item -Path '..\\.env' -Destination '.env' -Force
Write-Host "Copied main .env file to backend directory"

# Start the server
npm run dev
