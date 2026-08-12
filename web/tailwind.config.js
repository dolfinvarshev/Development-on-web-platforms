/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-heebo)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        blink: {
          '50%': { opacity: '0.15' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.6)', opacity: '0.9' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
      },
      animation: {
        blink: 'blink 0.9s step-start infinite',
        'pulse-ring': 'pulse-ring 1.4s ease-out infinite',
      },
    },
  },
  plugins: [],
};
