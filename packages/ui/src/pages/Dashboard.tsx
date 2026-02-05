import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { EnvironmentBadge } from '../components/EnvironmentSwitcher';
import { api, ChangeRequest, PromotionRequest } from '../api/client';
import { useEnvironment, environments, Environment } from '../hooks/useEnvironment';
import clsx from 'clsx';

export function Dashboard() {
  useEnvironment(); // Keep hook for context subscription
  const [changes, setChanges] = useState<ChangeRequest[]>([]);
  const [promotions, setPromotions] = useState<PromotionRequest[]>([]);
  const [envStats, setEnvStats] = useState<Record<string, { domains: number; configs: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getChangeRequests().catch(() => []),
      api.getPromotions().catch(() => []),
      loadEnvStats(),
    ])
      .then(([changesData, promotionsData]) => {
        setChanges(changesData);
        setPromotions(promotionsData);
      })
      .finally(() => setLoading(false));
  }, []);

  async function loadEnvStats() {
    const stats: Record<string, { domains: number; configs: number }> = {};
    for (const e of environments) {
      try {
        const domainsRes = await api.getDomains(e.id);
        let configCount = 0;
        for (const domain of domainsRes.domains) {
          const keysRes = await api.getKeys(e.id, domain);
          configCount += keysRes.keys.length;
        }
        stats[e.id] = { domains: domainsRes.domains.length, configs: configCount };
      } catch {
        stats[e.id] = { domains: 0, configs: 0 };
      }
    }
    setEnvStats(stats);
  }

  const pendingReview = changes.filter((c) => c.status === 'pending_review');
  const approvedChanges = changes.filter((c) => c.status === 'approved');

  const pendingPromotions = promotions.filter((p) => p.status === 'pending');
  const approvedPromotions = promotions.filter((p) => p.status === 'approved');

  return (
    <Layout>
      <div className="p-6 overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-surface-raised border border-border rounded-lg p-4">
            <div className="text-3xl font-semibold text-warning">{pendingReview.length}</div>
            <div className="text-sm text-gray-600 mt-1">Changes Pending Review</div>
          </div>
          <div className="bg-surface-raised border border-border rounded-lg p-4">
            <div className="text-3xl font-semibold text-success">{approvedChanges.length}</div>
            <div className="text-sm text-gray-600 mt-1">Ready to Merge</div>
          </div>
          <div className="bg-surface-raised border border-border rounded-lg p-4">
            <div className="text-3xl font-semibold text-blue-600">{pendingPromotions.length}</div>
            <div className="text-sm text-gray-600 mt-1">Promotions Pending</div>
          </div>
          <div className="bg-surface-raised border border-border rounded-lg p-4">
            <div className="text-3xl font-semibold text-amber-600">{approvedPromotions.length}</div>
            <div className="text-sm text-gray-600 mt-1">Promotions Ready</div>
          </div>
        </div>

        {/* Environment Health */}
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Environment Health</h2>
          <div className="grid grid-cols-3 gap-4">
            {environments.map((e) => {
              const stats = envStats[e.id] || { domains: 0, configs: 0 };
              return (
                <div
                  key={e.id}
                  className={clsx(
                    'bg-surface-raised border rounded-lg p-4',
                    e.id === 'dev' && 'border-blue-200',
                    e.id === 'staging' && 'border-amber-200',
                    e.id === 'prod' && 'border-red-200'
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <EnvironmentBadge env={e.id as Environment} size="md" />
                    <span className={clsx('w-2 h-2 rounded-full', e.bgColor)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-2xl font-semibold text-gray-900">{stats.domains}</div>
                      <div className="text-gray-500">Domains</div>
                    </div>
                    <div>
                      <div className="text-2xl font-semibold text-gray-900">{stats.configs}</div>
                      <div className="text-gray-500">Configs</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3 mb-8">
          <Link
            to="/browse"
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-md transition-fast"
          >
            Browse Configs
          </Link>
          <Link
            to="/promotions"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-fast"
          >
            Promote to Staging
          </Link>
          <Link
            to="/changes"
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-md transition-fast"
          >
            View All Changes
          </Link>
        </div>

        {/* Two-column layout for recent items */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent pending reviews */}
          <div className="bg-surface-raised border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="font-medium text-gray-900">Recent Changes</h2>
            </div>
            {!loading && pendingReview.length > 0 ? (
              <div className="divide-y divide-border">
                {pendingReview.slice(0, 5).map((change) => (
                  <Link
                    key={change.id}
                    to={`/changes/${change.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-fast"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">{change.title}</div>
                      <div className="text-sm text-gray-500">
                        {change.domain}/{change.key_name}
                      </div>
                    </div>
                    <span className="text-xs bg-warning/10 text-warning px-2 py-1 rounded-full font-medium flex-shrink-0 ml-2">
                      Review
                    </span>
                  </Link>
                ))}
              </div>
            ) : !loading && changes.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 text-center">
                No change requests yet
              </div>
            ) : (
              <div className="p-4 text-sm text-gray-500 text-center">
                No pending reviews
              </div>
            )}
            {changes.length > 0 && (
              <div className="px-4 py-2 border-t border-border">
                <Link
                  to="/changes"
                  className="text-sm text-accent hover:text-accent-hover font-medium"
                >
                  View all changes
                </Link>
              </div>
            )}
          </div>

          {/* Recent promotions */}
          <div className="bg-surface-raised border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="font-medium text-gray-900">Recent Promotions</h2>
            </div>
            {!loading && promotions.length > 0 ? (
              <div className="divide-y divide-border">
                {promotions.slice(0, 5).map((promotion) => (
                  <Link
                    key={promotion.id}
                    to={`/promotions/${promotion.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-fast"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium text-gray-900">
                          {promotion.id}
                        </span>
                        <span className="text-gray-400">|</span>
                        <span className="font-mono text-sm text-gray-600">{promotion.domain}</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <span>{promotion.source_env}</span>
                        <span>→</span>
                        <span>{promotion.target_env}</span>
                      </div>
                    </div>
                    <span
                      className={clsx(
                        'text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ml-2',
                        promotion.status === 'pending' && 'bg-amber-100 text-amber-700',
                        promotion.status === 'approved' && 'bg-blue-100 text-blue-700',
                        promotion.status === 'promoted' && 'bg-green-100 text-green-700',
                        promotion.status === 'rejected' && 'bg-red-100 text-red-700'
                      )}
                    >
                      {promotion.status}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-4 text-sm text-gray-500 text-center">
                No promotions yet
              </div>
            )}
            {promotions.length > 0 && (
              <div className="px-4 py-2 border-t border-border">
                <Link
                  to="/promotions"
                  className="text-sm text-accent hover:text-accent-hover font-medium"
                >
                  View all promotions
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
