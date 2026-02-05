/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Mission Control Dark Theme
        'void': '#0a0a0f',
        'void-light': '#12121a',
        'panel': '#16161f',
        'panel-light': '#1e1e2a',
        'panel-hover': '#252532',

        // Borders & Lines
        'grid': '#2a2a3a',
        'grid-light': '#3a3a4a',

        // Neon Accents
        'cyan': {
          DEFAULT: '#00d4ff',
          dim: '#00d4ff80',
          glow: '#00d4ff40',
        },
        'neon-green': {
          DEFAULT: '#00ff88',
          dim: '#00ff8880',
          glow: '#00ff8840',
        },
        'amber': {
          DEFAULT: '#ffaa00',
          dim: '#ffaa0080',
          glow: '#ffaa0040',
        },
        'red': {
          DEFAULT: '#ff3366',
          dim: '#ff336680',
          glow: '#ff336640',
        },

        // Text
        'text-primary': '#e8e8f0',
        'text-secondary': '#8888a0',
        'text-muted': '#5a5a70',

        // Legacy mappings for compatibility
        sidebar: '#0a0a0f',
        'sidebar-hover': '#1e1e2a',
        'sidebar-active': '#00d4ff',
        surface: '#12121a',
        'surface-raised': '#16161f',
        border: '#2a2a3a',
        'border-strong': '#3a3a4a',
        accent: '#00d4ff',
        'accent-hover': '#00b8e6',
        success: '#00ff88',
        warning: '#ffaa00',
        danger: '#ff3366',
        'diff-add': '#00ff8815',
        'diff-add-strong': '#00ff8830',
        'diff-remove': '#ff336615',
        'diff-remove-strong': '#ff336630',
      },
      fontFamily: {
        sans: ['JetBrains Mono', 'SF Mono', 'Fira Code', 'monospace'],
        mono: ['JetBrains Mono', 'SF Mono', 'Fira Code', 'monospace'],
        display: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(0, 212, 255, 0.3), 0 0 40px rgba(0, 212, 255, 0.1)',
        'glow-green': '0 0 20px rgba(0, 255, 136, 0.3), 0 0 40px rgba(0, 255, 136, 0.1)',
        'glow-amber': '0 0 20px rgba(255, 170, 0, 0.3), 0 0 40px rgba(255, 170, 0, 0.1)',
        'glow-red': '0 0 20px rgba(255, 51, 102, 0.3), 0 0 40px rgba(255, 51, 102, 0.1)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
      },
      backgroundImage: {
        'grid-pattern': `linear-gradient(rgba(42, 42, 58, 0.5) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(42, 42, 58, 0.5) 1px, transparent 1px)`,
        'scanlines': 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.1) 2px, rgba(0, 0, 0, 0.1) 4px)',
      },
      backgroundSize: {
        'grid-sm': '20px 20px',
        'grid-md': '40px 40px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        glow: {
          '0%': { opacity: '0.5' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
