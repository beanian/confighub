import { Router, Request, Response } from 'express';
import { getConfig, listKeys, listDomains } from '../services/git';
import { getConfigHistory, getConfigAtCommit, rollbackConfig } from '../services/promotion';
import { logAudit, AuditActions } from '../services/audit';
import { dbRun, dbGet } from '../db';
import yaml from 'js-yaml';

/**
 * Validates that an app is registered as a consumer for a specific config.
 * Returns { allowed: true } or { allowed: false, reason: string }.
 */
async function validateConsumer(
  appId: string,
  env: string,
  domain: string,
  key: string
): Promise<{ allowed: boolean; reason?: string }> {
  const dep = await dbGet<{ config_keys: string; domain: string }>(
    'SELECT config_keys, domain FROM dependencies WHERE app_id = ? AND environment = ?',
    [appId, env]
  );

  if (!dep) {
    return {
      allowed: false,
      reason: `App '${appId}' is not registered as a consumer in the '${env}' environment. Register via POST /api/dependencies.`,
    };
  }

  if (dep.domain !== domain) {
    return {
      allowed: false,
      reason: `App '${appId}' is registered in domain '${dep.domain}', not '${domain}'. Update your registration to include this domain.`,
    };
  }

  const keys: string[] = JSON.parse(dep.config_keys || '[]');
  if (!keys.includes(key)) {
    return {
      allowed: false,
      reason: `App '${appId}' is not registered as a consumer of '${domain}/${key}'. Update your registration to include this config key.`,
    };
  }

  return { allowed: true };
}

/**
 * Checks config access: authenticated users (JWT) are allowed, apps must be registered consumers.
 * Returns null if access is allowed, or a Response-ending action if denied.
 */
async function enforceConfigAccess(
  req: Request,
  res: Response,
  env: string,
  domain: string,
  key: string
): Promise<boolean> {
  const userId = (req as any).userId;
  const appId = req.headers['x-confighub-app-id'] as string | undefined;

  // Authenticated dashboard users can always read configs
  if (userId) {
    return true;
  }

  // Apps must identify themselves
  if (!appId) {
    res.status(401).json({
      error: 'Config access requires authentication or a registered app identity.',
      hint: 'Provide a JWT token via Authorization header, or identify your app via the X-ConfigHub-App-Id header.',
    });
    return false;
  }

  // Apps must be registered as consumers for this specific config
  const validation = await validateConsumer(appId, env, domain, key);
  if (!validation.allowed) {
    await logAudit(
      `app:${appId}`,
      AuditActions.CONFIG_ACCESS_DENIED,
      'config',
      `${domain}/${key}`,
      env,
      domain,
      { app_id: appId, reason: validation.reason }
    );
    res.status(403).json({
      error: 'Consumer registration required.',
      reason: validation.reason,
      hint: 'Register your app as a consumer via POST /api/dependencies before reading configs.',
    });
    return false;
  }

  return true;
}

const router = Router();

// POST /api/config/validate - validate YAML content
router.post('/validate', (req: Request, res: Response) => {
  const { content } = req.body;

  if (!content || typeof content !== 'string') {
    return res.status(400).json({ valid: false, error: 'Content is required' });
  }

  try {
    yaml.load(content);
    res.json({ valid: true });
  } catch (e) {
    const yamlError = e as yaml.YAMLException;
    res.json({
      valid: false,
      error: yamlError.message,
      line: yamlError.mark?.line !== undefined ? yamlError.mark.line + 1 : undefined,
      column: yamlError.mark?.column !== undefined ? yamlError.mark.column + 1 : undefined,
    });
  }
});

