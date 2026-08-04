import { ReactNode } from 'react';

interface BadgeProps {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
  size?: 'sm' | 'md';
  icon?: ReactNode;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

import mergeClasses from '../../lib/mergeClasses';

export function Badge({
  variant = 'primary',
  size = 'md',
  icon,
  dot = false,
  className = '',
  children,
}: BadgeProps) {
  const variants = {
    primary: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
    secondary: 'bg-amber-50 text-amber-800 border-amber-200/80',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
    warning: 'bg-amber-50 text-amber-800 border-amber-200/80',
    error: 'bg-red-50 text-red-800 border-red-200/80',
    info: 'bg-sky-50 text-sky-800 border-sky-200/80',
    neutral: 'bg-neutral-50 text-neutral-700 border-neutral-200/80',
  };

  const dotColors = {
    primary: 'bg-emerald-500',
    secondary: 'bg-amber-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
    info: 'bg-sky-500',
    neutral: 'bg-neutral-500',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span
      className={mergeClasses(
        'inline-flex items-center gap-1.5',
        'font-semibold rounded-full border px-2.5 py-1 shadow-sm',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />
      )}
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </span>
  );
}
