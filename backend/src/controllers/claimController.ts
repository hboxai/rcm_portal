import { Request, Response } from 'express';
import pool, { query } from '../config/db.js';
// Source claims table now restricted to api_bil_claim_reimburse (env override optional for future but no legacy fallback)
const CLAIMS_TABLE = process.env.CLAIMS_TABLE || 'api_bil_claim_reimburse';
const CLAIM_HISTORY_TABLE = process.env.CLAIM_HISTORY_TABLE || 'upl_change_logs';
// NEW: Allow configurable primary key / unique identifier column for claims source table
// Many legacy / external tables may not have a generic "id" column. Set CLAIMS_ID_COLUMN
// (e.g. cpt_id, oa_claim_id, oa_visit_id, claim_number, etc.) and the code will alias it to id.
// If not provided we assume an "id" column already exists.
// Default to bil_claim_reimburse because that's the primary key
const CLAIMS_ID_COLUMN = process.env.CLAIMS_ID_COLUMN || 'bil_claim_reimburse';
import Claim from '../models/Claim.js';
import ChangeLog from '../models/ChangeLog.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url'; // Added for __dirname

// Added for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Request counter to track API usage
let requestCounter = 0;
// Cache to avoid repeated identical queries
const queryCache: Record<string, {
  data: any; 
  timestamp: number;
  ttl: number;
}> = {};

/**
 * Get claims with optional filtering
 * @route GET /api/claims
 */
export const getClaims = async (req: Request, res: Response) => {
  try {
    // Return two mock claims so the UI can render sample rows
    const mockClaims = [
      {
        // Row identity
        claimId: 'CLAIM-1001',
        id: 'CLAIM-1001',
        oa_claim_id: 'OA-CLM-1001',
        oa_visit_id: 'VIS-5001',
        claim_status: 'Pending',
        payor_status: 'Pending Review',
        payor_reference_id: 'PR-789001',

        // Patient
        patient_id: 'P-001',
        patient_emr_no: 'EMR-001',
        patientfirst: 'John',
        patientlast: 'Doe',
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '1985-03-14',

        // Facility / provider
        facilityname: 'Downtown Health Clinic',
        renderingprovidername: 'Dr. Alice Carter, MD',

        // Dates / service
        charge_dt: '2025-08-01',
        service_start: '2025-08-01',
        service_end: '2025-08-01',
        dos: '2025-08-01',

        // Insurance
        prim_ins: 'Medicare',
        prim_amt: 120.0,
        prim_post_dt: '2025-08-05',
        sec_ins: 'Blue Cross',
        sec_amt: 30.0,

        // Billing
        cpt_code: '99213',
        cpt_id: 99213,
        units: 1,
        total_amt: 250.0,
        charge_amt: 250.0,
        allowed_amt: 200.0,
        allowed_add_amt: 0.0,
        allowed_exp_amt: 0.0,
        sec_denial_code: null,
        prim_chk_det: 'CHK-1001-ABC'
      },
      {
        // Row identity
        claimId: 'CLAIM-1002',
        id: 'CLAIM-1002',
        oa_claim_id: 'OA-CLM-1002',
        oa_visit_id: 'VIS-5002',
        claim_status: 'Paid',
        payor_status: 'Paid',
        payor_reference_id: 'PR-789002',

        // Patient
        patient_id: 'P-002',
        patient_emr_no: 'EMR-002',
        patientfirst: 'Jane',
        patientlast: 'Smith',
        first_name: 'Jane',
        last_name: 'Smith',
        date_of_birth: '1990-11-02',

        // Facility / provider
        facilityname: 'Lakeside Medical Center',
        renderingprovidername: 'Dr. Brian Lee, DO',

        // Dates / service
        charge_dt: '2025-08-03',
        service_start: '2025-08-03',
        service_end: '2025-08-03',
        dos: '2025-08-03',

        // Insurance
        prim_ins: 'Aetna',
        prim_amt: 180.0,
        prim_post_dt: '2025-08-07',
        sec_ins: 'None',
        sec_amt: 0.0,

        // Billing
        cpt_code: '97014',
        cpt_id: 97014,
        units: 2,
        total_amt: 320.0,
        charge_amt: 320.0,
        allowed_amt: 300.0,
        allowed_add_amt: 10.0,
        allowed_exp_amt: 0.0,
        sec_denial_code: null,
        prim_chk_det: 'CHK-1002-XYZ'
      }
    ];

    return res.json({
      success: true,
      data: mockClaims,
      totalCount: mockClaims.length,
      page: 1,
      limit: mockClaims.length,
      totalPages: 1,
      message: 'Mock claims'
    });
  } catch (error: any) {
    console.error('Error in getClaims:', error);
    return res.status(500).json({
      success: false,
      message: 'Database tables unlinked',
      error: error.message
    });
  }
};

