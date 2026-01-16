/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Deep Space / Midnight Theme for Dark Mode
        midnight: {
          950: '#0a0a1e', // Main Dark BG (Deep Navy)
          900: '#1a1a2e', // Panels
          800: '#16213e', // Cards
          700: '#1f2937', // Hover States
        },
        // Premium Gold Accents
        gold: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706', // Rich Gold
        },
        // TRUE Emerald - Nature/Habitat Theme
        emerald: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399', // Accent clair
          500: '#10b981', // PRIMARY - Émeraude
          600: '#059669', // Hover
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        // Turquoise - Secondary/Complement
        teal: {
          400: '#2dd4bf',
          500: '#14b8a6', // Secondary
          600: '#0d9488',
          700: '#0f766e',
        },
        // Standard Slate (kept for compatibility)
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
      boxShadow: {
        'glow-sm': '0 0 10px rgba(16, 185, 129, 0.2)', // Emerald Glow
        'glow-md': '0 0 20px rgba(16, 185, 129, 0.25)', // Emerald Glow
        'glow-lg': '0 0 30px rgba(16, 185, 129, 0.3)', // Emerald Glow Large
        'glow-gold': '0 0 20px rgba(245, 158, 11, 0.2)', // Gold Glow
        'glow-teal': '0 0 20px rgba(20, 184, 166, 0.2)', // Turquoise Glow
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};
