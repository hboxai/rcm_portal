# Quick Deployment Checklist - v0.9.0

## Before You Deploy

- [ ] All code committed and pushed to main branch
- [ ] Version updated to 0.9.0 (package.json files + login page)
- [ ] `.env` file configured for staging environment
- [ ] Database cleaned (2,700+ rows removed)
- [ ] S3 bucket verified empty
- [ ] Aptible tunnel running (if needed)

## Deployment Options

### Option 1: Automated Script (Windows)
```powershell
cd "d:\Billing\RCM Project"
.\deploy-staging.ps1
```

### Option 2: Automated Script (Linux/Mac)
```bash
cd "d:/Billing/RCM Project"
chmod +x deploy-staging.sh
./deploy-staging.sh
```

### Option 3: Manual Docker Deployment
```bash
# 1. Build
docker-compose build

# 2. Test locally
docker-compose up
# Visit http://localhost:8082

# 3. Tag and push
docker tag rcm-portal:latest your-registry.com/rcm-portal:0.9.0
docker push your-registry.com/rcm-portal:0.9.0

# 4. Deploy on server
ssh user@staging-server
cd /app/rcm-portal
docker-compose pull
docker-compose down
docker-compose up -d
```

## Post-Deployment Verification

### 1. Quick Health Checks
```bash
# Backend health
curl https://staging.yourhost.com/api/health

# Database connection
curl https://staging.yourhost.com/api/db-test
```

### 2. Login Test
- Go to staging URL
- Check footer shows **v0.9.0** ✓
- Login with credentials
- Verify JWT token set

### 3. Upload Test
- Download template: Click "Download Excel Template"
- Fill in 1 row with 2 CPT lines
- Upload file
- Verify preview shows validation
- Click Commit
- Check database for new records

### 4. Database Quick Check
```sql
-- Check recent uploads
SELECT upload_id, status, row_count, message 
FROM rcm_file_uploads 
ORDER BY created_at DESC LIMIT 3;

-- Check submit claims count
SELECT COUNT(*) FROM api_bil_claim_submit;

-- Check reimburse rows count (should be # of CPT lines)
SELECT COUNT(*) FROM api_bil_claim_reimburse;
```

## If Something Goes Wrong

### Rollback
```bash
# Docker rollback
docker-compose down
docker pull your-registry.com/rcm-portal:0.8.0
# Update docker-compose.yml tag
docker-compose up -d

# OR Git rollback
git checkout 50fa11b  # Previous commit
git push origin main --force
```

### Check Logs
```bash
# Docker logs
docker-compose logs -f backend

# PM2 logs
pm2 logs backend

# Check for errors
docker-compose logs backend | grep -i error
```

## Success Criteria

✅ Health endpoint returns 200  
✅ Login page shows v0.9.0  
✅ Can login successfully  
✅ Can download template  
✅ Can upload and preview file  
✅ Can commit upload  
✅ Submit claims created in database  
✅ Reimburse rows auto-created (1 per CPT)  
✅ S3 file uploaded successfully  
✅ No errors in logs  

## Support

If you encounter issues:
1. Check `DEPLOY_STAGING.md` for detailed troubleshooting
2. Review logs for error messages
3. Verify `.env` configuration
4. Check database connection
5. Verify S3 credentials

## Key Changes in v0.9.0

🆕 Preview-commit flow (no S3 until commit)  
🆕 Template download for submit uploads  
🆕 Enhanced validation (all rows checked)  
🆕 S3 retry logic with exponential backoff  
🆕 Concurrent upload detection  
🆕 Reimburse preview-commit flow  
🆕 SQL-based reimburse optimization (3x faster)  

---
**Version:** 0.9.0  
**Git Commit:** f1f4063  
**Deployment Date:** $(date +%Y-%m-%d)
