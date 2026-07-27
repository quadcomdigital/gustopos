import { useAppStore } from '../../store/app-store';
import { uiActionPolicyMatrix, type UiActionKey } from './policy';

/**
 * Hook to check if the current user has permission for a specific UI action.
 * Uses the policy matrix to map action → required permission,
 * then checks against the user's permission list from the store.
 */
export function usePermission() {
  const permissions = useAppStore((state) => state.permissions);
  const role = useAppStore((state) => state.currentUser?.role);

  return {
    /** Check if the user can perform a specific UI action */
    can(action: UiActionKey): boolean {
      const policy = uiActionPolicyMatrix[action];
      if (!policy) return false;
      // Admin always has all permissions
      if (role === 'admin') return true;
      // Check if the user's role is allowed
      if (!policy.roles.includes(role as 'admin' | 'waiter' | 'chef')) return false;
      // Check if the user has the required permission
      return permissions.includes(policy.permission);
    },

    /** Check if user has a raw permission string */
    hasPermission(permission: string): boolean {
      if (role === 'admin') return true;
      return permissions.includes(permission);
    },

    /** Get the current user's role */
    role,

    /** Get all permissions */
    permissions,
  };
}
