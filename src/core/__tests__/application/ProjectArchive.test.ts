import {
  ARCHIVE_FORMAT,
  ARCHIVE_VERSION,
  ProjectArchiveUseCase,
  parseProjectArchive,
  type ProjectArchiveStore,
  type ProjectSnapshot,
} from '../../application/ProjectArchive';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Un archivo mínimo y válido; cada prueba lo estropea de una forma. */
function validArchive(): Json {
  return {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    exportedAt: '2026-11-06T12:00:00.000Z',
    exportedBy: 'admin1',
    project: {
      slug: 'ovas-2027',
      name: '625 OVAs 2027',
      org: 'org-uno',
      template: 'ova-template',
      defaultTeam: 'Frontend',
      descriptionPrefix: '625 OVAs 2027',
      total: 625,
      createdAt: '2026-01-02T03:04:05.000Z',
    },
    schools: [{ name: 'Escuela Norte', slug: 'escuela-norte' }],
    developers: [{ name: 'Ana Pérez', githubLogin: 'Ana-Dev' }, { name: 'Luis', githubLogin: null }],
    ovas: [
      {
        repoName: 'GR-2-88-2027-1',
        repoUrl: 'https://github.com/org-uno/GR-2-88-2027-1',
        school: 'escuela-norte',
        developer: 'ana pérez',
        createdBy: 'admin1',
        createdAt: '2026-02-01T00:00:00Z',
        status: 'review',
        statusChangedAt: '2026-03-01T00:00:00Z',
      },
    ],
    members: [{ login: '@Admin1', role: 'admin', createdAt: '2026-01-02T03:04:05.000Z' }],
    activity: [
      {
        at: '2026-02-01T00:00:00Z',
        actor: 'admin1',
        action: 'ova.created',
        repoName: 'GR-2-88-2027-1',
        repoUrl: 'https://github.com/org-uno/GR-2-88-2027-1',
        details: { school: 'Escuela Norte' },
      },
    ],
  };
}

const parse = (archive: Json) => parseProjectArchive(JSON.stringify(archive));

/** Aplica un cambio al archivo válido y devuelve el resultado de leerlo. */
const parseWith = (change: (archive: Json) => void) => {
  const archive = validArchive();
  change(archive);
  return () => parse(archive);
};

