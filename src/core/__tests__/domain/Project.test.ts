import { Project } from '../../domain/Project';

const valid = { name: '625 OVAs 2027', org: 'bb-ovas', total: 625 };

describe('Project.validate', () => {
  it('aplica valores por defecto y genera el identificador desde el nombre', () => {
    expect(Project.validate(valid)).toEqual({
      slug: '625-ovas-2027',
      name: '625 OVAs 2027',
      org: 'bb-ovas',
      template: 'ova-template',
      defaultTeam: 'Frontend',
      descriptionPrefix: '625 OVAs 2027',
      total: 625,
    });
  });

  it('acepta valores propios y el total como texto', () => {
    const p = Project.validate({
      ...valid,
      slug: 'Otro-Slug',
      template: 'acme/base',
      defaultTeam: 'Docentes',
      descriptionPrefix: 'OVA',
      total: '12',
    });
    expect(p).toMatchObject({
      slug: 'otro-slug',
      template: 'acme/base',
      defaultTeam: 'Docentes',
      descriptionPrefix: 'OVA',
      total: 12,
    });
  });

  it.each([
    [{ name: '  ' }, 'Project name cannot be empty'],
    [{ name: 'x'.repeat(81) }, 'Project name cannot exceed 80 characters'],
    [{ org: '' }, 'Organization cannot be empty'],
    [{ org: '-malo' }, 'Invalid GitHub organization: -malo'],
    [{ org: 'a b' }, 'Invalid GitHub organization: a b'],
    [{ slug: 'Mal Slug' }, 'Invalid project identifier: mal slug'],
    [{ slug: 'new' }, 'Project identifier is reserved: new'],
    [{ slug: 'p' }, 'Project identifier is reserved: p'],
    [{ total: 0 }, 'Project total must be a whole number'],
    [{ total: 1.5 }, 'Project total must be a whole number'],
    [{ total: 'abc' }, 'Project total must be a whole number'],
    [{ total: 100_001 }, 'Project total must be a whole number'],
    [{ template: ' ' }, 'Template cannot be empty'],
  ])('rechaza %j', (override, message) => {
    expect(() => Project.validate({ ...valid, ...override })).toThrow(message);
  });
});
