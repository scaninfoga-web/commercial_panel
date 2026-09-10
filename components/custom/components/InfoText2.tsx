import React from 'react';

interface PageProps {
  label: string;
  value: string | React.JSX.Element | undefined;
  labelClassName?: string;
  valueClassName?: string;
  icon?: React.ReactNode;
}

export default function InfoText2({
  label,
  value,
  labelClassName,
  valueClassName,
  icon,
}: PageProps) {
  return (
    <div>
      <p
        className={`flex items-center gap-1.5 text-sm text-gray-400 ${labelClassName ?? ''}`}
      >
        {icon && (
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-emerald-400">
            {icon}
          </span>
        )}
        {label}
      </p>
      <div className={`text-base font-medium ${valueClassName ?? ''}`}>
        {value}
      </div>
    </div>
  );
}
