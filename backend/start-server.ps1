# Use the root .env file directly
Write-Host "Using main .env file from root directory"

# Set environment variable to point to the root .env file
$env:NODE_ENV_PATH = '../.env'

# Start the server
npm run dev
