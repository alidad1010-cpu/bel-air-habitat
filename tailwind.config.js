/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // Deep Space / Midnight Theme
                midnight: {
                    950: '#020617', // Main Dark BG
                    900: '#0f172a', // Sidebar / Cards
                    800: '#1e293b', // Hover States
                },
                // Premium Accents
                gold: {
                    400: '#fbbf24',
                    500: '#f59e0b',
                    600: '#d97706', // Rich Gold
                },
                emerald: {
                    400: '#34d399',
                    500: '#10b981', // Primary Green
                    600: '#059669',
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
                'glow-sm': '0 0 10px rgba(16, 185, 129, 0.1)',
                'glow-md': '0 0 20px rgba(16, 185, 129, 0.2)',
                'glow-gold': '0 0 20px rgba(245, 158, 11, 0.15)',
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
            }
        },
    },
    plugins: [],
}
