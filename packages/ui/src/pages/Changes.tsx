import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { api, ChangeRequest, Operation } from '../api/client';
import clsx from 'clsx';

const statusConfig = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  pending_review: { label: 'Pending Review', color: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
  merged: { label: 'Merged', color: 'bg-blue-100 text-blue-700' },
  discarded: { label: 'Discarded', color: 'bg-gray-100 text-gray-500' },
};

const operationIcons: Record<Operation, string> = {
  update: '✎',
  create: '+',
  delete: '−',
  create_domain: '📁+',
  delete_domain: '📁−',
};

export function Changes() {
  const [changes, setChanges] = useState<ChangeRequest[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getChangeRequests()
      .then(setChanges)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredChanges =
    filter === 'all' ? changes : changes.filter((c) => c.status === filter);

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Change Requests</h1>
          <Link
            to="/browse"
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-md transition-all"
          >
            New Change
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {['all', 'draft', 'pending_review', 'approved', 'merged'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={clsx(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-all',
                filter === status
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {status === 'all'
                ? 'All'
                : statusConfig[status as keyof typeof statusConfig]?.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="text-gray-400">Loading...</div>
        ) : filteredChanges.length === 0 ? (
          <div className="text-gray-400">No change requests found</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
            {filteredChanges.map((change) => {
              const operation = change.operation || 'update';
              return (
                <Link
                  key={change.id}
                  to={`/changes/${change.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-8 h-8 flex items-center justify-center rounded bg-gray-100 text-gray-600 text-sm"
                      title={operation}
                    >
                      {operationIcons[operation]}
                    </span>
                    <div>
                      <div className="font-medium text-gray-900">{change.title}</div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        {change.domain}
                        {change.key_name && `/${change.key_name}`}
                        {' '}&rarr; {change.target_environment}
                        <span className="mx-2">&bull;</span>
                        {new Date(change.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <span
                    className={clsx(
                      'text-xs px-2 py-1 rounded-full font-medium',
                      statusConfig[change.status]?.color || statusConfig.draft.color
                    )}
                  >
                    {statusConfig[change.status]?.label || change.status}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
