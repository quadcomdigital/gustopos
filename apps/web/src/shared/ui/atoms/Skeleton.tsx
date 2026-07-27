import { cn } from '../../../lib/utils';

interface SkeletonProps {
  className?: string;
  count?: number;
}

export default function Skeleton({ className, count = 1 }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn('animate-pulse bg-bg rounded', className ?? 'h-12 w-full')} />
      ))}
    </>
  );
}
