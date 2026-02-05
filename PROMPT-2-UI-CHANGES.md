# Prompt 2: UI + Change Management

Build the React frontend and change management workflow for ConfigHub. This is Phase 2 of 3.

**Prerequisite**: Phase 1 must be complete (API running on localhost:4000).

## What You're Building

A React UI where:
- Users log in and browse configs across environments
- Editors modify YAML in a Monaco editor with validation
- Changes create draft branches, go through review, and merge
- Reviewers see side-by-side diffs and approve/reject

## Design Direction

**Aesthetic**: Clean, professional **editorial/utilitarian** — think Bloomberg Terminal meets Notion. This is a tool for actuaries and analysts who need clarity, not decoration.

**Design principles**:
- **Typography**: Use `JetBrains Mono` for code/config, `IBM Plex Sans` for UI text — technical but refined
- **Color palette**: Dark sidebar (#1a1a2e), light content area (#fafafa), accent blue (#3b82f6), warning amber (#f59e0b), success green (#10b981)
- **Layout**: Fixed sidebar navigation, main content area with breadcrumbs, no unnecessary chrome
- **Density**: Information-dense but not cluttered — actuaries want to see data, not whitespace
- **Motion**: Subtle transitions only (150ms ease), no flashy animations — this is a serious tool

**Memorable detail**: The diff viewer — make it exceptional. Clear red/green highlighting, line numbers, collapsible unchanged sections.

---

## Step 1: Set Up UI Package

Create `packages/ui/package.json`:
```json
{
  "name": "@confighub/ui",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.0",
    "@monaco-editor/react": "^4.6.0",
    "diff": "^5.1.0",
    "js-yaml": "^4.1.0",
    "clsx": "^2.1.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@types/diff": "^5.0.9",
    "@types/js-yaml": "^4.0.9",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.3.3",
    "vite": "^5.0.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.0"
  }
}
```

Create `packages/ui/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
```

Create `packages/ui/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `packages/ui/tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

Create `packages/ui/tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: '#1a1a2e',
        'sidebar-hover': '#252542',
        'sidebar-active': '#3b82f6',
        surface: '#fafafa',
        'surface-raised': '#ffffff',
        border: '#e5e7eb',
        'border-strong': '#d1d5db',
        accent: '#3b82f6',
        'accent-hover': '#2563eb',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        'diff-add': '#dcfce7',
        'diff-add-strong': '#bbf7d0',
        'diff-remove': '#fee2e2',
        'diff-remove-strong': '#fecaca',
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
```

Create `packages/ui/postcss.config.js`:
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

## Step 2: Create Index HTML and CSS

Create `packages/ui/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ConfigHub</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `packages/ui/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  background-color: #fafafa;
  color: #1f2937;
  -webkit-font-smoothing: antialiased;
}

/* Custom scrollbar for code areas */
.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}

/* Transitions */
.transition-fast {
  transition: all 150ms ease;
}
```

## Step 3: Create API Client

Create `packages/ui/src/api/client.ts`:
```typescript
const API_BASE = '/api';

export interface ConfigResponse {
  domain: string;
  key: string;
  environment: string;
  version: string;
  data: unknown;
  raw?: string;
  lastModified: string;
}

export interface DomainsResponse {
  environment: string;
  domains: string[];
}

export interface KeysResponse {
  domain: string;
  environment: string;
  keys: string[];
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export interface ChangeRequest {
  id: string;
  branch_name: string;
  target_environment: string;
  domain: string;
  key_name: string;
  title: string;
  description?: string;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'merged';
  created_by: string;
  created_at: string;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }

