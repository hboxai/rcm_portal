import express from 'express';
import { logAudit, getAuditLogs, getClientInfo, AuditActions } from '../services/auditService.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Public endpoint for frontend to send audit events (fire-and-forget)
router.post('/', async (req, res) => {
  try {
    const { event, details } = req.body;
    const clientInfo = getClientInfo(req);
    
    // Log the event from frontend
    await logAudit({
      action: event || 'FRONTEND_EVENT',
      resource: 'frontend',
      details,
      ...clientInfo,
      status: 'success',
    });
    
    res.status(204).end();
  } catch (error) {
    // Fire-and-forget - don't return errors
    res.status(204).end();
  }
});

// Admin endpoint to view audit logs
router.get('/logs', authMiddleware, async (req: any, res) => {
  try {
    // Only admins can view audit logs
    if (req.user?.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin role required.'
      });
    }
    
    const { 
      userId, 
      action, 
      resource, 
      status, 
      startDate, 
      endDate, 
      limit = 100, 
      offset = 0 
    } = req.query;
    
    const result = await getAuditLogs({
      userId: userId ? parseInt(userId as string, 10) : undefined,
      action: action as string,
      resource: resource as string,
      status: status as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
    
    res.status(200).json({
      success: true,
      data: result.logs,
      total: result.total,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get available audit action types
router.get('/actions', authMiddleware, (req: any, res) => {
  if (req.user?.role !== 'Admin') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Admin role required.'
    });
  }
  
  res.status(200).json({
    success: true,
    actions: Object.values(AuditActions),
  });
});

export default router;