describe('parseProjectArchive', () => {
  it('lee un archivo válido y lo normaliza como si se hubiera escrito en la herramienta', () => {
    const parsed = parse(validArchive());

    expect(parsed.project).toMatchObject({ slug: 'ovas-2027', org: 'org-uno', total: 625 });
    expect(parsed.developers).toEqual([
      { name: 'Ana Pérez', githubLogin: 'ana-dev' },
      { name: 'Luis', githubLogin: null },
    ]);
    expect(parsed.members[0].login).toBe('admin1');
    expect(parsed.ovas[0]).toMatchObject({
      developer: 'ana pérez',
      createdAt: '2026-02-01T00:00:00.000Z',
      statusChangedAt: '2026-03-01T00:00:00.000Z',
    });
  });

  it('acepta el archivo con la marca BOM que añaden algunos editores', () => {
    expect(() => parseProjectArchive('﻿' + JSON.stringify(validArchive()))).not.toThrow();
  });

  it('acepta OVAs sin "statusChangedAt" y desarrolladores sin usuario de GitHub', () => {
    const parsed = parseWith((a) => {
      delete a.ovas[0].statusChangedAt;
      delete a.developers[0].githubLogin;
    })();

    expect(parsed.ovas[0].statusChangedAt).toBeNull();
    expect(parsed.developers[0].githubLogin).toBeNull();
  });

  it('ordena la actividad de la más antigua a la más reciente', () => {
    const parsed = parseWith((a) => {
      a.activity.push({ ...a.activity[0], at: '2026-01-01T00:00:00Z', actor: 'primero' });
    })();

    expect(parsed.activity.map((e) => e.actor)).toEqual(['primero', 'admin1']);
  });

  describe('archivos que no son un proyecto exportado', () => {
    it.each([
      ['texto que no es JSON', 'esto no es json', 'not valid JSON'],
      ['JSON de otra cosa', '{"hola":1}', 'not a project export'],
      ['un número', '42', 'not a project export'],
      ['null', 'null', 'not a project export'],
      ['una lista', '[]', 'not a project export'],
    ])('rechaza %s', (_name, content, message) => {
      expect(() => parseProjectArchive(content)).toThrow(message);
    });

    it('rechaza una versión del formato que no conoce', () => {
      expect(parseWith((a) => (a.version = 2))).toThrow('version not supported: 2');
      expect(parseWith((a) => delete a.version)).toThrow('version not supported: undefined');
    });
  });

  describe('datos incorrectos (se rechaza el archivo entero y se indica dónde)', () => {
    it.each<[string, (a: Json) => void, string]>([
      ['proyecto ausente', (a) => delete a.project, 'at project: invalid'],
      ['nombre del proyecto vacío', (a) => (a.project.name = '  '), 'at project.name: required'],
      ['organización inválida', (a) => (a.project.org = 'no válida!'), 'Invalid GitHub organization'],
      ['total ausente', (a) => delete a.project.total, 'at project.total: required'],
      ['total que no es un número entero', (a) => (a.project.total = 1.5), 'Project total must be'],
      ['fecha de creación inválida', (a) => (a.project.createdAt = 'ayer'), 'at project.createdAt: invalid'],
      ['quién exportó, ausente', (a) => delete a.exportedBy, 'at exportedBy: required'],
      ['lista de escuelas que no es una lista', (a) => (a.schools = 'x'), 'at schools: invalid'],
      ['escuela sin nombre', (a) => (a.schools[0].name = ''), 'at schools[0].name'],
      ['identificador de escuela inválido', (a) => (a.schools[0].slug = 'Mal Slug'), 'at schools[0].slug: invalid'],
      [
        'escuela repetida (sin importar mayúsculas)',
        (a) => a.schools.push({ name: 'ESCUELA norte', slug: 'otra' }),
        'at schools[1].name: duplicate',
      ],
      [
        'identificador de escuela repetido',
        (a) => a.schools.push({ name: 'Otra', slug: 'escuela-norte' }),
        'at schools[1].slug: duplicate',
      ],
      ['usuario de GitHub inválido', (a) => (a.developers[0].githubLogin = '--mal--'), 'at developers[0].githubLogin: invalid'],
      [
        'desarrollador repetido',
        (a) => a.developers.push({ name: 'LUIS', githubLogin: null }),
        'at developers[2].name: duplicate',
      ],
      [
        'usuario de GitHub vinculado a dos desarrolladores',
        (a) => (a.developers[1].githubLogin = 'ana-dev'),
        'at developers[1].githubLogin: duplicate',
      ],
      ['nombre de repositorio inválido', (a) => (a.ovas[0].repoName = 'con espacio'), 'at ovas[0].repoName: invalid'],
      [
        'OVA repetida',
        (a) => a.ovas.push({ ...a.ovas[0], repoName: 'gr-2-88-2027-1' }),
        'at ovas[1].repoName: duplicate',
      ],
      ['OVA con escuela desconocida', (a) => (a.ovas[0].school = 'otra'), 'at ovas[0].school: unknown-school'],
      ['OVA con desarrollador desconocido', (a) => (a.ovas[0].developer = 'Nadie'), 'at ovas[0].developer: unknown-developer'],
      ['estado inválido', (a) => (a.ovas[0].status = 'terminada'), 'at ovas[0].status: invalid'],
      ['enlace que no es https', (a) => (a.ovas[0].repoUrl = 'javascript:alert(1)'), 'at ovas[0].repoUrl: invalid'],
      ['enlace con http', (a) => (a.ovas[0].repoUrl = 'http://github.com/x/y'), 'at ovas[0].repoUrl: invalid'],
      ['fecha de la OVA inválida', (a) => (a.ovas[0].createdAt = 'nunca'), 'at ovas[0].createdAt: invalid'],
      ['rol inválido', (a) => (a.members[0].role = 'superman'), 'at members[0].role: invalid'],
      [
        'usuario repetido',
        (a) => a.members.push({ ...a.members[0], login: 'ADMIN1' }),
        'at members[1].login: duplicate',
      ],
      ['acción de actividad desconocida', (a) => (a.activity[0].action = 'ova.hackeada'), 'at activity[0].action: invalid'],
      ['actividad con enlace inseguro', (a) => (a.activity[0].repoUrl = 'javascript:x'), 'at activity[0].repoUrl: invalid'],
      ['texto demasiado largo', (a) => (a.ovas[0].createdBy = 'x'.repeat(301)), 'at ovas[0].createdBy: invalid'],
      ['elemento que no es un objeto', (a) => (a.ovas[0] = 'x'), 'at ovas[0]: invalid'],
      ['campo de texto con un número', (a) => (a.ovas[0].createdBy = 7), 'at ovas[0].createdBy: invalid'],
    ])('%s', (_name, change, message) => {
      expect(parseWith(change)).toThrow(message);
    });

    it('acepta una actividad sin enlace (la OVA pudo no tenerlo)', () => {
      expect(parseWith((a) => (a.activity[0].repoUrl = ''))()).toBeDefined();
    });
  });

  describe('detalle de la actividad', () => {
    it('solo conserva los datos conocidos y con su forma', () => {
      const parsed = parseWith((a) => {
        a.activity[0].details = {
          school: 'Norte',
          developer: 'Ana',
          reason: 'deleted_in_github',
          changes: [
            { field: 'status', from: 'a', to: 'b' },
            { field: 'otra-cosa', from: 'a', to: 'b' },
            { field: 'school', from: 1, to: 'b' },
            null,
          ],
          fixed: ['topic', 7, 'team'],
          extra: '<script>',
        };
      })();

      expect(parsed.activity[0].details).toEqual({
        school: 'Norte',
        developer: 'Ana',
        reason: 'deleted_in_github',
        changes: [{ field: 'status', from: 'a', to: 'b' }],
        fixed: ['topic', 'team'],
      });
    });

    it('un detalle ausente o nulo es un detalle vacío', () => {
      expect(parseWith((a) => delete a.activity[0].details)().activity[0].details).toEqual({});
      expect(parseWith((a) => (a.activity[0].details = null))().activity[0].details).toEqual({});
    });

    it('rechaza un detalle que no es un objeto', () => {
      expect(parseWith((a) => (a.activity[0].details = 'x'))).toThrow('at activity[0].details: invalid');
    });

    it('descarta los valores que no son del tipo esperado y la razón desconocida', () => {
      const details = parseWith((a) => {
        a.activity[0].details = { school: 3, developer: {}, reason: 'otra', changes: 'x', fixed: 'y' };
      })().activity[0].details;

      expect(details).toEqual({});
    });
  });
});

