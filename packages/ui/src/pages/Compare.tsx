import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { DiffViewer } from '../components/DiffViewer';
import { api } from '../api/client';
import clsx from 'clsx';

const environments = [
  { id: 'dev', label: 'Development', color: 'bg-blue-500' },
  { id: 'staging', label: 'Staging', color: 'bg-amber-500' },
  { id: 'prod', label: 'Production', color: 'bg-green-500' },
];

export function Compare() {
  const [leftEnv, setLeftEnv] = useState('dev');
  const [rightEnv, setRightEnv] = useState('prod');
  const [domains, setDomains] = useState<string[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [keys, setKeys] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [leftContent, setLeftContent] = useState<string>('');
  const [rightContent, setRightContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [leftError, setLeftError] = useState<string>('');
  const [rightError, setRightError] = useState<string>('');

  // Load domains from dev (as a base reference)
  useEffect(() => {
    api.getDomains('dev').then((res) => {
      setDomains(res.domains);
      if (res.domains.length > 0 && !selectedDomain) {
        setSelectedDomain(res.domains[0]);
      }
    });
  }, []);

  // Load keys when domain changes
  useEffect(() => {
    if (selectedDomain) {
      api.getKeys('dev', selectedDomain).then((res) => {
        setKeys(res.keys);
        if (res.keys.length > 0) {
          setSelectedKey(res.keys[0]);
        } else {
          setSelectedKey('');
        }
      });
    }
  }, [selectedDomain]);

  // Load content when selection changes
  useEffect(() => {
    if (selectedDomain && selectedKey) {
      setLoading(true);
      setLeftError('');
      setRightError('');

      Promise.all([
        api.getConfig(leftEnv, selectedDomain, selectedKey)
          .then((res) => {
            setLeftContent(res.raw || '');
            setLeftError('');
          })
          .catch(() => {
            setLeftContent('');
            setLeftError(`Not found in ${leftEnv}`);
          }),
        api.getConfig(rightEnv, selectedDomain, selectedKey)
          .then((res) => {
            setRightContent(res.raw || '');
            setRightError('');
          })
          .catch(() => {
            setRightContent('');
            setRightError(`Not found in ${rightEnv}`);
          }),
      ]).finally(() => setLoading(false));
    }
  }, [leftEnv, rightEnv, selectedDomain, selectedKey]);

  const swapEnvironments = () => {
    const temp = leftEnv;
    setLeftEnv(rightEnv);
    setRightEnv(temp);
  };

  const getEnvLabel = (envId: string) => {
    return environments.find((e) => e.id === envId)?.label || envId;
  };

  const getEnvColor = (envId: string) => {
    return environments.find((e) => e.id === envId)?.color || 'bg-gray-500';
  };

  const hasChanges = leftContent !== rightContent;

  return (
    <Layout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border bg-surface-raised">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold text-gray-900">Compare Environments</h1>
          </div>

          {/* Selection controls */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Domain selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Domain:</label>
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="px-3 py-1.5 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent font-mono"
              >
                {domains.map((domain) => (
                  <option key={domain} value={domain}>
                    {domain}
                  </option>
                ))}
              </select>
            </div>

            {/* Key selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Key:</label>
              <select
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
                className="px-3 py-1.5 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent font-mono"
              >
                {keys.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
            </div>

            {/* Environment selectors */}
            <div className="flex items-center gap-2 ml-auto">
              <select
                value={leftEnv}
                onChange={(e) => setLeftEnv(e.target.value)}
                className="px-3 py-1.5 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              >
                {environments.map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.label}
                  </option>
                ))}
              </select>

              <button
                onClick={swapEnvironments}
                className="px-2 py-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-fast"
                title="Swap environments"
              >
                ⇄
              </button>

              <select
                value={rightEnv}
                onChange={(e) => setRightEnv(e.target.value)}
                className="px-3 py-1.5 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              >
                {environments.map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className="px-4 py-2 border-b border-border bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className={clsx('w-2 h-2 rounded-full', getEnvColor(leftEnv))} />
              <span className="text-sm font-medium">{getEnvLabel(leftEnv)}</span>
              {leftError && <span className="text-xs text-red-500">({leftError})</span>}
            </div>
            <span className="text-gray-400">vs</span>
            <div className="flex items-center gap-2">
              <span className={clsx('w-2 h-2 rounded-full', getEnvColor(rightEnv))} />
              <span className="text-sm font-medium">{getEnvLabel(rightEnv)}</span>
              {rightError && <span className="text-xs text-red-500">({rightError})</span>}
            </div>
          </div>
          <div>
            {loading ? (
              <span className="text-sm text-gray-500">Loading...</span>
            ) : hasChanges ? (
              <span className="text-sm text-amber-600 font-medium">Configs differ</span>
            ) : (
              <span className="text-sm text-green-600 font-medium">Configs match</span>
            )}
          </div>
        </div>

        {/* Diff view */}
        <div className="flex-1 p-4 overflow-auto">
          {selectedDomain && selectedKey ? (
            loading ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                Loading...
              </div>
            ) : (
              <DiffViewer
                oldContent={leftContent || `# Config not found in ${getEnvLabel(leftEnv)}`}
                newContent={rightContent || `# Config not found in ${getEnvLabel(rightEnv)}`}
                oldLabel={`${getEnvLabel(leftEnv)} - ${selectedDomain}/${selectedKey}`}
                newLabel={`${getEnvLabel(rightEnv)} - ${selectedDomain}/${selectedKey}`}
              />
            )
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              Select a domain and key to compare
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