/**
 * Get claim by ID - Database tables unlinked
 * @route GET /api/claims/:id
 */
export const getClaimById = async (req: Request, res: Response) => {
  try {
    console.log('Claim details disabled: Database tables unlinked');
    return res.json({
      success: false,
      message: 'Claim details disabled: Database tables unlinked',
      data: null
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Database tables unlinked',
      error: error.message
    });
  }
};

/**
 * Update claim by ID - Database tables unlinked
 * @route PUT /api/claims/:id
 */
export const updateClaim = async (req: Request, res: Response) => {
  try {
    console.log('Claim updates disabled: Database tables unlinked');
    return res.json({
      success: false,
      message: 'Claim updates disabled: Database tables unlinked',
      data: null
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Database tables unlinked',
      error: error.message
    });
  }
};

/**
 * Delete claim by ID - Database tables unlinked
 * @route DELETE /api/claims/:id
 */
export const deleteClaim = async (req: Request, res: Response) => {
    // Database tables unlinked - claim deletion is disabled
    res.status(501).json({
        success: false,
        error: 'Claim deletion is disabled',
        message: 'Database tables have been unlinked from the search and submit files pages'
    });
};

/**
 * Get change history for a claim
 * @route GET /api/claims/:id/history
 */
export const getClaimHistory = async (req: Request, res: Response) => {
  try {
    requestCounter++;
    const requestId = requestCounter;
    const rawId = req.params.id;
    const id = (CLAIMS_ID_COLUMN === 'id' && /^\d+$/.test(rawId)) ? Number(rawId) : rawId;
    
    // Create cache key for this specific claim's history
    const cacheKey = `claim-history-${id}`;
    const now = Date.now();
    
    // Check if we have cached data for this claim's history (cache for 2 minutes)
    if (queryCache[cacheKey] && now - queryCache[cacheKey].timestamp < queryCache[cacheKey].ttl) {
      return res.status(200).json(queryCache[cacheKey].data);
    }
    
    try {
      // Check if the claim exists
      const claimCheckQuery = `SELECT ${CLAIMS_ID_COLUMN} AS id, cpt_id AS billing_id FROM ${CLAIMS_TABLE} WHERE ${CLAIMS_ID_COLUMN} = $1`;
      
      // Use our optimized query function
      const claimCheck = await query(claimCheckQuery, [id]);
      
      if (claimCheck.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Claim not found',
          message: `No claim found with ID: ${id}`
        });
        return;
      }
      
      const claim = claimCheck.rows[0];
      
      try {
        // Get change history for the claim
        const historyQuery = `
          SELECT id, claim_id, user_id, username, cpt_id AS billing_id, timestamp, field_name, old_value, new_value, action_type
          FROM upl_change_logs
          WHERE claim_id = $1
          ORDER BY timestamp DESC`;
        
        // Use our optimized query function
        const historyResult = await query(historyQuery, [id]);
        const rows = historyResult.rows;
        
        // Prepare result
        const result = {
          success: true,
          data: rows
        };
        
        // Cache the result with a TTL of 2 minutes (120 seconds)
        queryCache[cacheKey] = {
          data: result,
          timestamp: now,
          ttl: 120000 // 2 minutes
        };
        
        res.status(200).json(result);
      } catch (dbError: any) {
        // If the error is because the upl_change_logs table doesn't exist, return mock data
        if (dbError.code === '42P01') { // PostgreSQL code for "relation does not exist"
          console.log(`upl_change_logs table doesn't exist yet, returning mock data for claim ${id}`);
          
          // Generate mock data for the history
          const mockHistory = [
            {
              id: 1,
              claim_id: id,
              user_id: 1,
              username: 'System',
              billing_id: claim.billing_id,
              timestamp: new Date().toISOString(),
              field_name: 'claim_status',
              old_value: 'Pending',
              new_value: 'Posted',
              action_type: 'updated',
              first_name: claim.first_name,
              last_name: claim.last_name
            }
          ];
          
          // Prepare result with mock data
          const result = {
            success: true,
            data: mockHistory,
            mock: true
          };
          
          // Cache the mock result
          queryCache[cacheKey] = {
            data: result,
            timestamp: now,
            ttl: 120000 // 2 minutes
          };
          
          res.status(200).json(result);
        } else {
          throw dbError;
        }
      }
    } catch (error) {
      console.error(`Error fetching history for claim ${id}:`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve claim history',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } catch (outerError) {
    console.error(`Error in getClaimHistory for claim ${req.params.id}:`, outerError);
    res.status(500).json({
      success: false,
      error: 'Failed to process request',
      message: outerError instanceof Error ? outerError.message : 'Unknown error'
    });
  }
};

