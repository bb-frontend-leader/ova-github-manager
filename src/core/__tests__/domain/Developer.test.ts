import { Developer } from '../../domain/Developer';

describe('Developer', () => {
  describe('create', () => {
    it('recorta y colapsa espacios del nombre', () => {
      expect(Developer.create('  Juan   Pérez ').getName()).toBe('Juan Pérez');
    });

    it('rechaza un nombre vacío o solo con espacios', () => {
      expect(() => Developer.create('')).toThrow('Developer name cannot be empty');
      expect(() => Developer.create('   ')).toThrow('Developer name cannot be empty');
    });

    it('rechaza nombres de más de 100 caracteres', () => {
      expect(() => Developer.create('a'.repeat(101))).toThrow('cannot exceed 100');
    });
  });

  describe('equals', () => {
    it('ignora mayúsculas', () => {
      expect(Developer.create('Juan Pérez').equals(Developer.create('juan pérez'))).toBe(true);
    });

    it('distingue personas distintas', () => {
      expect(Developer.create('Juan').equals(Developer.create('María'))).toBe(false);
    });
  });
});
