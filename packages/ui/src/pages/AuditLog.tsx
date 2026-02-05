import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { EnvironmentBadge } from '../components/EnvironmentSwitcher';
import { api, AuditEntry } from '../api/client';
import { Environment } from '../hooks/useEnvironment';
import clsx from 'clsx';

const actionLabels: Record<string, string> = {
  'change_request.created': 'CR Created',
  'change_request.submitted': 'CR Submitted',
  'change_request.approved': 'CR Approved',
  'change_request.rejected': 'CR Rejected',
  'change_request.merged': 'CR Merged',
  'change_request.discarded': 'CR Discarded',
  'promotion.created': 'Promo Created',
  'promotion.approved': 'Promo Approved',
  'promotion.rejected': 'Promo Rejected',
  'promotion.executed': 'Promo Executed',
  'promotion.failed': 'Promo Failed',
  'promotion.rolled_back': 'Promo Rollback',
  'config.rollback': 'Config Rollback',
  'auth.login': 'Login',
  'auth.logout': 'Logout',
};

const actionColors: Record<string, string> = {
  'change_request.created': 'text-blue-600',
  'change_request.submitted': 'text-amber-600',
  'change_request.approved': 'text-green-600',
  'change_request.rejected': 'text-red-600',
  'change_request.merged': 'text-green-700',
  'change_request.discarded': 'text-gray-500',
  'promotion.created': 'text-blue-600',
  'promotion.approved': 'text-green-600',
  'promotion.rejected': 'text-red-600',
  'promotion.executed': 'text-green-700',
  'promotion.failed': 'text-red-700',
  'promotion.rolled_back': 'text-amber-600',
  'config.rollback': 'text-amber-600',
  'auth.login': 'text-gray-600',
  'auth.logout': 'text-gray-500',
};

