import { RepositoryDescription } from '../../domain/RepositoryDescription';

const PREFIX = '625 OVAs 2027';

describe('RepositoryDescription', () => {
  describe('create', () => {
    it('sigue el formato "{prefijo} - {repo} {emoji}"', () => {
      const desc = RepositoryDescription.create(PREFIX, 'GR-2-88-2027-1');

      expect(desc.getValue()).toMatch(/^625 OVAs 2027 - GR-2-88-2027-1 \S+$/u);
    });

    it('termina siempre con un emoji de la lista permitida', () => {
      for (let i = 0; i < 50; i++) {
        const value = RepositoryDescription.create(PREFIX, 'repo').getValue();
        const emoji = value.slice(`${PREFIX} - repo `.length);
        expect(RepositoryDescription.EMOJIS).toContain(emoji);
      }
    });

    it('elige el emoji según la fuente de aleatoriedad inyectada', () => {
      const first = RepositoryDescription.create(PREFIX, 'repo', () => 0).getValue();
      const last = RepositoryDescription.create(PREFIX, 'repo', () => 0.999).getValue();

      expect(first.endsWith(RepositoryDescription.EMOJIS[0])).toBe(true);
      expect(last.endsWith(RepositoryDescription.EMOJIS[RepositoryDescription.EMOJIS.length - 1])).toBe(
        true,
      );
    });

    it('recorta espacios alrededor del prefijo', () => {
      const desc = RepositoryDescription.create('  625 OVAs 2027  ', 'repo', () => 0);

      expect(desc.getValue().startsWith('625 OVAs 2027 - repo')).toBe(true);
    });

    it('rechaza un prefijo vacío', () => {
      expect(() => RepositoryDescription.create('', 'repo')).toThrow(
        'Description prefix cannot be empty',
      );
    });

    it('rechaza un prefijo con solo espacios', () => {
      expect(() => RepositoryDescription.create('   ', 'repo')).toThrow(
        'Description prefix cannot be empty',
      );
    });

    it('rechaza un nombre de repositorio vacío', () => {
      expect(() => RepositoryDescription.create(PREFIX, '')).toThrow(
        'Repository name cannot be empty',
      );
    });

    it('rechaza un nombre de repositorio con solo espacios', () => {
      expect(() => RepositoryDescription.create(PREFIX, '   ')).toThrow(
        'Repository name cannot be empty',
      );
    });

    it('rechaza descripciones de más de 300 caracteres', () => {
      expect(() => RepositoryDescription.create(PREFIX, 'a'.repeat(300))).toThrow(
        'Description cannot exceed 300 characters',
      );
    });
  });

  describe('equals', () => {
    it('es true con el mismo prefijo, repo y emoji', () => {
      const a = RepositoryDescription.create(PREFIX, 'repo', () => 0);
      const b = RepositoryDescription.create(PREFIX, 'repo', () => 0);

      expect(a.equals(b)).toBe(true);
    });

    it('es false si cambia el emoji', () => {
      const a = RepositoryDescription.create(PREFIX, 'repo', () => 0);
      const b = RepositoryDescription.create(PREFIX, 'repo', () => 0.5);

      expect(a.equals(b)).toBe(false);
    });

    it('es false si cambia el repositorio', () => {
      const a = RepositoryDescription.create(PREFIX, 'repo-a', () => 0);
      const b = RepositoryDescription.create(PREFIX, 'repo-b', () => 0);

      expect(a.equals(b)).toBe(false);
    });
  });

  describe('toString', () => {
    it('devuelve la descripción completa', () => {
      const desc = RepositoryDescription.create(PREFIX, 'my-repo', () => 0);

      expect(desc.toString()).toBe(desc.getValue());
      expect(desc.toString()).toContain('625 OVAs 2027 - my-repo');
    });
  });
});
