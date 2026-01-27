import { Router } from 'express';
import multer from 'multer';
import { triggerParseForEraFile, getLatestBatchForEraFile, reviewRows, commitBatch } from '../controllers/eraParseController.js';
import { uploadEraFilesGlobal, listEraFilesGlobal, deleteEraFileGlobal, autoParseEraFile } from '../controllers/eraFileController.js';
import { createFileFilter, MAX_FILE_SIZES } from '../utils/fileSanitization.js';

const router = Router();

// Multer for global ERA PDF uploads (memory) - with enhanced sanitization
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { 
		fileSize: MAX_FILE_SIZES.pdf, // 25MB for PDFs
		files: 10, // Max 10 files at once
	},
	fileFilter: createFileFilter(['.pdf']),
});

// Global ERA files (not tied to a single claim)
router.post('/files', upload.array('eraPdfs', 10), uploadEraFilesGlobal);
router.get('/files', listEraFilesGlobal);
router.delete('/files/:id', deleteEraFileGlobal);

// GET /api/era/era-files/:id/parse/latest - latest batch with rows (MUST come before /parse)
router.get('/era-files/:id/parse/latest', getLatestBatchForEraFile);

// POST /api/era/era-files/:id/auto-parse - automatically parse PDF and create batch
router.post('/era-files/:id/auto-parse', (req, res) => {
  console.log('Auto-parse endpoint hit for file:', req.params.id);
  autoParseEraFile(req, res);
});

// POST /api/era/era-files/:id/parse - trigger parse or ingest parsed rows (manual JSON)
router.post('/era-files/:id/parse', triggerParseForEraFile);

// POST /api/era-parses/:batchId/review - mark rows reviewed/unreviewed
router.post('/era-parses/:batchId/review', reviewRows);

// POST /api/era-parses/:batchId/commit - commit reviewed rows to reimburse table
router.post('/era-parses/:batchId/commit', commitBatch);

export default router;
