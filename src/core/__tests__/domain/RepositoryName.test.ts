import { RepositoryName } from '../../domain/RepositoryName';

describe('RepositoryName', () => {
  describe('create', () => {
    it('should create a valid repository name', () => {
      const name = RepositoryName.create('valid-repo-name');
      expect(name.getValue()).toBe('valid-repo-name');
    });

    it('should preserve uppercase letters', () => {
      const name = RepositoryName.create('GR-2-88-2025-1');
      expect(name.getValue()).toBe('GR-2-88-2025-1');
    });

    it('should normalize spaces to hyphens', () => {
      const name = RepositoryName.create('GR 2 88 2025 1');
      expect(name.getValue()).toBe('GR-2-88-2025-1');
    });

    it('should normalize underscores to hyphens', () => {
      const name = RepositoryName.create('GR_2_88_2025_1');
      expect(name.getValue()).toBe('GR-2-88-2025-1');
    });

    it('should normalize mixed spaces and underscores', () => {
      const name = RepositoryName.create('GR 2_88-2025_1');
      expect(name.getValue()).toBe('GR-2-88-2025-1');
    });

    it('should remove duplicate hyphens', () => {
      const name = RepositoryName.create('GR---2---88');
      expect(name.getValue()).toBe('GR-2-88');
    });

    it('should trim whitespace', () => {
      const name = RepositoryName.create('  GR-2-88-2025-1  ');
      expect(name.getValue()).toBe('GR-2-88-2025-1');
    });

    it('should throw on empty string', () => {
      expect(() => RepositoryName.create('')).toThrow('Repository name cannot be empty');
    });

    it('should throw on whitespace only', () => {
      expect(() => RepositoryName.create('   ')).toThrow('Repository name cannot be empty');
    });

    it('should throw on name starting with hyphen', () => {
      expect(() => RepositoryName.create('-invalid')).toThrow(
        'Repository name cannot start or end with a hyphen',
      );
    });

    it('should throw on name ending with hyphen', () => {
      expect(() => RepositoryName.create('invalid-')).toThrow(
        'Repository name cannot start or end with a hyphen',
      );
    });

    it('should throw on invalid characters', () => {
      expect(() => RepositoryName.create('invalid@repo')).toThrow(
        'Repository name can only contain letters, numbers, and hyphens',
      );
    });

    it('should throw on name exceeding 255 characters', () => {
      const longName = 'a'.repeat(256);
      expect(() => RepositoryName.create(longName)).toThrow(
        'Repository name must be between 1 and 255 characters',
      );
    });
  });

  describe('equals', () => {
    it('should return true for equal names', () => {
      const name1 = RepositoryName.create('test-repo');
      const name2 = RepositoryName.create('test-repo');
      expect(name1.equals(name2)).toBe(true);
    });

    it('should return false for different names', () => {
      const name1 = RepositoryName.create('test-repo');
      const name2 = RepositoryName.create('other-repo');
      expect(name1.equals(name2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the normalized name', () => {
      const name = RepositoryName.create('GR 2_88-2025_1');
      expect(name.toString()).toBe('GR-2-88-2025-1');
    });
  });
});
