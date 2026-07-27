import type { ReactNode } from 'react';
import { cn } from '../../../lib/utils';

export interface SegmentedChipOption<T extends string> {
  value: T;
  label: string;
  badge?: ReactNode;
  disabled?: boolean;
}

interface SegmentedChipsProps<T extends string> {
  options: Array<SegmentedChipOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: 'sm' | 'md';
  className?: string;
}

export default function SegmentedChips<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  className,
}: SegmentedChipsProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn('flex flex-wrap items-center gap-2', className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            disabled={option.disabled}
            aria-pressed={active}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border font-bold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]',
              size === 'sm' ? 'px-3 py-2 text-xs' : 'px-3 py-2.5 text-xs',
              active
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-secondary border-border hover:bg-bg',
            )}
          >
            <span>{option.label}</span>
            {option.badge ? <span className="text-[10px] font-extrabold">{option.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
