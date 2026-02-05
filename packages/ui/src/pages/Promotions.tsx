import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { EnvironmentBadge } from '../components/EnvironmentSwitcher';
import { api, PromotionRequest } from '../api/client';
import { useEnvironment, Environment } from '../hooks/useEnvironment';
import clsx from 'clsx';

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  promoted: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  rolled_back: 'bg-gray-100 text-gray-800',
};

export function Promotions() {
  useEnvironment(); // Keep hook for context subscription
  const [promotions, setPromotions] = useState<PromotionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'promoted'>('all');

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sourceEnv, setSourceEnv] = useState<'dev' | 'staging'>('dev');
  const [domains, setDomains] = useState<string[]>([]);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [keys, setKeys] = useState<string[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);

  const targetEnv = sourceEnv === 'dev' ? 'staging' : 'prod';

  useEffect(() => {
    loadPromotions();
  }, [filter]);

  useEffect(() => {
    if (showCreateForm) {
      loadDomains();
    }
  }, [showCreateForm, sourceEnv]);

  useEffect(() => {
    if (selectedDomain) {
      loadKeys();
    }
  }, [selectedDomain, sourceEnv]);

  async function loadPromotions() {
    setLoading(true);
    try {
      const filters = filter !== 'all' ? { status: filter } : undefined;
      const data = await api.getPromotions(filters);
      setPromotions(data);
    } catch (error) {
      console.error('Error loading promotions:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadDomains() {
    try {
      const res = await api.getDomains(sourceEnv);
      setDomains(res.domains);
      if (res.domains.length > 0 && !selectedDomain) {
        setSelectedDomain(res.domains[0]);
      }
    } catch (error) {
      console.error('Error loading domains:', error);
    }
  }

  async function loadKeys() {
    try {
      const res = await api.getKeys(sourceEnv, selectedDomain);
      setKeys(res.keys);
      setSelectedKeys([]);
    } catch (error) {
      console.error('Error loading keys:', error);
    }
  }

  function toggleKey(key: string) {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function handleCreate() {
    if (selectedKeys.length === 0) return;
    setCreating(true);

    try {
      await api.createPromotion({
        sourceEnv,
        targetEnv,
        domain: selectedDomain,
        files: selectedKeys,
        notes: notes || undefined,
      });

      setShowCreateForm(false);
      setSelectedKeys([]);
      setNotes('');
      loadPromotions();
    } catch (error) {
      console.error('Error creating promotion:', error);
      alert(error instanceof Error ? error.message : 'Failed to create promotion');
    } finally {
      setCreating(false);
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  return (
    <Layout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border bg-surface-raised">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold text-gray-900">Environment Promotions</h1>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent-hover transition-fast text-sm font-medium"
            >
              {showCreateForm ? 'Cancel' : 'New Promotion'}
            </button>
          </div>

          {/* Create form */}
          {showCreateForm && (
            <div className="bg-white border border-border rounded-lg p-4 mb-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Create Promotion Request</h2>

              {/* Pipeline visualization */}
              <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
                <EnvironmentBadge env={sourceEnv as Environment} size="md" />
                <span className="text-gray-400">→</span>
                <EnvironmentBadge env={targetEnv as Environment} size="md" />
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source Environment
                  </label>
                  <select
                    value={sourceEnv}
                    onChange={(e) => {
                      setSourceEnv(e.target.value as 'dev' | 'staging');
                      setSelectedDomain('');
                      setSelectedKeys([]);
                    }}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm"
                  >
                    <option value="dev">Development</option>
                    <option value="staging">Staging</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
                  <select
                    value={selectedDomain}
                    onChange={(e) => setSelectedDomain(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm font-mono"
                  >
                    {domains.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Environment
                  </label>
                  <div className="px-3 py-2 bg-gray-100 border border-border rounded-md text-sm text-gray-600">
                    {targetEnv === 'staging' ? 'Staging' : 'Production'}
                  </div>
                </div>
              </div>

              {/* File selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select configs to promote ({selectedKeys.length} selected)
                </label>
                <div className="border border-border rounded-md max-h-48 overflow-auto">
                  {keys.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500 text-center">
                      No configs in this domain
                    </div>
                  ) : (
                    keys.map((key) => (
                      <label
                        key={key}
                        className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-border last:border-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedKeys.includes(key)}
                          onChange={() => toggleKey(key)}
                          className="mr-3"
                        />
                        <span className="font-mono text-sm">{key}.yaml</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Explain why these configs are being promoted..."
                  className="w-full px-3 py-2 border border-border rounded-md text-sm"
                  rows={2}
                />
              </div>

              <button
                onClick={handleCreate}
                disabled={selectedKeys.length === 0 || creating}
                className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent-hover transition-fast text-sm font-medium disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Promotion Request'}
              </button>
            </div>
          )}

          {/* Filter tabs */}
          <div className="flex gap-1">
            {(['all', 'pending', 'approved', 'promoted'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-fast',
                  filter === f
                    ? 'bg-accent text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Promotions list */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              Loading...
            </div>
          ) : promotions.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              No promotion requests found
            </div>
          ) : (
            <div className="space-y-2">
              {promotions.map((promotion) => (
                <Link
                  key={promotion.id}
                  to={`/promotions/${promotion.id}`}
                  className="block bg-white border border-border rounded-lg p-4 hover:border-accent transition-fast"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-medium text-accent">
                        {promotion.id}
                      </span>
                      <span
                        className={clsx(
                          'px-2 py-0.5 text-xs font-medium rounded',
                          statusColors[promotion.status]
                        )}
                      >
                        {promotion.status}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatDate(promotion.requested_at)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <EnvironmentBadge env={promotion.source_env as Environment} />
                    <span className="text-gray-400">→</span>
                    <EnvironmentBadge env={promotion.target_env as Environment} />
                    <span className="text-gray-400 mx-2">|</span>
                    <span className="font-mono text-sm text-gray-700">{promotion.domain}</span>
                  </div>

                  <div className="text-sm text-gray-600">
                    {promotion.files.length} file{promotion.files.length !== 1 ? 's' : ''}:{' '}
                    <span className="font-mono text-xs">
                      {promotion.files.slice(0, 3).join(', ')}
                      {promotion.files.length > 3 && ` +${promotion.files.length - 3} more`}
                    </span>
                  </div>

                  {promotion.notes && (
                    <div className="mt-2 text-sm text-gray-500 truncate">
                      {promotion.notes}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
