import express from 'express';
import multer from 'multer';
import { uploadOfficeAllyStatus } from '../controllers/officeAllyStatusController.js';
import { createFileFilter, MAX_FILE_SIZES } from '../utils/fileSanitization.js';

const router = express.Router();

// Use memory storage for file upload - with enhanced sanitization
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZES.spreadsheet, // 50MB max for spreadsheets
    files: 1,
  },
  fileFilter: createFileFilter(['.xlsx', '.xls', '.csv']),
});

/**
 * POST /api/office-ally/status-upload
 * Upload Office Ally status file to update claim statuses
 */
router.post('/status-upload', (req, res) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      const msg = err?.message || 'Upload failed';
      return res.status(400).json({ error: msg });
    }
    // Delegate to controller
    return uploadOfficeAllyStatus(req as any, res as any);
  });
});

export default router;
