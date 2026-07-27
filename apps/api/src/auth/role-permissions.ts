type Role = "admin" | "waiter" | "chef" | "consumer";

export const permissionsByRole: Record<Role, string[]> = {
  admin: [
    "orders:update",
    "orders:void",
    "tables:pay",
    "payments:refund",
    "fiscal:close",
    "fiscal:export",
    "settings:update",
    "staff:manage",
    "printing:dispatch",
  ],
  waiter: [
    "orders:void",
    "tables:pay",
  ],
  chef: [
    "orders:update",
  ],
  consumer: [],
};

/**
 * Resolve permissions for a staff member.
 * Admin always gets all permissions (bypass).
 * For other roles: merge role defaults + custom per-staff overrides.
 * Custom permissions ADD to role defaults (never remove).
 */
export function resolveRolePermissions(role: Role, customPermissions?: string[] | null): string[] {
  if (role === "admin") {
    return [...permissionsByRole.admin];
  }

  const base = permissionsByRole[role] ?? [];
  const custom = Array.isArray(customPermissions) ? customPermissions : [];

  // Merge + deduplicate
  const merged = new Set([...base, ...custom]);
  return Array.from(merged);
}

/** All permissions that can be assigned as custom overrides */
export const AVAILABLE_CUSTOM_PERMISSIONS = [
  { key: "tables:pay", label: "Checkout Tavoli", description: "Chiudi conto e gestisci pagamenti tavoli" },
  { key: "orders:void", label: "Annulla Ordini", description: "Annulla ordini attivi" },
  { key: "printing:dispatch", label: "Dispatch Stampa", description: "Invia job di stampa alle stampanti" },
] as const;
