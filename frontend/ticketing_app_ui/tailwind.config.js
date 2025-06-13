// tailwind.config.js
module.exports = {
  corePlugins: {
    preflight: false,
  },
  content: [
    "./src/**/*.{html,js,jsx,ts,tsx,vue,scss}", // Adatta questo percorso ai tuoi file
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}