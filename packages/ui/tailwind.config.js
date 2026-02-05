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
