import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { EnvironmentSwitcher } from './EnvironmentSwitcher';
import clsx from 'clsx';

interface LayoutProps {
  children: ReactNode;
}

const navSections = [
  {
    label: 'Overview',
    items: [
      { path: '/', label: 'Dashboard', icon: '◫' },
      { path: '/drift', label: 'Drift', icon: '◉' },
    ],
  },
  {
    label: 'Configurations',
    items: [
      { path: '/browse', label: 'Browse', icon: '☰' },
      { path: '/compare', label: 'Compare', icon: '⇄' },
    ],
  },
  {
    label: 'Workflow',
    items: [
      { path: '/changes', label: 'Changes', icon: '⎇' },
      { path: '/promotions', label: 'Promotions', icon: '↗' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { path: '/audit', label: 'Audit Log', icon: '◷' },
      { path: '/dependencies', label: 'Dependencies', icon: '⬡' },
    ],
  },
];

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-white/10">
          <span className="text-white font-semibold tracking-tight text-lg">
            Config<span className="text-blue-500">Hub</span>
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 px-2 overflow-auto">
          {navSections.map((section, sectionIdx) => (
            <div key={section.label} className={clsx(sectionIdx > 0 && 'mt-4')}>
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {section.label}
              </div>
              {section.items.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all mb-0.5',
                    location.pathname === item.path
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-400 hover:bg-slate-800 hover:text-white'
                  )}
                >
                  <span className="text-base w-5 text-center">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-white/10">
          <div className="text-sm text-gray-400 truncate">{user?.email}</div>
          <div className="text-xs text-gray-500 capitalize mb-2">{user?.role}</div>
          <button
            onClick={logout}
            className="text-xs text-gray-500 hover:text-white transition-all"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar with environment switcher */}
        <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-4 flex-shrink-0">
          <div />
          <EnvironmentSwitcher />
          <div className="text-sm text-gray-500">
            {user?.email}
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
