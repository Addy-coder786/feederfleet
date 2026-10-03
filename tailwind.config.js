/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#f6f8f5',     // page ground (also text on green buttons)
        panel: '#ffffff',   // cards
        panel2: '#f1f5f0',  // soft inset
        line: '#dde6dd',    // borders
        grid: '#1f6b45',    // forest green — primary brand
        batt: '#4fa36a',    // light green — active / energy flow
        solar: '#c98a1b',   // amber — warnings only
        alert: '#c0452f',   // red — genuinely stressed only
        dim: '#6b7a70',     // soft grey — secondary text
        fg: '#163a28',      // dark green — headings / strong text
        fgb: '#2f4a3b',     // dark green — body text
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'Segoe UI', 'sans-serif'],
        display: ['Archivo', 'IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(22,58,40,0.06), 0 4px 16px -8px rgba(22,58,40,0.12)',
        glow: '0 1px 2px rgba(22,58,40,0.08), 0 10px 30px -12px rgba(22,58,40,0.25)',
      },
    },
  },
  plugins: [],
}
