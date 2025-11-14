#!/bin/bash
# EC2 Backend Authentication Debug Script
# This script diagnoses why login returns 502 error

echo "=========================================="
echo "EC2 BACKEND AUTHENTICATION DIAGNOSTICS"
echo "=========================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Check which Docker containers are running
echo "1️⃣  DOCKER CONTAINERS STATUS"
echo "----------------------------------------"
echo -e "${YELLOW}Running containers:${NC}"
sudo docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo -e "${YELLOW}All containers (including stopped):${NC}"
sudo docker ps -a --format "table {{.Names}}\t{{.Status}}"
echo ""

# 2. Check if .env files exist
echo "2️⃣  ENVIRONMENT FILE CHECK"
echo "----------------------------------------"
if [ -f ~/rcm-portal/.env ]; then
    echo -e "${GREEN}✓ Production .env found: ~/rcm-portal/.env${NC}"
    echo "File size: $(wc -c < ~/rcm-portal/.env) bytes"
    echo "File permissions: $(ls -l ~/rcm-portal/.env | awk '{print $1, $3, $4}')"
    echo ""
    echo "Environment variables in .env (values hidden):"
    cat ~/rcm-portal/.env | grep -E "^[A-Z_]+" | sed 's/=.*/=***HIDDEN***/' | head -20
else
    echo -e "${RED}✗ Production .env NOT FOUND at ~/rcm-portal/.env${NC}"
fi
echo ""

if [ -f ~/rcm-portal-stage/.env ]; then
    echo -e "${GREEN}✓ Staging .env found: ~/rcm-portal-stage/.env${NC}"
else
    echo "ℹ️  Staging .env not found (may not be deployed)"
fi
echo ""

# 3. Check container logs for errors
echo "3️⃣  BACKEND CONTAINER LOGS (Last 50 lines)"
echo "----------------------------------------"
if sudo docker ps | grep -q "rcm-portal"; then
    echo -e "${GREEN}✓ Container 'rcm-portal' is running${NC}"
    echo ""
    echo "Recent logs:"
    sudo docker logs rcm-portal 2>&1 | tail -50
else
    echo -e "${RED}✗ Container 'rcm-portal' is NOT running!${NC}"
    echo ""
    echo "Checking logs from stopped container:"
    sudo docker logs rcm-portal 2>&1 | tail -50
fi
echo ""

# 4. Check if environment variables are loaded in container
echo "4️⃣  ENVIRONMENT VARIABLES IN CONTAINER"
echo "----------------------------------------"
if sudo docker ps | grep -q "rcm-portal"; then
    echo "Checking critical auth environment variables:"
    
    if sudo docker exec rcm-portal printenv JWT_SECRET >/dev/null 2>&1; then
        JWT_LEN=$(sudo docker exec rcm-portal printenv JWT_SECRET | wc -c)
        echo -e "${GREEN}✓ JWT_SECRET is set (length: $JWT_LEN characters)${NC}"
    else
        echo -e "${RED}✗ JWT_SECRET is NOT set or empty!${NC}"
    fi
    
    if sudo docker exec rcm-portal printenv DB_HOST >/dev/null 2>&1; then
        DB_HOST_VAL=$(sudo docker exec rcm-portal printenv DB_HOST)
        echo -e "${GREEN}✓ DB_HOST is set: $DB_HOST_VAL${NC}"
    else
        echo -e "${RED}✗ DB_HOST is NOT set!${NC}"
    fi
    
    if sudo docker exec rcm-portal printenv DB_PASSWORD >/dev/null 2>&1; then
        echo -e "${GREEN}✓ DB_PASSWORD is set${NC}"
    else
        echo -e "${RED}✗ DB_PASSWORD is NOT set!${NC}"
    fi
    
    if sudo docker exec rcm-portal printenv DB_NAME >/dev/null 2>&1; then
        DB_NAME_VAL=$(sudo docker exec rcm-portal printenv DB_NAME)
        echo -e "${GREEN}✓ DB_NAME is set: $DB_NAME_VAL${NC}"
    else
        echo -e "${RED}✗ DB_NAME is NOT set!${NC}"
    fi
    
    if sudo docker exec rcm-portal printenv DB_USER >/dev/null 2>&1; then
        DB_USER_VAL=$(sudo docker exec rcm-portal printenv DB_USER)
        echo -e "${GREEN}✓ DB_USER is set: $DB_USER_VAL${NC}"
    else
        echo -e "${RED}✗ DB_USER is NOT set!${NC}"
    fi
    
    echo ""
    echo "All environment variables in container:"
    sudo docker exec rcm-portal printenv | grep -E "^(DB_|JWT_|AWS_|S3_|NODE_|PORT)" | sed 's/\(PASSWORD.*=\).*/\1***HIDDEN***/' | sort
else
    echo -e "${RED}✗ Container not running - cannot check environment${NC}"
fi
echo ""

