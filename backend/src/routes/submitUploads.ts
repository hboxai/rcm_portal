import express from 'express';
import multer from 'multer';
import os from 'os';
import path from 'path';
import { authMiddleware } from '../middleware/auth.js';
import { previewSubmitUpload } from '../controllers/submitUploadPreviewController.js';
import { commitSubmitUpload } from '../controllers/submitUploadCommitController.js';
import { listSubmitUploads, getSubmitUploadDownloadUrl, getClaimsBySubmitUpload, serverPreviewFromS3, getAllSubmitClaims } from '../controllers/submitUploadsController.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(os.tmpdir())),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

router.post('/preview', authMiddleware, upload.single('file'), previewSubmitUpload);
router.post('/commit', authMiddleware, express.json(), commitSubmitUpload);
router.get('/', authMiddleware, listSubmitUploads);
// New: list claims across all submit uploads
router.get('/claims', authMiddleware, getAllSubmitClaims);
router.get('/:upload_id/claims', authMiddleware, getClaimsBySubmitUpload);
router.get('/:upload_id/preview', authMiddleware, serverPreviewFromS3);
router.get('/:upload_id/download-url', authMiddleware, getSubmitUploadDownloadUrl);

export default router;
