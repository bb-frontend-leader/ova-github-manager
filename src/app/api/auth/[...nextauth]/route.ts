import { NextRequest } from 'next/server';
import { handlers } from '@/auth';
import { BASE_PATH } from '@/lib/base-path';

/**
 * Next quita el `basePath` de la URL antes de entregar la petición, pero Auth.js genera (y espera
 * reconocer) las rutas con el prefijo completo. Se lo devolvemos a la petición para que coincidan.
 */
function withPrefix(handler: (request: NextRequest) => Promise<Response>) {
  return (request: NextRequest) => {
    const url = new URL(request.url);
    if (!BASE_PATH || url.pathname.startsWith(`${BASE_PATH}/`)) return handler(request);
    url.pathname = `${BASE_PATH}${url.pathname}`;
    return handler(new NextRequest(url, request));
  };
}

export const GET = withPrefix(handlers.GET);
export const POST = withPrefix(handlers.POST);
