import { describe, expect, it } from 'vitest';
import { normalizeDisplayName, validateDisplayName } from './displayName';

describe('display name', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeDisplayName('  Ravi   Teja ')).toBe('Ravi Teja');
  });

  it('accepts ordinary names, including Telugu script', () => {
    expect(validateDisplayName('Ravi')).toBeNull();
    expect(validateDisplayName('mahesh_fan.99')).toBeNull();
    expect(validateDisplayName('రవి')).toBeNull();
  });

  it('rejects names that are too short or too long', () => {
    expect(validateDisplayName(' a ')).toMatch(/at least/);
    expect(validateDisplayName('x'.repeat(21))).toMatch(/at most/);
    expect(validateDisplayName('x'.repeat(20))).toBeNull();
  });

  it('rejects other scripts and accented letters (kept identical to the database rule)', () => {
    expect(validateDisplayName('Café')).not.toBeNull();
    expect(validateDisplayName('рави')).not.toBeNull();
  });

  it('rejects markup, URLs and emoji', () => {
    expect(validateDisplayName('<script>')).not.toBeNull();
    expect(validateDisplayName('http://x.y')).not.toBeNull();
    expect(validateDisplayName('Ravi 🎵')).not.toBeNull();
  });
});
