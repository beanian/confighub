import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { DependencyGraph } from '../components/DependencyGraph';
import { api, Dependency, ConsumerStatus } from '../api/client';
import clsx from 'clsx';

type ViewMode = 'table' | 'graph';

function getStatus(lastHeartbeat: string): ConsumerStatus {
  const heartbeatDate = new Date(lastHeartbeat);
  const now = new Date();
  const hoursSince = (now.getTime() - heartbeatDate.getTime()) / (1000 * 60 * 60);
  if (hoursSince < 24) return 'active';
  if (hoursSince < 168) return 'stale';
  return 'inactive';
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const statusColors: Record<ConsumerStatus, { bg: string; text: string; dot: string }> = {
  active: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  stale: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400' },
};

const envColors: Record<string, string> = {
  dev: 'bg-blue-100 text-blue-700',
  staging: 'bg-amber-100 text-amber-700',
  prod: 'bg-red-100 text-red-700',
};

export function Dependencies() {
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [envFilter, setEnvFilter] = useState<string>('');
  const [domainFilter, setDomainFilter] = useState<string>('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    api
      .getDependencies()
      .then(setDependencies)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredDeps = dependencies.filter((d) => {
    if (envFilter && d.environment !== envFilter) return false;
    if (domainFilter && d.domain !== domainFilter) return false;
    return true;
  });

  const domains = [...new Set(dependencies.map((d) => d.domain))];

  return (
    <Layout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border bg-surface-raised flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Dependencies</h1>
            <p className="text-sm text-gray-500 mt-1">
              Applications registered as consumers of configurations
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('table')}
                className={clsx(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-fast',
                  viewMode === 'table' ? 'bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                )}
              >
                Table
              </button>
              <button
                onClick={() => setViewMode('graph')}
                className={clsx(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-fast',
                  viewMode === 'graph' ? 'bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                )}
              >
                Graph
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 py-3 border-b border-border bg-gray-50 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Environment:</label>
            <select
              value={envFilter}
              onChange={(e) => setEnvFilter(e.target.value)}
              className="text-sm border border-border rounded-md px-2 py-1"
            >
              <option value="">All</option>
              <option value="dev">Dev</option>
              <option value="staging">Staging</option>
              <option value="prod">Prod</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Domain:</label>
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="text-sm border border-border rounded-md px-2 py-1"
            >
              <option value="">All</option>
              {domains.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="text-sm text-gray-500 ml-auto">
            {filteredDeps.length} registration{filteredDeps.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              Loading...
            </div>
          ) : viewMode === 'table' ? (
            <div className="h-full overflow-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Application
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Environment
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Domain
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Configs
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Team
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Last Heartbeat
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredDeps.map((dep) => {
                    const status = getStatus(dep.last_heartbeat);
                    const colors = statusColors[status];
                    const isExpanded = expandedRow === dep.id;

                    return (
                      <>
                        <tr
                          key={dep.id}
                          onClick={() => setExpandedRow(isExpanded ? null : dep.id)}
                          className="hover:bg-gray-50 cursor-pointer"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{dep.app_name}</div>
                            <div className="text-xs text-gray-500 font-mono">{dep.app_id}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={clsx(
                                'text-xs px-2 py-1 rounded-full font-medium',
                                envColors[dep.environment]
                              )}
                            >
                              {dep.environment}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-sm text-gray-700">{dep.domain}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {dep.config_keys.length} config{dep.config_keys.length !== 1 ? 's' : ''}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {dep.contact_team || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {formatRelativeTime(dep.last_heartbeat)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={clsx(
                                'inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium',
                                colors.bg,
                                colors.text
                              )}
                            >
                              <span className={clsx('w-1.5 h-1.5 rounded-full', colors.dot)} />
                              {status}
                            </span>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${dep.id}-expanded`} className="bg-gray-50">
                            <td colSpan={7} className="px-4 py-4">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <div className="font-medium text-gray-700 mb-2">
                                    Consumed Configs
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {dep.config_keys.map((key) => (
                                      <span
                                        key={key}
                                        className="bg-white border border-border px-2 py-1 rounded-md font-mono text-xs"
                                      >
                                        {dep.domain}/{key}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <div className="font-medium text-gray-700 mb-2">Contact</div>
                                  {dep.contact_email ? (
                                    <a
                                      href={`mailto:${dep.contact_email}`}
                                      className="text-accent hover:underline"
                                    >
                                      {dep.contact_email}
                                    </a>
                                  ) : (
                                    <span className="text-gray-400">No contact email</span>
                                  )}
                                </div>
                              </div>
                              <div className="mt-3 text-xs text-gray-500">
                                Registered: {new Date(dep.registered_at).toLocaleString()}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
              {filteredDeps.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  No dependencies found
                </div>
              )}
            </div>
          ) : (
            <div className="h-full p-4">
              <DependencyGraph dependencies={filteredDeps} />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
