import { useState, useEffect } from 'react';
import { api, ImpactAnalysis, ConsumerStatus } from '../api/client';
import clsx from 'clsx';

interface ImpactPanelProps {
  environment: string;
  domain: string;
  configKey: string;
  onImpactLoaded?: (hasActiveConsumers: boolean, consumerCount: number) => void;
}

const statusColors: Record<ConsumerStatus, { bg: string; text: string; dot: string }> = {
  active: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  stale: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  inactive: { bg: 'bg-gray-50', text: 'text-gray-500', dot: 'bg-gray-400' },
};

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

export function ImpactPanel({ environment, domain, configKey, onImpactLoaded }: ImpactPanelProps) {
  const [impact, setImpact] = useState<ImpactAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const isProd = environment === 'prod';

  useEffect(() => {
    api
      .getImpactAnalysis(environment, domain, configKey)
      .then((data) => {
        setImpact(data);
        const hasActive = data?.status_counts?.active > 0;
        onImpactLoaded?.(hasActive, data?.consumer_count || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [environment, domain, configKey, onImpactLoaded]);

  if (loading) {
    return (
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="text-sm text-gray-500">Loading impact analysis...</div>
      </div>
    );
  }

  if (!impact || impact.consumer_count === 0) {
    return (
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="w-2 h-2 rounded-full bg-gray-300" />
          No registered consumers for this config
        </div>
      </div>
    );
  }

  const hasActiveConsumers = impact.status_counts.active > 0;
  const isHighRisk = isProd && hasActiveConsumers;

  return (
    <div
      className={clsx(
        'border-b',
        isHighRisk
          ? 'bg-red-50 border-red-300'
          : hasActiveConsumers
          ? 'bg-amber-50 border-amber-200'
          : 'bg-gray-50 border-gray-200'
      )}
    >
      {/* Header / Warning Banner */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-black/5 transition-all"
      >
        <div className="flex items-center gap-3">
          {hasActiveConsumers && (
            <span className={clsx('text-lg font-bold', isHighRisk ? 'text-red-600' : 'text-amber-600')}>⚠</span>
          )}
          <div>
            <div className={clsx('text-sm font-medium', isHighRisk ? 'text-red-800' : hasActiveConsumers ? 'text-amber-800' : 'text-gray-700')}>
              {isHighRisk && <span className="font-bold">PRODUCTION IMPACT: </span>}
              {impact.consumer_count} app{impact.consumer_count !== 1 ? 's' : ''} consume this config
            </div>
            <div className="flex items-center gap-3 text-xs mt-0.5">
              {impact.status_counts.active > 0 && (
                <span className="flex items-center gap-1 text-green-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  {impact.status_counts.active} active
                </span>
              )}
              {impact.status_counts.stale > 0 && (
                <span className="flex items-center gap-1 text-amber-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {impact.status_counts.stale} stale
                </span>
              )}
              {impact.status_counts.inactive > 0 && (
                <span className="flex items-center gap-1 text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  {impact.status_counts.inactive} inactive
                </span>
              )}
            </div>
          </div>
        </div>
        <span className={clsx('text-sm transition-transform', expanded && 'rotate-180')}>
          ▼
        </span>
      </button>

      {/* Expanded Consumer List */}
      {expanded && (
        <div className="border-t border-black/10">
          {impact.consumers.map((consumer) => {
            const colors = statusColors[consumer.status];
            return (
              <div
                key={consumer.app_id}
                className={clsx('px-4 py-3 border-b border-black/5 last:border-0', colors.bg)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={clsx('w-2 h-2 rounded-full', colors.dot)} />
                    <span className={clsx('text-sm font-medium', colors.text)}>
                      {consumer.app_name}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      ({consumer.app_id})
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Last seen: {formatRelativeTime(consumer.last_heartbeat)}
                  </div>
                </div>
                {(consumer.contact_team || consumer.contact_email) && (
                  <div className="mt-1 text-xs text-gray-500 ml-4">
                    {consumer.contact_team && <span>{consumer.contact_team}</span>}
                    {consumer.contact_team && consumer.contact_email && <span> · </span>}
                    {consumer.contact_email && (
                      <a href={`mailto:${consumer.contact_email}`} className="text-blue-500 hover:underline">
                        {consumer.contact_email}
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Warning message */}
      {hasActiveConsumers && !expanded && (
        <div className={clsx('px-4 pb-3 text-xs', isHighRisk ? 'text-red-700 font-medium' : 'text-amber-700')}>
          {isHighRisk
            ? 'This change will affect live production applications. Review impacted consumers before proceeding.'
            : 'Changes may impact active applications. Click to see details.'}
        </div>
      )}
    </div>
  );
}
