import { can, ovasToCsv } from '@/core';
import { getCurrentUser } from '@/lib/dal';
import { filterOvas, parseOvaQuery } from '@/lib/ova-filter';
import { getServices } from '@/lib/services';

// Excel necesita la marca BOM para leer bien los acentos de un CSV en UTF-8
const BOM = '\uFEFF';

/** Descarga las OVAs (con el enlace de cada repositorio) respetando los filtros del panel. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response('Inicia sesión para exportar.', { status: 401 });
  if (!can(user.role, 'ova:view')) return new Response('No tienes permiso.', { status: 403 });

  const { searchParams } = new URL(request.url);
  const query = parseOvaQuery({
    schoolId: searchParams.get('schoolId') ?? undefined,
    developerId: searchParams.get('developerId') ?? undefined,
    q: searchParams.get('q') ?? undefined,
  });

  const ovas = filterOvas(await getServices().store.list({}), query);
  const date = new Date().toISOString().slice(0, 10);

  return new Response(BOM + ovasToCsv(ovas), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ovas-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
