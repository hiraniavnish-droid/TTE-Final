/** Static CSS travels with the versioned app instead of a runtime CDN script. */
module.exports = {
  content: ['./index.html', './App.tsx', './index.tsx', './components/**/*.{ts,tsx}', './pages/**/*.{ts,tsx}', './contexts/**/*.{ts,tsx}', './hooks/**/*.{ts,tsx}'],
  theme: { extend: { fontFamily: { sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'] } } },
  safelist: [{ pattern: /^(bg|text|border|ring)-(slate|gray|blue|indigo|violet|emerald|green|amber|orange|red|rose|cyan)-(50|100|200|300|400|500|600|700|800|900)$/ }],
  plugins: [],
};
