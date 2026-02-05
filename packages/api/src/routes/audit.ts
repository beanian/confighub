import { Router, Request, Response } from 'express';
import { listAuditEntries, getUserAuditHistory, getConfigAuditHistory } from '../services/audit';

const router = Router();

// List audit entries with filters and pagination
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      limit = '50',
      offset = '0',
      action,
      entity_type,
      entity_id,
      environment,
      domain,
      actor,
      start_date,
      end_date,
      search,
    } = req.query;

    const result = await listAuditEntries({
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
      action: action as string,
      entityType: entity_type as string,
      entityId: entity_id as string,
      environment: environment as string,
      domain: domain as string,
      actor: actor as string,
      startDate: start_date as string,
      endDate: end_date as string,
      search: search as string,
    });

    // Parse details JSON for each entry
    const entries = result.entries.map((entry) => ({
      ...entry,
      details: entry.details ? JSON.parse(entry.details) : null,
    }));

    res.json({
      entries,
      total: result.total,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
  } catch (error) {
    console.error('Error listing audit entries:', error);
    res.status(500).json({ error: 'Failed to list audit entries' });
  }
});

// Get audit history for a specific config file
router.get('/config/:env/:domain/:key', async (req: Request, res: Response) => {
  const { env, domain, key } = req.params;

  try {
    const entries = await getConfigAuditHistory(env, domain, key);

    const result = entries.map((entry) => ({
      ...entry,
      details: entry.details ? JSON.parse(entry.details) : null,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error getting config audit history:', error);
    res.status(500).json({ error: 'Failed to get config audit history' });
  }
});

// Get all actions by a specific user
router.get('/user/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { limit = '50', offset = '0' } = req.query;

  try {
    const result = await getUserAuditHistory(
      userId,
      parseInt(limit as string, 10),
      parseInt(offset as string, 10)
    );

    const entries = result.entries.map((entry) => ({
      ...entry,
      details: entry.details ? JSON.parse(entry.details) : null,
    }));

    res.json({
      entries,
      total: result.total,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
  } catch (error) {
    console.error('Error getting user audit history:', error);
    res.status(500).json({ error: 'Failed to get user audit history' });
  }
});

export default router;
