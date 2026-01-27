import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { uploadFile, listUploads, getClaimsByUpload, deleteUpload, getValidationReport, downloadUploadFile, getUploadById, getUploadPreview, getMappingInfo } from '../controllers/uploadController.js';
import { getSubmitUploadDownloadUrl } from '../controllers/submitUploadsController.js';
import { sanitizeFilename, createFileFilter, MAX_FILE_SIZES } from '../utils/fileSanitization.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', '..', 'uploads', 'excel');
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Sanitize the filename before saving
    const sanitized = sanitizeFilename(file.originalname);
    cb(null, `${Date.now()}-${sanitized}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZES.spreadsheet, // 50MB max
    files: 1, // Only one file at a time
  },
  fileFilter: createFileFilter(['.xlsx', '.xls', '.csv']),
});

// Wrap multer to surface validation/parsing errors as JSON
router.post('/', (req, res) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      const msg = err?.message || 'Upload failed';
      return res.status(400).json({ status: 'error', message: msg });
    }
    // Delegate to controller
    // @ts-ignore
    return uploadFile(req as any, res as any);
  });
});
router.get('/', listUploads);
router.get('/mapping-info', getMappingInfo);
router.get('/:id', getUploadById);
router.get('/:id/claims', getClaimsByUpload);
router.delete('/:id', deleteUpload);
router.get('/:id/validation', getValidationReport);
router.get('/:id/preview', getUploadPreview);
// New: presigned URL for audit uploads (rcm_file_uploads)
router.get('/:upload_id/download-url', getSubmitUploadDownloadUrl);
router.get('/:id/download', downloadUploadFile);

export default router;
