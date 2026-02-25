# RCM Portal - Staging Deployment Guide v0.9.0

## Pre-Deployment Checklist

✅ **Completed:**
- [x] Database cleaned (2,700+ rows removed from 7 tables)
- [x] Repository cleaned (removed test scripts, markdown docs)
- [x] Unused database functions removed (4 custom functions)
- [x] S3 bucket verified empty
- [x] Code committed and pushed to main branch
- [x] Version updated to 0.9.0

## Environment Setup

### 1. Environment Variables (.env)

Ensure your `.env` file has the following variables configured for **staging**:

```bash
# Database (Aptible Staging)
DB_HOST=localhost.aptible.in
DB_PORT=61735
DB_NAME=db
DB_USER=aptible
DB_PASSWORD=<staging-password>

# S3 (AWS Staging Bucket)
AWS_ACCESS_KEY_ID=<staging-aws-key>
AWS_SECRET_ACCESS_KEY=<staging-aws-secret>
S3_BUCKET=hbox-rcm-bucket
S3_REGION=us-west-2

# API Configuration
PORT=60172
NODE_ENV=staging
API_BASE_URL=https://staging.rcm-portal.yourhost.com/api

# Frontend Configuration
VITE_API_BASE_URL=https://staging.rcm-portal.yourhost.com/api

# JWT Secret (use staging-specific secret)
JWT_SECRET=<staging-jwt-secret>

# CORS Origins (staging domains)
CORS_ORIGIN=https://staging.rcm-portal.yourhost.com,http://localhost:5173
```

### 2. Database Migrations

Before deploying, ensure all migrations are applied to the staging database:

```bash
# SSH into your staging server or use Aptible tunnel
aptible db:tunnel db --app rcm-staging

# In another terminal, run migrations
cd backend
npm run db:migrate
```

**Critical Migrations for v0.9.0:**
- `028_add_temp_file_path.sql` - Adds temp file storage for preview-commit flow
- `029_add_cpt_code_id_unique_constraints.sql` - Ensures unique CPT IDs for split-row model
- `030_add_reimburse_extended_columns.sql` - Adds extended reimburse columns

### 3. Verify Database State

Check that tables are clean and ready:

```sql
-- Verify table counts (should all be 0 after cleanup)
SELECT 'api_bil_claim_submit' as table_name, COUNT(*) FROM api_bil_claim_submit
UNION ALL
SELECT 'api_bil_claim_reimburse', COUNT(*) FROM api_bil_claim_reimburse
UNION ALL
SELECT 'rcm_file_uploads', COUNT(*) FROM rcm_file_uploads
UNION ALL
SELECT 'rcm_submit_line_audit', COUNT(*) FROM rcm_submit_line_audit
UNION ALL
SELECT 'upl_change_logs', COUNT(*) FROM upl_change_logs;

-- Verify no custom functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_type = 'FUNCTION'
  AND routine_name LIKE '%claim%' OR routine_name LIKE '%reimburse%';
```

## Deployment Steps

### Option A: Docker Deployment (Recommended)

#### 1. Build Docker Image

```bash
cd "d:\Billing\RCM Project"

# Build the production image
docker-compose build

# Or build with no cache if needed
docker-compose build --no-cache
```

#### 2. Test Locally First

```bash
# Start container locally to verify build
docker-compose up

# Test in browser at http://localhost:8082
# Verify login, upload, and basic functionality
```

#### 3. Tag and Push to Registry

```bash
# Tag with version
docker tag rcm-portal:latest your-registry.com/rcm-portal:0.9.0
docker tag rcm-portal:latest your-registry.com/rcm-portal:staging

# Push to registry
docker push your-registry.com/rcm-portal:0.9.0
docker push your-registry.com/rcm-portal:staging
```

#### 4. Deploy to Staging Server

```bash
# SSH into staging server
ssh user@staging-server

# Pull latest image
docker pull your-registry.com/rcm-portal:staging

# Stop existing container
docker-compose down

# Start with new image
docker-compose up -d

# Check logs
docker-compose logs -f
```

