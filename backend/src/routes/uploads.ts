import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { uploadFile, listUploads, getClaimsByUpload, deleteUpload, getValidationReport, downloadUploadFile, getUploadById, getUploadPreview, getMappingInfo } from '../controllers/uploadController.js';
import { getSubmitUploadDownloadUrl } from '../controllers/submitUploadsController.js';

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
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const ok = ['.xlsx', '.xls', '.csv'].includes(ext);
    if (ok) return cb(null, true);
    cb(new Error('Only .xlsx, .xls, .csv files are allowed'));
  }
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
