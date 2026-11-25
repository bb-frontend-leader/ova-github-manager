import { LoadingPage, PageHeaderSkeleton } from '@/components/page-skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ProjectFormSkeleton } from '../project-form-skeleton';

export default function NewProjectLoading() {
  return (
    <LoadingPage>
      <Skeleton className="h-5 w-44" />

      <PageHeaderSkeleton
        title="Nuevo proyecto"
        description="Registra otra organización de GitHub para gestionar sus OVAs. Quedará con su propio catálogo, sus usuarios y su actividad."
      />

      <Card className="max-w-3xl">
        <CardContent>
          <ProjectFormSkeleton withSlug />
        </CardContent>
      </Card>
    </LoadingPage>
  );
}
