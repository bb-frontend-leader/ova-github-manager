import { RepositoryTopics } from '../../domain/RepositoryTopics';

describe('RepositoryTopics', () => {
  describe('create', () => {
    it('should create empty topics', () => {
      const topics = RepositoryTopics.create();
      expect(topics.getTopics()).toEqual([]);
    });

    it('should create with valid topics', () => {
      const topics = RepositoryTopics.create(['typescript', 'cli', 'github']);
      expect(topics.getTopics()).toContain('typescript');
      expect(topics.getTopics()).toContain('cli');
      expect(topics.getTopics()).toContain('github');
    });

    it('should normalize topics to lowercase', () => {
      const topics = RepositoryTopics.create(['TypeScript', 'CLI']);
      expect(topics.getTopics()).toEqual(['typescript', 'cli']);
    });

    it('should remove duplicates', () => {
      const topics = RepositoryTopics.create(['typescript', 'cli', 'typescript', 'CLI']);
      expect(topics.count()).toBe(2);
    });

    it('should trim whitespace', () => {
      const topics = RepositoryTopics.create(['  typescript  ', ' cli ']);
      expect(topics.getTopics()).toEqual(['typescript', 'cli']);
    });

    it('should filter empty strings', () => {
      const topics = RepositoryTopics.create(['typescript', '', 'cli', '  ']);
      expect(topics.count()).toBe(2);
    });

    it('should throw on non-array input', () => {
      expect(() => RepositoryTopics.create('not-an-array' as never)).toThrow(
        'Topics must be an array',
      );
    });

    it('should throw when exceeding 30 topics', () => {
      const tooManyTopics = Array.from({ length: 31 }, (_, i) => `topic${i}`);
      expect(() => RepositoryTopics.create(tooManyTopics)).toThrow('Maximum 30 topics allowed');
    });

    it('should throw on topic exceeding 50 characters', () => {
      const longTopic = 'a'.repeat(51);
      expect(() => RepositoryTopics.create([longTopic])).toThrow(
        'Each topic must be 50 characters or less',
      );
    });

    it('should throw on topic with invalid characters', () => {
      expect(() => RepositoryTopics.create(['invalid@topic'])).toThrow(
        'Topics can only contain lowercase letters, numbers, and hyphens',
      );
    });
  });

  describe('isEmpty', () => {
    it('should return true for empty topics', () => {
      const topics = RepositoryTopics.create();
      expect(topics.isEmpty()).toBe(true);
    });

    it('should return false for non-empty topics', () => {
      const topics = RepositoryTopics.create(['typescript']);
      expect(topics.isEmpty()).toBe(false);
    });
  });

  describe('count', () => {
    it('should return correct count', () => {
      const topics = RepositoryTopics.create(['typescript', 'cli', 'github']);
      expect(topics.count()).toBe(3);
    });

    it('should return 0 for empty topics', () => {
      const topics = RepositoryTopics.create();
      expect(topics.count()).toBe(0);
    });
  });

  describe('equals', () => {
    it('should return true for equal topic sets', () => {
      const topics1 = RepositoryTopics.create(['typescript', 'cli']);
      const topics2 = RepositoryTopics.create(['cli', 'typescript']);
      expect(topics1.equals(topics2)).toBe(true);
    });

    it('should return false for different topic sets', () => {
      const topics1 = RepositoryTopics.create(['typescript', 'cli']);
      const topics2 = RepositoryTopics.create(['typescript']);
      expect(topics1.equals(topics2)).toBe(false);
    });
  });
});
