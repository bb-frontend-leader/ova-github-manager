/**
 * Team Value Object
 * Represents a GitHub team within an organization
 */
export class Team {
  private readonly id: number;
  private readonly slug: string;
  private readonly name: string;

  private constructor(id: number, slug: string, name: string) {
    this.id = id;
    this.slug = slug;
    this.name = name;
  }

  static create(id: number, slug: string, name?: string): Team {
    if (id <= 0) {
      throw new Error('Team ID must be positive');
    }

    if (!slug || slug.trim().length === 0) {
      throw new Error('Team slug cannot be empty');
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new Error('Team slug can only contain lowercase letters, numbers, and hyphens');
    }

    const teamName = name || slug;

    return new Team(id, slug, teamName);
  }

  getId(): number {
    return this.id;
  }

  getSlug(): string {
    return this.slug;
  }

  getName(): string {
    return this.name;
  }

  equals(other: Team): boolean {
    return this.id === other.id && this.slug === other.slug;
  }
}
