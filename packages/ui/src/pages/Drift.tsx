import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { DiffViewer } from '../components/DiffViewer';
import { api, DriftAnalysis, DriftDiff } from '../api/client';
import clsx from 'clsx';

const statusConfig = {
  synced: {
    label: 'Synced',
    color: 'bg-emerald-500',
    textColor: 'text-emerald-700',
    bgLight: 'bg-emerald-50',
    border: 'border-emerald-200',
    description: 'Identical across all environments',
  },
  drifted: {
    label: 'Drifted',
    color: 'bg-red-500',
    textColor: 'text-red-700',
    bgLight: 'bg-red-50',
    border: 'border-red-200',
    description: 'Content differs between environments',
  },
  partial: {
    label: 'Partial',
    color: 'bg-amber-500',
    textColor: 'text-amber-700',
    bgLight: 'bg-amber-50',
    border: 'border-amber-200',
    description: 'Missing in some environments',
  },
  'dev-only': {
    label: 'Dev Only',
    color: 'bg-blue-500',
    textColor: 'text-blue-700',
    bgLight: 'bg-blue-50',
    border: 'border-blue-200',
    description: 'Only exists in development',
  },
};

function SyncGauge({ percentage }: { percentage: number }) {
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const color = percentage === 100 ? '#10b981' : percentage >= 75 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative w-28 h-28">
      <svg className="w-28 h-28 transform -rotate-90">
        <circle
          cx="56"
          cy="56"
          r="40"
          stroke="#e5e7eb"
          strokeWidth="12"
          fill="none"
        />
        <circle
          cx="56"
          cy="56"
          r="40"
          stroke={color}
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-gray-900">{percentage}%</span>
        <span className="text-xs text-gray-500">synced</span>
      </div>
    </div>
  );
}

function EnvCell({
  exists,
  status,
  envName,
  onClick
}: {
  exists: boolean;
  status: 'same' | 'different' | 'missing-source' | 'missing-target';
  envName: string;
  onClick?: () => void;
}) {
  if (!exists) {
    return (
      <div className="w-8 h-8 rounded flex items-center justify-center bg-gray-100 text-gray-400">
        <span className="text-xs">—</span>
      </div>
    );
  }

  const colors = {
    same: 'bg-emerald-500',
    different: 'bg-red-500',
    'missing-source': 'bg-amber-500',
    'missing-target': 'bg-amber-500',
  };

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-8 h-8 rounded flex items-center justify-center transition-transform hover:scale-110',
        colors[status]
      )}
      title={`${envName}: ${status}`}
    >
      <span className="text-white text-xs font-bold">
        {envName[0].toUpperCase()}
      </span>
    </button>
  );
}

