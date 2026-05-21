/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Palette B — Amber Core (light/warm surfaces)
        'warm-cream': '#FAF8F4',
        'warm-stone': '#F5F0E8',
        'dusty-linen': '#E8DED0',
        'amber-mist': '#D4B896',
        'dawn-gold': '#C9A54C',
        'dusty-ochre': '#C8A96E',
        'muted-amber': '#D4963A',
        'warm-walnut': '#8C6B3E',
        'deep-brown': '#3A2E28',
        'rich-charcoal': '#2A2420',
        // Palette C — Charcoal Sun (dark surfaces)
        'deep-charcoal': '#2A2420',
        'warm-graphite': '#3D3530',
        'smoky-brown': '#524840',
        'dusty-mocha': '#655A50',
        'warm-sand': '#E8DED0',
        'soft-cream': '#FAF7F2',
        'amber-glow': '#E8956A',
        'pale-apricot': '#F2C99A',
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
