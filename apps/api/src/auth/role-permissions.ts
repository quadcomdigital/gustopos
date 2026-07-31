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
    "loyalty:manage",
    "customers:view",
    "customers:manage",
    "inventory:manage",
    "purchasing:manage",
    "shifts:manage",
    "reservations:manage",
    "delivery:manage",
  ],
  waiter: [
    "orders:void",
    "tables:pay",
    "customers:view",
    "customers:manage",
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
  { key: "orders:update", label: "Aggiorna Ordini", description: "Modifica stato ordini in cucina" },
  { key: "printing:dispatch", label: "Dispatch Stampa", description: "Invia job di stampa alle stampanti" },
  { key: "loyalty:manage", label: "Gestione Loyalty", description: "Assegna e riscatta punti fedeltà" },
  { key: "customers:view", label: "Visualizza Clienti", description: "Accedi all'anagrafica clienti" },
  { key: "customers:manage", label: "Gestione Clienti", description: "Crea, modifica ed elimina clienti" },
  { key: "inventory:manage", label: "Gestione Inventario", description: "Modifica ingredienti, ricette e menu" },
  { key: "purchasing:manage", label: "Gestione Acquisti", description: "Gestisci fornitori e ordini di acquisto" },
  { key: "shifts:manage", label: "Gestione Turni", description: "Crea e modifica turni staff" },
  { key: "reservations:manage", label: "Gestione Prenotazioni", description: "Crea e modifica prenotazioni" },
  { key: "delivery:manage", label: "Gestione Delivery", description: "Gestisci ordini a domicilio" },
] as const;