// GET /api/config/:env/:domain/:key
router.get('/:env/:domain/:key', async (req: Request, res: Response) => {
  const { env, domain, key } = req.params;
  const format = req.query.format as string;

  // Validate environment
  if (!['dev', 'staging', 'prod'].includes(env)) {
    return res.status(400).json({ error: 'Invalid environment. Use: dev, staging, prod' });
  }

  // Enforce consumer registration for app access
  const allowed = await enforceConfigAccess(req, res, env, domain, key);
  if (!allowed) return;

  try {
    const result = await getConfig(env, domain, key);

    if (!result) {
      return res.status(404).json({ error: `Config not found: ${domain}/${key}` });
    }

    // Update heartbeat if X-ConfigHub-App-Id header present
    const appId = req.headers['x-confighub-app-id'] as string | undefined;
    if (appId) {
      dbRun(
        "UPDATE dependencies SET last_heartbeat = datetime('now') WHERE app_id = ? AND environment = ?",
        [appId, env]
      ).catch((err) => console.error('Error updating heartbeat:', err));
    }

    res.json({
      domain,
      key,
      environment: env,
      version: result.commitSha,
      data: result.content,
      raw: format === 'yaml' || format === 'raw' ? result.raw : undefined,
      lastModified: new Date().toISOString(), // TODO: get from git
    });
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

// GET /api/config/:env/:domain - list keys
router.get('/:env/:domain', async (req: Request, res: Response) => {
  const { env, domain } = req.params;

  if (!['dev', 'staging', 'prod'].includes(env)) {
    return res.status(400).json({ error: 'Invalid environment' });
  }

  try {
    const keys = await listKeys(env, domain);
    res.json({ domain, environment: env, keys });
  } catch (error) {
    console.error('Error listing keys:', error);
    res.status(500).json({ error: 'Failed to list keys' });
  }
});

// GET /api/config/:env - list domains
router.get('/:env', async (req: Request, res: Response) => {
  const { env } = req.params;

  if (!['dev', 'staging', 'prod'].includes(env)) {
    return res.status(400).json({ error: 'Invalid environment' });
  }

  try {
    const domains = await listDomains(env);
    res.json({ environment: env, domains });
  } catch (error) {
    console.error('Error listing domains:', error);
    res.status(500).json({ error: 'Failed to list domains' });
  }
});

// GET /api/config/:env/:domain/:key/history - get git history for a config file
router.get('/:env/:domain/:key/history', async (req: Request, res: Response) => {
  const { env, domain, key } = req.params;

  if (!['dev', 'staging', 'prod'].includes(env)) {
    return res.status(400).json({ error: 'Invalid environment' });
  }

  // Enforce consumer registration for app access
  const allowed = await enforceConfigAccess(req, res, env, domain, key);
  if (!allowed) return;

  try {
    const history = await getConfigHistory(env, domain, key);
    res.json({
      environment: env,
      domain,
      key,
      history,
    });
  } catch (error) {
    console.error('Error getting config history:', error);
    res.status(500).json({ error: 'Failed to get config history' });
  }
});

// GET /api/config/:env/:domain/:key/at/:commit - get config content at a specific commit
router.get('/:env/:domain/:key/at/:commit', async (req: Request, res: Response) => {
  const { env, domain, key, commit } = req.params;

  if (!['dev', 'staging', 'prod'].includes(env)) {
    return res.status(400).json({ error: 'Invalid environment' });
  }

  // Enforce consumer registration for app access
  const allowed = await enforceConfigAccess(req, res, env, domain, key);
  if (!allowed) return;

  try {
    const content = await getConfigAtCommit(env, domain, key, commit);

    if (content === null) {
      return res.status(404).json({ error: 'Config not found at specified commit' });
    }

    res.json({
      environment: env,
      domain,
      key,
      commit,
      content,
    });
  } catch (error) {
    console.error('Error getting config at commit:', error);
    res.status(500).json({ error: 'Failed to get config at commit' });
  }
});

// POST /api/config/:env/:domain/:key/rollback - rollback a config to a previous commit
router.post('/:env/:domain/:key/rollback', async (req: Request, res: Response) => {
  const { env, domain, key } = req.params;
  const { target_commit, reason } = req.body;
  const userId = (req as any).userId || 'anonymous';

  if (!['dev', 'staging', 'prod'].includes(env)) {
    return res.status(400).json({ error: 'Invalid environment' });
  }

  if (!target_commit) {
    return res.status(400).json({ error: 'target_commit is required' });
  }

  if (!reason) {
    return res.status(400).json({ error: 'reason is required for rollback' });
  }

  try {
    const { commitSha } = await rollbackConfig(env, domain, key, target_commit, reason);

    await logAudit(
      userId,
      AuditActions.CONFIG_ROLLBACK,
      'config',
      `${domain}/${key}`,
      env,
      domain,
      { key, targetCommit: target_commit, reason },
      commitSha
    );

    res.json({
      success: true,
      environment: env,
      domain,
      key,
      rolledBackTo: target_commit,
      newCommit: commitSha,
    });
  } catch (error) {
    console.error('Error rolling back config:', error);
    res.status(500).json({ error: 'Failed to rollback config' });
  }
});

export default router;
