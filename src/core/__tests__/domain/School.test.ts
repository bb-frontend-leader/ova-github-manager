import { School } from '../../domain/School';

describe('School', () => {
  describe('create', () => {
    it('conserva el nombre legible y genera el slug', () => {
      const school = School.create('Escuela de Ingeniería');

      expect(school.getName()).toBe('Escuela de Ingeniería');
      expect(school.getSlug()).toBe('escuela-de-ingenieria');
    });

    it('quita acentos, ñ y símbolos del slug', () => {
      expect(School.create('Facultad de Ciencias & Artes (UCV)').getSlug()).toBe(
        'facultad-de-ciencias-artes-ucv',
      );
      expect(School.create('Diseño Gráfico').getSlug()).toBe('diseno-grafico');
    });

    it('colapsa espacios repetidos y recorta los extremos', () => {
      const school = School.create('  Escuela   de   Letras  ');

      expect(school.getName()).toBe('Escuela de Letras');
      expect(school.getSlug()).toBe('escuela-de-letras');
    });

    it('el slug es un topic válido de GitHub', () => {
      const slug = School.create('Escuela de Ingeniería Civil 2').getSlug();

      expect(slug).toMatch(/^[a-z0-9-]+$/);
    });

    it('rechaza un nombre vacío o solo con espacios', () => {
      expect(() => School.create('')).toThrow('School name cannot be empty');
      expect(() => School.create('   ')).toThrow('School name cannot be empty');
    });

    it('rechaza un nombre sin letras ni números', () => {
      expect(() => School.create('---')).toThrow('must contain letters or numbers');
    });

    it('rechaza nombres de más de 100 caracteres', () => {
      expect(() => School.create('a'.repeat(101))).toThrow('cannot exceed 100');
    });

    it('rechaza un slug de más de 50 caracteres', () => {
      expect(() => School.create('a'.repeat(60))).toThrow('too long to be used as a topic');
    });
  });

  describe('equals', () => {
    it('compara por slug, ignorando mayúsculas y acentos', () => {
      expect(School.create('Ingeniería').equals(School.create('INGENIERIA'))).toBe(true);
      expect(School.create('Ingeniería').equals(School.create('Letras'))).toBe(false);
    });
  });
});
