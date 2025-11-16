import { Request, Response } from 'express';
import pool, { query } from '../config/db.js';
// Source claims table now restricted to api_bil_claim_reimburse (env override optional for future but no legacy fallback)
const CLAIMS_TABLE = process.env.CLAIMS_TABLE || 'api_bil_claim_reimburse';
const CLAIM_HISTORY_TABLE = process.env.CLAIM_HISTORY_TABLE || 'upl_change_logs';
// NEW: Allow configurable primary key / unique identifier column for claims source table
// Many legacy / external tables may not have a generic "id" column. Set CLAIMS_ID_COLUMN
// (e.g. cpt_id, oa_claim_id, oa_visit_id, claim_number, etc.) and the code will alias it to id.
// If not provided we assume an "id" column already exists.
// Default to the primary key column name on reimburse table
const CLAIMS_ID_COLUMN = process.env.CLAIMS_ID_COLUMN || 'bil_claim_reimburse_id';
import Claim from '../models/Claim.js';
import ChangeLog from '../models/ChangeLog.js';
import fs from 'fs';
import path from 'path';
import { uploadToS3, getPresignedGetUrl, deleteFromS3 } from '../services/s3.js';
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
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '10'), 10) || 10));
    const offset = (page - 1) * limit;

    // Filters from query
    const patient_id = req.query.patient_id ? String(req.query.patient_id) : undefined;
    const prim_ins = req.query.prim_ins ? String(req.query.prim_ins) : undefined;
  const cpt_code = req.query.cpt_code ? String(req.query.cpt_code) : undefined; // maps to cpt_id
    const dos = req.query.dos ? String(req.query.dos) : undefined; // maps to charge_dt
    const upload_id = req.query.upload_id ? String(req.query.upload_id) : undefined;
  const billingId = req.query.billingId ? String(req.query.billingId) : undefined; // maps to submit_claim_id

    const conditions: string[] = [];
    const params: any[] = [];
    let i = 1;
    if (patient_id) { conditions.push(`patient_id = $${i++}`); params.push(patient_id); }
    if (prim_ins)   { conditions.push(`prim_ins ILIKE $${i++}`); params.push(`%${prim_ins}%`); }
    if (cpt_code)   { conditions.push(`cpt_id::text = $${i++}`); params.push(cpt_code.trim()); }
    if (dos)        { conditions.push(`charge_dt = $${i++}::date`); params.push(dos); }
  if (upload_id)  { conditions.push(`upload_id = $${i++}`); params.push(upload_id); }
  if (billingId)  { conditions.push(`submit_claim_id::text = $${i++}`); params.push(billingId.trim()); }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const baseSelect = `
      SELECT 
        r.bil_claim_reimburse_id AS id,
        r.submit_claim_id   AS billing_id,
        r.upload_id,
        r.patient_id,
        r.cpt_id::text          AS cpt_code,
        r.charge_dt,
        r.charge_amt,
        r.allowed_amt,
        r.allowed_add_amt,
        r.allowed_exp_amt,
        r.total_amt,
        r.write_off_amt,
        r.bal_amt,
        r.reimb_pct,
        r.claim_status,
        r.claim_status_type,
        r.prim_ins,
        r.prim_amt,
        r.prim_post_dt,
        r.prim_chk_det,
        r.prim_recv_dt,
        r.prim_chk_amt,
        r.prim_cmt,
        r.sec_ins,
        r.sec_amt,
        r.sec_post_dt,
        r.sec_chk_det,
        r.sec_recv_dt,
        r.sec_chk_amt,
        r.sec_cmt,
        r.sec_denial_code,
        r.pat_amt,
        r.pat_recv_dt,
        -- Enrichments from submit table
        s.patientfirst AS first_name,
        s.patientlast  AS last_name,
        (s.patientfirst || ' ' || s.patientlast) AS patientname,
        s.facilityname,
        s.facilityname AS clinicname,
        s.oa_claimid,
        s.payor_reference_id
      FROM ${CLAIMS_TABLE} r
      LEFT JOIN api_bil_claim_submit s ON s.claim_id = r.submit_claim_id
      ${whereSql ? whereSql.replace(/\b(\w+)\b/g, (m) => {
        const cols = ['patient_id','prim_ins','cpt_id','charge_dt','upload_id','submit_claim_id'];
        return cols.includes(m) ? `r.${m}` : m;
      }) : ''}
      ORDER BY r.bil_claim_reimburse_id DESC
      LIMIT $${i} OFFSET $${i + 1}
    `;
    const [rows, count] = await Promise.all([
      query(baseSelect, [...params, limit, offset]),
      query(
        `SELECT COUNT(*)::int AS n 
         FROM ${CLAIMS_TABLE} r 
         LEFT JOIN api_bil_claim_submit s ON s.claim_id = r.submit_claim_id 
         ${whereSql ? whereSql.replace(/\b(\w+)\b/g, (m) => {
           const cols = ['patient_id','prim_ins','cpt_id','charge_dt','upload_id','submit_claim_id'];
           return cols.includes(m) ? `r.${m}` : m;
         }) : ''}
        `,
        params
      )
    ]);

    return res.json({
      success: true,
      data: rows.rows,
      totalCount: count.rows[0]?.n || 0,
      page,
      limit,
      totalPages: Math.ceil((count.rows[0]?.n || 0) / limit)
    });
  } catch (error: any) {
    console.error('Error in getClaims:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch claims',
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
    const rawId = req.params.id;
    const id = /^\d+$/.test(rawId) ? Number(rawId) : rawId;
    const sql = `
      SELECT 
        r.bil_claim_reimburse_id AS id,
        r.submit_claim_id   AS billing_id,
        r.upload_id,
        r.patient_id,
        r.cpt_id::text          AS cpt_code,
        r.charge_dt,
        r.charge_amt,
        r.allowed_amt,
        r.allowed_add_amt,
        r.allowed_exp_amt,
        r.total_amt,
        r.write_off_amt,
        r.bal_amt,
        r.reimb_pct,
        r.claim_status,
        r.claim_status_type,
        r.prim_ins,
        r.prim_amt,
        r.prim_post_dt,
        r.prim_chk_det,
        r.prim_recv_dt,
        r.prim_chk_amt,
        r.prim_cmt,
        r.sec_ins,
        r.sec_amt,
        r.sec_post_dt,
        r.sec_chk_det,
        r.sec_recv_dt,
        r.sec_chk_amt,
        r.sec_cmt,
        r.sec_denial_code,
        r.pat_amt,
        r.pat_recv_dt,
        -- Enrichments from submit table
        s.patientfirst AS first_name,
        s.patientlast  AS last_name,
        (s.patientfirst || ' ' || s.patientlast) AS patientname,
        s.facilityname,
        s.facilityname AS clinicname,
        s.oa_claimid,
        s.payor_reference_id
      FROM ${CLAIMS_TABLE} r
      LEFT JOIN api_bil_claim_submit s ON s.claim_id = r.submit_claim_id
      WHERE r.${CLAIMS_ID_COLUMN} = $1
    `;
    const r = await query(sql, [id]);
    if (!r.rowCount) return res.status(404).json({ success: false, message: 'Not found', data: null });
    return res.json({ success: true, data: r.rows[0] });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch claim',
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
    const rawId = req.params.id;
    const id = /^\d+$/.test(rawId) ? Number(rawId) : rawId;
    const allowed = [
      'allowed_amt','allowed_add_amt','allowed_exp_amt','prim_ins','prim_amt','prim_post_dt','prim_chk_det','prim_recv_dt','prim_chk_amt','prim_cmt',
      'sec_ins','sec_amt','sec_post_dt','sec_chk_det','sec_recv_dt','sec_chk_amt','sec_cmt','sec_denial_code','pat_amt','pat_recv_dt','total_amt','write_off_amt','bal_amt','reimb_pct','claim_status','claim_status_type','payor_reference_id','claim_id'
    ];
    const fields = Object.fromEntries(Object.entries(req.body || {}).filter(([k]) => allowed.includes(k)));
    if (Object.keys(fields).length === 0) return res.status(400).json({ success: false, message: 'No updatable fields provided' });
    const cols = Object.keys(fields);
    const vals = Object.values(fields);
    const setSql = cols.map((c, i) => `${c}=$${i + 1}`).join(',');
    const sql = `UPDATE ${CLAIMS_TABLE} SET ${setSql}, updated_at=NOW() WHERE ${CLAIMS_ID_COLUMN}=$${cols.length + 1} RETURNING *`;
    const r = await query(sql, [...vals, id]);
    if (!r.rowCount) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, data: r.rows[0] });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update claim',
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

    // User information from authMiddleware
    const loggedInUser = req.user as { id: number; role: string; email: string };

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

    // Note: user_id column was removed in migration 025
    // History is now filtered by upload_id or username if needed

    if (cptId) {
      conditions.push(`cl.cpt_id = $${paramIndex++}`);
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
    
    const cacheKey = `all-history-${cptId || 'all'}-${startDate || 'none'}-${endDate || 'none'}-${page}-${limit}`;
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

// Add explicit 'any' types to fix TS7006
const processClaim = (claim: any, index: any) => {
  // ...existing code...
};