### Option B: Direct Server Deployment

#### 1. Sync Code to Server

```bash
# Using rsync (recommended)
rsync -avz --exclude 'node_modules' --exclude 'dist' --exclude '.git' \
  "d:\Billing\RCM Project/" user@staging-server:/app/rcm-portal/

# Or using git pull on server
ssh user@staging-server
cd /app/rcm-portal
git pull origin main
```

#### 2. Install Dependencies

```bash
# On staging server
cd /app/rcm-portal

# Backend dependencies
cd backend
npm install --omit=dev

# Frontend dependencies
cd ../frontend
npm install
```

#### 3. Build Application

```bash
# Build backend
cd backend
npm run build

# Build frontend
cd ../frontend
npm run build
```

#### 4. Start Services

```bash
# Using PM2 (recommended for production)
pm2 restart backend
pm2 restart frontend

# Or using systemd
systemctl restart rcm-backend
systemctl restart rcm-frontend

# Or using the start script
cd /app/rcm-portal
./start.sh
```

## Post-Deployment Verification

### 1. Health Checks

```bash
# Check backend health
curl https://staging.rcm-portal.yourhost.com/api/health

# Expected response:
# {"status":"ok","timestamp":"2025-11-16T..."}

# Check database connection
curl https://staging.rcm-portal.yourhost.com/api/db-test

# Expected response:
# {"status":"success","message":"Connected to database","timestamp":"..."}
```

### 2. Functional Tests

#### Login Test
- Navigate to staging URL
- Verify version shows `v0.9.0` in footer
- Login with admin credentials
- Verify JWT token is set

#### Upload Test (Submit)
1. Download template: `/api/submit-uploads/template`
2. Fill in sample data (1 row, 2 CPT lines)
3. Upload via UI
4. Verify preview shows correct validation
5. Commit upload
6. Check claims table for new records
7. Verify reimburse rows were auto-created

#### Upload Test (Reimburse)
1. Upload reimburse file with matching `cpt_code_id`
2. Verify preview shows matched records
3. Commit upload
4. Verify updates in reimburse table

### 3. Database Verification

```sql
-- Check upload record
SELECT upload_id, status, row_count, message, s3_url
FROM rcm_file_uploads
ORDER BY created_at DESC
LIMIT 5;

-- Check submit claims
SELECT claim_id, cpt_code_id1, charges1, upload_id
FROM api_bil_claim_submit
ORDER BY created_at DESC
LIMIT 5;

-- Check reimburse rows (should be 1 per CPT)
SELECT bil_claim_reimburse_id, submit_cpt_id, cpt_code, charge_amt
FROM api_bil_claim_reimburse
ORDER BY created_at DESC
LIMIT 10;

-- Check audit logs
SELECT submit_cpt_id, cycle, hash_old, hash_new
FROM rcm_submit_line_audit
ORDER BY changed_at DESC
LIMIT 5;

-- Check change logs
SELECT claim_id, field_name, old_value, new_value, changed_at
FROM upl_change_logs
ORDER BY changed_at DESC
LIMIT 10;
```

### 4. S3 Verification

```bash
# Check S3 bucket for uploaded files
aws s3 ls s3://hbox-rcm-bucket/submit/ --recursive
aws s3 ls s3://hbox-rcm-bucket/reimburse/ --recursive
```

### 5. Log Monitoring

```bash
# Docker logs
docker-compose logs -f --tail=100

# PM2 logs
pm2 logs backend --lines 100
pm2 logs frontend --lines 100

# System logs
tail -f /var/log/rcm-portal/backend.log
tail -f /var/log/rcm-portal/frontend.log
```

## Rollback Procedure

If issues are detected, rollback to previous version:

### Docker Rollback

```bash
# Stop current container
docker-compose down

# Switch to previous image tag
docker pull your-registry.com/rcm-portal:0.8.0

# Update docker-compose.yml to use 0.8.0 tag
docker-compose up -d
```

### Direct Deployment Rollback

```bash
# Revert to previous commit
git checkout <previous-commit-hash>

# Rebuild
npm run build

# Restart services
pm2 restart all
```

