import { getProjectAccess, getViewer } from '@/lib/dal';
import { getServices } from '@/lib/services';

/**
 * Descarga el proyecto completo (ajustes, catálogo, OVAs, usuarios y actividad) en un JSON.
 * Solo super administradores: el archivo incluye a los usuarios y todo el historial.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ project: string }> },
) {
  const viewer = await getViewer();
  if (!viewer) return new Response('Inicia sesión para exportar.', { status: 401 });
  if (!viewer.superAdmin) return new Response('Solo un super administrador puede exportar un proyecto.', { status: 403 });

  const { project: slug } = await params;
  const access = await getProjectAccess(slug);
  if (!access) return new Response('Proyecto no encontrado.', { status: 404 });

  try {
    const { fileName, json } = await getServices().projectArchive.export(access.project.id, viewer.login);
    return new Response(json, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[archive]', error);
    return new Response('No se pudo exportar el proyecto.', { status: 500 });
  }
}
