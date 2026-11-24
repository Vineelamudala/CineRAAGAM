import { describe, expect, it } from 'vitest';
import { isActiveNav, navLabelFor } from './nav';

describe('navigation', () => {
  it('marks Today only on the home page', () => {
    expect(isActiveNav('/', '/')).toBe(true);
    expect(isActiveNav('/', '/time-travel')).toBe(false);
  });

  it('marks a section active on its sub-pages', () => {
    expect(isActiveNav('/time-travel', '/time-travel/2026-11-20')).toBe(true);
    expect(isActiveNav('/time-travel', '/time-travels')).toBe(false);
    expect(navLabelFor('/time-travel/2026-11-20')).toBe('Time Travel');
  });
});