### Database Rollback

```bash
# If migrations need to be reverted, run down migrations
# (Not implemented yet - manual SQL required)

# Restore from backup
pg_restore -h localhost.aptible.in -p 61735 -U aptible -d db < backup_before_0.9.0.sql
```

## Monitoring and Alerts

### Key Metrics to Monitor

1. **Response Times**
   - `/api/submit-uploads/preview` should be < 5s
   - `/api/submit-uploads/commit` should be < 30s for 1000 rows

2. **Error Rates**
   - Monitor 500 errors in application logs
   - Monitor database connection errors
   - Monitor S3 upload failures

3. **Resource Usage**
   - CPU usage should be < 70% under normal load
   - Memory usage should be < 2GB
   - Database connections should be < 20

4. **User Actions**
   - Track upload success/failure rate
   - Monitor concurrent upload attempts
   - Track duplicate detection rate

## Known Issues & Limitations

1. **Large Files** - Files > 50MB are rejected (intentional limit)
2. **Concurrent Uploads** - Warning shown but not prevented (Case 16)
3. **Preview Validation** - Validates first 100 rows only in preview (full validation on commit)
4. **Rate Limiting** - Progress polling exempted from rate limits

## New Features in v0.9.0

### Submit Upload Improvements
- ✅ Preview-commit flow (no S3 upload until commit)
- ✅ Enhanced validation (all rows checked, detailed errors)
- ✅ Template download endpoint
- ✅ Multiple sheets detection warning
- ✅ Unknown columns detection
- ✅ Better header mapping (underscore/dash variations)

### Reimburse Upload Improvements
- ✅ Preview-commit flow implemented
- ✅ SQL-based unpivot for reimburse mirroring (3x faster)
- ✅ Batch insert optimization for large files
- ✅ Extended columns support (patient info, service details, payment tracking)

### Infrastructure Improvements
- ✅ S3 retry logic with exponential backoff
- ✅ Rate limiting with progress polling exemption
- ✅ Concurrent upload detection
- ✅ Better error messages for missing columns

## Support & Troubleshooting

### Common Issues

**Issue: "Upload failed - S3 upload error"**
- Check AWS credentials in `.env`
- Verify S3 bucket exists and is accessible
- Check S3 retry logs in application

**Issue: "Missing required columns"**
- Download latest template
- Verify header names match exactly (case-insensitive, but format matters)
- Check for extra spaces or special characters in headers

**Issue: "Duplicate cpt_code_id"**
- This is expected behavior - system will UPDATE existing claim
- Check `rcm_submit_line_audit` for cycle history
- Verify unique constraint is working

**Issue: "Database connection timeout"**
- Verify Aptible tunnel is running
- Check DB credentials in `.env`
- Verify database is not overloaded

### Contact

For deployment issues, contact:
- DevOps Team: devops@example.com
- Backend Lead: backend@example.com
- Database Admin: dba@example.com

## Changelog v0.9.0

### Added
- Preview-commit flow for both submit and reimburse uploads
- Template download endpoint for submit uploads
- Enhanced validation with detailed row-level errors
- SQL-based reimburse mirroring optimization
- S3 retry logic with exponential backoff
- Concurrent upload detection warning
- Multiple sheets detection
- Unknown columns warning
- Extended reimburse columns (30+ new fields)

### Changed
- Split-row model now enforced with unique constraints
- Header mapping improved for underscore/dash variations
- Rate limiting excludes progress polling endpoints
- Validation now checks ALL rows (not just first 100)

### Fixed
- CPT Code ID mapping for underscored variations
- Reimburse mirroring performance for large datasets
- S3 upload reliability
- Preview progress animation smoothness

### Removed
- 15+ test and diagnostic scripts
- All markdown documentation files
- frontend/docs folder
- 4 unused custom database functions
- 2,700+ test data rows from database

---

**Deployment Date:** November 16, 2025  
**Version:** 0.9.0  
**Git Commit:** 50fa11b  
**Deployed By:** [Your Name]
