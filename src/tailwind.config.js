/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/themes/**/*.ejs'
  ],
  darkMode: 'class',
  plugins: [
    require('@tailwindcss/typography'),
  ]
} 