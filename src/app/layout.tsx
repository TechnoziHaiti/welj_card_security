import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Welj Card Security | Welj Express Services',
  description: 'Système officiel de gestion et de vérification d\'authenticité des cartes de membres Welj Express Services.',
  icons: {
    icon: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full font-sans">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window !== 'undefined' && window.HTMLMediaElement) {
                  var originalPlay = HTMLMediaElement.prototype.play;
                  HTMLMediaElement.prototype.play = function() {
                    var res = originalPlay.apply(this, arguments);
                    if (res && typeof res.catch === 'function') {
                      return res.catch(function(err) {
                        if (err && (err.name === 'AbortError' || (typeof err.message === 'string' && (err.message.indexOf('play()') !== -1 || err.message.indexOf('pause()') !== -1 || err.message.indexOf('interrupted') !== -1)))) {
                          return;
                        }
                        return Promise.reject(err);
                      });
                    }
                    return res;
                  };
                }
                window.addEventListener('unhandledrejection', function(event) {
                  var reason = event && event.reason;
                  if (reason && (reason.name === 'AbortError' || (typeof reason.message === 'string' && (reason.message.indexOf('play()') !== -1 || reason.message.indexOf('pause()') !== -1 || reason.message.indexOf('interrupted') !== -1 || reason.message.indexOf('removed') !== -1)))) {
                    event.preventDefault();
                  }
                });
              })();
            `,
          }}
        />
      </head>
      <body className="h-full bg-slate-50 text-slate-900 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
