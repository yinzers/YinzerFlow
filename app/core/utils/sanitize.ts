/**
 * Strip control characters, newlines, and Unicode BiDi overrides from attacker-controlled
 * strings before log interpolation. Prevents log injection (fake log entries via \n),
 * ANSI escape injection, and terminal display manipulation via BiDi overrides.
 */
const CONTROL_CHARS_RE = /[\r\n\x00-\x1f\x7f\u200f\u202a-\u202e\u2066-\u2069]/g;

export const _sanitizeLogField = (value: string, maxLength = 256): string => value.replace(CONTROL_CHARS_RE, '').slice(0, maxLength);
