/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,html}'],
  theme: {
    extend: {
      // Referencia a CSS custom properties (AD-4): BrandingService las
      // reescribe en runtime, un build sirve a N tenants (NFR-T-01).
      colors: {
        brand: {
          primary: 'var(--brand-primary)',
          'primary-contrast': 'var(--brand-primary-contrast)',
          secondary: 'var(--brand-secondary)',
          'secondary-contrast': 'var(--brand-secondary-contrast)',
          accent: 'var(--brand-accent)',
          'accent-contrast': 'var(--brand-accent-contrast)',
        },
      },
    },
  },
  plugins: [],
};
