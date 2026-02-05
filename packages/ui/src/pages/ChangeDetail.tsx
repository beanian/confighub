import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { DiffViewer } from '../components/DiffViewer';
import { api, ChangeRequest, Operation } from '../api/client';
import clsx from 'clsx';

type Action = 'submit' | 'approve' | 'reject' | 'merge' | 'discard';

const statusConfig: Record<string, { label: string; color: string; actions: Action[] }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', actions: ['submit', 'discard'] },
  pending_review: { label: 'Pending Review', color: 'bg-amber-100 text-amber-700', actions: ['approve', 'reject', 'discard'] },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700', actions: ['merge'] },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', actions: ['discard'] },
  merged: { label: 'Merged', color: 'bg-blue-100 text-blue-700', actions: [] },
  discarded: { label: 'Discarded', color: 'bg-gray-100 text-gray-500', actions: [] },
};

const operationLabels: Record<Operation, { label: string; color: string }> = {
  update: { label: 'Update', color: 'bg-blue-100 text-blue-700' },
  create: { label: 'Create', color: 'bg-green-100 text-green-700' },
  delete: { label: 'Delete', color: 'bg-red-100 text-red-700' },
  create_domain: { label: 'Create Domain', color: 'bg-green-100 text-green-700' },
  delete_domain: { label: 'Delete Domain', color: 'bg-red-100 text-red-700' },
};

interface ChangeDetail extends ChangeRequest {
  currentContent: string;
  proposedContent: string;
}

export function ChangeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [change, setChange] = useState<ChangeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  const loadChange = async () => {
    if (!id) return;
    try {
      const data = await api.getChangeRequest(id);
      setChange(data as ChangeDetail);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChange();
  }, [id]);

  const handleAction = async (action: Action) => {
    if (!id) return;
    setActionLoading(true);
    try {
      switch (action) {
        case 'submit':
          await api.submitForReview(id);
          break;
        case 'approve':
          await api.approveChange(id);
          break;
        case 'reject':
          if (!rejectComment.trim()) return;
          await api.rejectChange(id, rejectComment);
          setShowRejectModal(false);
          break;
        case 'merge':
          await api.mergeChange(id);
          break;
        case 'discard':
          await api.discardChange(id);
          setShowDiscardModal(false);
          navigate('/changes');
          return;
      }
      await loadChange();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full text-gray-400">Loading...</div>
      </Layout>
    );
  }

  if (!change) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full text-gray-400">
          Change request not found
        </div>
      </Layout>
    );
  }

  const config = statusConfig[change.status] || statusConfig.draft;
  const operation = change.operation || 'update';
  const operationConfig = operationLabels[operation];

  return (
    <Layout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border bg-surface-raised">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => navigate('/changes')}
              className="text-sm text-gray-500 hover:text-gray-700 transition-fast"
            >
              &larr; Back to Changes
            </button>
            <div className="flex items-center gap-2">
              <span className={clsx('text-xs px-2 py-1 rounded-full font-medium', operationConfig.color)}>
                {operationConfig.label}
              </span>
              <span className={clsx('text-xs px-2 py-1 rounded-full font-medium', config.color)}>
                {config.label}
              </span>
            </div>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">{change.title}</h1>
          <div className="text-sm text-gray-500 mt-1">
            {change.domain}
            {change.key_name && `/${change.key_name}`}
            {' '}&rarr; {change.target_environment}
            <span className="mx-2">&bull;</span>
            Created {new Date(change.created_at).toLocaleDateString()}
          </div>
          {change.description && (
            <p className="text-sm text-gray-600 mt-2">{change.description}</p>
          )}
        </div>

        {/* Actions */}
        {config.actions.length > 0 && (
          <div className="px-4 py-3 border-b border-border bg-gray-50 flex gap-2">
            {config.actions.includes('submit') && (
              <button
                onClick={() => handleAction('submit')}
                disabled={actionLoading}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-md transition-fast disabled:opacity-50"
              >
                Submit for Review
              </button>
            )}
            {config.actions.includes('approve') && (
              <button
                onClick={() => handleAction('approve')}
                disabled={actionLoading}
                className="px-4 py-2 bg-success hover:bg-green-600 text-white text-sm font-medium rounded-md transition-fast disabled:opacity-50"
              >
                Approve
              </button>
            )}
            {config.actions.includes('reject') && (
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={actionLoading}
                className="px-4 py-2 bg-danger hover:bg-red-600 text-white text-sm font-medium rounded-md transition-fast disabled:opacity-50"
              >
                Reject
              </button>
            )}
            {config.actions.includes('merge') && (
              <button
                onClick={() => handleAction('merge')}
                disabled={actionLoading}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-md transition-fast disabled:opacity-50"
              >
                Merge Changes
              </button>
            )}
            {config.actions.includes('discard') && (
              <button
                onClick={() => setShowDiscardModal(true)}
                disabled={actionLoading}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-md transition-fast disabled:opacity-50 ml-auto"
              >
                Discard
              </button>
            )}
          </div>
        )}

        {/* Diff */}
        <div className="flex-1 p-4 overflow-auto">
          <DiffViewer
            oldContent={change.currentContent || ''}
            newContent={change.proposedContent || ''}
            oldLabel="Current"
            newLabel="Proposed"
          />
        </div>

        {/* Reject Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Reject Change</h2>
              <textarea
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                placeholder="Explain why this change is being rejected..."
                className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent h-32 resize-none"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-fast"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAction('reject')}
                  disabled={!rejectComment.trim() || actionLoading}
                  className="px-4 py-2 bg-danger hover:bg-red-600 text-white text-sm font-medium rounded-md transition-fast disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Discard Modal */}
        {showDiscardModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Discard Change Request</h2>
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to discard this change request? This will delete the draft branch and cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowDiscardModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-fast"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAction('discard')}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-danger hover:bg-red-600 text-white text-sm font-medium rounded-md transition-fast disabled:opacity-50"
                >
                  {actionLoading ? 'Discarding...' : 'Discard'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
