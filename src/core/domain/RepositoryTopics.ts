/**
 * RepositoryTopics Value Object
 * Encapsulates a collection of repository topics with validation
 */
export class RepositoryTopics {
  private readonly topics: string[];

  private constructor(topics: string[]) {
    this.topics = topics;
  }

  static create(topics: string[] = []): RepositoryTopics {
    if (!Array.isArray(topics)) {
      throw new Error('Topics must be an array');
    }

    const uniqueTopics = [...new Set(topics.map((t) => t.toLowerCase().trim()))].filter(
      (t) => t.length > 0,
    );

    if (uniqueTopics.length > 30) {
      throw new Error('Maximum 30 topics allowed');
    }

    for (const topic of uniqueTopics) {
      if (topic.length > 50) {
        throw new Error('Each topic must be 50 characters or less');
      }

      if (!/^[a-z0-9-]+$/.test(topic)) {
        throw new Error('Topics can only contain lowercase letters, numbers, and hyphens');
      }
    }

    return new RepositoryTopics(uniqueTopics);
  }

  getTopics(): string[] {
    return [...this.topics];
  }

  isEmpty(): boolean {
    return this.topics.length === 0;
  }

  count(): number {
    return this.topics.length;
  }

  equals(other: RepositoryTopics): boolean {
    const thisSet = new Set(this.topics);
    const otherSet = new Set(other.topics);
    return thisSet.size === otherSet.size && [...thisSet].every((t) => otherSet.has(t));
  }
}
