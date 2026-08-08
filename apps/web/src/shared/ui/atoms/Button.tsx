import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../../lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white border-accent hover:bg-accent/90',
  secondary: 'bg-white text-secondary border-border hover:bg-bg',
  danger: 'bg-danger text-white border-danger hover:bg-danger/90',
  ghost: 'bg-transparent text-secondary border-transparent hover:bg-bg',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'min-h-[44px] px-3 py-2 text-xs',
  md: 'min-h-[44px] px-4 py-2.5 text-sm',
  lg: 'min-h-[48px] px-6 py-3 text-base',
};

export default forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ variant = 'primary', size = 'sm', loading, className, children, disabled, ...props }, ref) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded font-bold uppercase tracking-wider border transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
          variantStyles[variant],
          sizeStyles[size],
          (disabled || loading) && 'opacity-50 cursor-not-allowed',
          className,
        )}
        {...props}
      >
        {loading && <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />}
        {children}
      </button>
    );
  }
);