export function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Filters
  const [envFilter, setEnvFilter] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    loadEntries();
  }, [page, envFilter, actionFilter, searchTerm]);

  async function loadEntries() {
    setLoading(true);
    try {
      const result = await api.getAuditEntries({
        limit: pageSize,
        offset: page * pageSize,
        environment: envFilter || undefined,
        action: actionFilter || undefined,
        search: searchTerm || undefined,
      });
      setEntries(result.entries);
      setTotal(result.total);
    } catch (error) {
      console.error('Error loading audit entries:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchTerm(searchInput);
    setPage(0);
  }

  function formatTimestamp(ts: string) {
    const date = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    let relative = '';
    if (minutes < 1) relative = 'now';
    else if (minutes < 60) relative = `${minutes}m ago`;
    else if (hours < 24) relative = `${hours}h ago`;
    else if (days < 7) relative = `${days}d ago`;
    else relative = date.toLocaleDateString();

    return { relative, full: date.toISOString().replace('T', ' ').split('.')[0] };
  }

  function getEntityLink(entry: AuditEntry) {
    if (!entry.entity_id) return null;

    if (entry.entity_type === 'change_request') {
      return `/changes/${entry.entity_id}`;
    }
    if (entry.entity_type === 'promotion') {
      return `/promotions/${entry.entity_id}`;
    }
    return null;
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <Layout>
      <div className="h-full flex flex-col bg-gray-900 text-gray-100">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-700 bg-gray-800">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-sm font-semibold text-gray-100 tracking-wide">
              AUDIT LOG
            </h1>
            <span className="text-xs text-gray-500 font-mono">
              {total.toLocaleString()} entries
            </span>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <form onSubmit={handleSearch} className="flex-1 max-w-xs">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search..."
                className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </form>

            <select
              value={envFilter}
              onChange={(e) => {
                setEnvFilter(e.target.value);
                setPage(0);
              }}
              className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Environments</option>
              <option value="dev">Development</option>
              <option value="staging">Staging</option>
              <option value="prod">Production</option>
            </select>

            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(0);
              }}
              className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-blue-500"
            >
              <option value="">All Actions</option>
              <optgroup label="Change Requests">
                <option value="change_request.created">Created</option>
                <option value="change_request.submitted">Submitted</option>
                <option value="change_request.approved">Approved</option>
                <option value="change_request.rejected">Rejected</option>
                <option value="change_request.merged">Merged</option>
              </optgroup>
              <optgroup label="Promotions">
                <option value="promotion.created">Created</option>
                <option value="promotion.approved">Approved</option>
                <option value="promotion.rejected">Rejected</option>
                <option value="promotion.executed">Executed</option>
                <option value="promotion.rolled_back">Rolled Back</option>
              </optgroup>
              <optgroup label="Config">
                <option value="config.rollback">Rollback</option>
              </optgroup>
              <optgroup label="Auth">
                <option value="auth.login">Login</option>
                <option value="auth.logout">Logout</option>
              </optgroup>
            </select>

            {(envFilter || actionFilter || searchTerm) && (
              <button
                onClick={() => {
                  setEnvFilter('');
                  setActionFilter('');
                  setSearchTerm('');
                  setSearchInput('');
                  setPage(0);
                }}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-800 sticky top-0">
              <tr className="border-b border-gray-700">
                <th className="text-left px-3 py-2 font-medium text-gray-400 w-32">
                  TIMESTAMP
                </th>
                <th className="text-left px-3 py-2 font-medium text-gray-400 w-32">
                  ACTOR
                </th>
                <th className="text-left px-3 py-2 font-medium text-gray-400 w-28">
                  ACTION
                </th>
                <th className="text-left px-3 py-2 font-medium text-gray-400 w-20">
                  ENV
                </th>
                <th className="text-left px-3 py-2 font-medium text-gray-400 w-24">
                  DOMAIN
                </th>
                <th className="text-left px-3 py-2 font-medium text-gray-400 w-24">
                  ENTITY
                </th>
                <th className="text-left px-3 py-2 font-medium text-gray-400">
                  DETAILS
                </th>
                <th className="text-left px-3 py-2 font-medium text-gray-400 w-20">
                  COMMIT
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                    No audit entries found
                  </td>
                </tr>
              ) : (
                entries.map((entry, idx) => {
                  const ts = formatTimestamp(entry.timestamp);
                  const link = getEntityLink(entry);

                  return (
                    <tr
                      key={entry.id}
                      className={clsx(
                        'border-b border-gray-800 hover:bg-gray-800/50',
                        idx % 2 === 0 ? 'bg-gray-900' : 'bg-gray-900/50'
                      )}
                    >
                      <td className="px-3 py-2 font-mono text-gray-400" title={ts.full}>
                        {ts.relative}
                      </td>
                      <td className="px-3 py-2 text-gray-300 truncate max-w-[120px]">
                        {entry.actor.split('@')[0]}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={clsx(
                            'font-medium',
                            actionColors[entry.action] || 'text-gray-400'
                          )}
                        >
                          {actionLabels[entry.action] || entry.action}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {entry.environment && (
                          <EnvironmentBadge env={entry.environment as Environment} />
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-400 truncate max-w-[100px]">
                        {entry.domain || '-'}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {link ? (
                          <Link
                            to={link}
                            className="text-blue-400 hover:text-blue-300 hover:underline"
                          >
                            {entry.entity_id}
                          </Link>
                        ) : (
                          <span className="text-gray-500">
                            {entry.entity_id || '-'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-400 truncate max-w-[200px]">
                        {entry.details
                          ? Object.entries(entry.details)
                              .filter(([_, v]) => v != null)
                              .map(([k, v]) => `${k}=${String(v).substring(0, 20)}`)
                              .join(' ')
                          : '-'}
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-500">
                        {entry.commit_sha ? entry.commit_sha.substring(0, 7) : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-2 border-t border-gray-700 bg-gray-800 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Showing {page * pageSize + 1}-
            {Math.min((page + 1) * pageSize, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-xs bg-gray-700 border border-gray-600 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <span className="text-xs text-gray-500">
              Page {page + 1} of {totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 text-xs bg-gray-700 border border-gray-600 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
