import { Request, Response } from 'express';
import pool, { query } from '../config/db.js';
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
    requestCounter++;
    const requestId = requestCounter;

    const shouldLog = requestId % 5 === 0;
    if (shouldLog) {
      console.log(`[Request #${requestId}] GET /api/claims received with query params:`, req.query);
    }

    // Extract query parameters
    const patientId = req.query.patient_id ? String(req.query.patient_id) : undefined;
    const billingId = req.query.billingId ? String(req.query.billingId) : undefined;
    const dos = req.query.dos ? String(req.query.dos) : undefined;
    const firstName = req.query.first_name as string | undefined;
    const lastName = req.query.last_name as string | undefined;
    const payerName = req.query.prim_ins as string | undefined;
    const dateOfBirth = req.query.date_of_birth as string | undefined;
    const cptCode = req.query.cpt_code as string | undefined;

    // Pagination parameters
    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '10'); // Default limit to 10 if not provided
    const offset = (page - 1) * limit;

    if (shouldLog) {
      console.log(`[Request #${requestId}] Query params received:`, req.query);
      if (cptCode) {
        console.log(`[Request #${requestId}] CPT code filter received:`, cptCode);
      }
      if (billingId) {
        console.log(`[Request #${requestId}] Billing ID filter received:`, billingId);
      }
    }

    // Build query components
    let selectQuery = `
      SELECT
        id, patient_id, patient_emr_no, cpt_id AS billing_id, cpt_code, 
        first_name, last_name, date_of_birth, service_start, service_end,
        icd_code, provider_name, units, oa_claim_id, oa_visit_id,
        charge_dt, charge_amt, allowed_amt, allowed_add_amt, allowed_exp_amt,
        total_amt, charges_adj_amt, write_off_amt, bal_amt, reimb_pct,
        claim_status, claim_status_type, prim_ins, prim_amt, prim_post_dt,
        prim_chk_det, prim_recv_dt, prim_chk_amt, prim_cmt, sec_ins,
        sec_amt, sec_post_dt, sec_chk_det, sec_recv_dt, sec_chk_amt, sec_cmt,
        pat_amt, pat_recv_dt
      FROM upl_billing_reimburse`;
    
    const countQuery = `SELECT COUNT(*) FROM upl_billing_reimburse`;

    const queryParams: any[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    // Add filters if provided
    if (patientId) {
      conditions.push(`patient_id::text LIKE $${paramIndex++}`);
      queryParams.push(`%${patientId}%`);
    }

    if (billingId) {
      // Search in multiple possible ID fields to be flexible
      conditions.push(`(
        oa_visit_id::text LIKE $${paramIndex} OR 
        cpt_id::text LIKE $${paramIndex} OR 
        oa_claim_id::text LIKE $${paramIndex}
      )`);
      queryParams.push(`%${billingId}%`);
      paramIndex++;
    }

    if (dos) {
      // Support multiple date formats and partial date matching
      conditions.push(`(
        service_start::text LIKE $${paramIndex} OR 
        service_end::text LIKE $${paramIndex} OR
        charge_dt::text LIKE $${paramIndex}
      )`);
      queryParams.push(`%${dos}%`);
      paramIndex++;
    }

    if (firstName) {
      conditions.push(`LOWER(first_name) LIKE LOWER($${paramIndex++})`);
      queryParams.push(`%${firstName}%`);
    }

    if (lastName) {
      conditions.push(`LOWER(last_name) LIKE LOWER($${paramIndex++})`);
      queryParams.push(`%${lastName}%`);
    }

    if (payerName) {
      conditions.push(`LOWER(prim_ins) LIKE LOWER($${paramIndex++})`);
      queryParams.push(`%${payerName}%`);
    }

    if (dateOfBirth) {
      // Support multiple date formats and partial matching
      conditions.push(`date_of_birth::text LIKE $${paramIndex++}`);
      queryParams.push(`%${dateOfBirth}%`);
    }

    if (cptCode) {
      conditions.push(`cpt_code::text LIKE $${paramIndex++}`); // Remove LOWER(), cast to text
      queryParams.push(`%${cptCode}%`);
    }

    let whereClause = '';
    if (conditions.length > 0) {
      whereClause = ' WHERE ' + conditions.join(' AND ');
    }

    const fullCountQuery = countQuery + whereClause;
    let fullSelectQuery = selectQuery + whereClause;

    // Sort by most recent service date with nulls last
    fullSelectQuery += ' ORDER BY service_end DESC NULLS LAST';

    // Add LIMIT and OFFSET for pagination
    fullSelectQuery += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    const selectQueryParams = [...queryParams, limit, offset];

    // Create a cache key based on the query and params
    const cacheKey = JSON.stringify({ sql: fullSelectQuery, params: selectQueryParams, countSql: fullCountQuery, countParams: queryParams });
    const now = Date.now();
    
    if (queryCache[cacheKey] && now - queryCache[cacheKey].timestamp < queryCache[cacheKey].ttl) {
      if (shouldLog) console.log(`[Request #${requestId}] Using cached result for claims query`);
      return res.status(200).json(queryCache[cacheKey].data);
    }

    if (shouldLog) {
      console.log(`[Request #${requestId}] Executing SQL query:`, fullSelectQuery.replace(/\s+/g, ' '));
      console.log(`[Request #${requestId}] With parameters:`, selectQueryParams);
      console.log(`[Request #${requestId}] Executing count query:`, fullCountQuery.replace(/\s+/g, ' '));
      console.log(`[Request #${requestId}] With parameters:`, queryParams);
    }

    try {
      // Execute count query
      const countResult = await query(fullCountQuery, queryParams);
      const totalCount = parseInt(countResult.rows[0].count);

      // Execute select query for paginated data
      const { rows } = await query(fullSelectQuery, selectQueryParams);
      
      if (shouldLog) console.log(`[Request #${requestId}] Query returned ${rows.length} claims out of ${totalCount} total`);
      
      const result = {
        success: true,
        totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        data: rows
      };
      
      queryCache[cacheKey] = {
        data: result,
        timestamp: now,
        ttl: 30000 // 30 seconds
      };
      
      return res.status(200).json(result);
    } catch (dbError) {
      console.error(`[Request #${requestId}] Database query error:`, dbError);
      
      // Return a detailed error for debugging
      return res.status(500).json({
        success: false,
        error: 'Database query failed',
        message: dbError instanceof Error ? dbError.message : 'Unknown database error'
      });
    }
  } catch (error) {
    console.error('Error fetching claims:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve claims',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get claim by ID
 * @route GET /api/claims/:id
 */
export const getClaimById = async (req: Request, res: Response) => {
  try {
    requestCounter++;
    const requestId = requestCounter;
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: 'Invalid ID format',
        message: 'The ID must be a number'
      });
      return;
    }
    
    // Create cache key for this specific claim
    const cacheKey = `claim-${id}`;
    const now = Date.now();
    
    // Check if we have cached data for this claim (cache for 60 seconds)
    if (queryCache[cacheKey] && now - queryCache[cacheKey].timestamp < queryCache[cacheKey].ttl) {
      return res.status(200).json(queryCache[cacheKey].data);
    }
    
    // Query to get full claim details by ID
    const sqlQuery = `
      SELECT
        id, patient_id, patient_emr_no, cpt_id AS billing_id, cpt_code, 
        first_name, last_name, date_of_birth, service_start, service_end,
        icd_code, provider_name, units, oa_claim_id, oa_visit_id,
        charge_dt, charge_amt, allowed_amt, allowed_add_amt, allowed_exp_amt,
        total_amt, charges_adj_amt, write_off_amt, bal_amt, reimb_pct,
        claim_status, claim_status_type, prim_ins, prim_amt, prim_post_dt,
        prim_chk_det, prim_recv_dt, prim_chk_amt, prim_cmt, sec_ins,
        sec_amt, sec_post_dt, sec_chk_det, sec_recv_dt, sec_chk_amt, sec_cmt,
        pat_amt, pat_recv_dt
      FROM upl_billing_reimburse
      WHERE id = $1`;
    
    // Use our optimized query function
    const { rows } = await query(sqlQuery, [id]);
    
    if (rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Claim not found',
        message: `No claim found with ID: ${id}`
      });
      return;
    }
    
    // Prepare response
    const result = {
      success: true,
      data: rows[0]
    };
    
    // Cache the result with a TTL of 60 seconds
    queryCache[cacheKey] = {
      data: result,
      timestamp: now,
      ttl: 60000 // 60 seconds
    };
    
    // Return the claim
    res.status(200).json(result);
  } catch (error) {
    console.error(`Error fetching claim with ID ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve claim',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Update claim by ID
 * @route PUT /api/claims/:id
 */
export const updateClaim = async (req: Request, res: Response) => {
  try {
    requestCounter++;
    const requestId = requestCounter;
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: 'Invalid ID format',
        message: 'The ID must be a number'
      });
      return;
    }

    // Get the current claim to check if it exists and to compare old values
    const checkQuery = `
      SELECT 
        id, patient_id, patient_emr_no, cpt_id AS billing_id, cpt_code, 
        first_name, last_name, date_of_birth, service_start, service_end,
        icd_code, provider_name, units, oa_claim_id, oa_visit_id,
        charge_dt, charge_amt, allowed_amt, allowed_add_amt, allowed_exp_amt,
        total_amt, charges_adj_amt, write_off_amt, bal_amt, reimb_pct,
        claim_status, claim_status_type, prim_ins, prim_amt, prim_post_dt,
        prim_chk_det, prim_recv_dt, prim_chk_amt, prim_cmt, sec_ins,
        sec_amt, sec_post_dt, sec_chk_det, sec_recv_dt, sec_chk_amt, sec_cmt,
        pat_amt, pat_recv_dt 
      FROM upl_billing_reimburse WHERE id = $1`;
    const checkResult = await query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Claim not found',
        message: `No claim found with ID: ${id}`
      });
      return;
    }

    const oldClaim = checkResult.rows[0];

    // Get the request body
    const updateData = req.body;
    
    // Build the SET part of the query dynamically
    const allowedFields = [
      'oa_claim_id', 'oa_visit_id', 'charge_dt', 
      'charge_amt', 'allowed_amt', 'allowed_add_amt', 'allowed_exp_amt',
      'prim_ins', 'prim_amt', 'prim_post_dt', 'prim_chk_det', 'prim_recv_dt', 'prim_chk_amt', 'prim_cmt',
      'sec_ins', 'sec_amt', 'sec_post_dt', 'sec_chk_det', 'sec_recv_dt', 'sec_chk_amt', 'sec_cmt', 'sec_denial_code',
      'pat_amt', 'pat_recv_dt', 'total_amt', 'charges_adj_amt', 'write_off_amt', 
      'bal_amt', 'reimb_pct', 'claim_status', 'claim_status_type'
    ];

    // Define numeric fields that need special handling
    const numericFields = [
      'charge_amt', 'allowed_amt', 'allowed_add_amt', 'allowed_exp_amt',
      'prim_amt', 'prim_chk_amt', 'sec_amt', 'sec_chk_amt', 'pat_amt',
      'total_amt', 'charges_adj_amt', 'write_off_amt', 'bal_amt', 'reimb_pct'
    ];

    // Filter only allowed fields from request body and handle type conversions
    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (field in updateData) {
        let value = updateData[field];
        
        // Special handling for numeric fields
        if (numericFields.includes(field)) {
          // Convert empty strings to null
          if (value === '' || value === undefined) {
            value = null;
          } 
          // Convert string numbers to actual numbers, or null if invalid
          else if (value !== null) {
            // Try to parse as number
            const parsedNum = parseFloat(String(value).replace(/,/g, ''));
            if (isNaN(parsedNum)) {
              value = null;
            } else {
              value = parsedNum;
            }
          }
        } else if (field === 'claim_status_type') {
          // Special handling for claim_status_type - always store as null if empty
          if (value === '' || value === undefined) {
            value = null;
          }
          console.log(`claim_status_type value: "${value}", type: ${typeof value}`);
        }
        
        updates[field] = value;
      }
    }
    
    // If there's nothing to update, return early
    if (Object.keys(updates).length === 0) {
      res.status(400).json({
        success: false,
        error: 'No valid fields to update',
        message: 'Request must include at least one valid field to update'
      });
      return;
    }

    // Track changes for history
    const changesForHistory: Array<{
      field_name: string;
      old_value: string | null;
      new_value: string | null;
    }> = [];

    // Collect fields that changed for history tracking
    for (const [key, newValue] of Object.entries(updates)) {
      const oldValue = oldClaim[key as keyof Claim];
      
      // Convert values for comparison to handle all edge cases
      const oldValueStr = oldValue === null || oldValue === undefined 
        ? '' 
        : String(oldValue).trim();
      
      const newValueStr = newValue === null || newValue === undefined 
        ? '' 
        : String(newValue).trim();
      
      // Check if values are different for tracking purposes
      // For numeric fields, compare the actual values to prevent insignificant differences
      if (numericFields.includes(key)) {
        // For numeric fields, convert to numbers for comparison
        const oldNum = oldValue === null || oldValue === undefined || oldValue === '' 
          ? null 
          : parseFloat(String(oldValue));
        
        const newNum = newValue === null || newValue === undefined || newValue === '' 
          ? null 
          : parseFloat(String(newValue));
        
        // Check if numbers are different
        if ((oldNum === null && newNum !== null) || 
            (oldNum !== null && newNum === null) ||
            (oldNum !== null && newNum !== null && oldNum !== newNum)) {
          changesForHistory.push({
            field_name: key,
            old_value: oldValue !== null && oldValue !== undefined ? String(oldValue) : null,
            new_value: newValue !== null && newValue !== undefined ? String(newValue) : null
          });
        }
      } else {
        // For non-numeric fields, compare the string values
        if (oldValueStr !== newValueStr) {
          changesForHistory.push({
            field_name: key,
            old_value: oldValue !== null && oldValue !== undefined ? String(oldValue) : null,
            new_value: newValue !== null && newValue !== undefined ? String(newValue) : null
          });
        }
      }
    }
    
    // Construct the SET clause and parameters
    const setClauses: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;
    
    for (const [key, value] of Object.entries(updates)) {
      const dbColumn = key === 'billing_id' ? 'cpt_id' : key;
      setClauses.push(`${dbColumn} = $${paramIndex}`);
      queryParams.push(value);
      paramIndex++;
    }
    
    // Add the ID as the last parameter
    queryParams.push(id);
    
    // Construct the full query
    const updateQuery = `
      UPDATE upl_billing_reimburse
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *`;
    
    // Execute the query to update the claim using our optimized query function
    console.log('Executing update query:', updateQuery);
    console.log('With parameters:', queryParams);
    
    const updateResult = await query(updateQuery, queryParams);
    
    if (updateResult.rows.length === 0) {
      console.error('Update query did not return any rows.');
      res.status(500).json({
        success: false,
        error: 'Failed to update claim',
        message: 'Update operation succeeded but no rows were returned'
      });
      return;
    }
    
    const updatedClaim = updateResult.rows[0];
    console.log('Claim updated successfully:', updatedClaim);

    // After successful update, invalidate any cached entries for this claim
    Object.keys(queryCache).forEach(key => {
      if (key === `claim-${id}` || key === `claim-history-${id}` || key.includes('claims')) {
        delete queryCache[key];
      }
    });

    // Only try to log changes if there are changes to log
    if (changesForHistory.length > 0) {
      // Ensure we properly extract user information with proper fallbacks
      // Make sure we prioritize user_id and username from the request body
      const userId = req.body.user_id !== undefined ? req.body.user_id : 1;
      let username = req.body.username;
      // If username is not provided, try to extract from email if available
      if (!username && req.body.email && typeof req.body.email === 'string') {
        username = req.body.email.split('@')[0];
      }
      // Fallbacks for admin/system
      if (!username) {
        username = userId !== 1 ? 'Admin' : 'System';
      }
      // Always ensure username is just the part before @ if it looks like an email
      if (username && username.includes('@')) {
        username = username.split('@')[0];
      }
      console.log('Logging changes with user info:', { userId, username, changesCount: changesForHistory.length });
      console.log('Changes being logged:', changesForHistory);
      
      try {
        // Create a single batch insert statement for all changes
        if (changesForHistory.length > 0) {
          const valuesSql = changesForHistory.map((_, index) => {
            const offset = index * 8;
            return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, NOW(), $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`;
          }).join(', ');
          
          const logQuery = `
            INSERT INTO upl_change_logs (
              claim_id, user_id, username, cpt_id, 
              timestamp, field_name, old_value, new_value, action_type
            ) VALUES ${valuesSql}
            RETURNING id`;
          
          const logParams: any[] = [];
          changesForHistory.forEach(change => {
            logParams.push(
              id,
              userId,
              username,
              oldClaim.billing_id || null, // Renamed from cpt_id
              change.field_name,
              change.old_value,
              change.new_value,
              'updated'
            );
          });
          
          // Use a single query for all log entries
          try {
            await query(logQuery, logParams);
            console.log(`Created ${changesForHistory.length} change log entries for user ${username} (ID: ${userId})`);
          } catch (innerError: any) {
            // Handle errors at each stage
            console.error('Error executing log query:', innerError);
            // Continue with the response even if logging fails
          }
        }
      } catch (logError: any) {
        // If the error is because the upl_change_logs table doesn't exist, just continue
        if (logError.code === '42P01') { // PostgreSQL code for "relation does not exist"
          console.log('upl_change_logs table does not exist, skipping history tracking');
        } else {
          // Log other errors but don't fail the operation
          console.error('Failed to create change logs:', logError);
        }
        // Continue with the response even if logging fails
      }
    }
    
    // Return the updated claim
    res.status(200).json({
      success: true,
      message: 'Claim updated successfully',
      data: updatedClaim
    });
    
  } catch (error) {
    console.error('Error updating claim:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update claim',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get change history for a claim
 * @route GET /api/claims/:id/history
 */
export const getClaimHistory = async (req: Request, res: Response) => {
  try {
    requestCounter++;
    const requestId = requestCounter;
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: 'Invalid ID format',
        message: 'The ID must be a number'
      });
      return;
    }
    
    // Create cache key for this specific claim's history
    const cacheKey = `claim-history-${id}`;
    const now = Date.now();
    
    // Check if we have cached data for this claim's history (cache for 2 minutes)
    if (queryCache[cacheKey] && now - queryCache[cacheKey].timestamp < queryCache[cacheKey].ttl) {
      return res.status(200).json(queryCache[cacheKey].data);
    }
    
    try {
      // Check if the claim exists
      const claimCheckQuery = 'SELECT id, cpt_id AS billing_id, first_name, last_name FROM upl_billing_reimburse WHERE id = $1'; // Changed billing_id to cpt_id AS billing_id
      
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
          ubr.cpt_code,
          ubr.first_name,
          ubr.last_name
        FROM upl_change_logs cl
        LEFT JOIN upl_billing_reimburse ubr ON cl.claim_id = ubr.id
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
        const claimsQuery = `SELECT id, cpt_id AS billing_id, first_name, last_name FROM upl_billing_reimburse LIMIT 5`;
        const claimsResult = await query(claimsQuery, []);
        const claims = claimsResult.rows;
        
        // Generate mock history data based on existing claims
        const mockHistory = claims.flatMap((claim, index) => {
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