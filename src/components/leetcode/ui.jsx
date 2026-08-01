'use client';

/**
 * Shared, reusable UI primitives for the LeetCode Automation feature. These
 * reuse the app's CSS variables (--ink, --muted, --line, --accent, …) so they
 * match the existing design system, and include `dark:` variants for graceful
 * dark-mode support.
 */

export function FlameIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2c.3 2.4-.9 3.9-2.2 5.3C8.3 8.9 7 10.4 7 12.8a5 5 0 0 0 10 .2c0-1.7-.7-3-1.6-4.2-.3 1-1 1.7-1.9 2 .6-1.6.2-3.4-1-4.9C11.4 4.6 12 3.3 12 2Z" />
    </svg>
  );
}

const TONES = {
  ok: 'bg-[var(--accent-soft)] text-[var(--accent)]',
  warn: 'bg-[#fef3e2] text-[#b45309]',
  danger: 'bg-[#fdeceb] text-[var(--danger)]',
  muted: 'bg-[#eef2f0] text-[var(--muted)]',
  info: 'bg-[#e6f0f7] text-[#1d5f8a]',
};

export function Badge({ tone = 'muted', children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone] || TONES.muted} ${className}`}
    >
      {children}
    </span>
  );
}

export function Card({ children, className = '', as: Tag = 'section' }) {
  return (
    <Tag
      className={`rounded-[18px] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow)] dark:border-white/10 dark:bg-white/5 ${className}`}
    >
      {children}
    </Tag>
  );
}

export function StatCard({ label, value, hint, tone = 'default', className = '' }) {
  const gradient = tone === 'accent';
  return (
    <article
      className={`animate-rise rounded-[14px] border p-4 ${
        gradient
          ? 'border-transparent bg-gradient-to-br from-[#0f7a4f] to-[#149463] text-white'
          : 'border-[var(--line)] bg-white dark:border-white/10 dark:bg-white/5'
      } ${className}`}
    >
      <p
        className={`text-[0.72rem] font-semibold uppercase tracking-[0.06em] ${
          gradient ? 'text-white/80' : 'text-[var(--muted)]'
        }`}
      >
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums md:text-3xl">{value}</p>
      {hint != null && (
        <p className={`text-sm ${gradient ? 'text-white/80' : 'text-[var(--muted)]'}`}>{hint}</p>
      )}
    </article>
  );
}

export function Toggle({ checked, onChange, disabled = false, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        checked ? 'bg-[var(--accent)]' : 'bg-slate-300'
      }`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
  );
}

export function ToggleRow({ label, hint, checked, onChange, disabled }) {
  return (
    <div className="mb-2 flex items-start justify-between gap-3 rounded-lg border border-[var(--line)] bg-[#fbfdfc] px-3 py-2.5 dark:border-white/10 dark:bg-white/5">
      <span>
        <span className="block text-sm font-semibold text-[var(--ink)] dark:text-white">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-[var(--muted)]">{hint}</span>}
      </span>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} label={label} />
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block text-sm font-medium">
      <span className="text-[var(--ink)] dark:text-white/90">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[var(--muted)]">{hint}</span>}
    </label>
  );
}

const inputBase =
  'mt-1.5 w-full rounded-[10px] border border-[var(--line)] bg-[#fbfdfc] px-3 py-2.5 outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[rgba(15,122,79,0.15)] dark:bg-white/5 dark:text-white';

export function Input(props) {
  return <input {...props} className={`${inputBase} ${props.className || ''}`} />;
}

export function Textarea(props) {
  return <textarea {...props} className={`${inputBase} font-mono text-sm ${props.className || ''}`} />;
}

export function Select({ children, ...props }) {
  return (
    <select {...props} className={`${inputBase} ${props.className || ''}`}>
      {children}
    </select>
  );
}

export function Button({ variant = 'primary', className = '', ...props }) {
  const variants = {
    primary: 'bg-[var(--accent)] text-white hover:bg-[#0c6541] disabled:opacity-60',
    ghost:
      'border border-[var(--line)] bg-white text-[var(--ink)] hover:bg-[#f7faf8] dark:bg-white/5 dark:text-white dark:border-white/10',
    danger: 'border border-[var(--danger)] text-[var(--danger)] hover:bg-[#fdeceb]',
    subtle: 'bg-[var(--accent-soft)] text-[var(--accent)] hover:brightness-95',
  };
  return (
    <button
      type="button"
      {...props}
      className={`rounded-[10px] px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    />
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-lg bg-[#e7efeb] dark:bg-white/10 ${className}`} />;
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="grid place-items-center rounded-[14px] border border-dashed border-[var(--line)] px-6 py-12 text-center dark:border-white/10">
      <p className="text-base font-semibold text-[var(--ink)] dark:text-white">{title}</p>
      {body && <p className="mt-1 max-w-md text-sm text-[var(--muted)]">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onMouseDown={onClose}>
      <div
        className={`animate-rise w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[var(--shadow)] dark:border-white/10 dark:bg-[#101915]`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3 dark:border-white/10">
          <h3 className="m-0 text-base font-bold text-[var(--ink)] dark:text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-[#f1f5f3] dark:hover:bg-white/10"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-[var(--line)] px-4 py-3 dark:border-white/10">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

const DIFF_TONE = {
  EASY: 'ok',
  MEDIUM: 'warn',
  HARD: 'danger',
  UNRATED: 'muted',
};

export function DifficultyBadge({ value }) {
  return <Badge tone={DIFF_TONE[value] || 'muted'}>{(value || 'UNRATED').toLowerCase()}</Badge>;
}

const RESULT_TONE = {
  success: 'ok',
  failure: 'danger',
  reminder: 'info',
  skipped: 'muted',
};

export function ResultBadge({ value }) {
  return <Badge tone={RESULT_TONE[value] || 'muted'}>{value}</Badge>;
}

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDuration(ms) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}
