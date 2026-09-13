/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#FAF7EE', // Slightly yellowish warm background
        surface: '#FFFFFF',    // Pure white cards for crisp contrast
        'surface-subtle': '#F5F1E4', // Warm subtle sub-surface
        'surface-hover': '#F3EEDB', // Slightly deeper warm hover
        border: '#E8E3D5',     // Soft warm border
        primary: {
          DEFAULT: '#2563EB',
          hover: '#1D4ED8',
        },
        risk: {
          low: '#16A34A',      // Emerald 600
          medium: '#D97706',   // Amber 600
          high: '#EA580C',     // Orange 600
          critical: '#DC2626', // Red 600
        },
      },
    },
  },
  plugins: [],
}
