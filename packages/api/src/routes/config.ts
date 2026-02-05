import { Router, Request, Response } from 'express';
import { getConfig, listKeys, listDomains } from '../services/git';
import { getConfigHistory, getConfigAtCommit, rollbackConfig } from '../services/promotion';
import { logAudit, AuditActions } from '../services/audit';
import yaml from 'js-yaml';

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

  try {
    const result = await getConfig(env, domain, key);

    if (!result) {
      return res.status(404).json({ error: `Config not found: ${domain}/${key}` });
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
