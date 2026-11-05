/**
 * Developer Value Object
 * Persona que lleva una OVA. Es solo un dato del registro: no implica permisos en GitHub.
 */
export class Developer {
  private static readonly MAX_NAME_LENGTH = 100;

  private constructor(private readonly name: string) {}

  static create(name: string): Developer {
    const trimmed = (name ?? '').trim().replace(/\s+/g, ' ');

    if (trimmed.length === 0) {
      throw new Error('Developer name cannot be empty');
    }

    if (trimmed.length > Developer.MAX_NAME_LENGTH) {
      throw new Error(`Developer name cannot exceed ${Developer.MAX_NAME_LENGTH} characters`);
    }

    return new Developer(trimmed);
  }

  getName(): string {
    return this.name;
  }

  equals(other: Developer): boolean {
    return this.name.toLowerCase() === other.name.toLowerCase();
  }
}