# 5. Check database connectivity from container
echo "5️⃣  DATABASE CONNECTION TEST"
echo "----------------------------------------"
if sudo docker ps | grep -q "rcm-portal"; then
    echo "Testing database connection from container..."
    sudo docker exec rcm-portal sh -c '
        if command -v psql >/dev/null 2>&1; then
            PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p ${DB_PORT:-5432} -U $DB_USER -d $DB_NAME -c "SELECT 1;" 2>&1
        else
            echo "psql not installed in container, checking with node..."
            node -e "
                const { Pool } = require(\"pg\");
                const pool = new Pool({
                    host: process.env.DB_HOST,
                    port: process.env.DB_PORT || 5432,
                    database: process.env.DB_NAME,
                    user: process.env.DB_USER,
                    password: process.env.DB_PASSWORD,
                    ssl: process.env.DB_SSL_ENABLED === \"true\" ? { rejectUnauthorized: false } : false
                });
                pool.query(\"SELECT NOW()\")
                    .then(() => { console.log(\"✓ Database connection successful\"); pool.end(); })
                    .catch(err => { console.error(\"✗ Database connection failed:\", err.message); pool.end(); });
            " 2>&1
        fi
    '
else
    echo -e "${RED}✗ Container not running - cannot test DB connection${NC}"
fi
echo ""

# 6. Check backend API health
echo "6️⃣  BACKEND API HEALTH CHECK"
echo "----------------------------------------"
echo "Testing backend endpoint from EC2 localhost..."
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/health 2>/dev/null || echo "FAILED")
if [ "$HEALTH_CHECK" = "200" ]; then
    echo -e "${GREEN}✓ Backend API responds on port 5000${NC}"
elif [ "$HEALTH_CHECK" = "FAILED" ]; then
    echo -e "${RED}✗ Cannot reach backend on localhost:5000${NC}"
else
    echo -e "${YELLOW}⚠ Backend returned status: $HEALTH_CHECK${NC}"
fi

LOGIN_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/auth/login 2>/dev/null || echo "FAILED")
if [ "$LOGIN_CHECK" = "405" ] || [ "$LOGIN_CHECK" = "400" ]; then
    echo -e "${GREEN}✓ Login endpoint reachable (status: $LOGIN_CHECK - normal for GET request)${NC}"
elif [ "$LOGIN_CHECK" = "502" ]; then
    echo -e "${RED}✗ Login endpoint returns 502 Bad Gateway!${NC}"
elif [ "$LOGIN_CHECK" = "FAILED" ]; then
    echo -e "${RED}✗ Cannot reach login endpoint${NC}"
else
    echo -e "${YELLOW}⚠ Login endpoint status: $LOGIN_CHECK${NC}"
fi
echo ""

# 7. Check NGINX configuration (if exists)
echo "7️⃣  NGINX/REVERSE PROXY CHECK"
echo "----------------------------------------"
if command -v nginx >/dev/null 2>&1; then
    echo "NGINX is installed"
    sudo nginx -t 2>&1
    echo ""
    echo "NGINX config for backend proxy:"
    sudo grep -r "proxy_pass.*5000" /etc/nginx/ 2>/dev/null || echo "No proxy config found"
elif sudo docker ps | grep -q nginx; then
    echo "NGINX running in Docker container"
    sudo docker exec $(sudo docker ps | grep nginx | awk '{print $1}') nginx -t 2>&1
else
    echo "NGINX not detected (may not be used)"
fi
echo ""

# 8. Summary and diagnosis
echo "=========================================="
echo "📋 DIAGNOSIS SUMMARY"
echo "=========================================="
echo ""

# Check for common issues
ISSUES_FOUND=0

if ! sudo docker ps | grep -q "rcm-portal"; then
    echo -e "${RED}🔴 CRITICAL: Backend container is not running!${NC}"
    echo "   → Fix: Check docker-compose logs and restart container"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if [ ! -f ~/rcm-portal/.env ]; then
    echo -e "${RED}🔴 CRITICAL: .env file missing!${NC}"
    echo "   → Fix: GitHub Actions workflow must create .env from secrets"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if sudo docker ps | grep -q "rcm-portal"; then
    if ! sudo docker exec rcm-portal printenv JWT_SECRET >/dev/null 2>&1; then
        echo -e "${RED}🔴 CRITICAL: JWT_SECRET not set in container!${NC}"
        echo "   → Fix: Verify .env is mounted and contains JWT_SECRET"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
    
    if ! sudo docker exec rcm-portal printenv DB_HOST >/dev/null 2>&1; then
        echo -e "${RED}🔴 CRITICAL: Database env vars not set!${NC}"
        echo "   → Fix: Add DB_HOST, DB_PASSWORD, etc. to .env"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
fi

if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✓ No critical issues detected!${NC}"
    echo ""
    echo "If you still see 502 errors, check:"
    echo "  1. Backend startup errors in logs"
    echo "  2. Database connection from container"
    echo "  3. NGINX proxy configuration"
    echo "  4. Security group / firewall rules"
else
    echo ""
    echo "Found $ISSUES_FOUND critical issue(s) that need to be fixed."
fi

echo ""
echo "=========================================="
echo "Script completed. Review output above."
echo "=========================================="
