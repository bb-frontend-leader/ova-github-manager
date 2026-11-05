import { can, ovasToCsv } from '@/core';
import { getProjectAccess, getViewer } from '@/lib/dal';
import { filterOvas, parseOvaQuery } from '@/lib/ova-filter';

// Excel necesita la marca BOM para leer bien los acentos de un CSV en UTF-8
const BOM = '\uFEFF';

/** Descarga las OVAs (con el enlace de cada repositorio) respetando los filtros del panel. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ project: string }> },
) {
  if (!(await getViewer())) return new Response('Inicia sesión para exportar.', { status: 401 });

  const { project: slug } = await params;
  const access = await getProjectAccess(slug);
  if (!access || !can(access.role, 'ova:view')) {
    return new Response('No tienes permiso.', { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const query = parseOvaQuery({
    schoolId: searchParams.get('schoolId') ?? undefined,
    developerId: searchParams.get('developerId') ?? undefined,
    q: searchParams.get('q') ?? undefined,
  });

  const ovas = filterOvas(await access.services.store.list({}), query);
  const date = new Date().toISOString().slice(0, 10);

  return new Response(BOM + ovasToCsv(ovas), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${access.project.slug}-ovas-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