    return res.json();
  }

  // Auth
  async login(email: string, password: string): Promise<LoginResponse> {
    return this.fetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  // Config reads
  async getDomains(env: string): Promise<DomainsResponse> {
    return this.fetch(`/config/${env}`);
  }

  async getKeys(env: string, domain: string): Promise<KeysResponse> {
    return this.fetch(`/config/${env}/${domain}`);
  }

  async getConfig(env: string, domain: string, key: string): Promise<ConfigResponse> {
    return this.fetch(`/config/${env}/${domain}/${key}?format=yaml`);
  }

  // Change requests
  async getChangeRequests(): Promise<ChangeRequest[]> {
    return this.fetch('/changes');
  }

  async createChangeRequest(data: {
    domain: string;
    key: string;
    targetEnvironment: string;
    title: string;
    description?: string;
    content: string;
  }): Promise<ChangeRequest> {
    return this.fetch('/changes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getChangeRequest(id: string): Promise<ChangeRequest & { diff: string; currentContent: string; proposedContent: string }> {
    return this.fetch(`/changes/${id}`);
  }

  async submitForReview(id: string): Promise<ChangeRequest> {
    return this.fetch(`/changes/${id}/submit`, { method: 'POST' });
  }

  async approveChange(id: string, comment?: string): Promise<ChangeRequest> {
    return this.fetch(`/changes/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  }

  async rejectChange(id: string, comment: string): Promise<ChangeRequest> {
    return this.fetch(`/changes/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  }

  async mergeChange(id: string): Promise<ChangeRequest> {
    return this.fetch(`/changes/${id}/merge`, { method: 'POST' });
  }
}

export const api = new ApiClient();
```

## Step 4: Create Auth Context

Create `packages/ui/src/hooks/useAuth.tsx`:
```typescript
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../api/client';

interface User {
  id: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (token && savedUser) {
      api.setToken(token);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.login(email, password);
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
    api.setToken(response.token);
    setUser(response.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    api.setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

## Step 5: Create Layout Components

Create `packages/ui/src/components/Layout.tsx`:
```typescript
import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import clsx from 'clsx';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/', label: 'Dashboard', icon: '◫' },
  { path: '/browse', label: 'Browse', icon: '☰' },
  { path: '/changes', label: 'Changes', icon: '⎇' },
];

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-sidebar flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-white/10">
          <span className="text-white font-semibold tracking-tight text-lg">
            Config<span className="text-accent">Hub</span>
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-fast mb-1',
                location.pathname === item.path
                  ? 'bg-sidebar-active text-white'
                  : 'text-gray-400 hover:bg-sidebar-hover hover:text-white'
              )}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-white/10">
          <div className="text-sm text-gray-400 truncate">{user?.email}</div>
          <div className="text-xs text-gray-500 capitalize mb-2">{user?.role}</div>
          <button
            onClick={logout}
            className="text-xs text-gray-500 hover:text-white transition-fast"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-surface">
        {children}
      </main>
    </div>
  );
}
```

Create `packages/ui/src/components/EnvironmentSelector.tsx`:
```typescript
import clsx from 'clsx';

interface EnvironmentSelectorProps {
  value: string;
  onChange: (env: string) => void;
}

const environments = [
  { id: 'dev', label: 'Development', color: 'bg-blue-500' },
  { id: 'staging', label: 'Staging', color: 'bg-amber-500' },
  { id: 'prod', label: 'Production', color: 'bg-green-500' },
];

export function EnvironmentSelector({ value, onChange }: EnvironmentSelectorProps) {
  return (
    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
      {environments.map((env) => (
        <button
          key={env.id}
          onClick={() => onChange(env.id)}
          className={clsx(
            'px-3 py-1.5 text-sm font-medium rounded-md transition-fast flex items-center gap-2',
            value === env.id
              ? 'bg-white shadow-sm text-gray-900'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          <span className={clsx('w-2 h-2 rounded-full', env.color)} />
          {env.label}
        </button>
      ))}
    </div>
  );
}
```

## Step 6: Create Diff Viewer Component

Create `packages/ui/src/components/DiffViewer.tsx`:
```typescript
import { useMemo } from 'react';
import { diffLines, Change } from 'diff';
import clsx from 'clsx';

interface DiffViewerProps {
  oldContent: string;
  newContent: string;
  oldLabel?: string;
  newLabel?: string;
}

export function DiffViewer({ 
  oldContent, 
  newContent, 
  oldLabel = 'Current', 
  newLabel = 'Proposed' 
}: DiffViewerProps) {
  const diff = useMemo(() => diffLines(oldContent, newContent), [oldContent, newContent]);

  // Build line-by-line view
  const { leftLines, rightLines } = useMemo(() => {
    const left: Array<{ num: number; content: string; type: 'unchanged' | 'removed' }> = [];
    const right: Array<{ num: number; content: string; type: 'unchanged' | 'added' }> = [];
    
    let leftNum = 1;
    let rightNum = 1;

    diff.forEach((part: Change) => {
      const lines = part.value.split('\n').filter((_, i, arr) => i < arr.length - 1 || part.value.slice(-1) !== '\n' ? true : i < arr.length - 1);
      
      if (part.added) {
        lines.forEach((line) => {
          left.push({ num: -1, content: '', type: 'unchanged' });
          right.push({ num: rightNum++, content: line, type: 'added' });
        });
      } else if (part.removed) {
        lines.forEach((line) => {
          left.push({ num: leftNum++, content: line, type: 'removed' });
          right.push({ num: -1, content: '', type: 'unchanged' });
        });
      } else {
        lines.forEach((line) => {
          left.push({ num: leftNum++, content: line, type: 'unchanged' });
          right.push({ num: rightNum++, content: line, type: 'unchanged' });
        });
      }
    });

    return { leftLines: left, rightLines: right };
  }, [diff]);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Headers */}
      <div className="flex border-b border-border bg-gray-50">
        <div className="flex-1 px-4 py-2 font-medium text-sm text-gray-700 border-r border-border">
          {oldLabel}
        </div>
        <div className="flex-1 px-4 py-2 font-medium text-sm text-gray-700">
          {newLabel}
        </div>
      </div>

      {/* Diff content */}
      <div className="flex font-mono text-sm max-h-[600px] overflow-auto custom-scrollbar">
        {/* Left side */}
        <div className="flex-1 border-r border-border">
          {leftLines.map((line, i) => (
            <div
              key={`left-${i}`}
              className={clsx(
                'flex',
                line.type === 'removed' && 'bg-diff-remove'
              )}
            >
              <span className={clsx(
                'w-12 flex-shrink-0 px-2 py-0.5 text-right text-gray-400 select-none border-r',
                line.type === 'removed' ? 'bg-diff-remove-strong border-red-200' : 'border-gray-100'
              )}>
                {line.num > 0 ? line.num : ''}
              </span>
              <span className={clsx(
                'flex-1 px-3 py-0.5 whitespace-pre',
                line.type === 'removed' && 'text-red-800'
              )}>
                {line.type === 'removed' && <span className="text-red-500 mr-1">−</span>}
                {line.content}
              </span>
            </div>
          ))}
        </div>

        {/* Right side */}
        <div className="flex-1">
          {rightLines.map((line, i) => (
            <div
              key={`right-${i}`}
              className={clsx(
                'flex',
                line.type === 'added' && 'bg-diff-add'
              )}
            >
              <span className={clsx(
                'w-12 flex-shrink-0 px-2 py-0.5 text-right text-gray-400 select-none border-r',
                line.type === 'added' ? 'bg-diff-add-strong border-green-200' : 'border-gray-100'
              )}>
                {line.num > 0 ? line.num : ''}
              </span>
              <span className={clsx(
                'flex-1 px-3 py-0.5 whitespace-pre',
                line.type === 'added' && 'text-green-800'
              )}>
                {line.type === 'added' && <span className="text-green-500 mr-1">+</span>}
                {line.content}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

## Step 7: Create Page Components

Create `packages/ui/src/pages/Login.tsx`:
```typescript
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@confighub.local');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sidebar flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-white tracking-tight">
            Config<span className="text-accent">Hub</span>
          </h1>
          <p className="text-gray-400 mt-2 text-sm">Configuration Governance Platform</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-surface-raised rounded-lg p-6 shadow-xl">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              required
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-accent hover:bg-accent-hover text-white font-medium rounded-md transition-fast disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-gray-500 text-xs mt-4">
          Default: admin@confighub.local / admin123
        </p>
      </div>
    </div>
  );
}
```

Create `packages/ui/src/pages/Dashboard.tsx`:
```typescript
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { EnvironmentSelector } from '../components/EnvironmentSelector';
import { api, ChangeRequest } from '../api/client';

export function Dashboard() {
  const [env, setEnv] = useState('dev');
  const [changes, setChanges] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getChangeRequests()
      .then(setChanges)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const pendingReview = changes.filter(c => c.status === 'pending_review');
  const drafts = changes.filter(c => c.status === 'draft');
  const approved = changes.filter(c => c.status === 'approved');

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <EnvironmentSelector value={env} onChange={setEnv} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-surface-raised border border-border rounded-lg p-4">
            <div className="text-3xl font-semibold text-warning">{pendingReview.length}</div>
            <div className="text-sm text-gray-600 mt-1">Pending Review</div>
          </div>
          <div className="bg-surface-raised border border-border rounded-lg p-4">
            <div className="text-3xl font-semibold text-gray-600">{drafts.length}</div>
            <div className="text-sm text-gray-600 mt-1">Drafts</div>
          </div>
          <div className="bg-surface-raised border border-border rounded-lg p-4">
            <div className="text-3xl font-semibold text-success">{approved.length}</div>
            <div className="text-sm text-gray-600 mt-1">Ready to Merge</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3 mb-8">
          <Link
            to="/browse"
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-md transition-fast"
          >
            Browse Configs
          </Link>
          <Link
            to="/changes"
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-md transition-fast"
          >
            View All Changes
          </Link>
        </div>

        {/* Recent pending reviews */}
        {pendingReview.length > 0 && (
          <div className="bg-surface-raised border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="font-medium text-gray-900">Pending Review</h2>
            </div>
            <div className="divide-y divide-border">
              {pendingReview.slice(0, 5).map((change) => (
                <Link
                  key={change.id}
                  to={`/changes/${change.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-fast"
                >
                  <div>
                    <div className="font-medium text-gray-900">{change.title}</div>
                    <div className="text-sm text-gray-500">
                      {change.domain}/{change.key_name} → {change.target_environment}
                    </div>
                  </div>
                  <span className="text-xs bg-warning/10 text-warning px-2 py-1 rounded-full font-medium">
                    Review
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
```

Create `packages/ui/src/pages/Browse.tsx`:
```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { EnvironmentSelector } from '../components/EnvironmentSelector';
import { api } from '../api/client';
import Editor from '@monaco-editor/react';
import clsx from 'clsx';

export function Browse() {
  const navigate = useNavigate();
  const [env, setEnv] = useState('dev');
  const [domains, setDomains] = useState<string[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [keys, setKeys] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Load domains
  useEffect(() => {
    api.getDomains(env).then((res) => {
      setDomains(res.domains);
      if (res.domains.length > 0 && !selectedDomain) {
        setSelectedDomain(res.domains[0]);
      }
    });
  }, [env]);

  // Load keys when domain changes
  useEffect(() => {
    if (selectedDomain) {
      api.getKeys(env, selectedDomain).then((res) => {
        setKeys(res.keys);
        setSelectedKey(null);
        setContent('');
      });
    }
  }, [env, selectedDomain]);

  // Load content when key changes
  useEffect(() => {
    if (selectedDomain && selectedKey) {
      setLoading(true);
      api.getConfig(env, selectedDomain, selectedKey)
        .then((res) => setContent(res.raw || ''))
        .finally(() => setLoading(false));
    }
  }, [env, selectedDomain, selectedKey]);

  const handleEdit = () => {
    if (selectedDomain && selectedKey) {
      navigate(`/edit/${env}/${selectedDomain}/${selectedKey}`);
    }
  };

  return (
    <Layout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-raised">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-gray-900">Browse Configurations</h1>
            <EnvironmentSelector value={env} onChange={setEnv} />
          </div>
          {selectedKey && (
            <button
              onClick={handleEdit}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-md transition-fast"
            >
              Edit Config
            </button>
          )}
        </div>

        {/* Three-pane layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Domains */}
          <div className="w-48 border-r border-border bg-surface-raised overflow-auto">
            <div className="p-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Domains
            </div>
            {domains.map((domain) => (
              <button
                key={domain}
                onClick={() => setSelectedDomain(domain)}
                className={clsx(
                  'w-full text-left px-3 py-2 text-sm transition-fast',
                  selectedDomain === domain
                    ? 'bg-accent text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                {domain}
              </button>
            ))}
          </div>

          {/* Keys */}
          <div className="w-56 border-r border-border bg-surface-raised overflow-auto">
            <div className="p-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Keys
            </div>
            {keys.map((key) => (
              <button
                key={key}
                onClick={() => setSelectedKey(key)}
                className={clsx(
                  'w-full text-left px-3 py-2 text-sm font-mono transition-fast',
                  selectedKey === key
                    ? 'bg-accent text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                {key}
              </button>
            ))}
            {keys.length === 0 && selectedDomain && (
              <div className="px-3 py-2 text-sm text-gray-400">No configs found</div>
            )}
          </div>

          {/* Preview */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedKey ? (
              <>
                <div className="px-4 py-2 border-b border-border bg-gray-50 text-sm">
                  <span className="text-gray-500">{selectedDomain}/</span>
                  <span className="font-medium text-gray-900">{selectedKey}</span>
                  <span className="text-gray-400">.yaml</span>
                </div>
                <div className="flex-1">
                  {loading ? (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      Loading...
                    </div>
                  ) : (
                    <Editor
                      height="100%"
                      language="yaml"
                      value={content}
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
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                Select a config to preview
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
```

Create `packages/ui/src/pages/EditConfig.tsx`:
```typescript
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { DiffViewer } from '../components/DiffViewer';
import { api } from '../api/client';
import Editor from '@monaco-editor/react';
import yaml from 'js-yaml';

export function EditConfig() {
  const { env, domain, key } = useParams();
  const navigate = useNavigate();
  
  const [originalContent, setOriginalContent] = useState('');
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [showDiff, setShowDiff] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (env && domain && key) {
      api.getConfig(env, domain, key).then((res) => {
        const raw = res.raw || '';
        setOriginalContent(raw);
        setContent(raw);
        setTitle(`Update ${key}`);
      });
    }
  }, [env, domain, key]);

  const validateYaml = (value: string): boolean => {
    try {
      yaml.load(value);
      setValidationError('');
      return true;
    } catch (e) {
      setValidationError(e instanceof Error ? e.message : 'Invalid YAML');
      return false;
    }
  };

  const handleContentChange = (value: string | undefined) => {
    const newValue = value || '';
    setContent(newValue);
    validateYaml(newValue);
  };

  const handleSubmit = async () => {
    if (!validateYaml(content)) return;
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const change = await api.createChangeRequest({
        domain: domain!,
        key: key!,
        targetEnvironment: env!,
        title,
        description,
        content,
      });
      navigate(`/changes/${change.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create change');
    } finally {
      setSubmitting(false);
    }
  };

  const hasChanges = content !== originalContent;

  return (
    <Layout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-raised">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <span>{env}</span>
              <span>/</span>
              <span>{domain}</span>
              <span>/</span>
              <span className="font-medium text-gray-900">{key}</span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Change title..."
              className="text-lg font-semibold bg-transparent border-none outline-none text-gray-900 w-96"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDiff(!showDiff)}
              className={clsx(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-fast',
                showDiff
                  ? 'bg-gray-200 text-gray-900'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {showDiff ? 'Hide Diff' : 'Show Diff'}
            </button>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-fast"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!hasChanges || !!validationError || submitting}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-md transition-fast disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : 'Create Change Request'}
            </button>
          </div>
        </div>

        {/* Description */}
        <div className="px-4 py-3 border-b border-border bg-gray-50">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional) — explain why this change is needed..."
            className="w-full bg-transparent border-none outline-none text-sm text-gray-600 placeholder:text-gray-400"
          />
        </div>

        {/* Errors */}
        {(error || validationError) && (
          <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-sm text-red-700">
            {error || validationError}
          </div>
        )}

        {/* Editor / Diff */}
        <div className="flex-1 overflow-hidden">
          {showDiff ? (
            <div className="h-full p-4 overflow-auto">
              <DiffViewer
                oldContent={originalContent}
                newContent={content}
                oldLabel="Current"
                newLabel="Your Changes"
              />
            </div>
          ) : (
            <Editor
              height="100%"
              language="yaml"
              value={content}
              onChange={handleContentChange}
              theme="vs-light"
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: 'JetBrains Mono, monospace',
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                tabSize: 2,
              }}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}

// Need to import clsx
import clsx from 'clsx';
```

Create `packages/ui/src/pages/Changes.tsx`:
```typescript
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { api, ChangeRequest } from '../api/client';
import clsx from 'clsx';

const statusConfig = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  pending_review: { label: 'Pending Review', color: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
  merged: { label: 'Merged', color: 'bg-blue-100 text-blue-700' },
};

export function Changes() {
  const [changes, setChanges] = useState<ChangeRequest[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getChangeRequests()
      .then(setChanges)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredChanges = filter === 'all' 
    ? changes 
    : changes.filter(c => c.status === filter);

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Change Requests</h1>
          <Link
            to="/browse"
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-md transition-fast"
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
                'px-3 py-1.5 text-sm font-medium rounded-md transition-fast',
                filter === status
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {status === 'all' ? 'All' : statusConfig[status as keyof typeof statusConfig]?.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="text-gray-400">Loading...</div>
        ) : filteredChanges.length === 0 ? (
          <div className="text-gray-400">No change requests found</div>
        ) : (
          <div className="bg-surface-raised border border-border rounded-lg divide-y divide-border">
            {filteredChanges.map((change) => (
              <Link
                key={change.id}
                to={`/changes/${change.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-fast"
              >
                <div>
                  <div className="font-medium text-gray-900">{change.title}</div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {change.domain}/{change.key_name} → {change.target_environment}
                    <span className="mx-2">•</span>
                    {new Date(change.created_at).toLocaleDateString()}
                  </div>
                </div>
                <span className={clsx(
                  'text-xs px-2 py-1 rounded-full font-medium',
                  statusConfig[change.status].color
                )}>
                  {statusConfig[change.status].label}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
```

## Step 8: Create App Entry Point

Create `packages/ui/src/main.tsx`:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Browse } from './pages/Browse';
import { EditConfig } from './pages/EditConfig';
import { Changes } from './pages/Changes';
import './index.css';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/browse" element={<ProtectedRoute><Browse /></ProtectedRoute>} />
          <Route path="/edit/:env/:domain/:key" element={<ProtectedRoute><EditConfig /></ProtectedRoute>} />
          <Route path="/changes" element={<ProtectedRoute><Changes /></ProtectedRoute>} />
          <Route path="/changes/:id" element={<ProtectedRoute><Changes /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

## Step 9: Add Auth Routes to API

Create `packages/api/src/routes/auth.ts`:
```typescript
import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../db';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  });
});

export default router;
```

Create `packages/api/src/routes/changes.ts`:
```typescript
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { getGit, envToBranch, getConfig } from '../services/git';
import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';

const router = Router();
const REPO_PATH = process.env.CONFIG_REPO_PATH || './config-repo';

// List all change requests
router.get('/', (req: Request, res: Response) => {
  const changes = db.prepare(`
    SELECT * FROM change_requests 
    ORDER BY created_at DESC
  `).all();
  
  res.json(changes);
});

// Get single change request
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const change = db.prepare('SELECT * FROM change_requests WHERE id = ?').get(id);
  
  if (!change) {
    return res.status(404).json({ error: 'Change request not found' });
  }

  // Get current and proposed content for diff
  try {
    const current = await getConfig(
      (change as any).target_environment,
      (change as any).domain,
      (change as any).key_name
    );

    // Get proposed content from draft branch
    const g = getGit();
    const currentBranch = (await g.branchLocal()).current;
    
    await g.checkout((change as any).branch_name);
    const proposedPath = path.join(REPO_PATH, 'config', (change as any).domain, `${(change as any).key_name}.yaml`);
    const proposedContent = fs.existsSync(proposedPath) ? fs.readFileSync(proposedPath, 'utf-8') : '';
    await g.checkout(currentBranch);

    res.json({
      ...change,
      currentContent: current?.raw || '',
      proposedContent,
    });
  } catch (error) {
    res.json({ ...change, currentContent: '', proposedContent: '' });
  }
});

// Create change request
router.post('/', async (req: Request, res: Response) => {
  const { domain, key, targetEnvironment, title, description, content } = req.body;
  const userId = (req as any).userId || 'anonymous';

  // Validate YAML
  try {
    yaml.load(content);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid YAML content' });
  }

  const id = uuidv4().slice(0, 8);
  const branchName = `draft/${id}`;

  try {
    const g = getGit();
    const targetBranch = envToBranch(targetEnvironment);
    
    // Create branch from target
    await g.checkout(targetBranch);
    await g.checkoutLocalBranch(branchName);
    
    // Write file
    const filePath = path.join(REPO_PATH, 'config', domain, `${key}.yaml`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
    
    // Commit
    await g.add('.');
    await g.commit(title);
    
    // Return to main
    await g.checkout('main');

    // Save to database
    db.prepare(`
      INSERT INTO change_requests (id, branch_name, target_environment, domain, key_name, title, description, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)
    `).run(id, branchName, targetEnvironment, domain, key, title, description || null, userId);

    const change = db.prepare('SELECT * FROM change_requests WHERE id = ?').get(id);
    res.status(201).json(change);
  } catch (error) {
    console.error('Error creating change:', error);
    res.status(500).json({ error: 'Failed to create change request' });
  }
});

// Submit for review
router.post('/:id/submit', (req: Request, res: Response) => {
  const { id } = req.params;
  
  db.prepare(`
    UPDATE change_requests 
    SET status = 'pending_review', updated_at = datetime('now')
    WHERE id = ? AND status = 'draft'
  `).run(id);

  const change = db.prepare('SELECT * FROM change_requests WHERE id = ?').get(id);
  res.json(change);
});

// Approve
router.post('/:id/approve', (req: Request, res: Response) => {
  const { id } = req.params;
  const { comment } = req.body;
  const userId = (req as any).userId || 'anonymous';
  
  db.prepare(`
    UPDATE change_requests 
    SET status = 'approved', reviewed_by = ?, review_comment = ?, updated_at = datetime('now')
    WHERE id = ? AND status = 'pending_review'
  `).run(userId, comment || null, id);

  const change = db.prepare('SELECT * FROM change_requests WHERE id = ?').get(id);
  res.json(change);
});

// Reject
router.post('/:id/reject', (req: Request, res: Response) => {
  const { id } = req.params;
  const { comment } = req.body;
  const userId = (req as any).userId || 'anonymous';
  
  db.prepare(`
    UPDATE change_requests 
    SET status = 'rejected', reviewed_by = ?, review_comment = ?, updated_at = datetime('now')
    WHERE id = ? AND status = 'pending_review'
  `).run(userId, comment, id);

  const change = db.prepare('SELECT * FROM change_requests WHERE id = ?').get(id);
  res.json(change);
});

// Merge
router.post('/:id/merge', async (req: Request, res: Response) => {
  const { id } = req.params;
  
  const change = db.prepare('SELECT * FROM change_requests WHERE id = ?').get(id) as any;
  
  if (!change || change.status !== 'approved') {
    return res.status(400).json({ error: 'Change must be approved before merging' });
  }

  try {
    const g = getGit();
    const targetBranch = envToBranch(change.target_environment);
    
    await g.checkout(targetBranch);
    await g.merge([change.branch_name, '--no-ff', '-m', `Merge: ${change.title}`]);
    
    // Delete draft branch
    await g.deleteLocalBranch(change.branch_name, true);
    
    // Update status
    db.prepare(`
      UPDATE change_requests 
      SET status = 'merged', merged_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(id);

    const updated = db.prepare('SELECT * FROM change_requests WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    console.error('Error merging:', error);
    res.status(500).json({ error: 'Failed to merge change' });
  }
});

export default router;
```

Update `packages/api/src/index.ts`:
```typescript
import express from 'express';
import cors from 'cors';
import { initializeDatabase } from './db';
import { initializeRepo } from './services/git';
import configRoutes from './routes/config';
import authRoutes from './routes/auth';
import changesRoutes from './routes/changes';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/config', configRoutes);
app.use('/api/changes', changesRoutes);

// Initialize and start
async function start() {
  try {
    initializeDatabase();
    console.log('Database initialized');
    
    await initializeRepo();
    console.log('Git repository ready');
    
    app.listen(PORT, () => {
      console.log(`ConfigHub API running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
```

## Step 10: Update Root package.json

```json
{
  "name": "confighub",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "npm run dev:api & npm run dev:ui",
    "dev:api": "npm run dev -w @confighub/api",
    "dev:ui": "npm run dev -w @confighub/ui",
    "build": "npm run build -w @confighub/api && npm run build -w @confighub/ui"
  }
}
```

## Verification

```bash
# Install all dependencies
npm install

# Start both API and UI
npm run dev

# Or in separate terminals:
# Terminal 1: npm run dev:api
# Terminal 2: npm run dev:ui
```

Then open http://localhost:3000

1. **Login** with `admin@confighub.local` / `admin123`
2. **Browse** → select `pricing` domain → select `motor-rates`
3. **Edit Config** → make a change → Create Change Request
4. **Changes** → view your draft → Submit for Review → Approve → Merge

## Done

When verification passes, Phase 2 is complete. Ready for Phase 3 (Environment Promotion & History).
