import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export default function SectionHeader({ title, description, actions, className }: SectionHeaderProps) {
  return (
    <div className={`px-4 py-3 border-b border-border bg-bg/40 flex items-center justify-between gap-3 ${className ?? ''}`}>
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-primary uppercase tracking-widest truncate">{title}</h3>
        {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
