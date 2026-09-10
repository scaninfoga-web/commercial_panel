import React from 'react';
import { cn } from '@/lib/utils';

interface VerifiedBadgeProps {
  className?: string;
  title?: string;
  size?: number;
}

const VerifiedBadge = ({
  className,
  title = 'Verified',
  size = 14,
}: VerifiedBadgeProps) => (
  <span
    title={title}
    aria-label={title}
    className={cn('inline-flex items-center justify-center', className)}
  >
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-[0_0_4px_rgba(16,185,129,0.45)]"
    >
      <path
        d="M12 1.5l2.36 1.86 2.98-.34 1.32 2.7 2.7 1.32-.34 2.98L23 12l-1.86 2.36.34 2.98-2.7 1.32-1.32 2.7-2.98-.34L12 22.5l-2.36-1.86-2.98.34-1.32-2.7-2.7-1.32.34-2.98L1 12l1.86-2.36-.34-2.98 2.7-1.32 1.32-2.7 2.98.34L12 1.5z"
        fill="#10b981"
        stroke="#34d399"
        strokeWidth="0.5"
      />
      <path
        d="M7.5 12.2l3 3 6-6.4"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  </span>
);

export default VerifiedBadge;
