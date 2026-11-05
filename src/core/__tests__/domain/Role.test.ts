import { GithubLogin } from '../../domain/GithubLogin';
import { ROLES, can, isRole, type Permission, type Role } from '../../domain/Role';

describe('Role', () => {
  const matrix: Record<Role, Record<Permission, boolean>> = {
    viewer: { 'ova:view': true, 'ova:create': false, 'ova:edit': false, 'catalog:manage': false, 'users:manage': false },
    creator: { 'ova:view': true, 'ova:create': true, 'ova:edit': true, 'catalog:manage': false, 'users:manage': false },
    admin: { 'ova:view': true, 'ova:create': true, 'ova:edit': true, 'catalog:manage': true, 'users:manage': true },
  };

  it.each(ROLES)('el rol %s tiene exactamente los permisos esperados', (role) => {
    for (const [permission, expected] of Object.entries(matrix[role])) {
      expect(can(role, permission as Permission)).toBe(expected);
    }
  });

  it('isRole acepta solo roles conocidos', () => {
    expect(isRole('admin')).toBe(true);
    expect(isRole('superadmin')).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isRole(1)).toBe(false);
  });
});

describe('GithubLogin', () => {
  it('normaliza a minúsculas y quita la @ inicial', () => {
    expect(GithubLogin.create('  @Alejo-Dev ').getValue()).toBe('alejo-dev');
  });

  it('acepta un solo carácter y el máximo de 39', () => {
    expect(GithubLogin.create('a').getValue()).toBe('a');
    expect(GithubLogin.create('a'.repeat(39)).getValue()).toHaveLength(39);
  });

  it.each(['', '   ', '-abc', 'abc-', 'a--b', 'a b', 'a_b', 'a'.repeat(40), 'ñandú'])(
    'rechaza "%s"',
    (input) => {
      expect(() => GithubLogin.create(input)).toThrow();
    },
  );

  it('compara sin distinguir mayúsculas', () => {
    expect(GithubLogin.create('Foo').equals(GithubLogin.create('foo'))).toBe(true);
    expect(GithubLogin.create('foo').equals(GithubLogin.create('bar'))).toBe(false);
    expect(GithubLogin.create('Foo').toString()).toBe('foo');
  });
});
