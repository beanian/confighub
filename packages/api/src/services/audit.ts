import { dbRun, dbAll, dbGet } from '../db';

export interface AuditEntry {
  id: number;
  timestamp: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  environment: string | null;
  domain: string | null;
  details: string | null;
  commit_sha: string | null;
}

export interface AuditDetails {
  [key: string]: unknown;
}

// Standard action types
export const AuditActions = {
  // Change requests
  CHANGE_REQUEST_CREATED: 'change_request.created',
  CHANGE_REQUEST_SUBMITTED: 'change_request.submitted',
  CHANGE_REQUEST_APPROVED: 'change_request.approved',
  CHANGE_REQUEST_REJECTED: 'change_request.rejected',
  CHANGE_REQUEST_MERGED: 'change_request.merged',
  CHANGE_REQUEST_DISCARDED: 'change_request.discarded',

  // Promotions
  PROMOTION_CREATED: 'promotion.created',
  PROMOTION_APPROVED: 'promotion.approved',
  PROMOTION_REJECTED: 'promotion.rejected',
  PROMOTION_EXECUTED: 'promotion.executed',
  PROMOTION_FAILED: 'promotion.failed',
  PROMOTION_ROLLED_BACK: 'promotion.rolled_back',

  // Config
  CONFIG_ROLLBACK: 'config.rollback',

  // Auth
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGOUT: 'auth.logout',
} as const;

export type AuditAction = typeof AuditActions[keyof typeof AuditActions];

// Log an audit event
export async function logAudit(
  actor: string,
  action: AuditAction | string,
  entityType: string,
  entityId: string | null,
  environment: string | null = null,
  domain: string | null = null,
  details: AuditDetails | null = null,
  commitSha: string | null = null
): Promise<void> {
  await dbRun(
    `INSERT INTO audit_log (actor, action, entity_type, entity_id, environment, domain, details, commit_sha)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      actor,
      action,
      entityType,
      entityId,
      environment,
      domain,
      details ? JSON.stringify(details) : null,
      commitSha,
    ]
  );
}

// Query options for listing audit entries
export interface AuditQueryOptions {
  limit?: number;
  offset?: number;
  action?: string;
  entityType?: string;
  entityId?: string;
  environment?: string;
  domain?: string;
  actor?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

// List audit entries with filters
export async function listAuditEntries(options: AuditQueryOptions = {}): Promise<{
  entries: AuditEntry[];
  total: number;
}> {
  const {
    limit = 50,
    offset = 0,
    action,
    entityType,
    entityId,
    environment,
    domain,
    actor,
    startDate,
    endDate,
    search,
  } = options;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (action) {
    conditions.push('action = ?');
    params.push(action);
  }
  if (entityType) {
    conditions.push('entity_type = ?');
    params.push(entityType);
  }
  if (entityId) {
    conditions.push('entity_id = ?');
    params.push(entityId);
  }
  if (environment) {
    conditions.push('environment = ?');
    params.push(environment);
  }
  if (domain) {
    conditions.push('domain = ?');
    params.push(domain);
  }
  if (actor) {
    conditions.push('actor = ?');
    params.push(actor);
  }
  if (startDate) {
    conditions.push('timestamp >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('timestamp <= ?');
    params.push(endDate);
  }
  if (search) {
    conditions.push('(action LIKE ? OR details LIKE ? OR entity_id LIKE ?)');
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await dbGet<{ count: number }>(
    `SELECT COUNT(*) as count FROM audit_log ${whereClause}`,
    params
  );
  const total = countResult?.count || 0;

  // Get entries
  const entries = await dbAll<AuditEntry>(
    `SELECT * FROM audit_log ${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { entries, total };
}

// Get audit history for a specific config file
export async function getConfigAuditHistory(
  env: string,
  domain: string,
  key: string
): Promise<AuditEntry[]> {
  return dbAll<AuditEntry>(
    `SELECT * FROM audit_log
     WHERE (environment = ? OR environment IS NULL)
     AND domain = ?
     AND (details LIKE ? OR entity_id LIKE ?)
     ORDER BY timestamp DESC`,
    [env, domain, `%${key}%`, `%${key}%`]
  );
}

// Get all actions by a specific user
export async function getUserAuditHistory(
  userId: string,
  limit = 50,
  offset = 0
): Promise<{ entries: AuditEntry[]; total: number }> {
  const countResult = await dbGet<{ count: number }>(
    'SELECT COUNT(*) as count FROM audit_log WHERE actor = ?',
    [userId]
  );
  const total = countResult?.count || 0;

  const entries = await dbAll<AuditEntry>(
    'SELECT * FROM audit_log WHERE actor = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?',
    [userId, limit, offset]
  );

  return { entries, total };
}

// Format action for display
export function formatAction(action: string): string {
  const actionMap: Record<string, string> = {
    'change_request.created': 'Created change request',
    'change_request.submitted': 'Submitted for review',
    'change_request.approved': 'Approved change request',
    'change_request.rejected': 'Rejected change request',
    'change_request.merged': 'Merged change request',
    'change_request.discarded': 'Discarded change request',
    'promotion.created': 'Created promotion request',
    'promotion.approved': 'Approved promotion',
    'promotion.rejected': 'Rejected promotion',
    'promotion.executed': 'Executed promotion',
    'promotion.failed': 'Promotion failed',
    'promotion.rolled_back': 'Rolled back promotion',
    'config.rollback': 'Rolled back config',
    'auth.login': 'Logged in',
    'auth.logout': 'Logged out',
  };

  return actionMap[action] || action;
}
