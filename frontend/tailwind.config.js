/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },      colors: {
        // New Color Palette
        'purple': '#8029D5',
        'pink': '#F44893',
        'blue': '#3B58F2',
        'green': '#04B8B8',
        'yellow': '#FFAE3B',
        'red': '#FF4521',
        'white': '#FFFFFF',

        // Semantic mapping using the new palette
        primary: '#8029D5', // purple
        secondary: '#3B58F2', // blue
        accent: '#F44893', // pink
        success: '#04B8B8', // green
        warning: '#FFAE3B', // yellow
        error: '#FF4521', // red
        background: '#FFFFFF', // white
        textDark: '#2D1B69', // darker purple for text
        textLight: '#FFFFFF', // white for dark backgrounds

        // Keeping existing for compatibility, can be removed/updated later
        // primary: { // Light Blue / Indigo
        //   50: '#eef2ff',
        //   100: '#e0e7ff',
        //   200: '#c7d2fe',
        //   300: '#a5b4fc',
        //   400: '#818cf8',
        //   500: '#6366f1', // Main primary color
        //   600: '#4f46e5',
        //   700: '#4338ca',
        //   800: '#3730a3',
        //   900: '#312e81',
        // },
        // secondary: { // Light Purple / Violet
        //   50: '#f5f3ff',
        //   100: '#ede9fe',
        //   200: '#ddd6fe',
        //   300: '#c4b5fd',
        //   400: '#a78bfa',
        //   500: '#8b5cf6', // Main secondary color
        //   600: '#7c3aed',
        //   700: '#6d28d9',
        //   800: '#5b21b6',
        //   900: '#4c1d95',
        // },
        // accent: { // Light Teal / Cyan
        //   50: '#ecfeff',
        //   100: '#cffafe',
        //   200: '#a5f3fc',
        //   300: '#67e8f9',
        //   400: '#22d3ee',
        //   500: '#06b6d4', // Main accent color
        //   600: '#0891b2',
        //   700: '#0e7490',
        //   800: '#155e75',
        //   900: '#164e63',
        // },
        success: { // Adjusted for light theme visibility if needed
          50: '#f0fdf4', // Lighter
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e', // Main success
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        warning: { // Adjusted for light theme visibility
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b', // Main warning
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        error: { // Adjusted for light theme visibility
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444', // Main error
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        // Dark colors will now be used for text primarily
        dark: {
          100: '#6b7280', // gray-500
          200: '#4b5563', // gray-600
          300: '#374151', // gray-700
          400: '#1f2937', // gray-800
          500: '#111827', // gray-900
          DEFAULT: '#111827',
        },
        // Light colors for backgrounds and surfaces
        light: {
          50: '#f9fafb',    // gray-50
          100: '#f3f4f6',   // gray-100
          200: '#e5e7eb',   // gray-200
          300: '#d1d5db',   // gray-300
          400: '#9ca3af',   // gray-400
          DEFAULT: '#f3f4f6',
        }
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};