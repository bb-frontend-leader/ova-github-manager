'use client';

import './globals.css';
import { ErrorPanel } from '@/components/error-panel';
import { themeScript } from '@/lib/theme-script';

/**
 * Último recurso: falla el layout raíz o el de la aplicación (sesión, base de datos…). Sustituye al
 * layout raíz, así que define su propio <html> y <body> y carga los estilos y el tema por su cuenta.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="es" suppressHydrationWarning className="h-full antialiased">
      <head>
        <title>Error · OVA GitHub Manager</title>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          <ErrorPanel error={error} retry={retry} />
        </main>
      </body>
    </html>
  );
}
