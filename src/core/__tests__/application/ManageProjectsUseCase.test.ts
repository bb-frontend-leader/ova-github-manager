import { DuplicateEntryError } from '../../application/errors';
import { ManageProjectsUseCase, type ProjectGateway } from '../../application/ManageProjectsUseCase';
import { SqliteOvaStore } from '../../infrastructure/sqlite';

describe('ManageProjectsUseCase', () => {
  let store: SqliteOvaStore;
  let gateway: jest.Mocked<ProjectGateway>;
  let useCase: ManageProjectsUseCase;
  const input = { name: 'Proyecto Uno', org: 'org-uno', total: 10 };

  beforeEach(() => {
    store = new SqliteOvaStore(':memory:');
    gateway = {
      validateOrgAccess: jest.fn().mockResolvedValue(undefined),
      repositoryExists: jest.fn().mockResolvedValue(true),
    };
    useCase = new ManageProjectsUseCase(store, gateway);
  });
  afterEach(() => store.close());

  it('crea un proyecto tras comprobar el acceso a la organización', async () => {
    const { project, warnings } = await useCase.create(input);

    expect(gateway.validateOrgAccess).toHaveBeenCalledWith('org-uno');
    expect(gateway.repositoryExists).toHaveBeenCalledWith('org-uno', 'ova-template');
    expect(warnings).toEqual([]);
    expect(project).toMatchObject({ slug: 'proyecto-uno', org: 'org-uno', total: 10 });
    expect((await useCase.list()).map((p) => p.slug)).toEqual(['proyecto-uno']);
  });

  it('no guarda si la organización no es accesible', async () => {
    gateway.validateOrgAccess.mockRejectedValue(new Error('Not Found'));

    await expect(useCase.create(input)).rejects.toThrow('Not Found');
    expect(await useCase.list()).toEqual([]);
  });

  it('valida los datos antes de llamar a GitHub', async () => {
    await expect(useCase.create({ ...input, total: 0 })).rejects.toThrow('Project total');
    expect(gateway.validateOrgAccess).not.toHaveBeenCalled();
  });

  it('avisa si la plantilla no existe, y entiende "owner/repo"', async () => {
    gateway.repositoryExists.mockResolvedValue(false);

    const { warnings } = await useCase.create({ ...input, template: 'acme/base' });

    expect(gateway.repositoryExists).toHaveBeenCalledWith('acme', 'base');
    expect(warnings[0]).toContain('acme/base');
  });

  it('avisa si no pudo comprobar la plantilla, pero guarda', async () => {
    gateway.repositoryExists.mockRejectedValue(new Error('boom'));

    const { project, warnings } = await useCase.create(input);

    expect(project.id).toBeGreaterThan(0);
    expect(warnings[0]).toContain('No se pudo comprobar');
  });

  it('rechaza una organización o un identificador repetidos', async () => {
    await useCase.create(input);

    await expect(useCase.create({ ...input, name: 'Otro' })).rejects.toThrow(
      'Organization already registered: org-uno',
    );
    await expect(useCase.create({ ...input, org: 'ORG-UNO' })).rejects.toBeInstanceOf(
      DuplicateEntryError,
    );
    await expect(useCase.create({ ...input, org: 'otra-org' })).rejects.toThrow(
      'Project already exists: proyecto-uno',
    );
  });

  describe('update', () => {
    const changes = {
      name: 'Nuevo nombre',
      template: 'ova-template',
      defaultTeam: 'Docentes',
      descriptionPrefix: 'NN',
      total: 20,
    };

    it('cambia lo editable y conserva organización e identificador', async () => {
      const { project } = await useCase.create(input);

      const { project: updated, warnings } = await useCase.update(project.id, changes);

      expect(updated).toMatchObject({ ...changes, org: 'org-uno', slug: 'proyecto-uno' });
      expect(warnings).toEqual([]);
      expect(gateway.repositoryExists).toHaveBeenCalledTimes(1); // plantilla igual: no se vuelve a comprobar
    });

    it('comprueba la plantilla solo si cambió', async () => {
      const { project } = await useCase.create(input);
      gateway.repositoryExists.mockResolvedValue(false);

      const { warnings } = await useCase.update(project.id, { ...changes, template: 'otra' });

      expect(warnings).toHaveLength(1);
    });

    it('falla si el proyecto no existe o los datos son inválidos', async () => {
      await expect(useCase.update(99, changes)).rejects.toThrow('Project not found');
      const { project } = await useCase.create(input);
      await expect(useCase.update(project.id, { ...changes, total: -1 })).rejects.toThrow(
        'Project total',
      );
    });
  });
});
