/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Deep Space / Midnight Theme - Slightly more Navy for "Premium"
        midnight: {
          950: '#020617', // Main Dark BG
          900: '#0f172a', // Sidebar / Cards
          800: '#1e293b', // Hover States
        },
        // Premium Accents
        // MAPPED TO NEW THEME: "Emerald" classes now render Royal Indigo
        gold: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706', // Rich Gold
        },
        emerald: {
          400: '#818cf8', // Actually Indigo 400
          500: '#6366f1', // Actually Indigo 500 (Primary)
          600: '#4f46e5', // Actually Indigo 600
        },
        // Standard Slate (kept for compatibility, but refined)
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
        'glow-sm': '0 0 10px rgba(99, 102, 241, 0.2)', // Indigo Glow
        'glow-md': '0 0 20px rgba(99, 102, 241, 0.25)', // Indigo Glow
        'glow-gold': '0 0 20px rgba(245, 158, 11, 0.2)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};
