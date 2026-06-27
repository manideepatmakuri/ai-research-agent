export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {
    colors: {
      brand: { 50:'#f0f7ff',100:'#e0effe',400:'#36a7f8',500:'#0c8ce9',600:'#006fc7',700:'#0159a2' },
      surface: { 300:'#cbd5e1',400:'#94a3b8',500:'#64748b',600:'#475569',700:'#334155',800:'#1e293b',900:'#0f172a',950:'#020617' }
    },
    fontFamily: { sans: ['"DM Sans"','system-ui'], mono: ['"JetBrains Mono"','monospace'] }
  }},
  plugins: [],
}
