// Asserts the change-spec rules baked into the student navigation.
// If anyone re-adds the chatbot link or recently-viewed entry, this fails.
import { describe, expect, it } from 'vitest';
import { navByRole } from '../navigation';

describe('navByRole.student', () => {
  const studentPaths = navByRole.student.map((i) => i.path);

  it('does NOT include the chatbot route in the sidebar (it lives in the FAB)', () => {
    expect(studentPaths).not.toContain('/chatbot');
  });

  it('does NOT include "Recently Viewed"', () => {
    expect(studentPaths).not.toContain('/recent');
    expect(navByRole.student.some((i) => i.label.toLowerCase().includes('recently viewed'))).toBe(
      false,
    );
  });

  it('keeps the core student items', () => {
    expect(studentPaths).toEqual(
      expect.arrayContaining(['/', '/faqs', '/community', '/ask', '/my-questions']),
    );
  });
});

describe('navByRole.moderator and navByRole.admin', () => {
  it('expose moderator dashboard at /moderation', () => {
    expect(navByRole.moderator.map((i) => i.path)).toContain('/moderation');
  });

  it('expose admin overview at /admin', () => {
    expect(navByRole.admin.map((i) => i.path)).toContain('/admin');
  });

  // Dashboard Spec lock-ins
  it('moderator sidebar does NOT include the legacy items removed by the dashboard spec', () => {
    const labels = navByRole.moderator.map((i) => i.label.toLowerCase());
    expect(labels).not.toContain('pending answers'); // renamed to "Unresolved Questions"
    expect(labels).not.toContain('flagged faqs'); // moved into FAQ Management
    expect(labels).not.toContain('duplicate candidates'); // removed
    expect(labels).not.toContain('browse faqs'); // removed
  });

  it('moderator sidebar uses the renamed "Unresolved Questions" entry', () => {
    expect(
      navByRole.moderator.some(
        (i) => i.label === 'Unresolved Questions' && i.path === '/moderation/unresolved',
      ),
    ).toBe(true);
  });

  it('admin sidebar moves Categories/Tags out of the top level', () => {
    const paths = navByRole.admin.map((i) => i.path);
    expect(paths).not.toContain('/admin/categories');
    expect(paths).not.toContain('/admin/tags');
  });

  it('moderator and admin both link to FAQ Management at the same path', () => {
    expect(navByRole.moderator.map((i) => i.path)).toContain('/admin/faqs');
    expect(navByRole.admin.map((i) => i.path)).toContain('/admin/faqs');
  });
});
