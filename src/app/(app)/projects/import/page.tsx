import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Alert } from '@/components/alert';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { requireSuperAdmin } from '@/lib/dal';
import { ImportForm } from './import-form';

export const metadata = { title: 'Importar proyecto' };

export default async function ImportProjectPage() {
  await requireSuperAdmin();

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Volver a los proyectos
      </Link>

      <PageHeader
        title="Importar proyecto"
        description="Crea un proyecto nuevo con los ajustes, el catálogo, las OVAs, los usuarios y la actividad de un archivo exportado."
      />

      <Alert variant="info" title="Qué pasa al importar">
        <ul className="list-disc pl-5">
          <li>Siempre se crea un proyecto <strong>nuevo</strong>: no se mezcla ni se sobrescribe ninguno. Si la organización de GitHub ya es un proyecto aquí, no se puede importar.</li>
          <li>Si algo del archivo no es válido se cancela todo y no se guarda nada.</li>
          <li>La herramienta debe tener acceso a la organización del archivo.</li>
          <li>Los usuarios conservan su rol, pero no pueden entrar hasta que inicien sesión: ahí se comprueba que siguen en la organización.</li>
          <li>GitHub no se toca: los repositorios ya existen o se registran con «Reparar».</li>
        </ul>
      </Alert>

      <Card className="max-w-3xl">
        <CardContent>
          <ImportForm />
        </CardContent>
      </Card>
    </div>
  );
}
