import { forwardRef, HTMLAttributes, ReactNode } from 'react';
import mergeClasses from '../../lib/mergeClasses';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined' | 'glass';
  hover?: boolean;
  selected?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: ReactNode;
}
const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      hover = false,
      selected = false,
      padding = 'md',
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    const baseStyles = `
      rounded-[1.75rem]
      transition-all duration-300 ease-out
    `;

    const variants = {
      default: `
        bg-white border border-white/70
        shadow-[0_16px_40px_rgba(16,24,40,0.08)]
      `,
      elevated: `
        bg-white border border-white/70
        shadow-[0_20px_50px_rgba(16,24,40,0.12)]
      `,
      outlined: `
        bg-white border border-neutral-200/90
      `,
      glass: `
        bg-white/80 backdrop-blur-xl border border-white/50
        shadow-[0_18px_40px_rgba(16,24,40,0.10)]
      `,
    };

    const paddings = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    };

    const hoverStyles = hover
      ? `cursor-pointer hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(16,24,40,0.16)] hover:border-emerald-200/80`
      : '';

    const selectedStyles = selected
      ? `border-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.14)]`
      : '';

    return (
      <div
        ref={ref}
        className={mergeClasses(
          baseStyles,
          variants[variant],
          paddings[padding],
          hoverStyles,
          selectedStyles,
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export default Card;

// Card Header Component
interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function CardHeader({ title, subtitle, action, className = '', ...props }: CardHeaderProps) {
  return (
    <div className={`flex items-start justify-between mb-4 ${className}`} {...props}>
      <div>
        <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
        {subtitle && <p className="text-sm text-neutral-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
