/**
 * RepositoryName Value Object
 * Encapsulates repository naming rules and normalization
 * Preserves uppercase letters (e.g., GR-2-90-2025-1)
 */
export class RepositoryName {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(input: string): RepositoryName {
    if (!input || input.trim().length === 0) {
      throw new Error('Repository name cannot be empty');
    }

    const normalized = this.normalize(input);

    if (normalized.length < 1 || normalized.length > 255) {
      throw new Error('Repository name must be between 1 and 255 characters');
    }

    // Allow uppercase, lowercase, numbers, and hyphens
    if (!/^[a-zA-Z0-9-]+$/.test(normalized)) {
      throw new Error('Repository name can only contain letters, numbers, and hyphens');
    }

    if (normalized.startsWith('-') || normalized.endsWith('-')) {
      throw new Error('Repository name cannot start or end with a hyphen');
    }

    return new RepositoryName(normalized);
  }

  private static normalize(input: string): string {
    return (
      input
        .trim()
        // Replace spaces with hyphens
        .replace(/\s+/g, '-')
        // Replace underscores with hyphens
        .replace(/_+/g, '-')
        // Remove duplicate hyphens
        .replace(/-{2,}/g, '-')
    );
  }

  getValue(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }

  equals(other: RepositoryName): boolean {
    return this.value === other.value;
  }
}
