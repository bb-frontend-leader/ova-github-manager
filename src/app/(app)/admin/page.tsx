import { ROLES } from '@/core';
import { Alert } from '@/components/alert';
import { InitialsAvatar } from '@/components/initials-avatar';
import { NativeSelect } from '@/components/native-select';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { requirePagePermission } from '@/lib/dal';
import { getServices } from '@/lib/services';
import { addDeveloperAction, addSchoolAction, addUserAction, changeRoleAction } from './actions';

const ROLE_OPTIONS: Record<(typeof ROLES)[number], string> = {
  viewer: 'Lector · solo consulta',
  creator: 'Creador · crea OVAs',
  admin: 'Admin · todo',
};

const ROLE_BADGE: Record<(typeof ROLES)[number], string> = {
  viewer: 'Lector',
  creator: 'Creador',
  admin: 'Admin',
};

function Count({ children }: { children: number }) {
  return <span className="font-normal text-muted-foreground">({children})</span>;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const current = await requirePagePermission('users:manage');
  await requirePagePermission('catalog:manage');

  const { ok, error } = await searchParams;
  const { store } = getServices();
  const [schools, developers, users] = await Promise.all([
    store.listSchools(),
    store.listDevelopers(),
    store.listUsers(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Administración"
        description="Gestiona las escuelas, los desarrolladores y quién puede entrar a la herramienta."
      />

      {ok && <Alert variant="success" title={ok} />}
      {error && <Alert variant="error" title="No se pudo completar la acción">{error}</Alert>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              Escuelas <Count>{schools.length}</Count>
            </CardTitle>
            <CardDescription>
              Cada escuela se convierte en el topic de GitHub de sus OVAs (sin acentos y en minúsculas).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form action={addSchoolAction} className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="school-name">Nueva escuela</Label>
                <Input id="school-name" name="name" required autoComplete="off" placeholder="Escuela de Ingeniería" />
              </div>
              <Button type="submit">Añadir escuela</Button>
            </form>
            {schools.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay escuelas. Añade la primera para poder crear OVAs.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Topic</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schools.map((school) => (
                      <TableRow key={school.id}>
                        <TableCell>{school.name}</TableCell>
                        <TableCell>
                          <code className="text-xs text-muted-foreground">{school.slug}</code>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Desarrolladores <Count>{developers.length}</Count>
            </CardTitle>
            <CardDescription>
              Quedan en el registro de cada OVA. Los permisos en GitHub se gestionan por el equipo.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form action={addDeveloperAction} className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="developer-name">Nuevo desarrollador</Label>
                <Input id="developer-name" name="name" required autoComplete="off" placeholder="Nombre y apellido" />
              </div>
              <Button type="submit">Añadir desarrollador</Button>
            </form>
            {developers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay desarrolladores. Añade el primero para poder asignarle OVAs.
              </p>
            ) : (
              <ul className="divide-y rounded-lg ring-1 ring-foreground/10">
                {developers.map((developer) => (
                  <li key={developer.id} className="flex items-center gap-2.5 px-3 py-2 text-sm">
                    <InitialsAvatar name={developer.name} />
                    {developer.name}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Usuarios <Count>{users.length}</Count>
          </CardTitle>
          <CardDescription>
            Quien entra por primera vez (siendo miembro de la organización) queda como Lector. Puedes
            autorizarlo de antemano o subirle el rol.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form action={addUserAction} className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-48 flex-col gap-1.5">
              <Label htmlFor="user-login">Usuario de GitHub</Label>
              <Input id="user-login" name="login" placeholder="octocat" required autoComplete="off" />
            </div>
            <div className="flex min-w-56 flex-col gap-1.5">
              <Label htmlFor="user-role">Rol</Label>
              <NativeSelect id="user-role" name="role" defaultValue="creator">
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_OPTIONS[role]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Button type="submit">Autorizar usuario</Button>
          </form>

          <div className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol actual</TableHead>
                  <TableHead>Cambiar rol</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.login}>
                    <TableCell>
                      <span className="flex items-center gap-2.5">
                        <InitialsAvatar name={user.login} />
                        <span className="font-medium">@{user.login}</span>
                        {user.login === current.login && <Badge variant="outline">Tú</Badge>}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {ROLE_BADGE[user.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <form action={changeRoleAction} className="flex items-center gap-2">
                        <input type="hidden" name="login" value={user.login} />
                        <NativeSelect
                          name="role"
                          defaultValue={user.role}
                          aria-label={`Nuevo rol de @${user.login}`}
                          className="max-w-56"
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_OPTIONS[role]}
                            </option>
                          ))}
                        </NativeSelect>
                        <Button type="submit" variant="outline" size="sm">
                          Guardar rol
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
