import { useEffect, useState } from 'react';
import type { ProductionReference } from '@gustopos/shared';
import { fetchProductionReferences } from '../../shared/api/client';

/**
 * Loads the tenant's production references ("contenitori": BUN, Piadina, …)
 * for explicit category/product/modifier assignment.
 */
export function useProductionReferences(): { references: ProductionReference[]; loading: boolean } {
  const [references, setReferences] = useState<ProductionReference[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchProductionReferences()
      .then((rows) => {
        if (active) setReferences(rows);
      })
      .catch(() => {
        if (active) setReferences([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { references, loading };
}
