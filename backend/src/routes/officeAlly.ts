import express from 'express';
import multer from 'multer';
import { uploadOfficeAllyStatus } from '../controllers/officeAllyStatusController.js';

const router = express.Router();

// Use memory storage for file upload (no need to save to disk)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    const ok = ext.endsWith('.xlsx') || ext.endsWith('.xls') || ext.endsWith('.csv');
    if (ok) return cb(null, true);
    cb(new Error('Only .xlsx, .xls, .csv files are allowed'));
  }
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
