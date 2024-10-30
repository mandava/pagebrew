/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/defaults/templates/**/*.ejs'
  ],
  darkMode: 'class',
  plugins: [
    require('@tailwindcss/typography'),
  ]
} 