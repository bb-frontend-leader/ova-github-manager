import { LoadingPage, PageHeaderSkeleton } from '@/components/page-skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ProjectFormSkeleton } from '../../../projects/project-form-skeleton';

export default function ProjectSettingsLoading() {
  return (
    <LoadingPage>
      <PageHeaderSkeleton
        title="Ajustes del proyecto"
        description="Plantilla, team, prefijo y objetivo con los que se crean y se miden las OVAs de este proyecto."
      />

      <Card className="max-w-3xl">
        <CardContent>
          <ProjectFormSkeleton withSlug={false} />
        </CardContent>
      </Card>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Exportar el proyecto</CardTitle>
          <CardDescription>
            Un archivo con los ajustes, el catálogo, las OVAs, los usuarios y toda la actividad. Sirve para pasar el
            proyecto a otra instalación de la herramienta o para tener una copia que se pueda importar (en
            «Proyectos» → «Importar proyecto»). Guárdalo en un lugar seguro: incluye a los usuarios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-9 w-44" />
        </CardContent>
      </Card>
    </LoadingPage>
  );
}