export function Drift() {
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<DriftAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedConfig, setSelectedConfig] = useState<{
    domain: string;
    key: string;
    source: string;
    target: string;
  } | null>(null);
  const [diffData, setDiffData] = useState<DriftDiff | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAnalysis();
  }, []);

  useEffect(() => {
    if (selectedConfig) {
      loadDiff();
    }
  }, [selectedConfig]);

  async function loadAnalysis() {
    setLoading(true);
    try {
      const data = await api.getDriftAnalysis();
      setAnalysis(data);
      // Expand domains with drift by default
      const driftedDomains = new Set(
        data.domains
          .filter(d => d.syncPercentage < 100)
          .map(d => d.domain)
      );
      setExpandedDomains(driftedDomains);
    } catch (error) {
      console.error('Error loading drift analysis:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadDiff() {
    if (!selectedConfig) return;
    setLoadingDiff(true);
    try {
      const data = await api.getDriftDiff(
        selectedConfig.domain,
        selectedConfig.key,
        selectedConfig.source,
        selectedConfig.target
      );
      setDiffData(data);
    } catch (error) {
      console.error('Error loading diff:', error);
    } finally {
      setLoadingDiff(false);
    }
  }

  function toggleDomain(domain: string) {
    setExpandedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  }

  function handleCellClick(domain: string, key: string, source: string, target: string) {
    setSelectedConfig({ domain, key, source, target });
  }

  function handlePromote(domain: string, keys: string[], sourceEnv: string) {
    // Navigate to promotions page with pre-filled data
    navigate(`/promotions?domain=${domain}&source=${sourceEnv}&keys=${keys.join(',')}`);
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Analyzing environment drift...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!analysis) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full text-gray-400">
          Failed to load drift analysis
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="h-full flex">
        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header with summary */}
          <div className="p-6 border-b border-border bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">
                  Environment Drift Dashboard
                </h1>
                <p className="text-gray-500">
                  Real-time synchronization status across dev, staging, and production
                </p>
              </div>
              <button
                onClick={loadAnalysis}
                className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-fast text-sm font-medium flex items-center gap-2"
              >
                <span>↻</span> Refresh
              </button>
            </div>

            {/* Stats cards */}
            <div className="mt-6 grid grid-cols-5 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                <SyncGauge percentage={analysis.summary.overallSyncPercentage} />
                <div>
                  <div className="text-sm text-gray-500">Overall</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {analysis.summary.totalConfigs} configs
                  </div>
                </div>
              </div>

              {Object.entries(statusConfig).map(([key, config]) => {
                const count = analysis.summary[key as keyof typeof analysis.summary] as number;
                return (
                  <div
                    key={key}
                    className={clsx(
                      'rounded-xl border p-4',
                      config.bgLight,
                      config.border
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={clsx('w-3 h-3 rounded-full', config.color)} />
                      <span className={clsx('text-sm font-medium', config.textColor)}>
                        {config.label}
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{count}</div>
                    <div className="text-xs text-gray-500 mt-1">{config.description}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Domain matrix */}
          <div className="flex-1 overflow-auto p-6">
            <div className="space-y-4">
              {analysis.domains.map((domain) => (
                <div
                  key={domain.domain}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                >
                  {/* Domain header */}
                  <button
                    onClick={() => toggleDomain(domain.domain)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-fast"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400">
                        {expandedDomains.has(domain.domain) ? '▼' : '▶'}
                      </span>
                      <span className="font-mono font-semibold text-gray-900">
                        {domain.domain}
                      </span>
                      <span className="text-sm text-gray-500">
                        {domain.totalConfigs} config{domain.totalConfigs !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      {/* Mini sync bar */}
                      <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={clsx(
                            'h-full rounded-full transition-all',
                            domain.syncPercentage === 100
                              ? 'bg-emerald-500'
                              : domain.syncPercentage >= 75
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                          )}
                          style={{ width: `${domain.syncPercentage}%` }}
                        />
                      </div>
                      <span
                        className={clsx(
                          'text-sm font-medium w-12 text-right',
                          domain.syncPercentage === 100
                            ? 'text-emerald-600'
                            : domain.syncPercentage >= 75
                            ? 'text-amber-600'
                            : 'text-red-600'
                        )}
                      >
                        {domain.syncPercentage}%
                      </span>
                    </div>
                  </button>

                  {/* Config matrix */}
                  {expandedDomains.has(domain.domain) && (
                    <div className="border-t border-gray-200">
                      {/* Header row */}
                      <div className="grid grid-cols-[1fr,auto,auto,auto,auto,auto] gap-2 px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500">
                        <div>Config Key</div>
                        <div className="w-8 text-center">DEV</div>
                        <div className="w-12 text-center text-gray-400">→</div>
                        <div className="w-8 text-center">STG</div>
                        <div className="w-12 text-center text-gray-400">→</div>
                        <div className="w-8 text-center">PRD</div>
                      </div>

                      {/* Config rows */}
                      {domain.configs.map((config) => {
                        const sc = statusConfig[config.status];
                        return (
                          <div
                            key={config.key}
                            className={clsx(
                              'grid grid-cols-[1fr,auto,auto,auto,auto,auto] gap-2 px-4 py-2 items-center border-t border-gray-100 hover:bg-gray-50 transition-fast',
                              selectedConfig?.domain === domain.domain &&
                                selectedConfig?.key === config.key &&
                                'bg-accent/5'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={clsx('w-2 h-2 rounded-full', sc.color)}
                              />
                              <span className="font-mono text-sm text-gray-900">
                                {config.key}
                              </span>
                              <span
                                className={clsx(
                                  'text-xs px-1.5 py-0.5 rounded',
                                  sc.bgLight,
                                  sc.textColor
                                )}
                              >
                                {sc.label}
                              </span>
                            </div>

                            <EnvCell
                              exists={config.dev.exists}
                              status="same"
                              envName="dev"
                            />

                            <div className="w-12 flex justify-center">
                              {config.driftDetails?.devVsStaging === 'different' ? (
                                <button
                                  onClick={() => handleCellClick(domain.domain, config.key, 'dev', 'staging')}
                                  className="text-red-500 hover:text-red-700 font-bold"
                                  title="Click to view diff"
                                >
                                  ≠
                                </button>
                              ) : config.driftDetails?.devVsStaging === 'missing-target' ? (
                                <span className="text-amber-500">→</span>
                              ) : config.driftDetails?.devVsStaging === 'missing-source' ? (
                                <span className="text-amber-500">←</span>
                              ) : (
                                <span className="text-emerald-500">=</span>
                              )}
                            </div>

                            <EnvCell
                              exists={config.staging.exists}
                              status={config.driftDetails?.devVsStaging || 'same'}
                              envName="staging"
                              onClick={() => handleCellClick(domain.domain, config.key, 'dev', 'staging')}
                            />

                            <div className="w-12 flex justify-center">
                              {config.driftDetails?.stagingVsProd === 'different' ? (
                                <button
                                  onClick={() => handleCellClick(domain.domain, config.key, 'staging', 'prod')}
                                  className="text-red-500 hover:text-red-700 font-bold"
                                  title="Click to view diff"
                                >
                                  ≠
                                </button>
                              ) : config.driftDetails?.stagingVsProd === 'missing-target' ? (
                                <span className="text-amber-500">→</span>
                              ) : config.driftDetails?.stagingVsProd === 'missing-source' ? (
                                <span className="text-amber-500">←</span>
                              ) : (
                                <span className="text-emerald-500">=</span>
                              )}
                            </div>

                            <EnvCell
                              exists={config.prod.exists}
                              status={config.driftDetails?.stagingVsProd || 'same'}
                              envName="prod"
                              onClick={() => handleCellClick(domain.domain, config.key, 'staging', 'prod')}
                            />
                          </div>
                        );
                      })}

                      {/* Quick actions */}
                      {domain.syncPercentage < 100 && (
                        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                          <span className="text-sm text-gray-500">
                            {domain.configs.filter(c => c.status !== 'synced').length} config(s) out of sync
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const driftedKeys = domain.configs
                                  .filter(c => c.driftDetails?.devVsStaging !== 'same' && c.dev.exists)
                                  .map(c => c.key);
                                if (driftedKeys.length > 0) {
                                  handlePromote(domain.domain, driftedKeys, 'dev');
                                }
                              }}
                              className="px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-fast"
                            >
                              Sync to Staging
                            </button>
                            <button
                              onClick={() => {
                                const driftedKeys = domain.configs
                                  .filter(c => c.driftDetails?.stagingVsProd !== 'same' && c.staging.exists)
                                  .map(c => c.key);
                                if (driftedKeys.length > 0) {
                                  handlePromote(domain.domain, driftedKeys, 'staging');
                                }
                              }}
                              className="px-3 py-1.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-fast"
                            >
                              Sync to Prod
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {analysis.domains.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  No configurations found
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Diff sidebar */}
        {selectedConfig && (
          <div className="w-[500px] border-l border-border bg-white flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between bg-gray-50">
              <div>
                <div className="font-mono text-sm font-semibold text-gray-900">
                  {selectedConfig.domain}/{selectedConfig.key}
                </div>
                <div className="text-xs text-gray-500">
                  {selectedConfig.source} → {selectedConfig.target}
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedConfig(null);
                  setDiffData(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {loadingDiff ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  Loading diff...
                </div>
              ) : diffData ? (
                <div className="space-y-4">
                  {!diffData.isDifferent ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
                      These configurations are identical
                    </div>
                  ) : (
                    <>
                      <DiffViewer
                        oldContent={diffData.targetContent || '# File does not exist'}
                        newContent={diffData.sourceContent || '# File does not exist'}
                        oldLabel={selectedConfig.target}
                        newLabel={selectedConfig.source}
                      />
                      <button
                        onClick={() => handlePromote(
                          selectedConfig.domain,
                          [selectedConfig.key],
                          selectedConfig.source
                        )}
                        className="w-full py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-fast text-sm font-medium"
                      >
                        Create Promotion Request
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
