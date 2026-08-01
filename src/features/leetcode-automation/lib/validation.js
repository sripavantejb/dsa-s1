import { DIFFICULTIES, ENGINES, LANGUAGES, ROTATIONS } from '../constants.js';

/** Thrown by validators; carries an HTTP status for the route layer. */
export class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
  }
}

export function requireString(value, field, { max = 5000, trim = true } = {}) {
  if (typeof value !== 'string') throw new ValidationError(`${field} is required.`);
  const out = trim ? value.trim() : value;
  if (!out) throw new ValidationError(`${field} is required.`);
  if (out.length > max) throw new ValidationError(`${field} is too long (max ${max}).`);
  return out;
}

export function optionalString(value, { max = 5000, trim = true, fallback = '' } = {}) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return fallback;
  const out = trim ? value.trim() : value;
  return out.length > max ? out.slice(0, max) : out;
}

export function enumValue(value, allowed, field, fallback) {
  if (value == null && fallback !== undefined) return fallback;
  if (!allowed.includes(value)) {
    throw new ValidationError(`${field} must be one of: ${allowed.join(', ')}.`);
  }
  return value;
}

export function boolValue(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

export function intValue(value, { min = 0, max = 1000, fallback = 0 } = {}) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function stringArray(value, { maxItems = 50, maxLen = 60 } = {}) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v) => typeof v === 'string')
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((v) => (v.length > maxLen ? v.slice(0, maxLen) : v));
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
export function timeOfDay(value, fallback = '09:00') {
  if (typeof value === 'string' && TIME_RE.test(value)) return value;
  return fallback;
}

export function timezone(value, fallback = 'UTC') {
  if (typeof value !== 'string' || !value) return fallback;
  try {
    // Throws RangeError for an invalid IANA zone.
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return value;
  } catch {
    return fallback;
  }
}

export const validators = {
  language: (v, fallback = 'cpp') => enumValue(v, LANGUAGES, 'language', fallback),
  difficulty: (v, fallback = 'UNRATED') => enumValue(v, DIFFICULTIES, 'difficulty', fallback),
  rotation: (v, fallback = 'sequential') => enumValue(v, ROTATIONS, 'rotation', fallback),
  engine: (v, fallback = ENGINES.REMINDER) =>
    enumValue(v, [ENGINES.REMINDER, ENGINES.PLAYWRIGHT], 'engine', fallback),
};
