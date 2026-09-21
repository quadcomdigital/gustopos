import { useEffect, useState } from 'react';
import type { PrintStation } from '@gustopos/shared';
import { fetchPrintStations } from '../../shared/api/client';

/**
 * Loads the tenant's print stations for explicit product/category assignment.
 * Stations are the only source of routing truth (no name/regex inference).
 */
export function usePrintStations(): { stations: PrintStation[]; loading: boolean } {
  const [stations, setStations] = useState<PrintStation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchPrintStations()
      .then((rows) => {
        if (active) setStations(rows);
      })
      .catch(() => {
        if (active) setStations([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { stations, loading };
}
