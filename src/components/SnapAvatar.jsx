/** Profile / chat avatars for Tej & Hafsa */

const AVATARS = {
  hafsa: '/avatars/hafsa.png',
  tej: '/avatars/tej.png',
};

export function SnapAvatar({ username, size = 40, className = '' }) {
  const key = String(username || '').toLowerCase();
  const photo = AVATARS[key];

  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt={key}
        width={size}
        height={size}
        className={`shrink-0 rounded-full object-cover shadow-sm ring-1 ring-black/5 ${className}`}
        style={{ width: size, height: size }}
        draggable={false}
      />
    );
  }

  // Fallback cartoon avatar (Tej, or unknown)
  const isTej = key === 'tej';
  const bg = isTej ? '#0f7a4f' : '#c2410c';
  const hair = isTej ? '#1a1a1a' : '#3b2314';
  const skin = isTej ? '#e8b888' : '#f0c9a8';
  const shirt = isTej ? '#149463' : '#ea580c';
  const id = isTej ? 'tej' : key || 'user';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      className={`shrink-0 rounded-full shadow-sm ${className}`}
      aria-hidden="true"
    >
      <circle cx="40" cy="40" r="40" fill={bg} />
      <circle cx="40" cy="40" r="36" fill="#fff" opacity="0.12" />
      <ellipse cx="40" cy="28" rx="28" ry="24" fill={hair} />
      <ellipse cx="40" cy="42" rx="22" ry="24" fill={skin} />
      {isTej ? (
        <path d="M18 34c4-14 14-20 22-20s18 6 22 20c-6-8-14-10-22-10s-16 2-22 10z" fill={hair} />
      ) : (
        <>
          <path d="M14 38c6-18 16-26 26-26s20 8 26 26c-8-10-16-14-26-14s-18 4-26 14z" fill={hair} />
          <path d="M12 42c2 10 6 16 10 18 0-8 2-14 4-18-6 0-10-2-14 0zm44 0c-2 10-6 16-10 18 0-8-2-14-4-18 6 0 10-2 14 0z" fill={hair} />
        </>
      )}
      <ellipse cx="32" cy="42" rx="4.5" ry="5.5" fill="#fff" />
      <ellipse cx="48" cy="42" rx="4.5" ry="5.5" fill="#fff" />
      <circle cx="33" cy="43" r="2.4" fill="#1a1a1a" />
      <circle cx="49" cy="43" r="2.4" fill="#1a1a1a" />
      <circle cx="33.8" cy="41.8" r="0.8" fill="#fff" />
      <circle cx="49.8" cy="41.8" r="0.8" fill="#fff" />
      <path d="M27 36c3-2 7-2 10 0" stroke={hair} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M43 36c3-2 7-2 10 0" stroke={hair} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M33 52c3 4 11 4 14 0" stroke="#c45c3e" strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="26" cy="48" r="3" fill="#f2a8a0" opacity="0.55" />
      <circle cx="54" cy="48" r="3" fill="#f2a8a0" opacity="0.55" />
      <path d="M22 72c4-8 10-12 18-12s14 4 18 12" fill={shirt} />
      <title>{id}</title>
    </svg>
  );
}
