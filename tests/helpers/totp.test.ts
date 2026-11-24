import { describe, expect, it } from 'vitest';
import { totp } from './totp';

// RFC 6238 Appendix B test vector (SHA-1 secret "12345678901234567890").
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('totp (test helper)', () => {
  it('matches the RFC 6238 test vectors (last 6 digits)', () => {
    expect(totp(RFC_SECRET, 59_000)).toBe('287082');
    expect(totp(RFC_SECRET, 1_111_111_109_000)).toBe('081804');
    expect(totp(RFC_SECRET, 1_234_567_890_000)).toBe('005924');
  });
});
