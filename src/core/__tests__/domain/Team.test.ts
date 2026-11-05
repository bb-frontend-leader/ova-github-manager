import { Team } from '../../domain/Team';

describe('Team', () => {
  describe('create', () => {
    it('should create a valid team', () => {
      const team = Team.create(123, 'backend-team', 'Backend Team');
      expect(team.getId()).toBe(123);
      expect(team.getSlug()).toBe('backend-team');
      expect(team.getName()).toBe('Backend Team');
    });

    it('should use slug as name if name not provided', () => {
      const team = Team.create(123, 'backend-team');
      expect(team.getName()).toBe('backend-team');
    });

    it('should throw on zero ID', () => {
      expect(() => Team.create(0, 'team-slug')).toThrow('Team ID must be positive');
    });

    it('should throw on negative ID', () => {
      expect(() => Team.create(-1, 'team-slug')).toThrow('Team ID must be positive');
    });

    it('should throw on empty slug', () => {
      expect(() => Team.create(123, '')).toThrow('Team slug cannot be empty');
    });

    it('should throw on whitespace-only slug', () => {
      expect(() => Team.create(123, '   ')).toThrow('Team slug cannot be empty');
    });

    it('should throw on slug with invalid characters', () => {
      expect(() => Team.create(123, 'invalid_team')).toThrow(
        'Team slug can only contain lowercase letters, numbers, and hyphens',
      );
    });

    it('should throw on slug with uppercase letters', () => {
      expect(() => Team.create(123, 'Backend-Team')).toThrow(
        'Team slug can only contain lowercase letters, numbers, and hyphens',
      );
    });
  });

  describe('equals', () => {
    it('should return true for equal teams', () => {
      const team1 = Team.create(123, 'backend-team');
      const team2 = Team.create(123, 'backend-team');
      expect(team1.equals(team2)).toBe(true);
    });

    it('should return false for different IDs', () => {
      const team1 = Team.create(123, 'backend-team');
      const team2 = Team.create(456, 'backend-team');
      expect(team1.equals(team2)).toBe(false);
    });

    it('should return false for different slugs', () => {
      const team1 = Team.create(123, 'backend-team');
      const team2 = Team.create(123, 'frontend-team');
      expect(team1.equals(team2)).toBe(false);
    });
  });
});
