import { CreateRepositoryUseCase } from '../../application/CreateRepositoryUseCase';
import type { RepositoryGateway, RepositoryData } from '../../application/ports';

const mockGateway: jest.Mocked<RepositoryGateway> = {
  createRepository: jest.fn(),
  assignTeam: jest.fn(),
  replaceTopics: jest.fn(),
  getRepository: jest.fn(),
  getTopics: jest.fn(),
  repositoryExists: jest.fn(),
  listRepositories: jest.fn(),
};

const mockRepositoryData: RepositoryData = {
  id: 1,
  name: 'GR-2-88-2025-1',
  description: 'test-org - GR-2-88-2025-1 🚀',
  private: true,
  url: 'https://github.com/org/GR-2-88-2025-1',
  owner: { login: 'org' },
};

describe('CreateRepositoryUseCase', () => {
  let useCase: CreateRepositoryUseCase;

  beforeEach(() => {
    jest.resetAllMocks();
    mockGateway.createRepository.mockResolvedValue(mockRepositoryData);
    mockGateway.assignTeam.mockResolvedValue(undefined);
    mockGateway.replaceTopics.mockResolvedValue(undefined);
    useCase = new CreateRepositoryUseCase(mockGateway, {
      org: 'test-org',
      descriptionPrefix: '625 OVAs 2027',
    });
  });

  describe('creación básica', () => {
    it('crea el repositorio con el nombre normalizado y privado', async () => {
      const result = await useCase.execute({ rawName: 'GR 2_88-2025-1' });

      expect(result.success).toBe(true);
      expect(result.repositoryName).toBe('GR-2-88-2025-1');
      expect(result.repositoryUrl).toBe('https://github.com/org/GR-2-88-2025-1');
      expect(result.warnings).toEqual([]);
      expect(mockGateway.createRepository).toHaveBeenCalledWith(
        expect.objectContaining({ org: 'test-org', name: 'GR-2-88-2025-1', private: true }),
      );
    });

    it('genera la descripción con el prefijo configurado y el nombre normalizado', async () => {
      await useCase.execute({ rawName: 'GR 2_88-2027-1' });

      expect(mockGateway.createRepository).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringMatching(/^625 OVAs 2027 - GR-2-88-2027-1 \S+$/u),
        }),
      );
    });

    it('usa la organización del DTO por encima de la configurada', async () => {
      await useCase.execute({ rawName: 'test-repo', organization: 'custom-org' });

      expect(mockGateway.createRepository).toHaveBeenCalledWith(
        expect.objectContaining({ org: 'custom-org' }),
      );
    });

    it('pasa el template al gateway', async () => {
      await useCase.execute({ rawName: 'test-repo', template: 'python-starter' });

      expect(mockGateway.createRepository).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'python-starter' }),
      );
    });
  });

  describe('validación', () => {
    it('rechaza un nombre vacío sin llamar al gateway', async () => {
      const result = await useCase.execute({ rawName: '' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Repository name cannot be empty');
      expect(mockGateway.createRepository).not.toHaveBeenCalled();
    });

    it('rechaza un prefijo de descripción vacío', async () => {
      const emptyPrefix = new CreateRepositoryUseCase(mockGateway, {
        org: 'test-org',
        descriptionPrefix: '',
      });

      const result = await emptyPrefix.execute({ rawName: 'test-repo' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Description prefix cannot be empty');
      expect(mockGateway.createRepository).not.toHaveBeenCalled();
    });

    it('rechaza un team por defecto con permiso inválido', async () => {
      const badDefault = new CreateRepositoryUseCase(mockGateway, {
        org: 'test-org',
        descriptionPrefix: '625 OVAs 2027',
        defaultTeam: { slug: 'Frontend', permission: 'owner' as never },
      });

      const result = await badDefault.execute({ rawName: 'test-repo' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid permission level');
      expect(mockGateway.createRepository).not.toHaveBeenCalled();
    });

    it('rechaza un permiso de team inválido', async () => {
      const result = await useCase.execute({
        rawName: 'test-repo',
        teamSlug: 'backend-team',
        teamPermission: 'invalid' as never,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid permission level');
      expect(mockGateway.createRepository).not.toHaveBeenCalled();
    });

    it('rechaza más de 30 topics', async () => {
      const topics = Array.from({ length: 31 }, (_, i) => `topic${i}`);

      const result = await useCase.execute({ rawName: 'test-repo', topics });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Maximum 30 topics');
      expect(mockGateway.createRepository).not.toHaveBeenCalled();
    });
  });

  describe('team', () => {
    it('asigna el team al repositorio creado', async () => {
      await useCase.execute({
        rawName: 'test-repo',
        teamSlug: 'backend-team',
        teamPermission: 'admin',
      });

      expect(mockGateway.assignTeam).toHaveBeenCalledWith(
        'test-org',
        'GR-2-88-2025-1',
        'backend-team',
        'admin',
      );
    });

    it('usa permiso push si hay team y no se indica permiso', async () => {
      await useCase.execute({ rawName: 'test-repo', teamSlug: 'backend-team' });

      expect(mockGateway.assignTeam).toHaveBeenCalledWith(
        'test-org',
        'GR-2-88-2025-1',
        'backend-team',
        'push',
      );
    });

    it('no asigna team si no se indica y no hay team por defecto', async () => {
      await useCase.execute({ rawName: 'test-repo' });

      expect(mockGateway.assignTeam).not.toHaveBeenCalled();
    });

    describe('team por defecto (Frontend con pull)', () => {
      let withDefault: CreateRepositoryUseCase;

      beforeEach(() => {
        withDefault = new CreateRepositoryUseCase(mockGateway, {
          org: 'test-org',
          descriptionPrefix: '625 OVAs 2027',
          defaultTeam: { slug: 'Frontend', permission: 'pull' },
        });
      });

      it('lo asigna a todo repo nuevo cuando el DTO no indica team', async () => {
        await withDefault.execute({ rawName: 'test-repo' });

        expect(mockGateway.assignTeam).toHaveBeenCalledTimes(1);
        expect(mockGateway.assignTeam).toHaveBeenCalledWith(
          'test-org',
          'GR-2-88-2025-1',
          'Frontend',
          'pull',
        );
      });

      it('el team del DTO tiene prioridad y reemplaza al de por defecto', async () => {
        await withDefault.execute({
          rawName: 'test-repo',
          teamSlug: 'otro-team',
          teamPermission: 'push',
        });

        expect(mockGateway.assignTeam).toHaveBeenCalledTimes(1);
        expect(mockGateway.assignTeam).toHaveBeenCalledWith(
          'test-org',
          'GR-2-88-2025-1',
          'otro-team',
          'push',
        );
      });

      it('reporta un warning si falla el team por defecto', async () => {
        mockGateway.assignTeam.mockRejectedValueOnce(new Error('Not Found'));

        const result = await withDefault.execute({ rawName: 'test-repo' });

        expect(result.success).toBe(true);
        expect(result.warnings[0]).toContain('Frontend');
      });
    });

    it('reporta un warning si falla la asignación, pero el repo sigue creado', async () => {
      mockGateway.assignTeam.mockRejectedValueOnce(new Error('Not Found'));

      const result = await useCase.execute({ rawName: 'test-repo', teamSlug: 'ghost-team' });

      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('ghost-team');
      expect(result.warnings[0]).toContain('Not Found');
      expect(result.message).toContain('1 warning');
    });

    it('reporta un warning genérico si el error del team no es un Error', async () => {
      mockGateway.assignTeam.mockRejectedValueOnce('boom');

      const result = await useCase.execute({ rawName: 'test-repo', teamSlug: 'ghost-team' });

      expect(result.success).toBe(true);
      expect(result.warnings[0]).toContain('error desconocido');
    });
  });

  describe('topics', () => {
    it('normaliza los topics a minúsculas y sin espacios antes de enviarlos', async () => {
      await useCase.execute({
        rawName: 'test-repo',
        topics: ['Python', ' Machine-Learning ', 'AI'],
      });

      expect(mockGateway.replaceTopics).toHaveBeenCalledWith('test-org', 'GR-2-88-2025-1', [
        'python',
        'machine-learning',
        'ai',
      ]);
    });

    it('no llama a replaceTopics si no hay topics', async () => {
      await useCase.execute({ rawName: 'test-repo', topics: [] });

      expect(mockGateway.replaceTopics).not.toHaveBeenCalled();
    });

    it('reporta un warning si fallan los topics, pero el repo sigue creado', async () => {
      mockGateway.replaceTopics.mockRejectedValueOnce(new Error('Validation Failed'));

      const result = await useCase.execute({ rawName: 'test-repo', topics: ['ucv'] });

      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('Validation Failed');
    });

    it('acumula warnings de team y topics', async () => {
      mockGateway.assignTeam.mockRejectedValueOnce(new Error('team error'));
      mockGateway.replaceTopics.mockRejectedValueOnce(new Error('topics error'));

      const result = await useCase.execute({
        rawName: 'test-repo',
        teamSlug: 'ghost-team',
        topics: ['ucv'],
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(2);
      expect(result.message).toContain('2 warning');
    });
  });

  describe('fallos del gateway al crear', () => {
    it('devuelve el mensaje del error del gateway', async () => {
      mockGateway.createRepository.mockRejectedValueOnce(new Error('API Error'));

      const result = await useCase.execute({ rawName: 'test-repo' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('API Error');
    });

    it('usa un mensaje genérico si el error no es una instancia de Error', async () => {
      mockGateway.createRepository.mockRejectedValueOnce('Unknown error');

      const result = await useCase.execute({ rawName: 'test-repo' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to create repository');
    });

    it('no intenta asignar team ni topics si la creación falla', async () => {
      mockGateway.createRepository.mockRejectedValueOnce(new Error('API Error'));

      await useCase.execute({ rawName: 'test-repo', teamSlug: 'team', topics: ['ucv'] });

      expect(mockGateway.assignTeam).not.toHaveBeenCalled();
      expect(mockGateway.replaceTopics).not.toHaveBeenCalled();
    });
  });
});
