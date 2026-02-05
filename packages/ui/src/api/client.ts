const API_BASE = '/api';

export interface ConfigResponse {
  domain: string;
  key: string;
  environment: string;
  version: string;
  data: unknown;
  raw?: string;
  lastModified: string;
}

export interface DomainsResponse {
  environment: string;
  domains: string[];
}

export interface KeysResponse {
  domain: string;
  environment: string;
  keys: string[];
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export type Operation = 'update' | 'create' | 'delete' | 'create_domain' | 'delete_domain';

export interface ChangeRequest {
  id: string;
  branch_name: string;
  target_environment: string;
  domain: string;
  key_name: string | null;
  operation: Operation;
  title: string;
  description?: string;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'merged' | 'discarded';
  created_by: string;
  created_at: string;
}

export type PromotionStatus = 'pending' | 'approved' | 'rejected' | 'promoted' | 'failed' | 'rolled_back';

export interface PromotionRequest {
  id: string;
  source_env: string;
  target_env: string;
  domain: string;
  files: string[];
  status: PromotionStatus;
  requested_by: string;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  promoted_at: string | null;
  commit_sha: string | null;
  notes: string | null;
  review_notes: string | null;
}

export interface PromotionPreview {
  sourceEnv: string;
  targetEnv: string;
  domain: string;
  files: Array<{
    file: string;
    sourceContent: string;
    targetContent: string | null;
    diff: string;
  }>;
}

export interface AuditEntry {
  id: number;
  timestamp: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  environment: string | null;
  domain: string | null;
  details: Record<string, unknown> | null;
  commit_sha: string | null;
}

export interface AuditListResponse {
  entries: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface ConfigHistoryEntry {
  sha: string;
  author: string;
  date: string;
  message: string;
  type: 'merge' | 'promote' | 'rollback' | 'other';
}

export interface ConfigDriftStatus {
  key: string;
  dev: { exists: boolean; hash?: string };
  staging: { exists: boolean; hash?: string };
  prod: { exists: boolean; hash?: string };
  status: 'synced' | 'drifted' | 'partial' | 'dev-only';
  driftDetails?: {
    devVsStaging: 'same' | 'different' | 'missing-source' | 'missing-target';
    stagingVsProd: 'same' | 'different' | 'missing-source' | 'missing-target';
  };
}

export interface DomainDrift {
  domain: string;
  configs: ConfigDriftStatus[];
  syncPercentage: number;
  totalConfigs: number;
}

export interface DriftAnalysis {
  domains: DomainDrift[];
  summary: {
    totalConfigs: number;
    synced: number;
    drifted: number;
    partial: number;
    devOnly: number;
    overallSyncPercentage: number;
  };
  generatedAt: string;
}

export interface DriftDiff {
  domain: string;
  key: string;
  source: string;
  target: string;
  sourceContent: string;
  targetContent: string;
  sourceExists: boolean;
  targetExists: boolean;
  isDifferent: boolean;
  diff: string;
}

export interface Dependency {
  id: string;
  app_name: string;
  app_id: string;
  environment: string;
  domain: string;
  config_keys: string[];
  contact_email: string | null;
  contact_team: string | null;
  last_heartbeat: string;
  registered_at: string;
  metadata: Record<string, unknown> | null;
}

export interface DependencySummary {
  total: number;
  dev: number;
  staging: number;
  prod: number;
}

export type ConsumerStatus = 'active' | 'stale' | 'inactive';

export interface Consumer {
  app_id: string;
  app_name: string;
  contact_email: string | null;
  contact_team: string | null;
  last_heartbeat: string;
  registered_at: string;
  status: ConsumerStatus;
  metadata: Record<string, unknown> | null;
}

export interface ImpactAnalysis {
  environment: string;
  domain: string;
  key: string;
  consumers: Consumer[];
  consumer_count: number;
  status_counts: {
    active: number;
    stale: number;
    inactive: number;
  };
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }

    return res.json();
  }

