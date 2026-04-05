/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#f5f4f0',
        dark: '#1a1a18',
        muted: '#6b6960',
        faint: '#9b9890',
        border: 'rgba(0,0,0,0.07)',
        status: {
          red: '#E24B4A',
          amber: '#EF9F27',
          green: '#1D9E75',
        }
      },
      borderRadius: {
        card: '18px',
        btn: '22px',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
