import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { DiffViewer } from '../components/DiffViewer';
import { EnvironmentBadge } from '../components/EnvironmentSwitcher';
import { ImpactPanel } from '../components/ImpactPanel';
import { api, PromotionRequest, PromotionPreview } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { Environment } from '../hooks/useEnvironment';
import clsx from 'clsx';

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-blue-100 text-blue-800 border-blue-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  promoted: 'bg-green-100 text-green-800 border-green-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
  rolled_back: 'bg-gray-100 text-gray-800 border-gray-200',
};

export function PromotionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [promotion, setPromotion] = useState<PromotionRequest | null>(null);
  const [preview, setPreview] = useState<PromotionPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<number>(0);

  // Review form
  const [reviewNotes, setReviewNotes] = useState('');
  const [rollbackReason, setRollbackReason] = useState('');
  const [showRollbackModal, setShowRollbackModal] = useState(false);

  // Impact tracking for prod promotions
  const [hasActiveConsumers, setHasActiveConsumers] = useState(false);
  const [impactAcknowledged, setImpactAcknowledged] = useState(false);
  const [showImpactWarningModal, setShowImpactWarningModal] = useState(false);

  useEffect(() => {
    loadPromotion();
  }, [id]);

  async function loadPromotion() {
    if (!id) return;
    setLoading(true);

    try {
      const [promotionData, previewData] = await Promise.all([
        api.getPromotion(id),
        api.getPromotionPreview(id),
      ]);
      setPromotion(promotionData);
      setPreview(previewData);
    } catch (error) {
      console.error('Error loading promotion:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    if (!id) return;
    setActionLoading(true);

    try {
      const updated = await api.approvePromotion(id, reviewNotes || undefined);
      setPromotion(updated);
      setReviewNotes('');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to approve');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!id || !reviewNotes) {
      alert('Please provide review notes explaining the rejection');
      return;
    }
    setActionLoading(true);

    try {
      const updated = await api.rejectPromotion(id, reviewNotes);
      setPromotion(updated);
      setReviewNotes('');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to reject');
    } finally {
      setActionLoading(false);
    }
  }

  function handleImpactLoaded(hasActive: boolean) {
    setHasActiveConsumers(hasActive);
  }

  function handleExecuteClick() {
    // If promoting to prod with active consumers, require acknowledgment
    if (promotion?.target_env === 'prod' && hasActiveConsumers && !impactAcknowledged) {
      setShowImpactWarningModal(true);
      return;
    }
    handleExecute();
  }

  async function handleExecute() {
    if (!id) return;
    setActionLoading(true);

    try {
      const updated = await api.executePromotion(id);
      setPromotion(updated);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to execute promotion');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRollback() {
    if (!id || !rollbackReason) {
      alert('Please provide a reason for the rollback');
      return;
    }
    setActionLoading(true);

    try {
      const updated = await api.rollbackPromotion(id, rollbackReason);
      setPromotion(updated);
      setShowRollbackModal(false);
      setRollbackReason('');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to rollback');
    } finally {
      setActionLoading(false);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString();
  }

  // Admins can approve their own promotions
  const canApprove =
    promotion?.status === 'pending' &&
    (promotion.requested_by !== user?.id || user?.role === 'admin');
  const canExecute = promotion?.status === 'approved';
  const canRollback = promotion?.status === 'promoted';

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full text-gray-400">
          Loading...
        </div>
      </Layout>
    );
  }

  if (!promotion) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full text-gray-400">
          Promotion not found
        </div>
      </Layout>
    );
  }

  const currentFile = preview?.files[selectedFile];

  return (
    <Layout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/promotions')}
                className="text-gray-500 hover:text-gray-700"
              >
                ←
              </button>
              <h1 className="text-lg font-semibold font-mono">{promotion.id}</h1>
              <span
                className={clsx(
                  'px-2 py-1 text-sm font-medium rounded border',
                  statusColors[promotion.status]
                )}
              >
                {promotion.status}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {canApprove && (
                <>
                  <button
                    onClick={handleReject}
                    disabled={actionLoading}
                    className="px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 transition-all text-sm font-medium disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-all text-sm font-medium disabled:opacity-50"
                  >
                    Approve
                  </button>
                </>
              )}
              {canExecute && (
                <button
                  onClick={handleExecuteClick}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-all text-sm font-medium disabled:opacity-50"
                >
                  Execute Promotion
                </button>
              )}
              {canRollback && (
                <button
                  onClick={() => setShowRollbackModal(true)}
                  disabled={actionLoading}
                  className="px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 transition-all text-sm font-medium disabled:opacity-50"
                >
                  Rollback
                </button>
              )}
            </div>
          </div>

          {/* Promotion info */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <EnvironmentBadge env={promotion.source_env as Environment} />
              <span className="text-gray-400 text-lg">→</span>
              <EnvironmentBadge env={promotion.target_env as Environment} />
            </div>
            <span className="text-gray-400">|</span>
            <span className="font-mono text-gray-700">{promotion.domain}</span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600">
              {promotion.files.length} file{promotion.files.length !== 1 ? 's' : ''}
            </span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600">by {promotion.requested_by}</span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-500">{formatDate(promotion.requested_at)}</span>
          </div>

          {promotion.notes && (
            <div className="mt-3 p-3 bg-gray-50 rounded-md text-sm text-gray-700">
              <span className="font-medium">Notes:</span> {promotion.notes}
            </div>
          )}

          {promotion.review_notes && (
            <div className="mt-3 p-3 bg-blue-50 rounded-md text-sm text-gray-700">
              <span className="font-medium">Review notes:</span> {promotion.review_notes}
            </div>
          )}

          {/* Review notes input for pending */}
          {canApprove && (
            <div className="mt-3">
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add review notes (required for rejection)..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                rows={2}
              />
            </div>
          )}
        </div>

        {/* File tabs and diff */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* File tabs */}
          {preview && preview.files.length > 1 && (
            <div className="px-4 py-2 border-b border-gray-200 bg-gray-50 flex gap-1 overflow-x-auto">
              {preview.files.map((file, idx) => (
                <button
                  key={file.file}
                  onClick={() => setSelectedFile(idx)}
                  className={clsx(
                    'px-3 py-1.5 text-xs font-mono rounded-md transition-all whitespace-nowrap',
                    selectedFile === idx
                      ? 'bg-white border border-gray-200 shadow-sm'
                      : 'text-gray-600 hover:bg-white'
                  )}
                >
                  {file.file}
                </button>
              ))}
            </div>
          )}

          {/* Impact Analysis for target environment */}
          {currentFile && (
            <ImpactPanel
              environment={promotion.target_env}
              domain={promotion.domain}
              configKey={currentFile.file}
              onImpactLoaded={handleImpactLoaded}
            />
          )}

          {/* Diff view */}
          <div className="flex-1 overflow-auto p-4">
            {currentFile ? (
              <DiffViewer
                oldContent={currentFile.targetContent || '# File does not exist in target environment'}
                newContent={currentFile.sourceContent}
                oldLabel={`${promotion.target_env}: ${promotion.domain}/${currentFile.file}`}
                newLabel={`${promotion.source_env}: ${promotion.domain}/${currentFile.file}`}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                No preview available
              </div>
            )}
          </div>
        </div>

        {/* Production Impact Warning modal */}
        {showImpactWarningModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl text-red-600">⚠</span>
                <h2 className="text-lg font-semibold text-red-800">
                  Production Consumers Detected
                </h2>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                <p className="text-sm text-red-800">
                  This promotion will affect <strong>active production applications</strong> that
                  are currently consuming this configuration. Ensure you have:
                </p>
                <ul className="mt-2 text-sm text-red-700 list-disc list-inside space-y-1">
                  <li>Reviewed all changes in the diff view</li>
                  <li>Notified the affected teams (see consumer list)</li>
                  <li>Confirmed the changes are safe for production</li>
                </ul>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowImpactWarningModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setImpactAcknowledged(true);
                    setShowImpactWarningModal(false);
                    handleExecute();
                  }}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-all text-sm font-medium disabled:opacity-50"
                >
                  I Understand, Execute Promotion
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rollback modal */}
        {showRollbackModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Rollback Promotion
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                This will restore the files in{' '}
                <strong>{promotion.target_env}</strong> to their state before this
                promotion. This action creates a new commit and cannot be undone.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for rollback *
                </label>
                <textarea
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                  placeholder="Explain why this promotion needs to be rolled back..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowRollbackModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRollback}
                  disabled={!rollbackReason || actionLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-all text-sm font-medium disabled:opacity-50"
                >
                  {actionLoading ? 'Rolling back...' : 'Confirm Rollback'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
