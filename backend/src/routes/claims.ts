import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url'; // Added for __dirname

// Added for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { 
  getClaims, 
  getClaimById, 
  updateClaim, 
  getClaimHistory,
  getAllChangeHistory,
  uploadEraPdfs, // New import
  getEraPdfsForClaim, // New import
  deleteEraPdf // New import
} from '../controllers/claimController.js';
import { authMiddleware } from '../middleware/auth.js'; // Added import

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '..', '..', 'uploads', 'era_pdfs'); // Adjust __dirname if using ES modules and it's not defined
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`); // Simple unique filename
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'));
    }
  }
});

// GET all claims with optional filtering
router.get('/', getClaims); // Consider adding authMiddleware here if all claims data needs protection

// GET claim by ID
router.get('/:id', authMiddleware, getClaimById); // Added authMiddleware for individual claim access

// PUT update claim
router.put('/:id', authMiddleware, updateClaim); // Added authMiddleware, user info is used in updateClaim

// GET claim history by ID
router.get('/:id/history', authMiddleware, getClaimHistory); // Added authMiddleware

// GET all change history (with optional filters)
router.get('/history/all', authMiddleware, getAllChangeHistory); // Added authMiddleware

// ERA PDF Routes
router.post('/:id/era-pdfs', authMiddleware, upload.array('eraPdfs', 5), uploadEraPdfs); // Max 5 PDFs at a time
router.get('/:id/era-pdfs', authMiddleware, getEraPdfsForClaim);
router.delete('/:id/era-pdfs/:pdfId', authMiddleware, deleteEraPdf);

// POST new claim
router.post('/', (req, res) => {
  try {
    const newClaim = req.body;
    
    // This will be replaced with actual database insert later
    res.status(201).json({
      status: 'success',
      message: 'Claim created successfully',
      data: { claim: newClaim }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to create claim',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// DELETE claim
router.delete('/:id', (req, res) => {
  try {
    const id = req.params.id;
    
    // This will be replaced with actual database delete later
    res.status(200).json({
      status: 'success',
      message: `Claim with id ${id} deleted successfully`
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete claim',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;