describe('ProjectArchiveUseCase.import', () => {
  const snapshotOf = (archive: Json): ProjectSnapshot => {
    const { project, schools, developers, ovas, members, activity } = parse(archive);
    return { project, schools, developers, ovas, members, activity };
  };

  function setup() {
    const store: jest.Mocked<ProjectArchiveStore> = {
      readProject: jest.fn<Promise<ProjectSnapshot | null>, [number]>(async () => snapshotOf(validArchive())),
      importProject: jest.fn(async (snapshot) => ({ id: 7, ...snapshot.project })),
    };
    const gateway = { validateOrgAccess: jest.fn(async () => undefined) };
    return { store, gateway, useCase: new ProjectArchiveUseCase(store, gateway) };
  }

  it('comprueba el acceso a la organización del archivo y guarda el proyecto', async () => {
    const { store, gateway, useCase } = setup();

    const result = await useCase.import(JSON.stringify(validArchive()));

    expect(gateway.validateOrgAccess).toHaveBeenCalledWith('org-uno');
    expect(store.importProject).toHaveBeenCalledTimes(1);
    expect(result.counts).toEqual({ schools: 1, developers: 2, ovas: 1, members: 1, activity: 1 });
    expect(result.project.id).toBe(7);
  });

  it('un archivo inválido no llega a tocar GitHub ni la base', async () => {
    const { store, gateway, useCase } = setup();

    await expect(useCase.import('{"format":"otro"}')).rejects.toThrow('not a project export');

    expect(gateway.validateOrgAccess).not.toHaveBeenCalled();
    expect(store.importProject).not.toHaveBeenCalled();
  });

  it('si no se puede ver la organización, no guarda nada', async () => {
    const { store, gateway, useCase } = setup();
    gateway.validateOrgAccess.mockRejectedValueOnce(new Error('Access denied'));

    await expect(useCase.import(JSON.stringify(validArchive()))).rejects.toThrow('Access denied');

    expect(store.importProject).not.toHaveBeenCalled();
  });

  it('usa el identificador elegido en lugar del del archivo', async () => {
    const { store, useCase } = setup();

    await useCase.import(JSON.stringify(validArchive()), { slug: '  Copia-1 ' });

    expect(store.importProject.mock.calls[0][0].project.slug).toBe('copia-1');
  });

  it('un identificador en blanco se trata como "el del archivo"', async () => {
    const { store, useCase } = setup();

    await useCase.import(JSON.stringify(validArchive()), { slug: '   ' });

    expect(store.importProject.mock.calls[0][0].project.slug).toBe('ovas-2027');
  });

  it('conserva la fecha de creación original del proyecto', async () => {
    const { store, useCase } = setup();

    await useCase.import(JSON.stringify(validArchive()));

    expect(store.importProject.mock.calls[0][0].project.createdAt).toBe('2026-01-02T03:04:05.000Z');
  });
});
