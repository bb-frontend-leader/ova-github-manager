import {
  FieldSkeleton,
  ListSkeleton,
  LoadingPage,
  PageHeaderSkeleton,
  TableSkeleton,
} from '@/components/page-skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** «Escuelas (3)»: el título es real y la cuenta, en gris. */
function CountedTitle({ children }: { children: string }) {
  return (
    <CardTitle className="flex items-center gap-1.5">
      {children} <Skeleton className="h-4 w-6" />
    </CardTitle>
  );
}

export default function AdminLoading() {
  return (
    <LoadingPage>
      <PageHeaderSkeleton
        title="Administración"
        description="Gestiona las escuelas, los desarrolladores y quién puede entrar a la herramienta."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CountedTitle>Escuelas</CountedTitle>
            <CardDescription>
              Cada escuela se convierte en el topic de GitHub de sus OVAs (sin acentos y en minúsculas).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-end gap-2">
              <FieldSkeleton label="Nueva escuela" className="flex-1" />
              <Skeleton className="h-9 w-32" />
            </div>
            <TableSkeleton
              rows={4}
              columns={[
                { label: 'Nombre', width: 'w-40' },
                { label: 'Topic', width: 'w-28' },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CountedTitle>Desarrolladores</CountedTitle>
            <CardDescription>
              Quedan en el registro de cada OVA. Vincula a cada persona con su usuario de GitHub para que vea su
              trabajo en «Mi trabajo». Los permisos en GitHub se gestionan por el equipo.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-2">
              <FieldSkeleton label="Nuevo desarrollador" className="min-w-40 flex-1" />
              <FieldSkeleton label="Usuario de GitHub (opcional)" className="min-w-32 flex-1" />
              <Skeleton className="h-9 w-44" />
            </div>
            <ListSkeleton rows={4} avatar />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CountedTitle>Usuarios</CountedTitle>
          <CardDescription>
            Quien entra por primera vez (siendo miembro de la organización) queda como Lector. Puedes autorizarlo
            de antemano o subirle el rol.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <FieldSkeleton label="Usuario de GitHub" className="min-w-48" />
            <FieldSkeleton label="Rol" className="min-w-56" />
            <Skeleton className="h-9 w-36" />
          </div>
          <TableSkeleton
            rows={5}
            columns={[
              { label: 'Usuario', width: 'w-36' },
              { label: 'Rol actual', width: 'w-16' },
              { label: 'Cambiar rol', width: 'w-64' },
            ]}
          />
        </CardContent>
      </Card>
    </LoadingPage>
  );
}
