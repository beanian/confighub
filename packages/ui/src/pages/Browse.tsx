import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ConfigHistory } from '../components/ConfigHistory';
import { api, Operation } from '../api/client';
import { useEnvironment } from '../hooks/useEnvironment';
import Editor from '@monaco-editor/react';
import clsx from 'clsx';

interface CreateConfigModalProps {
  env: string;
  existingDomains: string[];
  initialDomain?: string;
  onClose: () => void;
  onCreated: (changeId: string) => void;
}

function CreateConfigModal({ env, existingDomains, initialDomain, onClose, onCreated }: CreateConfigModalProps) {
  const [domainType, setDomainType] = useState<'existing' | 'new'>(initialDomain ? 'existing' : 'new');
  const [selectedDomain, setSelectedDomain] = useState(initialDomain || '');
  const [newDomain, setNewDomain] = useState('');
  const [keyName, setKeyName] = useState('');
  const [content, setContent] = useState('# New configuration\n');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const domain = domainType === 'existing' ? selectedDomain : newDomain;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!domain.trim()) {
      setError('Domain is required');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(domain)) {
      setError('Domain: use lowercase letters, numbers, and hyphens only');
      return;
    }
    if (!keyName.trim()) {
      setError('Key name is required');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(keyName)) {
      setError('Key: use lowercase letters, numbers, and hyphens only');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const isNewDomain = domainType === 'new' || !existingDomains.includes(domain);
      const change = await api.createChangeRequest({
        domain,
        key: keyName,
        targetEnvironment: env,
        title: isNewDomain
          ? `Create ${domain}/${keyName} (new domain)`
          : `Create config: ${domain}/${keyName}`,
        content,
        operation: 'create',
      });
      onCreated(change.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create change request');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Create New Config</h2>
        <p className="text-sm text-gray-500 mb-4">
          Create a new configuration file. You can add it to an existing domain or create a new domain.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Domain selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Domain</label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setDomainType('existing')}
                className={clsx(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-fast',
                  domainType === 'existing'
                    ? 'bg-accent text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                Existing Domain
              </button>
              <button
                type="button"
                onClick={() => setDomainType('new')}
                className={clsx(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-fast',
                  domainType === 'new'
                    ? 'bg-accent text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                New Domain
              </button>
            </div>

            {domainType === 'existing' ? (
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent font-mono"
              >
                <option value="">Select a domain...</option>
                {existingDomains.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value.toLowerCase())}
                placeholder="e.g., my-new-domain"
                className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent font-mono"
              />
            )}
          </div>

          {/* Key name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Key Name</label>
            <input
              type="text"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value.toLowerCase())}
              placeholder="e.g., my-config"
              className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              Lowercase letters, numbers, and hyphens only
            </p>
          </div>

          {/* Content */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Initial Content (YAML)</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent font-mono h-32 resize-none"
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-fast"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-md transition-fast disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Change Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface DeleteModalProps {
  type: 'domain' | 'key';
  name: string;
  env: string;
  domain?: string;
  onClose: () => void;
  onCreated: (changeId: string) => void;
}

function DeleteModal({ type, name, env, domain, onClose, onCreated }: DeleteModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      const operation: Operation = type === 'domain' ? 'delete_domain' : 'delete';
      const change = await api.createChangeRequest({
        domain: type === 'domain' ? name : domain!,
        key: type === 'key' ? name : undefined,
        targetEnvironment: env,
        title: type === 'domain' ? `Delete domain: ${name}` : `Delete config: ${domain}/${name}`,
        operation,
      });
      onCreated(change.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create change request');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Delete {type === 'domain' ? 'Domain' : 'Key'}
        </h2>
        <p className="text-sm text-gray-600 mb-2">
          This will create a change request to delete <span className="font-mono font-medium">{name}</span>.
          {type === 'domain' && ' This will delete all keys in this domain.'}
        </p>
        <p className="text-sm text-amber-600 mb-4">
          The deletion will only happen after the change request is reviewed and merged.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-fast"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2 bg-danger hover:bg-red-600 text-white text-sm font-medium rounded-md transition-fast disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Delete Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Browse() {
  const navigate = useNavigate();
  const { environment: env } = useEnvironment();
  const [domains, setDomains] = useState<string[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [keys, setKeys] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'history'>('preview');
  const [historyContent, setHistoryContent] = useState<string | null>(null);
  const [historyCommit, setHistoryCommit] = useState<string | null>(null);

  // Modal state
  const [showCreateConfig, setShowCreateConfig] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'domain' | 'key'; name: string } | null>(null);

  // Load domains
  const loadDomains = async () => {
    try {
      const res = await api.getDomains(env);
      setDomains(res.domains);
      if (res.domains.length > 0 && (!selectedDomain || !res.domains.includes(selectedDomain))) {
        setSelectedDomain(res.domains[0]);
      } else if (res.domains.length === 0) {
        setSelectedDomain(null);
        setKeys([]);
        setSelectedKey(null);
        setContent('');
      }
    } catch (e) {
      console.error('Error loading domains:', e);
      setDomains([]);
    }
  };

  useEffect(() => {
    loadDomains();
  }, [env]);

  // Load keys when domain changes
  const loadKeys = async () => {
    if (selectedDomain) {
      try {
        const res = await api.getKeys(env, selectedDomain);
        setKeys(res.keys);
        if (!res.keys.includes(selectedKey || '')) {
          setSelectedKey(null);
          setContent('');
        }
      } catch (e) {
        console.error('Error loading keys:', e);
        setKeys([]);
      }
    }
  };

  useEffect(() => {
    if (selectedDomain) {
      loadKeys();
    }
  }, [env, selectedDomain]);

  // Load content when key changes
  useEffect(() => {
    if (selectedDomain && selectedKey) {
      setLoading(true);
      setActiveTab('preview');
      setHistoryContent(null);
      setHistoryCommit(null);
      api
        .getConfig(env, selectedDomain, selectedKey)
        .then((res) => setContent(res.raw || ''))
        .catch((e) => {
          console.error('Error loading config:', e);
          setContent('');
        })
        .finally(() => setLoading(false));
    }
  }, [env, selectedDomain, selectedKey]);

  const handleEdit = () => {
    if (selectedDomain && selectedKey) {
      navigate(`/edit/${env}/${selectedDomain}/${selectedKey}`);
    }
  };

  const handleChangeCreated = (changeId: string) => {
    navigate(`/changes/${changeId}`);
  };

  return (
    <Layout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-raised">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-gray-900">Browse Configurations</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateConfig(true)}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-md transition-fast"
            >
              + New Config
            </button>
            {selectedKey && (
              <button
                onClick={handleEdit}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-md transition-fast"
              >
                Edit Config
              </button>
            )}
          </div>
        </div>

        {/* Three-pane layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Domains */}
          <div className="w-48 border-r border-border bg-surface-raised overflow-auto flex flex-col">
            <div className="p-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Domains
            </div>
            <div className="flex-1 overflow-auto">
              {domains.map((domain) => (
                <div
                  key={domain}
                  className={clsx(
                    'group flex items-center justify-between px-3 py-2 text-sm transition-fast',
                    selectedDomain === domain
                      ? 'bg-accent text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <button
                    onClick={() => setSelectedDomain(domain)}
                    className="flex-1 text-left truncate"
                  >
                    {domain}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget({ type: 'domain', name: domain });
                    }}
                    className={clsx(
                      'w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-fast',
                      selectedDomain === domain
                        ? 'hover:bg-white/20 text-white'
                        : 'hover:bg-gray-200 text-gray-500'
                    )}
                    title="Delete domain"
                  >
                    ×
                  </button>
                </div>
              ))}
              {domains.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-400">No domains found</div>
              )}
            </div>
          </div>

          {/* Keys */}
          <div className="w-56 border-r border-border bg-surface-raised overflow-auto flex flex-col">
            <div className="p-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Keys
            </div>
            <div className="flex-1 overflow-auto">
              {keys.map((key) => (
                <div
                  key={key}
                  className={clsx(
                    'group flex items-center justify-between px-3 py-2 text-sm font-mono transition-fast',
                    selectedKey === key
                      ? 'bg-accent text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <button
                    onClick={() => setSelectedKey(key)}
                    className="flex-1 text-left truncate"
                  >
                    {key}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget({ type: 'key', name: key });
                    }}
                    className={clsx(
                      'w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-fast',
                      selectedKey === key
                        ? 'hover:bg-white/20 text-white'
                        : 'hover:bg-gray-200 text-gray-500'
                    )}
                    title="Delete key"
                  >
                    ×
                  </button>
                </div>
              ))}
              {keys.length === 0 && selectedDomain && (
                <div className="px-3 py-2 text-sm text-gray-400">No configs found</div>
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedKey ? (
              <>
                <div className="px-4 py-2 border-b border-border bg-gray-50 flex items-center justify-between">
                  <div className="text-sm">
                    <span className="text-gray-500">{selectedDomain}/</span>
                    <span className="font-medium text-gray-900">{selectedKey}</span>
                    <span className="text-gray-400">.yaml</span>
                    {historyCommit && activeTab === 'preview' && (
                      <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                        @ {historyCommit.substring(0, 7)}
                      </span>
                    )}
                  </div>
                  {/* Tabs */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setActiveTab('preview');
                        setHistoryContent(null);
                        setHistoryCommit(null);
                      }}
                      className={clsx(
                        'px-3 py-1 text-xs font-medium rounded transition-fast',
                        activeTab === 'preview'
                          ? 'bg-accent text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      )}
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => setActiveTab('history')}
                      className={clsx(
                        'px-3 py-1 text-xs font-medium rounded transition-fast',
                        activeTab === 'history'
                          ? 'bg-accent text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      )}
                    >
                      History
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  {activeTab === 'preview' ? (
                    loading ? (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        Loading...
                      </div>
                    ) : (
                      <Editor
                        height="100%"
                        language="yaml"
                        value={historyContent || content}
                        theme="vs-light"
                        options={{
                          readOnly: true,
                          minimap: { enabled: false },
                          fontSize: 13,
                          fontFamily: 'JetBrains Mono, monospace',
                          lineNumbers: 'on',
                          scrollBeyondLastLine: false,
                          wordWrap: 'on',
                        }}
                      />
                    )
                  ) : (
                    <div className="h-full overflow-auto">
                      <ConfigHistory
                        env={env}
                        domain={selectedDomain!}
                        configKey={selectedKey}
                        onSelectVersion={(versionContent, commit) => {
                          setHistoryContent(versionContent);
                          setHistoryCommit(commit);
                          setActiveTab('preview');
                        }}
                        onRollback={() => {
                          // Reload content after rollback
                          api.getConfig(env, selectedDomain!, selectedKey)
                            .then((res) => setContent(res.raw || ''));
                        }}
                      />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                {selectedDomain ? 'Select a config to preview' : 'Select a domain or create a new config'}
              </div>
            )}
          </div>
        </div>

        {/* Modals */}
        {showCreateConfig && (
          <CreateConfigModal
            env={env}
            existingDomains={domains}
            initialDomain={selectedDomain || undefined}
            onClose={() => setShowCreateConfig(false)}
            onCreated={handleChangeCreated}
          />
        )}

        {deleteTarget && (
          <DeleteModal
            type={deleteTarget.type}
            name={deleteTarget.name}
            env={env}
            domain={selectedDomain || undefined}
            onClose={() => setDeleteTarget(null)}
            onCreated={handleChangeCreated}
          />
        )}
      </div>
    </Layout>
  );
}
