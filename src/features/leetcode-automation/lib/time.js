/**
 * Timezone-aware helpers for scheduling, built on Intl (no external deps).
 * Good enough for a daily run time; not intended for sub-minute precision.
 */

/** Milliseconds a given instant is offset from UTC in `timeZone`. */
function tzOffsetMs(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(date).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUTC - date.getTime();
}

/** The UTC Date for a wall-clock time in `timeZone`. */
function wallTimeToUtc(y, m, d, hh, mm, timeZone) {
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0);
  const offset = tzOffsetMs(new Date(guess), timeZone);
  return new Date(guess - offset);
}

/** Wall-clock Y/M/D for an instant in `timeZone`. */
function zonedDateParts(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = dtf.formatToParts(date).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day) };
}

/**
 * The next UTC instant at which local `HH:mm` occurs in `timeZone`, strictly
 * after `from`.
 * @param {string} timeOfDay "HH:mm"
 * @param {string} timeZone  IANA id
 * @param {Date} [from]
 * @returns {Date}
 */
export function nextRunAt(timeOfDay, timeZone, from = new Date()) {
  const [hh, mm] = String(timeOfDay || '09:00')
    .split(':')
    .map((n) => Number(n));
  const { y, m, d } = zonedDateParts(from, timeZone);

  let candidate = wallTimeToUtc(y, m, d, hh || 0, mm || 0, timeZone);
  if (candidate.getTime() <= from.getTime()) {
    // Move to the same wall-clock time on the next calendar day.
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    const np = zonedDateParts(next, timeZone);
    candidate = wallTimeToUtc(np.y, np.m, np.d, hh || 0, mm || 0, timeZone);
  }
  return candidate;
}
