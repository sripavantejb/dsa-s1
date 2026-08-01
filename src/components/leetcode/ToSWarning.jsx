'use client';

import { TOS_WARNING } from '@/features/leetcode-automation/constants';

/** Prominent, reused ToS/ownership disclaimer. */
export function ToSWarning({ className = '' }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-[14px] border border-[#f3d9b5] bg-[#fef7ec] px-4 py-3 text-sm text-[#8a5a12] dark:border-[#8a5a12]/40 dark:bg-[#3a2a10]/40 dark:text-[#f3d9b5] ${className}`}
      role="alert"
    >
      <span aria-hidden="true" className="mt-0.5 text-base">⚠️</span>
      <p className="m-0 leading-relaxed">{TOS_WARNING}</p>
    </div>
  );
}
