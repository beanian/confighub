import { useState, useEffect } from 'react';
import { api, ConfigHistoryEntry } from '../api/client';
import clsx from 'clsx';

interface ConfigHistoryProps {
  env: string;
  domain: string;
  configKey: string;
  onSelectVersion?: (content: string, commit: string) => void;
  onRollback?: (commit: string) => void;
}

const typeIcons: Record<string, string> = {
  merge: '⎇',
  promote: '↗',
  rollback: '↩',
  other: '●',
};

const typeColors: Record<string, string> = {
  merge: 'text-green-600 bg-green-100',
  promote: 'text-blue-600 bg-blue-100',
  rollback: 'text-amber-600 bg-amber-100',
  other: 'text-gray-600 bg-gray-100',
};

export function ConfigHistory({
  env,
  domain,
  configKey,
  onSelectVersion,
  onRollback,
}: ConfigHistoryProps) {
  const [history, setHistory] = useState<ConfigHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [showRollbackModal, setShowRollbackModal] = useState<string | null>(null);
  const [rollbackReason, setRollbackReason] = useState('');
  const [rollingBack, setRollingBack] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [env, domain, configKey]);

  async function loadHistory() {
    setLoading(true);
    try {
      const result = await api.getConfigHistory(env, domain, configKey);
      setHistory(result.history);
    } catch (error) {
      console.error('Error loading config history:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectVersion(commit: string) {
    if (!onSelectVersion) return;
    setSelectedCommit(commit);
    setLoadingContent(true);

    try {
      const result = await api.getConfigAtCommit(env, domain, configKey, commit);
      onSelectVersion(result.content, commit);
    } catch (error) {
      console.error('Error loading version:', error);
    } finally {
      setLoadingContent(false);
    }
  }

  async function handleRollback() {
    if (!showRollbackModal || !rollbackReason) return;
    setRollingBack(true);

    try {
      await api.rollbackConfig(env, domain, configKey, showRollbackModal, rollbackReason);
      setShowRollbackModal(null);
      setRollbackReason('');
      loadHistory();
      onRollback?.(showRollbackModal);
    } catch (error) {
      console.error('Error rolling back:', error);
      alert(error instanceof Error ? error.message : 'Failed to rollback');
    } finally {
      setRollingBack(false);
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400">
        Loading history...
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400">
        No history available
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />

      {/* Entries */}
      <div className="space-y-0">
        {history.map((entry, idx) => {
          const { date, time } = formatDate(entry.date);
          const isSelected = selectedCommit === entry.sha;
          const isFirst = idx === 0;

          return (
            <div
              key={entry.sha}
              className={clsx(
                'relative pl-10 pr-4 py-3 hover:bg-gray-50 transition-all',
                isSelected && 'bg-blue-50'
              )}
            >
              {/* Timeline dot */}
              <div
                className={clsx(
                  'absolute left-2 w-5 h-5 rounded-full flex items-center justify-center text-xs',
                  typeColors[entry.type]
                )}
              >
                {typeIcons[entry.type]}
              </div>

              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Commit info */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                      {entry.sha.substring(0, 7)}
                    </span>
                    <span className="text-xs text-gray-500">{entry.author}</span>
                    <span className="text-xs text-gray-400">
                      {date} {time}
                    </span>
                    {isFirst && (
                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                        Current
                      </span>
                    )}
                  </div>

                  {/* Message */}
                  <p className="text-sm text-gray-700 truncate">{entry.message}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {onSelectVersion && (
                    <button
                      onClick={() => handleSelectVersion(entry.sha)}
                      disabled={loadingContent && selectedCommit === entry.sha}
                      className={clsx(
                        'px-2 py-1 text-xs rounded transition-all',
                        isSelected
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-500 hover:bg-gray-100'
                      )}
                    >
                      {loadingContent && selectedCommit === entry.sha
                        ? 'Loading...'
                        : 'View'}
                    </button>
                  )}
                  {!isFirst && onRollback && (
                    <button
                      onClick={() => setShowRollbackModal(entry.sha)}
                      className="px-2 py-1 text-xs text-amber-600 hover:bg-amber-50 rounded transition-all"
                    >
                      Rollback
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rollback modal */}
      {showRollbackModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Rollback Configuration
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              This will restore <strong>{domain}/{configKey}</strong> in{' '}
              <strong>{env}</strong> to commit{' '}
              <code className="bg-gray-100 px-1 rounded">
                {showRollbackModal.substring(0, 7)}
              </code>
              . A new commit will be created with the old content.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for rollback *
              </label>
              <textarea
                value={rollbackReason}
                onChange={(e) => setRollbackReason(e.target.value)}
                placeholder="Explain why this config needs to be rolled back..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowRollbackModal(null);
                  setRollbackReason('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-all text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleRollback}
                disabled={!rollbackReason || rollingBack}
                className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-all text-sm font-medium disabled:opacity-50"
              >
                {rollingBack ? 'Rolling back...' : 'Confirm Rollback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
