/**
 * School Value Object
 * Una escuela se guarda con su nombre legible y un slug apto para ser topic de GitHub
 * (minúsculas, sin acentos, solo letras, números y guiones).
 */
export class School {
  private static readonly MAX_NAME_LENGTH = 100;
  private static readonly MAX_SLUG_LENGTH = 50; // límite de un topic en GitHub

  private constructor(
    private readonly name: string,
    private readonly slug: string,
  ) {}

  static create(name: string): School {
    const trimmed = (name ?? '').trim().replace(/\s+/g, ' ');

    if (trimmed.length === 0) {
      throw new Error('School name cannot be empty');
    }

    if (trimmed.length > School.MAX_NAME_LENGTH) {
      throw new Error(`School name cannot exceed ${School.MAX_NAME_LENGTH} characters`);
    }

    const slug = School.toSlug(trimmed);

    if (slug.length === 0) {
      throw new Error('School name must contain letters or numbers');
    }

    if (slug.length > School.MAX_SLUG_LENGTH) {
      throw new Error(`School name is too long to be used as a topic (max ${School.MAX_SLUG_LENGTH})`);
    }

    return new School(trimmed, slug);
  }

  /** "Escuela de Ingeniería" -> "escuela-de-ingenieria" */
  static toSlug(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  getName(): string {
    return this.name;
  }

  getSlug(): string {
    return this.slug;
  }

  equals(other: School): boolean {
    return this.slug === other.slug;
  }
}
