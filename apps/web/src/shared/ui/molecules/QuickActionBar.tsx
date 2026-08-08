import type { ReactNode } from 'react';
import { cn } from '../../../lib/utils';

export interface QuickAction {
  key: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'neutral' | 'danger';
}

interface QuickActionBarProps {
  actions: QuickAction[];
  className?: string;
}

export default function QuickActionBar({ actions, className }: QuickActionBarProps) {
  return (
    <div
      className={cn(
        'md:hidden fixed left-3 right-3 bottom-20 z-[1001] rounded-2xl border border-border bg-white/95 backdrop-blur shadow-lg p-2',
        className,
      )}
    >
      <div className={cn('grid gap-2', actions.length === 2 ? 'grid-cols-2' : actions.length >= 3 ? 'grid-cols-3' : 'grid-cols-1')}>
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            className={cn(
              'min-h-11 rounded-xl px-2 py-2 text-[11px] font-bold uppercase tracking-wider border inline-flex items-center justify-center gap-1.5 disabled:opacity-50',
              action.tone === 'primary'
                ? 'bg-primary text-white border-primary'
                : action.tone === 'danger'
                  ? 'bg-danger-50 text-danger-700 border-danger-300'
                  : 'bg-white text-secondary border-border',
            )}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
