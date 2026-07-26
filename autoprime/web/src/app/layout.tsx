import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'AP Auto Prime — Gestão de Lava Rápido e Estética Automotiva',
  description: 'Plataforma completa de gestão para lava-rápido, estética automotiva e detail.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/favicon-32.png',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AP Auto Prime',
  },
};

export const viewport: Viewport = {
  themeColor: '#2f7cf6',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

const THEME_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem('autoprime_theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = stored ? stored === 'dark' : prefersDark;
    if (isDark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

// Registrado de forma síncrona no <head>, sem esperar o React hidratar —
// ferramentas de análise de PWA (ex.: PWABuilder) leem o HTML inicial e não
// detectam um registro feito só depois via useEffect.
const SW_SCRIPT = `
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(function () {});
}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: SW_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
