/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    // Inlines the imports of the two entry stylesheets (app/app.css and
    // app/marketing.css) so each one's @config applies to all of its sources.
    // No other stylesheet has an @import, so this is a no-op for them.
    'postcss-import': {},
    tailwindcss: {},
  },
};

export default config;
