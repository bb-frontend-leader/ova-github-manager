import { TeamPermission } from '../../domain/TeamPermission';

describe('TeamPermission', () => {
  describe('create', () => {
    it('should create pull permission', () => {
      const perm = TeamPermission.create('pull');
      expect(perm.getLevel()).toBe('pull');
    });

    it('should create push permission', () => {
      const perm = TeamPermission.create('push');
      expect(perm.getLevel()).toBe('push');
    });

    it('should create admin permission', () => {
      const perm = TeamPermission.create('admin');
      expect(perm.getLevel()).toBe('admin');
    });

    it('should throw on invalid permission level', () => {
      expect(() => TeamPermission.create('invalid' as never)).toThrow(
        'Invalid permission level. Must be one of: pull, push, admin',
      );
    });
  });

  describe('static factories', () => {
    it('should create pull via static method', () => {
      const perm = TeamPermission.pull();
      expect(perm.isPull()).toBe(true);
      expect(perm.getLevel()).toBe('pull');
    });

    it('should create push via static method', () => {
      const perm = TeamPermission.push();
      expect(perm.isPush()).toBe(true);
      expect(perm.getLevel()).toBe('push');
    });

    it('should create admin via static method', () => {
      const perm = TeamPermission.admin();
      expect(perm.isAdmin()).toBe(true);
      expect(perm.getLevel()).toBe('admin');
    });
  });

  describe('permission checks', () => {
    it('should identify pull permission', () => {
      const perm = TeamPermission.pull();
      expect(perm.isPull()).toBe(true);
      expect(perm.isPush()).toBe(false);
      expect(perm.isAdmin()).toBe(false);
    });

    it('should identify push permission', () => {
      const perm = TeamPermission.push();
      expect(perm.isPull()).toBe(false);
      expect(perm.isPush()).toBe(true);
      expect(perm.isAdmin()).toBe(false);
    });

    it('should identify admin permission', () => {
      const perm = TeamPermission.admin();
      expect(perm.isPull()).toBe(false);
      expect(perm.isPush()).toBe(false);
      expect(perm.isAdmin()).toBe(true);
    });
  });

  describe('equals', () => {
    it('should return true for equal permissions', () => {
      const perm1 = TeamPermission.create('push');
      const perm2 = TeamPermission.create('push');
      expect(perm1.equals(perm2)).toBe(true);
    });

    it('should return false for different permissions', () => {
      const perm1 = TeamPermission.create('push');
      const perm2 = TeamPermission.create('pull');
      expect(perm1.equals(perm2)).toBe(false);
    });
  });
});