  // Auth
  async login(email: string, password: string): Promise<LoginResponse> {
    return this.fetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  // Config reads
  async getDomains(env: string): Promise<DomainsResponse> {
    return this.fetch(`/config/${env}`);
  }

  async getKeys(env: string, domain: string): Promise<KeysResponse> {
    return this.fetch(`/config/${env}/${domain}`);
  }

  async getConfig(env: string, domain: string, key: string): Promise<ConfigResponse> {
    return this.fetch(`/config/${env}/${domain}/${key}?format=yaml`);
  }

  // YAML validation
  async validateYaml(content: string): Promise<{
    valid: boolean;
    error?: string;
    line?: number;
    column?: number;
  }> {
    return this.fetch('/config/validate', {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  // Change requests
  async getChangeRequests(): Promise<ChangeRequest[]> {
    return this.fetch('/changes');
  }

  async createChangeRequest(data: {
    domain: string;
    key?: string;
    targetEnvironment: string;
    title: string;
    description?: string;
    content?: string;
    operation?: Operation;
  }): Promise<ChangeRequest> {
    return this.fetch('/changes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getChangeRequest(id: string): Promise<ChangeRequest & { currentContent: string; proposedContent: string }> {
    return this.fetch(`/changes/${id}`);
  }

  async submitForReview(id: string): Promise<ChangeRequest> {
    return this.fetch(`/changes/${id}/submit`, { method: 'POST' });
  }

  async approveChange(id: string, comment?: string): Promise<ChangeRequest> {
    return this.fetch(`/changes/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  }

  async rejectChange(id: string, comment: string): Promise<ChangeRequest> {
    return this.fetch(`/changes/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  }

  async mergeChange(id: string): Promise<ChangeRequest> {
    return this.fetch(`/changes/${id}/merge`, { method: 'POST' });
  }

  async discardChange(id: string): Promise<ChangeRequest> {
    return this.fetch(`/changes/${id}/discard`, { method: 'POST' });
  }

  // Promotions
  async getPromotions(filters?: { status?: string; target_env?: string; source_env?: string }): Promise<PromotionRequest[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.target_env) params.set('target_env', filters.target_env);
    if (filters?.source_env) params.set('source_env', filters.source_env);
    const query = params.toString();
    return this.fetch(`/promotions${query ? `?${query}` : ''}`);
  }

  async getPromotion(id: string): Promise<PromotionRequest> {
    return this.fetch(`/promotions/${id}`);
  }

  async getPromotionPreview(id: string): Promise<PromotionPreview> {
    return this.fetch(`/promotions/${id}/preview`);
  }

  async createPromotion(data: {
    sourceEnv: string;
    targetEnv: string;
    domain: string;
    files: string[];
    notes?: string;
  }): Promise<PromotionRequest> {
    return this.fetch('/promotions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async approvePromotion(id: string, review_notes?: string): Promise<PromotionRequest> {
    return this.fetch(`/promotions/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ review_notes }),
    });
  }

  async rejectPromotion(id: string, review_notes: string): Promise<PromotionRequest> {
    return this.fetch(`/promotions/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ review_notes }),
    });
  }

  async executePromotion(id: string): Promise<PromotionRequest> {
    return this.fetch(`/promotions/${id}/execute`, { method: 'POST' });
  }

  async rollbackPromotion(id: string, reason: string): Promise<PromotionRequest> {
    return this.fetch(`/promotions/${id}/rollback`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // Audit
  async getAuditEntries(filters?: {
    limit?: number;
    offset?: number;
    action?: string;
    entity_type?: string;
    environment?: string;
    domain?: string;
    actor?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
  }): Promise<AuditListResponse> {
    const params = new URLSearchParams();
    if (filters?.limit) params.set('limit', filters.limit.toString());
    if (filters?.offset) params.set('offset', filters.offset.toString());
    if (filters?.action) params.set('action', filters.action);
    if (filters?.entity_type) params.set('entity_type', filters.entity_type);
    if (filters?.environment) params.set('environment', filters.environment);
    if (filters?.domain) params.set('domain', filters.domain);
    if (filters?.actor) params.set('actor', filters.actor);
    if (filters?.start_date) params.set('start_date', filters.start_date);
    if (filters?.end_date) params.set('end_date', filters.end_date);
    if (filters?.search) params.set('search', filters.search);
    const query = params.toString();
    return this.fetch(`/audit${query ? `?${query}` : ''}`);
  }

  async getUserAuditHistory(userId: string, limit = 50, offset = 0): Promise<AuditListResponse> {
    return this.fetch(`/audit/user/${userId}?limit=${limit}&offset=${offset}`);
  }

  // Config history
  async getConfigHistory(env: string, domain: string, key: string): Promise<{
    environment: string;
    domain: string;
    key: string;
    history: ConfigHistoryEntry[];
  }> {
    return this.fetch(`/config/${env}/${domain}/${key}/history`);
  }

  async getConfigAtCommit(env: string, domain: string, key: string, commit: string): Promise<{
    environment: string;
    domain: string;
    key: string;
    commit: string;
    content: string;
  }> {
    return this.fetch(`/config/${env}/${domain}/${key}/at/${commit}`);
  }

  async rollbackConfig(env: string, domain: string, key: string, targetCommit: string, reason: string): Promise<{
    success: boolean;
    environment: string;
    domain: string;
    key: string;
    rolledBackTo: string;
    newCommit: string;
  }> {
    return this.fetch(`/config/${env}/${domain}/${key}/rollback`, {
      method: 'POST',
      body: JSON.stringify({ target_commit: targetCommit, reason }),
    });
  }

  // Drift analysis
  async getDriftAnalysis(): Promise<DriftAnalysis> {
    return this.fetch('/drift');
  }

  async getDriftDiff(domain: string, key: string, source: string, target: string): Promise<DriftDiff> {
    return this.fetch(`/drift/${domain}/${key}/diff?source=${source}&target=${target}`);
  }

  // Dependencies
  async getDependencies(filters?: {
    environment?: string;
    domain?: string;
    app_id?: string;
  }): Promise<Dependency[]> {
    const params = new URLSearchParams();
    if (filters?.environment) params.set('environment', filters.environment);
    if (filters?.domain) params.set('domain', filters.domain);
    if (filters?.app_id) params.set('app_id', filters.app_id);
    const query = params.toString();
    return this.fetch(`/dependencies${query ? `?${query}` : ''}`);
  }

  async getDependencySummary(): Promise<DependencySummary> {
    return this.fetch('/dependencies/summary');
  }

  async registerDependency(data: {
    app_name: string;
    app_id: string;
    environment: string;
    domain: string;
    config_keys: string[];
    contact_email?: string;
    contact_team?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Dependency> {
    return this.fetch('/dependencies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteDependency(appId: string, environment?: string): Promise<{ success: boolean }> {
    const query = environment ? `?environment=${environment}` : '';
    return this.fetch(`/dependencies/${appId}${query}`, { method: 'DELETE' });
  }

  // Impact analysis
  async getImpactAnalysis(env: string, domain: string, key: string): Promise<ImpactAnalysis> {
    return this.fetch(`/impact/${env}/${domain}/${key}`);
  }
}

export const api = new ApiClient();
