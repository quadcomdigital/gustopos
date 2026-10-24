import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Reveals its children once they scroll into view, using a transform/opacity
 * transition defined in `franks.css`. Under `prefers-reduced-motion` the CSS
 * never applies, so content renders visible with no animation.
 *
 * The observer disconnects after the first intersection: there is no reason to
 * keep watching once a section has settled, and it keeps 9+ observers off the
 * scroll path.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  /** Stagger, in ms. Kept small and capped by callers. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`fr-reveal ${className ?? ''}`}
      data-shown={shown ? 'true' : 'false'}
      style={{ transitionDelay: delay ? `${delay}ms` : undefined }}
    >
      {children}
    </div>
  );
}
