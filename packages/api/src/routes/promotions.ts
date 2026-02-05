import { Router, Request, Response } from 'express';
import { dbRun, dbGet, dbAll } from '../db';
import { logAudit, AuditActions } from '../services/audit';
import {
  getPromotionPreview,
  executePromotion,
  rollbackPromotion,
} from '../services/promotion';

const router = Router();

interface PromotionRequest {
  id: string;
  source_env: string;
  target_env: string;
  domain: string;
  files: string;
  status: string;
  requested_by: string;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  promoted_at: string | null;
  commit_sha: string | null;
  notes: string | null;
  review_notes: string | null;
}

// Generate a promotion request ID
function generatePromotionId(): string {
  // Simple incrementing ID would require a query, so we use timestamp-based
  const num = Date.now() % 100000;
  return `PR-${num}`;
}

// List all promotion requests
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, target_env, source_env } = req.query;
    let sql = 'SELECT * FROM promotion_requests WHERE 1=1';
    const params: string[] = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status as string);
    }
    if (target_env) {
      sql += ' AND target_env = ?';
      params.push(target_env as string);
    }
    if (source_env) {
      sql += ' AND source_env = ?';
      params.push(source_env as string);
    }

    sql += ' ORDER BY requested_at DESC';

    const promotions = await dbAll<PromotionRequest>(sql, params);

    // Parse files JSON
    const result = promotions.map((p) => ({
      ...p,
      files: JSON.parse(p.files),
    }));

    res.json(result);
  } catch (error) {
    console.error('Error listing promotions:', error);
    res.status(500).json({ error: 'Failed to list promotions' });
  }
});

// Get single promotion request
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const promotion = await dbGet<PromotionRequest>(
      'SELECT * FROM promotion_requests WHERE id = ?',
      [id]
    );

    if (!promotion) {
      return res.status(404).json({ error: 'Promotion request not found' });
    }

    res.json({
      ...promotion,
      files: JSON.parse(promotion.files),
    });
  } catch (error) {
    console.error('Error fetching promotion:', error);
    res.status(500).json({ error: 'Failed to fetch promotion' });
  }
});

// Get preview for a promotion
router.get('/:id/preview', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const promotion = await dbGet<PromotionRequest>(
      'SELECT * FROM promotion_requests WHERE id = ?',
      [id]
    );

    if (!promotion) {
      return res.status(404).json({ error: 'Promotion request not found' });
    }

    const files = JSON.parse(promotion.files);
    const preview = await getPromotionPreview(
      promotion.source_env,
      promotion.target_env,
      promotion.domain,
      files
    );

    res.json(preview);
  } catch (error) {
    console.error('Error getting promotion preview:', error);
    res.status(500).json({ error: 'Failed to get promotion preview' });
  }
});

