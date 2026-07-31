import type { ReactNode } from 'react';
import Skeleton from '../atoms/Skeleton';
import EmptyState from '../atoms/EmptyState';

interface LoadingOrEmptyProps {
  loading: boolean;
  icon: ReactNode;
  title: string;
  description?: string;
  /** Number of skeleton rows to show while loading. Default 5. */
  skeletonCount?: number;
}

/**
 * Standardised loading/empty placeholder used across inventory tabs.
 * Replaces the repetitive:
 *
 *   {loading ? (
 *     <div className="space-y-2">
 *       {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
 *     </div>
 *   ) : (
 *     <EmptyState icon={...} title="..." description="..." />
 *   )}
 */
export default function LoadingOrEmpty({
  loading,
  icon,
  title,
  description,
  skeletonCount = 5,
}: LoadingOrEmptyProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return <EmptyState icon={icon} title={title} description={description} />;
}
