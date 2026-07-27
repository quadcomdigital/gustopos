import { useMemo } from 'react';
import { useAppStore } from '../store/app-store';

export function useTenantModules() {
  const enabledModules = useAppStore((state) => state.enabledModules);
  return useMemo(() => enabledModules, [enabledModules]);
}

export function useUserPermissions() {
  const permissions = useAppStore((state) => state.permissions);
  return useMemo(() => permissions, [permissions]);
}
