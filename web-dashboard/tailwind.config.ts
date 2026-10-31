import type { Config } from 'tailwindcss'

// Los colores son variables CSS (src/index.css): cambian solos entre modo claro y oscuro.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        plano: v('plano'),
        superficie: v('superficie'),
        elevada: v('elevada'),
        borde: v('borde'),
        tinta: v('tinta'),
        tenue: v('tenue'),
        apagada: v('apagada'),
        acento: v('acento'),
        'acento-tinta': v('acento-tinta'),
        serie: v('serie'),
        rejilla: v('rejilla'),
        bien: v('bien'),
        alerta: v('alerta'),
        critico: v('critico'),
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
