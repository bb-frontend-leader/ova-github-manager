/**
 * TeamPermission Value Object
 * Represents the permission level a team has for a repository
 */
export type PermissionLevel = 'pull' | 'push' | 'admin';

export class TeamPermission {
  private readonly level: PermissionLevel;

  private constructor(level: PermissionLevel) {
    this.level = level;
  }

  static create(level: PermissionLevel): TeamPermission {
    const validLevels: PermissionLevel[] = ['pull', 'push', 'admin'];

    if (!validLevels.includes(level)) {
      throw new Error(
        `Invalid permission level. Must be one of: ${validLevels.join(', ')}`,
      );
    }

    return new TeamPermission(level);
  }

  static pull(): TeamPermission {
    return new TeamPermission('pull');
  }

  static push(): TeamPermission {
    return new TeamPermission('push');
  }

  static admin(): TeamPermission {
    return new TeamPermission('admin');
  }

  getLevel(): PermissionLevel {
    return this.level;
  }

  isPull(): boolean {
    return this.level === 'pull';
  }

  isPush(): boolean {
    return this.level === 'push';
  }

  isAdmin(): boolean {
    return this.level === 'admin';
  }

  equals(other: TeamPermission): boolean {
    return this.level === other.level;
  }
}
