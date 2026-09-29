// Tailwind settings for the suite (these were previously in the <script> config for the Tailwind CDN).
// Tailwind scans the files in `content` and only includes the classes it finds, so styles.css stays small.
const path = require('path');
const root = path.join(__dirname, '..');

module.exports = {
    content: [
        path.join(root, 'index.html'),
        path.join(root, 'shared/**/*.js'),
        path.join(root, 'tabs/**/*.{html,js}'),
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                qbNavy: { 50: '#f0f4f9', 100: '#d9e2ec', 500: '#1b365d', 600: '#0f2042', 700: '#0a152e', 800: '#060d1d', 900: '#0f172a' },
                qbTeal: { 400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488' },
                brand:  { 50: '#f0f9ff', 100: '#e0f2fe', 500: '#0284c7', 600: '#0284c7', 700: '#0369a1' },
            },
            fontFamily: { sans: ['Inter', 'sans-serif'] },
        },
    },
};
