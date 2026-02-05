import { Router, Request, Response } from 'express';
import { dbRun, dbGet, dbAll } from '../db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

interface Dependency {
  id: string;
  app_name: string;
  app_id: string;
  environment: string;
  domain: string;
  config_keys: string;
  contact_email: string | null;
  contact_team: string | null;
  last_heartbeat: string;
  registered_at: string;
  metadata: string | null;
}

// GET /api/dependencies - List all dependencies
router.get('/', async (req: Request, res: Response) => {
  const { environment, domain, app_id } = req.query;

  try {
    let sql = 'SELECT * FROM dependencies WHERE 1=1';
    const params: string[] = [];

    if (environment) {
      sql += ' AND environment = ?';
      params.push(environment as string);
    }
    if (domain) {
      sql += ' AND domain = ?';
      params.push(domain as string);
    }
    if (app_id) {
      sql += ' AND app_id = ?';
      params.push(app_id as string);
    }

    sql += ' ORDER BY last_heartbeat DESC';

    const deps = await dbAll<Dependency>(sql, params);

    // Parse JSON fields
    const result = deps.map((d) => ({
      ...d,
      config_keys: JSON.parse(d.config_keys || '[]'),
      metadata: d.metadata ? JSON.parse(d.metadata) : null,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching dependencies:', error);
    res.status(500).json({ error: 'Failed to fetch dependencies' });
  }
});

// GET /api/dependencies/summary - Get summary counts by environment
router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const deps = await dbAll<Dependency>('SELECT environment FROM dependencies');

    const summary = {
      total: deps.length,
      dev: deps.filter((d) => d.environment === 'dev').length,
      staging: deps.filter((d) => d.environment === 'staging').length,
      prod: deps.filter((d) => d.environment === 'prod').length,
    };

    res.json(summary);
  } catch (error) {
    console.error('Error fetching dependency summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// GET /api/dependencies/:appId - Get single app's registration
router.get('/:appId', async (req: Request, res: Response) => {
  const { appId } = req.params;
  const { environment } = req.query;

  try {
    let sql = 'SELECT * FROM dependencies WHERE app_id = ?';
    const params: string[] = [appId];

    if (environment) {
      sql += ' AND environment = ?';
      params.push(environment as string);
    }

    const deps = await dbAll<Dependency>(sql, params);

    if (deps.length === 0) {
      return res.status(404).json({ error: 'Dependency not found' });
    }

    const result = deps.map((d) => ({
      ...d,
      config_keys: JSON.parse(d.config_keys || '[]'),
      metadata: d.metadata ? JSON.parse(d.metadata) : null,
    }));

    res.json(result.length === 1 ? result[0] : result);
  } catch (error) {
    console.error('Error fetching dependency:', error);
    res.status(500).json({ error: 'Failed to fetch dependency' });
  }
});

// POST /api/dependencies - Register/upsert dependency
router.post('/', async (req: Request, res: Response) => {
  const { app_name, app_id, environment, domain, config_keys, contact_email, contact_team, metadata } = req.body;

  if (!app_name || !app_id || !environment || !domain || !config_keys) {
    return res.status(400).json({ error: 'Required fields: app_name, app_id, environment, domain, config_keys' });
  }

  if (!['dev', 'staging', 'prod'].includes(environment)) {
    return res.status(400).json({ error: 'Invalid environment' });
  }

  try {
    // Check if exists
    const existing = await dbGet<Dependency>(
      'SELECT id FROM dependencies WHERE app_id = ? AND environment = ?',
      [app_id, environment]
    );

    const configKeysJson = JSON.stringify(config_keys);
    const metadataJson = metadata ? JSON.stringify(metadata) : null;

    if (existing) {
      // Update
      await dbRun(
        `UPDATE dependencies SET
          app_name = ?,
          domain = ?,
          config_keys = ?,
          contact_email = ?,
          contact_team = ?,
          metadata = ?,
          last_heartbeat = datetime('now')
        WHERE app_id = ? AND environment = ?`,
        [app_name, domain, configKeysJson, contact_email || null, contact_team || null, metadataJson, app_id, environment]
      );

      const updated = await dbGet<Dependency>(
        'SELECT * FROM dependencies WHERE app_id = ? AND environment = ?',
        [app_id, environment]
      );

      res.json({
        ...updated,
        config_keys: JSON.parse(updated!.config_keys || '[]'),
        metadata: updated!.metadata ? JSON.parse(updated!.metadata) : null,
      });
    } else {
      // Insert
      const id = uuidv4();
      await dbRun(
        `INSERT INTO dependencies (id, app_name, app_id, environment, domain, config_keys, contact_email, contact_team, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, app_name, app_id, environment, domain, configKeysJson, contact_email || null, contact_team || null, metadataJson]
      );

      const created = await dbGet<Dependency>('SELECT * FROM dependencies WHERE id = ?', [id]);

      res.status(201).json({
        ...created,
        config_keys: JSON.parse(created!.config_keys || '[]'),
        metadata: created!.metadata ? JSON.parse(created!.metadata) : null,
      });
    }
  } catch (error) {
    console.error('Error registering dependency:', error);
    res.status(500).json({ error: 'Failed to register dependency' });
  }
});

// DELETE /api/dependencies/:appId - Deregister
router.delete('/:appId', async (req: Request, res: Response) => {
  const { appId } = req.params;
  const { environment } = req.query;

  try {
    let sql = 'DELETE FROM dependencies WHERE app_id = ?';
    const params: string[] = [appId];

    if (environment) {
      sql += ' AND environment = ?';
      params.push(environment as string);
    }

    await dbRun(sql, params);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting dependency:', error);
    res.status(500).json({ error: 'Failed to delete dependency' });
  }
});

// POST /api/dependencies/:appId/heartbeat - Manual heartbeat
router.post('/:appId/heartbeat', async (req: Request, res: Response) => {
  const { appId } = req.params;
  const { environment } = req.body;

  try {
    let sql = "UPDATE dependencies SET last_heartbeat = datetime('now') WHERE app_id = ?";
    const params: string[] = [appId];

    if (environment) {
      sql += ' AND environment = ?';
      params.push(environment);
    }

    await dbRun(sql, params);
    res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error updating heartbeat:', error);
    res.status(500).json({ error: 'Failed to update heartbeat' });
  }
});

export default router;
