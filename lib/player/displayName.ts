export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 20;

// English letters, digits, the Telugu Unicode block, space, _ . -
// MUST match the check in supabase/migrations/*_core_schema.sql (profiles.display_name).
const ALLOWED = /^[A-Za-z0-9 _.ఀ-౿-]+$/;

export function normalizeDisplayName(raw: string): string {
  return raw.normalize('NFC').trim().replace(/\s+/g, ' ');
}

/** Returns an error message, or null when the name is valid. */
export function validateDisplayName(raw: string): string | null {
  const name = normalizeDisplayName(raw);
  const length = [...name].length;
  if (length < DISPLAY_NAME_MIN) return `Use at least ${DISPLAY_NAME_MIN} characters.`;
  if (length > DISPLAY_NAME_MAX) return `Use at most ${DISPLAY_NAME_MAX} characters.`;
  if (!ALLOWED.test(name)) return 'Use English or Telugu letters, numbers, spaces, dots, dashes or underscores.';
  return null;
}
