import { Router, Request, Response } from 'express';
import { dbAll } from '../db';

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

type ConsumerStatus = 'active' | 'stale' | 'inactive';

function getStatus(lastHeartbeat: string): ConsumerStatus {
  const heartbeatDate = new Date(lastHeartbeat);
  const now = new Date();
  const hoursSince = (now.getTime() - heartbeatDate.getTime()) / (1000 * 60 * 60);

  if (hoursSince < 24) return 'active';
  if (hoursSince < 168) return 'stale'; // 7 days
  return 'inactive';
}

// GET /api/impact/:env/:domain/:key - Get consumers for specific config
router.get('/:env/:domain/:key', async (req: Request, res: Response) => {
  const { env, domain, key } = req.params;

  if (!['dev', 'staging', 'prod'].includes(env)) {
    return res.status(400).json({ error: 'Invalid environment' });
  }

  try {
    // Get all dependencies that match environment and domain
    const deps = await dbAll<Dependency>(
      'SELECT * FROM dependencies WHERE environment = ? AND domain = ?',
      [env, domain]
    );

    // Filter to those that consume this specific key
    const consumers = deps
      .filter((d) => {
        const keys = JSON.parse(d.config_keys || '[]');
        return keys.includes(key);
      })
      .map((d) => {
        const status = getStatus(d.last_heartbeat);
        return {
          app_id: d.app_id,
          app_name: d.app_name,
          contact_email: d.contact_email,
          contact_team: d.contact_team,
          last_heartbeat: d.last_heartbeat,
          registered_at: d.registered_at,
          status,
          metadata: d.metadata ? JSON.parse(d.metadata) : null,
        };
      });

    const statusCounts = {
      active: consumers.filter((c) => c.status === 'active').length,
      stale: consumers.filter((c) => c.status === 'stale').length,
      inactive: consumers.filter((c) => c.status === 'inactive').length,
    };

    res.json({
      environment: env,
      domain,
      key,
      consumers,
      consumer_count: consumers.length,
      status_counts: statusCounts,
    });
  } catch (error) {
    console.error('Error fetching impact analysis:', error);
    res.status(500).json({ error: 'Failed to fetch impact analysis' });
  }
});

export default router;
