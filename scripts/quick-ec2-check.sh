#!/bin/bash
# Quick EC2 Environment Check - Run this on your EC2 instance

echo "=== QUICK EC2 ENVIRONMENT CHECK ==="
echo ""
echo "1. Checking if .env file exists..."
if [ -f ~/rcm-portal/.env ]; then
    echo "✓ .env exists at ~/rcm-portal/.env"
    echo "   Size: $(wc -l < ~/rcm-portal/.env) lines"
    echo "   Variables found:"
    grep -E "^[A-Z_]+=" ~/rcm-portal/.env | cut -d= -f1 | sort
else
    echo "✗ .env NOT FOUND at ~/rcm-portal/.env"
    echo "   THIS IS THE PROBLEM - GitHub Actions is not creating .env!"
fi

echo ""
echo "2. Checking Docker container..."
if sudo docker ps | grep -q rcm-portal; then
    echo "✓ Container rcm-portal is RUNNING"
    
    echo ""
    echo "3. Checking environment variables IN container..."
    
    JWT=$(sudo docker exec rcm-portal printenv JWT_SECRET 2>/dev/null)
    if [ -n "$JWT" ]; then
        echo "✓ JWT_SECRET is set (length: ${#JWT})"
    else
        echo "✗ JWT_SECRET is MISSING or EMPTY"
    fi
    
    DB_HOST=$(sudo docker exec rcm-portal printenv DB_HOST 2>/dev/null)
    if [ -n "$DB_HOST" ]; then
        echo "✓ DB_HOST = $DB_HOST"
    else
        echo "✗ DB_HOST is MISSING"
    fi
    
    DB_PASS=$(sudo docker exec rcm-portal printenv DB_PASSWORD 2>/dev/null)
    if [ -n "$DB_PASS" ]; then
        echo "✓ DB_PASSWORD is set"
    else
        echo "✗ DB_PASSWORD is MISSING"
    fi
else
    echo "✗ Container rcm-portal is NOT RUNNING"
    echo ""
    echo "Checking container status..."
    sudo docker ps -a | grep rcm-portal
    echo ""
    echo "Last 20 lines of container logs:"
    sudo docker logs rcm-portal 2>&1 | tail -20
fi

echo ""
echo "=== SUMMARY ==="
if [ ! -f ~/rcm-portal/.env ]; then
    echo "🔴 PROBLEM: .env file does NOT exist on EC2"
    echo "   → You need to add GitHub secrets and redeploy"
    echo "   → GitHub Actions workflow will create .env from secrets"
elif ! sudo docker ps | grep -q rcm-portal; then
    echo "🔴 PROBLEM: Docker container is not running"
    echo "   → Check logs above for startup errors"
elif ! sudo docker exec rcm-portal printenv JWT_SECRET >/dev/null 2>&1; then
    echo "🔴 PROBLEM: JWT_SECRET not loaded in container"
    echo "   → .env exists but not mounted to container correctly"
else
    echo "✅ Environment appears to be configured correctly"
    echo "   If auth still fails, check database connectivity"
fi
