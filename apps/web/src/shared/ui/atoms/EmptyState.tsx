import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && <div aria-hidden="true" className="w-12 h-12 rounded-full bg-bg flex items-center justify-center mb-3 text-text-muted">{icon}</div>}
      <p className="text-sm font-bold text-secondary">{title}</p>
      {description && <p className="text-xs text-text-muted mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}