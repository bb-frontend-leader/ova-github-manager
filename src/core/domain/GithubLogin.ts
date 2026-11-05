/**
 * GithubLogin Value Object
 * Usuario de GitHub. Se guarda en minúsculas porque GitHub no distingue mayúsculas.
 */
export class GithubLogin {
  private constructor(private readonly value: string) {}

  static create(input: string): GithubLogin {
    const login = (input ?? '').trim().toLowerCase().replace(/^@/, '');

    if (login.length === 0) {
      throw new Error('GitHub username cannot be empty');
    }

    // Reglas de GitHub: 1-39 caracteres, alfanumérico o guion, sin empezar/terminar en guion
    if (!/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/.test(login) || login.includes('--')) {
      throw new Error(`Invalid GitHub username: ${login}`);
    }

    return new GithubLogin(login);
  }

  getValue(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }

  equals(other: GithubLogin): boolean {
    return this.value === other.value;
  }
}
