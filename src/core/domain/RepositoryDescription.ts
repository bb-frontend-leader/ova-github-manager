/**
 * RepositoryDescription Value Object
 * Formato: "{prefijo} - {nombre del repo} {emoji aleatorio}"
 * Ejemplo: "625 OVAs 2027 - GR-2-88-2027-1 🚀"
 */
export class RepositoryDescription {
  private readonly value: string;

  static readonly EMOJIS = [
    '🚀', '📚', '🎯', '💻', '🔥', '⚡', '🌟', '✨', '🎨', '🛠️', '📦', '🔧', '🎭', '🏆', '💡',
  ];

  private constructor(value: string) {
    this.value = value;
  }

  /**
   * @param prefix texto fijo del proyecto (p. ej. "625 OVAs 2027")
   * @param repoName nombre del repositorio ya normalizado
   * @param random fuente de aleatoriedad (inyectable para pruebas deterministas)
   */
  static create(
    prefix: string,
    repoName: string,
    random: () => number = Math.random,
  ): RepositoryDescription {
    if (!prefix || prefix.trim().length === 0) {
      throw new Error('Description prefix cannot be empty');
    }

    if (!repoName || repoName.trim().length === 0) {
      throw new Error('Repository name cannot be empty');
    }

    const emoji = this.EMOJIS[Math.floor(random() * this.EMOJIS.length)];
    const description = `${prefix.trim()} - ${repoName} ${emoji}`;

    if (description.length > 300) {
      throw new Error('Description cannot exceed 300 characters');
    }

    return new RepositoryDescription(description);
  }

  getValue(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }

  equals(other: RepositoryDescription): boolean {
    return this.value === other.value;
  }
}
