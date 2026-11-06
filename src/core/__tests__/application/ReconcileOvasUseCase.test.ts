import { ManageCatalogUseCase } from '../../application/ManageCatalogUseCase';
import type {
  RepositoryData,
  RepositoryGateway,
  RepositoryInspector,
  TeamPermissionLevel,
} from '../../application/ports';
import { ReconcileOvasUseCase } from '../../application/ReconcileOvasUseCase';
import type { SqliteProjectStore } from '../../infrastructure/sqlite';
import { openProjectStore } from '../helpers';

type Gateway = jest.Mocked<RepositoryGateway & RepositoryInspector>;

const repo = (name: string, extra: Partial<RepositoryData> = {}): RepositoryData => ({
  id: 1,
  name,
  description: null,
  private: true,
  url: `https://github.com/mi-org/${name}`,
  owner: { login: 'mi-org' },
  topics: [],
  ...extra,
});

describe('ReconcileOvasUseCase', () => {
  let store: SqliteProjectStore;
  let gateway: Gateway;
  let useCase: ReconcileOvasUseCase;
  let schoolId: number;
  let developerId: number;

  const config = {
    org: 'mi-org',
    template: 'ova-template',
    team: { slug: 'frontend', permission: 'push' as TeamPermissionLevel },
  };

  const register = (repoName: string) =>
    store.add({
      repoName,
      repoUrl: `https://github.com/mi-org/${repoName}`,
      schoolId,
      developerId,
      createdBy: 'alejo',
    });

  beforeEach(async () => {
    store = await openProjectStore();
    const catalog = new ManageCatalogUseCase(store);
    schoolId = (await catalog.addSchool('Ingeniería')).id; // slug: ingenieria
    developerId = (await catalog.addDeveloper('Juan')).id;

    gateway = {
      createRepository: jest.fn(),
      assignTeam: jest.fn().mockResolvedValue(undefined),
      replaceTopics: jest.fn().mockResolvedValue(undefined),
      getTopics: jest.fn().mockResolvedValue([]),
      getRepository: jest.fn(),
      repositoryExists: jest.fn(),
      listRepositories: jest.fn().mockResolvedValue([]),
      listTeamRepositories: jest.fn().mockResolvedValue([]),
      getTeamPermission: jest.fn().mockResolvedValue(null),
      listRepositoryHealth: jest.fn(),
    };
    useCase = new ReconcileOvasUseCase(gateway, store, store, config, store);
  });

  afterEach(() => store.close());

  describe('scan', () => {
    it('detecta lo que le falta a cada OVA registrada', async () => {
      await register('OK');
      await register('SIN-TOPIC');
      await register('SIN-TEAM');
      await register('POCO-PERMISO');
      gateway.listRepositories.mockResolvedValue([
        repo('OK', { topics: ['ingenieria'] }),
        repo('SIN-TOPIC', { topics: [] }),
        repo('SIN-TEAM', { topics: ['ingenieria'] }),
        repo('POCO-PERMISO', { topics: ['ingenieria'] }),
      ]);
      gateway.listTeamRepositories.mockResolvedValue([
        { name: 'OK', permission: 'push' },
        { name: 'SIN-TOPIC', permission: 'push' },
        { name: 'POCO-PERMISO', permission: 'pull' },
      ]);

      const report = await useCase.scan();
      const issues = Object.fromEntries(report.repairs.map((r) => [r.ova.repoName, r.issues]));

      expect(report.checked).toBe(4);
      expect(issues).toEqual({
        'SIN-TOPIC': ['missing_topic'],
        'SIN-TEAM': ['missing_team'],
        'POCO-PERMISO': ['insufficient_permission'],
      });
      expect(report.repairs.find((r) => r.ova.repoName === 'POCO-PERMISO')?.teamPermission).toBe('pull');
      expect(report.teamError).toBeUndefined();
    });

    it('un permiso mayor al requerido (admin) no es un problema', async () => {
      await register('GR-1');
      gateway.listRepositories.mockResolvedValue([repo('GR-1', { topics: ['ingenieria'] })]);
      gateway.listTeamRepositories.mockResolvedValue([{ name: 'GR-1', permission: 'admin' }]);

      expect((await useCase.scan()).repairs).toEqual([]);
    });

    it('acumula varios problemas de la misma OVA', async () => {
      await register('GR-1');
      gateway.listRepositories.mockResolvedValue([repo('GR-1')]);

      const [item] = (await useCase.scan()).repairs;

      expect(item.issues).toEqual(['missing_topic', 'missing_team']);
    });

    it('compara los nombres sin distinguir mayúsculas', async () => {
      await register('GR-1');
      gateway.listRepositories.mockResolvedValue([repo('gr-1', { topics: ['ingenieria'] })]);
      gateway.listTeamRepositories.mockResolvedValue([{ name: 'gr-1', permission: 'push' }]);

      const report = await useCase.scan();

      expect(report.repairs).toEqual([]);
      expect(report.unregistered).toEqual([]);
    });

    it('ignora las OVAs cuyo repositorio ya no existe (eso lo resuelve la sincronización)', async () => {
      await register('BORRADA');
      gateway.listRepositories.mockResolvedValue([repo('otro')]);

      expect((await useCase.scan()).repairs).toEqual([]);
    });

    it('lista los repositorios sin registrar, las probables OVAs primero', async () => {
      await register('REGISTRADA');
      gateway.listRepositories.mockResolvedValue([
        repo('REGISTRADA', { topics: ['ingenieria'] }),
        repo('zeta-util'),
        repo('57-1604'),
        repo('GR-9', { topics: ['ingenieria'] }),
        repo('antigua', { archived: true }),
        repo('ova-template', { isTemplate: true }),
        repo('Ova-Template'),
      ]);
      gateway.listTeamRepositories.mockResolvedValue([
        { name: 'REGISTRADA', permission: 'push' },
        { name: '57-1604', permission: 'pull' },
      ]);

      const { unregistered } = await useCase.scan();

      expect(unregistered.map((r) => r.name)).toEqual(['57-1604', 'GR-9', 'zeta-util']);
      expect(unregistered.map((r) => r.probableOva)).toEqual([true, true, false]);
      expect(unregistered[1].suggestedSchool?.name).toBe('Ingeniería');
      expect(unregistered[0].suggestedSchool).toBeNull();
    });

    it('sin plantilla configurada no excluye ningún nombre', async () => {
      const noTemplate = new ReconcileOvasUseCase(gateway, store, store, {
        org: 'mi-org',
        team: config.team,
      });
      gateway.listRepositories.mockResolvedValue([repo('ova-template')]);

      expect((await noTemplate.scan()).unregistered.map((r) => r.name)).toEqual(['ova-template']);
    });

    it('acepta la plantilla en formato owner/repo', async () => {
      const qualified = new ReconcileOvasUseCase(gateway, store, store, {
        ...config,
        template: 'mi-org/ova-template',
      });
      gateway.listRepositories.mockResolvedValue([repo('ova-template'), repo('GR-1')]);

      expect((await qualified.scan()).unregistered.map((r) => r.name)).toEqual(['GR-1']);
    });

    it('si no puede leer el team, lo informa y sigue revisando los topics', async () => {
      await register('GR-1');
      gateway.listRepositories.mockResolvedValue([repo('GR-1')]);
      gateway.listTeamRepositories.mockRejectedValue(
        new Error('Failed to list repositories of team "frontend": Not Found'),
      );

      const report = await useCase.scan();

      expect(report.teamError).toContain('frontend');
      expect(report.repairs[0].issues).toEqual(['missing_topic']);
    });

    it('describe el fallo del team aunque no sea un Error', async () => {
      gateway.listRepositories.mockResolvedValue([repo('GR-1')]);
      gateway.listTeamRepositories.mockRejectedValue('boom');

      expect((await useCase.scan()).teamError).toBe('Failed to read the team');
    });

    it('se niega a actuar si GitHub no devuelve repositorios', async () => {
      await expect(useCase.scan()).rejects.toThrow('GitHub returned no repositories');
    });
  });

  describe('repair', () => {
    it('añade el topic y el team que faltan sin quitar los demás topics', async () => {
      await register('GR-1');
      gateway.getTopics.mockResolvedValue(['otro-topic']);
      gateway.getTeamPermission.mockResolvedValue(null);

      const outcome = await useCase.repair('GR-1', 'maria');

      expect(outcome).toMatchObject({ repoName: 'GR-1', success: true });
      expect(outcome.fixed).toEqual(['topic "ingenieria"', 'team frontend (push)']);
      expect(gateway.replaceTopics).toHaveBeenCalledWith('mi-org', 'GR-1', ['otro-topic', 'ingenieria']);
      expect(gateway.assignTeam).toHaveBeenCalledWith('mi-org', 'GR-1', 'frontend', 'push');

      const { entries } = await store.listActivity({ action: 'ova.repaired' }, 10, 0);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ actor: 'maria', details: { fixed: outcome.fixed } });
    });

    it('sube el permiso del team si era menor', async () => {
      await register('GR-1');
      gateway.getTopics.mockResolvedValue(['ingenieria']);
      gateway.getTeamPermission.mockResolvedValue('pull');

      const outcome = await useCase.repair('GR-1');

      expect(outcome.fixed).toEqual(['permiso del team frontend: pull → push']);
      expect(gateway.replaceTopics).not.toHaveBeenCalled();
    });

    it('no toca nada si ya está todo bien (ni anota actividad)', async () => {
      await register('GR-1');
      gateway.getTopics.mockResolvedValue(['ingenieria']);
      gateway.getTeamPermission.mockResolvedValue('admin');

      const outcome = await useCase.repair('GR-1');

      expect(outcome).toEqual({ repoName: 'GR-1', success: true, fixed: [] });
      expect(gateway.assignTeam).not.toHaveBeenCalled();
      expect((await store.listActivity({}, 10, 0)).total).toBe(0);
    });

    it('informa si la OVA no está registrada', async () => {
      const outcome = await useCase.repair('NO-EXISTE');

      expect(outcome).toEqual({
        repoName: 'NO-EXISTE',
        success: false,
        fixed: [],
        error: 'OVA not found',
      });
    });

    it('informa el error de GitHub sin lanzar', async () => {
      await register('GR-1');
      gateway.getTopics.mockRejectedValue(new Error('Failed to read topics'));

      const outcome = await useCase.repair('GR-1');

      expect(outcome).toMatchObject({ success: false, error: 'Failed to read topics' });
    });

    it('describe el error aunque no sea un Error', async () => {
      await register('GR-1');
      gateway.getTopics.mockRejectedValue('boom');

      expect((await useCase.repair('GR-1')).error).toBe('Unknown error');
    });

    it('la corrección vale aunque no se pueda anotar en la actividad', async () => {
      await register('GR-1');
      const brokenAudit = { record: jest.fn().mockRejectedValue(new Error('disco lleno')) };
      const withBrokenAudit = new ReconcileOvasUseCase(gateway, store, store, config, brokenAudit as never);

      const outcome = await withBrokenAudit.repair('GR-1');

      expect(outcome.success).toBe(true);
      expect(gateway.assignTeam).toHaveBeenCalled();
    });

    it('funciona sin registro de actividad', async () => {
      await register('GR-1');
      const withoutAudit = new ReconcileOvasUseCase(gateway, store, store, config);

      expect((await withoutAudit.repair('GR-1')).success).toBe(true);
    });
  });

  describe('repairAll', () => {
    const setUpPending = async (names: string[]) => {
      for (const name of names) await register(name);
      gateway.listRepositories.mockResolvedValue(names.map((n) => repo(n)));
    };

    it('corrige todas las pendientes y anota cada una', async () => {
      await setUpPending(['GR-1', 'GR-2']);

      const result = await useCase.repairAll('maria');

      expect(result.remaining).toBe(0);
      expect(result.outcomes.map((o) => [o.repoName, o.success])).toEqual([
        ['GR-2', true],
        ['GR-1', true],
      ]);
      expect(gateway.assignTeam).toHaveBeenCalledTimes(2);
      expect((await store.listActivity({ action: 'ova.repaired' }, 10, 0)).total).toBe(2);
    });

    it('trabaja por tandas e informa cuántas quedan', async () => {
      await setUpPending(['GR-1', 'GR-2', 'GR-3']);

      const result = await useCase.repairAll('maria', 2);

      expect(result.outcomes).toHaveLength(2);
      expect(result.remaining).toBe(1);
    });

    it('una que falla no detiene a las demás', async () => {
      await setUpPending(['GR-1', 'GR-2']);
      gateway.getTopics.mockRejectedValueOnce(new Error('Failed to read topics')).mockResolvedValue([]);

      const result = await useCase.repairAll();

      expect(result.outcomes.map((o) => o.success)).toEqual([false, true]);
      expect(result.outcomes[0].error).toBe('Failed to read topics');
    });

    it('describe el error aunque no sea un Error', async () => {
      await setUpPending(['GR-1']);
      gateway.getTopics.mockRejectedValue('boom');

      expect((await useCase.repairAll()).outcomes[0].error).toBe('Unknown error');
    });

    it('usa el tamaño de tanda por defecto y actor "sistema"', async () => {
      await setUpPending(['GR-1']);

      await useCase.repairAll();

      const { entries } = await store.listActivity({ action: 'ova.repaired' }, 10, 0);
      expect(entries[0].actor).toBe('sistema');
    });
  });

  describe('adopt', () => {
    it('registra el repositorio y lo deja con su topic y su team', async () => {
      gateway.getRepository.mockResolvedValue(repo('57-1604'));
      gateway.getTopics.mockResolvedValue([]);
      gateway.getTeamPermission.mockResolvedValue(null);

      const result = await useCase.adopt({ repoName: '57-1604', schoolId, developerId, actor: 'maria' });

      expect(result).toMatchObject({ success: true, warnings: [] });
      if (!result.success) throw new Error('unreachable');
      expect(result.ova).toMatchObject({
        repoName: '57-1604',
        repoUrl: 'https://github.com/mi-org/57-1604',
        createdBy: 'maria',
        status: 'development',
      });
      expect(result.fixed).toEqual(['topic "ingenieria"', 'team frontend (push)']);
      expect((await store.findByRepoName('57-1604'))?.school.name).toBe('Ingeniería');

      const { entries } = await store.listActivity({ action: 'ova.adopted' }, 10, 0);
      expect(entries[0]).toMatchObject({ actor: 'maria', details: { fixed: result.fixed } });
    });

    it('usa el nombre y el enlace tal como están en GitHub', async () => {
      gateway.getRepository.mockResolvedValue(repo('GR-1'));
      gateway.getTeamPermission.mockResolvedValue('push');
      gateway.getTopics.mockResolvedValue(['ingenieria']);

      const result = await useCase.adopt({ repoName: 'gr-1', schoolId, developerId, actor: 'maria' });

      expect(result.success && result.ova.repoName).toBe('GR-1');
      expect(result.success && result.fixed).toEqual([]);
    });

    it('rechaza un repositorio que ya está registrado', async () => {
      await register('GR-1');

      const result = await useCase.adopt({ repoName: 'gr-1', schoolId, developerId, actor: 'maria' });

      expect(result).toEqual({ success: false, message: 'OVA already registered: GR-1' });
      expect(gateway.getRepository).not.toHaveBeenCalled();
    });

    it('rechaza una escuela o un desarrollador que no existen', async () => {
      const noSchool = await useCase.adopt({ repoName: 'X-1', schoolId: 999, developerId, actor: 'm' });
      const noDev = await useCase.adopt({ repoName: 'X-1', schoolId, developerId: 999, actor: 'm' });

      expect(noSchool).toEqual({ success: false, message: 'School or developer does not exist' });
      expect(noDev).toEqual({ success: false, message: 'School or developer does not exist' });
    });

    it('rechaza un repositorio que no existe en GitHub', async () => {
      gateway.getRepository.mockRejectedValue(new Error('Repository not found: mi-org/X-1'));

      const result = await useCase.adopt({ repoName: 'X-1', schoolId, developerId, actor: 'maria' });

      expect(result).toEqual({ success: false, message: 'Repository not found: mi-org/X-1' });
    });

    it('describe el fallo aunque no sea un Error', async () => {
      gateway.getRepository.mockRejectedValue('boom');

      const result = await useCase.adopt({ repoName: 'X-1', schoolId, developerId, actor: 'maria' });

      expect(result).toEqual({ success: false, message: 'Unknown error' });
    });

    it.each([
      ['marcado como plantilla', repo('base', { isTemplate: true })],
      ['con el nombre de la plantilla', repo('OVA-Template')],
    ])('no deja registrar como OVA un repositorio %s', async (_label, template) => {
      gateway.getRepository.mockResolvedValue(template);

      const result = await useCase.adopt({ repoName: template.name, schoolId, developerId, actor: 'maria' });

      expect(result).toEqual({
        success: false,
        message: 'The template repository cannot be registered as an OVA',
      });
      expect(await store.list()).toEqual([]);
    });

    it('queda registrada aunque falle la configuración en GitHub, y avisa', async () => {
      gateway.getRepository.mockResolvedValue(repo('GR-1'));
      gateway.getTopics.mockRejectedValue(new Error('Failed to read topics'));

      const result = await useCase.adopt({ repoName: 'GR-1', schoolId, developerId, actor: 'maria' });

      expect(result.success).toBe(true);
      expect(result.success && result.warnings[0]).toContain('Failed to read topics');
      expect(await store.findByRepoName('GR-1')).not.toBeNull();
    });

    it('describe el fallo de configuración aunque no sea un Error', async () => {
      gateway.getRepository.mockResolvedValue(repo('GR-1'));
      gateway.getTopics.mockRejectedValue('boom');

      const result = await useCase.adopt({ repoName: 'GR-1', schoolId, developerId, actor: 'maria' });

      expect(result.success && result.warnings[0]).toContain('Unknown error');
    });

    it('avisa si no se pudo anotar en la actividad', async () => {
      gateway.getRepository.mockResolvedValue(repo('GR-1'));
      gateway.getTopics.mockResolvedValue(['ingenieria']);
      gateway.getTeamPermission.mockResolvedValue('push');
      const brokenAudit = { record: jest.fn().mockRejectedValue(new Error('disco lleno')) };
      const withBrokenAudit = new ReconcileOvasUseCase(gateway, store, store, config, brokenAudit as never);

      const result = await withBrokenAudit.adopt({ repoName: 'GR-1', schoolId, developerId, actor: 'maria' });

      expect(result.success && result.warnings).toHaveLength(1);
    });

    it('funciona sin plantilla configurada ni registro de actividad', async () => {
      const bare = new ReconcileOvasUseCase(gateway, store, store, { org: 'mi-org', team: config.team });
      gateway.getRepository.mockResolvedValue(repo('GR-1'));
      gateway.getTopics.mockResolvedValue(['ingenieria']);
      gateway.getTeamPermission.mockResolvedValue('push');

      const result = await bare.adopt({ repoName: 'GR-1', schoolId, developerId, actor: 'maria' });

      expect(result).toMatchObject({ success: true, warnings: [] });
    });
  });
});
