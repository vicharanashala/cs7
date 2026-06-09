// Trainee roles (t-admin / t-moderator) must behave exactly like the role they impersonate
// for access purposes. These helpers back the requireRole gate and the client feature gates.
import { describe, it, expect } from 'vitest';
import { effectiveRole, hasAdminAccess, hasModeratorAccess } from '@samagama/shared';

describe('effectiveRole', () => {
  it('collapses trainee roles to their full counterpart', () => {
    expect(effectiveRole('t-admin')).toBe('admin');
    expect(effectiveRole('t-moderator')).toBe('moderator');
  });

  it('leaves non-trainee roles unchanged', () => {
    expect(effectiveRole('admin')).toBe('admin');
    expect(effectiveRole('moderator')).toBe('moderator');
    expect(effectiveRole('student')).toBe('student');
  });
});

describe('hasAdminAccess', () => {
  it('is true for admin and t-admin only', () => {
    expect(hasAdminAccess('admin')).toBe(true);
    expect(hasAdminAccess('t-admin')).toBe(true);
    expect(hasAdminAccess('moderator')).toBe(false);
    expect(hasAdminAccess('t-moderator')).toBe(false);
    expect(hasAdminAccess('student')).toBe(false);
  });
});

describe('hasModeratorAccess', () => {
  it('is true for every moderator- and admin-level role', () => {
    expect(hasModeratorAccess('moderator')).toBe(true);
    expect(hasModeratorAccess('t-moderator')).toBe(true);
    expect(hasModeratorAccess('admin')).toBe(true);
    expect(hasModeratorAccess('t-admin')).toBe(true);
  });

  it('is false for students', () => {
    expect(hasModeratorAccess('student')).toBe(false);
  });
});
