/**
 * Prefijo bajo el que se sirve la aplicación (p. ej. "/ova-github-manager/app"), o "" si va en la raíz.
 * Lo fija `BASE_PATH` en next.config.ts, que lo expone como NEXT_PUBLIC_BASE_PATH para el código.
 *
 * Next ya añade el prefijo a <Link>, router y redirect(). Hace falta `withBasePath` donde la
 * ruta no pasa por Next: <a>, <form action> con una ruta, y las URL que construye Auth.js.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function withBasePath(path: string): string {
  return `${BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
}
