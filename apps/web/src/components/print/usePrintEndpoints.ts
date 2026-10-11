import { useCallback, useEffect, useState } from 'react';
import type { PrintEndpoint } from '@gustopos/shared';
import { fetchPrintEndpoints } from '../../shared/api/client';

/**
 * The tenant's ACQUIRED printers (QZ enumeration + LAN scans), refreshed once
 * on mount. Unlike a bridge's live printer list, these survive the printer
 * being off and the bridge being offline — that is what lets a configuration
 * pick `ip:port` at any time and be applied later.
 */
export function usePrintEndpoints(): {
  endpoints: PrintEndpoint[];
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [endpoints, setEndpoints] = useState<PrintEndpoint[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const rows = await fetchPrintEndpoints();
      setEndpoints(rows);
    } catch {
      // Registry is an enrichment: the editor falls back to the live list.
      setEndpoints([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { endpoints, loading, refresh };
}