// Create promotion request
router.post('/', async (req: Request, res: Response) => {
  const { sourceEnv, targetEnv, domain, files, notes } = req.body;
  const userId = (req as any).userId || 'anonymous';

  // Validate
  if (!sourceEnv || !targetEnv || !domain || !files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Validate environment flow
  const validFlows = [
    { source: 'dev', target: 'staging' },
    { source: 'staging', target: 'prod' },
  ];
  const isValidFlow = validFlows.some(
    (f) => f.source === sourceEnv && f.target === targetEnv
  );

  if (!isValidFlow) {
    return res.status(400).json({
      error: 'Invalid promotion flow. Only dev→staging or staging→prod allowed.',
    });
  }

  try {
    const id = generatePromotionId();

    await dbRun(
      `INSERT INTO promotion_requests (id, source_env, target_env, domain, files, status, requested_by, notes)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [id, sourceEnv, targetEnv, domain, JSON.stringify(files), userId, notes || null]
    );

    await logAudit(
      userId,
      AuditActions.PROMOTION_CREATED,
      'promotion',
      id,
      targetEnv,
      domain,
      { sourceEnv, files, notes }
    );

    const promotion = await dbGet<PromotionRequest>(
      'SELECT * FROM promotion_requests WHERE id = ?',
      [id]
    );

    res.status(201).json({
      ...promotion,
      files: JSON.parse(promotion!.files),
    });
  } catch (error) {
    console.error('Error creating promotion:', error);
    res.status(500).json({ error: 'Failed to create promotion' });
  }
});

// Approve promotion
router.post('/:id/approve', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { review_notes } = req.body;
  const userId = (req as any).userId || 'anonymous';
  const userRole = (req as any).userRole || 'viewer';

  try {
    const promotion = await dbGet<PromotionRequest>(
      'SELECT * FROM promotion_requests WHERE id = ?',
      [id]
    );

    if (!promotion) {
      return res.status(404).json({ error: 'Promotion request not found' });
    }

    if (promotion.status !== 'pending') {
      return res.status(400).json({ error: 'Promotion is not pending' });
    }

    // Check self-approval (admins can self-approve)
    if (promotion.requested_by === userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'You cannot approve your own promotion request' });
    }

    await dbRun(
      `UPDATE promotion_requests
       SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now'), review_notes = ?
       WHERE id = ?`,
      [userId, review_notes || null, id]
    );

    await logAudit(
      userId,
      AuditActions.PROMOTION_APPROVED,
      'promotion',
      id,
      promotion.target_env,
      promotion.domain,
      { sourceEnv: promotion.source_env, review_notes }
    );

    const updated = await dbGet<PromotionRequest>(
      'SELECT * FROM promotion_requests WHERE id = ?',
      [id]
    );

    res.json({
      ...updated,
      files: JSON.parse(updated!.files),
    });
  } catch (error) {
    console.error('Error approving promotion:', error);
    res.status(500).json({ error: 'Failed to approve promotion' });
  }
});

// Reject promotion
router.post('/:id/reject', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { review_notes } = req.body;
  const userId = (req as any).userId || 'anonymous';

  try {
    const promotion = await dbGet<PromotionRequest>(
      'SELECT * FROM promotion_requests WHERE id = ?',
      [id]
    );

    if (!promotion) {
      return res.status(404).json({ error: 'Promotion request not found' });
    }

    if (promotion.status !== 'pending') {
      return res.status(400).json({ error: 'Promotion is not pending' });
    }

    await dbRun(
      `UPDATE promotion_requests
       SET status = 'rejected', reviewed_by = ?, reviewed_at = datetime('now'), review_notes = ?
       WHERE id = ?`,
      [userId, review_notes || null, id]
    );

    await logAudit(
      userId,
      AuditActions.PROMOTION_REJECTED,
      'promotion',
      id,
      promotion.target_env,
      promotion.domain,
      { sourceEnv: promotion.source_env, review_notes }
    );

    const updated = await dbGet<PromotionRequest>(
      'SELECT * FROM promotion_requests WHERE id = ?',
      [id]
    );

    res.json({
      ...updated,
      files: JSON.parse(updated!.files),
    });
  } catch (error) {
    console.error('Error rejecting promotion:', error);
    res.status(500).json({ error: 'Failed to reject promotion' });
  }
});

// Execute promotion
router.post('/:id/execute', async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).userId || 'anonymous';

  try {
    const promotion = await dbGet<PromotionRequest>(
      'SELECT * FROM promotion_requests WHERE id = ?',
      [id]
    );

    if (!promotion) {
      return res.status(404).json({ error: 'Promotion request not found' });
    }

    if (promotion.status !== 'approved') {
      return res.status(400).json({ error: 'Promotion must be approved before execution' });
    }

    const files = JSON.parse(promotion.files);

    try {
      const { commitSha } = await executePromotion(
        id,
        promotion.source_env,
        promotion.target_env,
        promotion.domain,
        files,
        `Promotion ${id}`
      );

      await dbRun(
        `UPDATE promotion_requests
         SET status = 'promoted', promoted_at = datetime('now'), commit_sha = ?
         WHERE id = ?`,
        [commitSha, id]
      );

      await logAudit(
        userId,
        AuditActions.PROMOTION_EXECUTED,
        'promotion',
        id,
        promotion.target_env,
        promotion.domain,
        { sourceEnv: promotion.source_env, files },
        commitSha
      );

      const updated = await dbGet<PromotionRequest>(
        'SELECT * FROM promotion_requests WHERE id = ?',
        [id]
      );

      res.json({
        ...updated,
        files: JSON.parse(updated!.files),
      });
    } catch (execError) {
      await dbRun(
        `UPDATE promotion_requests SET status = 'failed' WHERE id = ?`,
        [id]
      );

      await logAudit(
        userId,
        AuditActions.PROMOTION_FAILED,
        'promotion',
        id,
        promotion.target_env,
        promotion.domain,
        { error: String(execError) }
      );

      throw execError;
    }
  } catch (error) {
    console.error('Error executing promotion:', error);
    res.status(500).json({ error: 'Failed to execute promotion' });
  }
});

// Rollback promotion
router.post('/:id/rollback', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = (req as any).userId || 'anonymous';

  if (!reason) {
    return res.status(400).json({ error: 'Reason is required for rollback' });
  }

  try {
    const promotion = await dbGet<PromotionRequest>(
      'SELECT * FROM promotion_requests WHERE id = ?',
      [id]
    );

    if (!promotion) {
      return res.status(404).json({ error: 'Promotion request not found' });
    }

    if (promotion.status !== 'promoted') {
      return res.status(400).json({ error: 'Can only rollback a promoted request' });
    }

    if (!promotion.commit_sha) {
      return res.status(400).json({ error: 'Promotion has no commit SHA to rollback from' });
    }

    const files = JSON.parse(promotion.files);

    const { commitSha } = await rollbackPromotion(
      id,
      promotion.target_env,
      promotion.domain,
      files,
      promotion.commit_sha,
      reason
    );

    await dbRun(
      `UPDATE promotion_requests SET status = 'rolled_back' WHERE id = ?`,
      [id]
    );

    await logAudit(
      userId,
      AuditActions.PROMOTION_ROLLED_BACK,
      'promotion',
      id,
      promotion.target_env,
      promotion.domain,
      { reason, files },
      commitSha
    );

    const updated = await dbGet<PromotionRequest>(
      'SELECT * FROM promotion_requests WHERE id = ?',
      [id]
    );

    res.json({
      ...updated,
      files: JSON.parse(updated!.files),
    });
  } catch (error) {
    console.error('Error rolling back promotion:', error);
    res.status(500).json({ error: 'Failed to rollback promotion' });
  }
});

export default router;
