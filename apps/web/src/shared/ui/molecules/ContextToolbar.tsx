import type { ReactNode } from 'react';
import { cn } from '../../../lib/utils';

export interface ContextToolbarAction {
  key: string;
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  tone?: 'primary' | 'neutral' | 'danger';
}

interface ContextToolbarProps {
  title: string;
  description?: string;
  actions: ContextToolbarAction[];
  className?: string;
}

export default function ContextToolbar({ title, description, actions, className }: ContextToolbarProps) {
  return (
    <div className={cn('rounded-xl border border-border bg-white p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3', className)}>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-primary">{title}</p>
        {description ? <p className="text-xs text-text-muted">{description}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            className={cn(
              'min-h-10 rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wider border inline-flex items-center gap-1.5 disabled:opacity-50',
              action.tone === 'primary'
                ? 'bg-primary text-white border-primary'
                : action.tone === 'danger'
                  ? 'bg-red-50 text-red-700 border-red-300'
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
