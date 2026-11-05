import { SignInUseCase } from '../../application/UserAccessUseCases';
import { SqliteOvaStore } from '../../infrastructure/sqlite';
import { openProject } from '../helpers';

async function twoProjects() {
  const { root, projectId: a } = await openProject('Alpha');
  const b = (
    await root.createProject({
      slug: 'beta',
      name: 'Beta',
      org: 'Beta',
      template: 't',
      defaultTeam: 'Frontend',
      descriptionPrefix: 'Beta',
      total: 5,
    })
  ).id;
  return { root, a, b };
}

describe('SignInUseCase', () => {
  let root: SqliteOvaStore;
  let a: number;
  let b: number;

  beforeEach(async () => {
    ({ root, a, b } = await twoProjects());
  });
  afterEach(() => root.close());

  const member = (orgs: string[]) => async (org: string) => orgs.includes(org);

  it('da acceso solo a los proyectos cuya organización integra, como viewer', async () => {
    const result = await new SignInUseCase(root, { superAdmins: [] }).execute('Maria', member(['Beta']));

    expect(result).toMatchObject({ login: 'maria', superAdmin: false });
    expect(result.projects.map((p) => p.slug)).toEqual(['beta']);
    expect(await root.forProject(b).findUser('maria')).toMatchObject({ role: 'viewer', verified: true });
    expect(await root.forProject(a).findUser('maria')).toBeNull();
  });

  it('no cambia el rol de quien ya existe y lo marca como verificado', async () => {
    await root.forProject(a).createUser('maria', 'creator');

    await new SignInUseCase(root, { superAdmins: [] }).execute('MARIA', member(['Alpha']));

    expect(await root.forProject(a).findUser('maria')).toMatchObject({ role: 'creator', verified: true });
  });

  it('quita la verificación si deja de ser miembro de la organización', async () => {
    const useCase = new SignInUseCase(root, { superAdmins: [] });
    await useCase.execute('maria', member(['Alpha']));
    expect((await root.listProjectsFor('maria')).map((p) => p.slug)).toEqual(['alpha']);

    const result = await useCase.execute('maria', member([]));

    expect(result.projects).toEqual([]);
    expect(await root.listProjectsFor('maria')).toEqual([]);
    expect((await root.forProject(a).findUser('maria'))?.verified).toBe(false);
  });

  it('si no puede comprobar la membresía no da acceso', async () => {
    const result = await new SignInUseCase(root, { superAdmins: [] }).execute('maria', async () => {
      throw new Error('GitHub caído');
    });

    expect(result.projects).toEqual([]);
  });

  it('un super administrador ve todos los proyectos aunque no sea miembro', async () => {
    const useCase = new SignInUseCase(root, { superAdmins: ['@Alejo'] });

    const result = await useCase.execute('alejo', member([]));

    expect(result.superAdmin).toBe(true);
    expect(result.projects.map((p) => p.slug).sort()).toEqual(['alpha', 'beta']);
    expect(useCase.isSuperAdmin('ALEJO')).toBe(true);
    expect(useCase.isSuperAdmin('maria')).toBe(false);
  });

  it('rechaza un usuario de GitHub inválido o un super admin inválido', async () => {
    const useCase = new SignInUseCase(root, { superAdmins: [] });
    await expect(useCase.execute('a b', member([]))).rejects.toThrow('Invalid GitHub username');
    expect(() => new SignInUseCase(root, { superAdmins: ['no válido'] })).toThrow();
  });
});