/**
 * Get all change history
 * @route GET /api/history
 */
export const getAllChangeHistory = async (req: Request, res: Response) => {
  try {
    requestCounter++;
    // const requestId = requestCounter; // Commented out as requestId is not used

    // User information from authMiddleware
    const loggedInUser = req.user as { id: number; role: string; email: string }; // Adjust type as per your JWT payload

    let userIdFromQuery = req.query.user_id ? parseInt(req.query.user_id as string) : undefined;
    const cptId = req.query.billing_id ? parseInt(req.query.billing_id as string) : undefined;
    const startDate = req.query.start_date ? req.query.start_date as string : undefined;
    const endDate = req.query.end_date ? req.query.end_date as string : undefined;
    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '20');
    const offset = (page - 1) * limit;

    // Build query conditions
    let conditions: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    // Role-based filtering for user_id
    if (loggedInUser.role === 'Admin') {
      if (userIdFromQuery) {
        conditions.push(`cl.user_id = $${paramIndex++}`);
        queryParams.push(userIdFromQuery);
      }
      // Admin can see all logs if no specific user_id is queried
    } else {
      // Non-admin users can only see their own logs
      conditions.push(`cl.user_id = $${paramIndex++}`);
      queryParams.push(loggedInUser.id);
      // Ignore any user_id passed in query by non-admin
      userIdFromQuery = loggedInUser.id; // For cache key consistency
    }

    if (cptId) {
      conditions.push(`cl.cpt_id = $${paramIndex++}`); // Assuming upl_change_logs has cpt_id
      queryParams.push(cptId);
    }

    if (startDate) {
      conditions.push(`cl.timestamp >= $${paramIndex++}`);
      queryParams.push(startDate);
    }

    if (endDate) {
      conditions.push(`cl.timestamp <= $${paramIndex++}`);
      queryParams.push(endDate);
    }
    
    // Create a cache key that reflects the actual user ID being filtered
    const effectiveUserIdForCache = loggedInUser.role === 'Admin' ? (userIdFromQuery || 'all') : loggedInUser.id;
    const cacheKey = `all-history-${effectiveUserIdForCache}-${cptId || 'all'}-${startDate || 'none'}-${endDate || 'none'}-${page}-${limit}`;
    const now = Date.now();
    
    // Check if we have cached data for this query (cache for 60 seconds)
    if (queryCache[cacheKey] && now - queryCache[cacheKey].timestamp < queryCache[cacheKey].ttl) {
      return res.status(200).json(queryCache[cacheKey].data);
    }

    try {
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count total records for pagination
      const countQuery = `SELECT COUNT(*) FROM upl_change_logs cl ${whereClause}`;
      
      // Use our optimized query function
      const countResult = await query(countQuery, queryParams);
      const totalCount = parseInt(countResult.rows[0].count);

      const historyQuery = `
        SELECT 
          cl.*,
          ubr.cpt_id AS billing_id
        FROM upl_change_logs cl
        LEFT JOIN ${CLAIMS_TABLE} ubr ON cl.claim_id = ubr.${CLAIMS_ID_COLUMN}
        ${whereClause}
        ORDER BY cl.timestamp DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;

      queryParams.push(limit, offset);
      
      // Use our optimized query function
      const historyResult = await query(historyQuery, queryParams);
      const rows = historyResult.rows;
      
      // Prepare result
      const result = {
        success: true,
        totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        data: rows
      };
      
      // Cache the result with a TTL of 60 seconds
      queryCache[cacheKey] = {
        data: result,
        timestamp: now,
        ttl: 60000 // 60 seconds
      };

      res.status(200).json(result);
    } catch (dbError: any) {
      // If the error is because the change_logs table doesn't exist, return mock data
      if (dbError.code === '42P01') { // PostgreSQL code for "relation does not exist"
        console.log(`upl_change_logs table doesn't exist yet, returning mock history data`);
        
        // Get some claims to generate mock history using our optimized query
        const claimsQuery = `SELECT id, cpt_id AS billing_id, first_name, last_name FROM ${CLAIMS_TABLE} LIMIT 5`;
        const claimsResult = await query(claimsQuery, []);
        const claims = claimsResult.rows;
        
        // Generate mock history data based on existing claims
        const mockHistory = claims.flatMap((claim: any, index: any) => {
          const date = new Date();
          date.setDate(date.getDate() - index); // Different days for variety
          
          return [
            {
              id: index * 2 + 1,
              claim_id: claim.id,
              user_id: userIdFromQuery || 1,
              username: 'System',
              billing_id: claim.billing_id,
              timestamp: date.toISOString(),
              field_name: 'claim_status',
              old_value: 'Pending',
              new_value: 'Posted',
              action_type: 'updated',
              cpt_code: `CPT${claim.id}`,
              first_name: claim.first_name,
              last_name: claim.last_name
            },
            {
              id: index * 2 + 2,
              claim_id: claim.id,
              user_id: userIdFromQuery || 1,
              username: 'System',
              billing_id: claim.billing_id,
              timestamp: new Date(date.setHours(date.getHours() - 2)).toISOString(),
              field_name: 'prim_ins',
              old_value: null,
              new_value: 'Medicare',
              action_type: 'updated',
              cpt_code: `CPT${claim.id}`,
              first_name: claim.first_name,
              last_name: claim.last_name
            }
          ];
        });
        
        // Apply any filters that were requested
        let filteredHistory = [...mockHistory];
        
        // Apply role-based filtering for mock data as well
        if (loggedInUser.role !== 'Admin') {
          filteredHistory = filteredHistory.filter(h => h.user_id === loggedInUser.id);
        } else if (userIdFromQuery) { // Admin querying a specific user
          filteredHistory = filteredHistory.filter(h => h.user_id === userIdFromQuery);
        }
        
        if (cptId) {
          filteredHistory = filteredHistory.filter(h => h.billing_id === cptId);
        }
        
        // Apply pagination
        const totalCount = filteredHistory.length;
        const paginatedHistory = filteredHistory.slice(offset, offset + limit);
        
        // Prepare result with mock data
        const mockResult = {
          success: true,
          totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
          data: paginatedHistory,
          mock: true
        };
        
        // Cache the mock result
        queryCache[cacheKey] = {
          data: mockResult,
          timestamp: now,
          ttl: 60000 // 60 seconds
        };
        
        res.status(200).json(mockResult);
      } else {
        // Rethrow if it's not the "relation does not exist" error
        throw dbError;
      }
    }
  } catch (error) {
    console.error('Error fetching change history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve change history',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// ERA PDF Management
const UPLOAD_DIR = path.resolve(__dirname, '..', '..', 'uploads', 'era_pdfs');

interface EraPdfInfo { // Define an interface for the objects in currentFiles
  id: string;
  claim_id: string;
  filename: string;
  url: string;
  uploaded_at: string;
}

export const uploadEraPdfs = async (req: Request, res: Response) => {
  const claimId = req.params.id;
  // Correctly type req.files using Express.Multer.File[]
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    return res.status(400).json({ success: false, message: 'No files uploaded.' });
  }

  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const uploadedPdfData = files.map(file => ({
      filename: file.filename, // Name given by multer
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: `/uploads/era_pdfs/${file.filename}` // Relative URL for frontend access
    }));

    // TODO: Database Integration - Save metadata for each file in uploadedPdfData

    console.log(`Uploaded ERA PDFs for claim ${claimId} to ${UPLOAD_DIR}:`, uploadedPdfData);

    // For now, return the file info. Later, this should come from the DB.
    const mockEraPdfsFromDb = uploadedPdfData.map((pdf, index) => ({
      id: `mock-${Date.now()}-${index}`, 
      claim_id: claimId,
      filename: pdf.filename,
      url: pdf.url,
      uploaded_at: new Date().toISOString()
    }));

    res.status(201).json({ 
      success: true, 
      message: 'ERA PDFs uploaded successfully.', 
      data: mockEraPdfsFromDb
    });

  } catch (error) {
    console.error(`Error uploading ERA PDFs for claim ${claimId}:`, error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to upload ERA PDFs.', 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
};

export const getEraPdfsForClaim = async (req: Request, res: Response) => {
  const claimId = req.params.id;

  try {
    // TODO: Database Integration - Query 'era_pdfs' table for claimId.
    const currentFiles: EraPdfInfo[] = []; // Initialize with the defined interface
    if (fs.existsSync(UPLOAD_DIR)) {
        const filesInDir = fs.readdirSync(UPLOAD_DIR);
        // This is a very rough mock. In reality, you'd filter by claimId from DB.
        // And the 'id' would be the database ID.
        filesInDir.forEach((file, index) => {
            // For now, we assume all files in the directory might be related if no DB.
            // A real implementation MUST fetch from DB based on claimId.
            currentFiles.push({
                id: `disk-${index}-${file.substring(0,5)}-${Date.now()}`, 
                claim_id: claimId, 
                filename: file,
                url: `/uploads/era_pdfs/${file}`,
                uploaded_at: fs.existsSync(path.join(UPLOAD_DIR, file)) ? 
                             new Date(fs.statSync(path.join(UPLOAD_DIR, file)).mtime).toISOString() : 
                             new Date().toISOString()
            });
        });
    }

    res.status(200).json({ 
      success: true, 
      data: currentFiles 
    });

  } catch (error) {
    console.error(`Error fetching ERA PDFs for claim ${claimId}:`, error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch ERA PDFs.', 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
};

export const deleteEraPdf = async (req: Request, res: Response) => {
  const claimId = req.params.id;
  const pdfId = req.params.pdfId; // This will be the filename for now, later DB ID

  try {
    // TODO: Database Integration

    const filenameToDelete = pdfId; // Assuming pdfId is the filename for mock
    const filePathToDelete = path.join(UPLOAD_DIR, filenameToDelete);

    if (fs.existsSync(filePathToDelete)) {
      fs.unlinkSync(filePathToDelete);
      console.log(`Deleted ERA PDF file: ${filePathToDelete} for claim ${claimId}`);
      
      res.status(200).json({ 
        success: true, 
        message: 'ERA PDF deleted successfully.' 
      });
    } else {
      console.warn(`ERA PDF file not found for deletion: ${filePathToDelete}`);
      res.status(404).json({ 
        success: false, 
        message: 'ERA PDF not found or already deleted.' 
      });
    }

  } catch (error) {
    console.error(`Error deleting ERA PDF ${pdfId} for claim ${claimId}:`, error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete ERA PDF.', 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
};

// Add explicit 'any' types to fix TS7006
const processClaim = (claim: any, index: any) => {
  // ...existing code...
};