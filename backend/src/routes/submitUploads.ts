import express from 'express';
import multer from 'multer';
import os from 'os';
import path from 'path';
import { authMiddleware, authorizeRole } from '../middleware/auth.js';
import { previewSubmitUpload } from '../controllers/submitUploadPreviewController.js';
import { commitSubmitUpload } from '../controllers/submitUploadCommitController.js';
import { downloadSubmitTemplate } from '../controllers/submitUploadTemplateController.js';
import { listSubmitUploads, getSubmitUploadDownloadUrl, getClaimsBySubmitUpload, serverPreviewFromS3, getAllSubmitClaims, getSubmitClaimById, getSubmitUploadDeleteImpact, processSubmitUploadEndpoint, getClaimChangeHistory, getUploadChangeLog } from '../controllers/submitUploadsController.js';
import { cancelSubmitUpload } from '../controllers/submitUploadCancelController.js';
import { deleteSubmitUpload } from '../controllers/submitUploadDeleteController.js';
import { sanitizeFilename, createFileFilter, MAX_FILE_SIZES } from '../utils/fileSanitization.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(os.tmpdir())),
  filename: (req, file, cb) => {
    // Sanitize the filename before saving
    const sanitized = sanitizeFilename(file.originalname);
    cb(null, `${Date.now()}-${sanitized}`);
  }
});
const upload = multer({ 
  storage,
  limits: { 
    fileSize: MAX_FILE_SIZES.spreadsheet, // 50MB max for spreadsheets
    files: 1,
  },
  fileFilter: createFileFilter(['.xlsx', '.xls', '.csv']),
});

// Template download (no auth required for easy access)
router.get('/template', downloadSubmitTemplate);

router.post('/preview', authMiddleware, upload.single('file'), previewSubmitUpload);
router.post('/commit', authMiddleware, express.json(), commitSubmitUpload);
router.post('/cancel', authMiddleware, express.json(), cancelSubmitUpload);
router.get('/', authMiddleware, listSubmitUploads);
// Lightweight progress polling for UI
router.get('/:upload_id/progress', authMiddleware, async (req, res) => {
  try {
    const { upload_id } = req.params as { upload_id: string };
    const r = await (await import('../config/db.js')).default.query(
      `SELECT status, row_count, message, processing_completed_at FROM rcm_file_uploads WHERE upload_id=$1 LIMIT 1`,
      [upload_id]
    );
    if (!r.rowCount) return res.status(404).json({ error: 'Not found' });
    const { status, row_count, message, processing_completed_at } = r.rows[0];
    // Try to parse percentage from message
    let percent: number | null = null;
    const m = typeof message === 'string' ? message.match(/\((\d+)%\)/) : null;
    if (m) percent = parseInt(m[1], 10);
    return res.json({ status, row_count, message, percent, done: !!processing_completed_at });
  } catch (err: any) {
    console.error('progress poll error', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
});
// New: list claims across all submit uploads
router.get('/claims', authMiddleware, getAllSubmitClaims);
router.get('/claims/:id', authMiddleware, getSubmitClaimById);
// New: Get claim change history
router.get('/claims/:claim_id/history', authMiddleware, getClaimChangeHistory);
router.get('/:upload_id/claims', authMiddleware, getClaimsBySubmitUpload);
router.get('/:upload_id/preview', authMiddleware, serverPreviewFromS3);
router.get('/:upload_id/download-url', authMiddleware, getSubmitUploadDownloadUrl);
// Impact counts to show in delete confirmation
router.get('/:upload_id/delete-impact', authMiddleware, getSubmitUploadDeleteImpact);
// New: Process upload (parse Excel, detect duplicates, update/insert claims)
router.post('/:upload_id/process', authMiddleware, processSubmitUploadEndpoint);
// New: Get change log for an upload
router.get('/:upload_id/changes', authMiddleware, getUploadChangeLog);
// Admin-only hard delete
router.delete('/:upload_id', authMiddleware, authorizeRole(['Admin']), deleteSubmitUpload);

export default router;
