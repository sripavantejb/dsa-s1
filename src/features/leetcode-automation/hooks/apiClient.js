'use client';

/**
 * Thin fetch wrapper for the automation feature. Mirrors the `api()` helper in
 * TrackerApp so behaviour (JSON headers, error messages) is consistent.
 */
export async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export function qs(params = {}) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '' && v !== 'all') usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}
