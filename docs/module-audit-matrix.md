# Module Audit Matrix

This matrix tracks the current module baseline, the most relevant missing capabilities, and implementation priority.

| Module | Status | Fundamental Gap | Priority |
| --- | --- | --- | --- |
| kitchen | active | Missing order status transition guardrails | P0 |
| inventory | active | Core CRUD present, no automated regression tests | P1 |
| simple_catalog | active | Mutual exclusion with inventory enforced, but no dedicated test coverage | P2 |
| customers | active | No permission-level authorization on customer-sensitive actions | P1 |
| analytics | active | Refund/report endpoints rely on role-only authorization | P0 |
| printing | active | Dispatch workflows lack permission checks and baseline tests | P1 |
| reservations | active | Operational flow present, advanced planning not covered | P2 |
| delivery | active | Status workflow present, advanced dispatch controls not covered | P2 |
| purchasing_suppliers | active | CRUD present, approval workflow and robust tests missing | P2 |
| staff_shifts_timeclock | active | Core flow present, no fine-grained permission checks | P1 |
| fiscal_exports | active | Export controls role-based only, no hardened permission layer | P0 |
| public_menu | active | Public rate limit in-memory only, not distributed-safe | P1 |
| public_takeaway | active | Route-level module gating not uniform across public routes | P1 |
| self_order_qr | active | Module gating mixed between route and repository checks | P1 |
| public_group_order | partial | Not fully governed in Superadmin module list and public menu visibility | P0 |
| consumer_accounts | active | Permission model not explicit for privileged account operations | P1 |
| loyalty_points | partial | Declared in contracts but no tenant-facing feature implementation | P2 |

## Operational acceptance baseline

- Every module has explicit state: `active`, `partial`, or `missing`.
- Every `P0` gap maps to a concrete remediation in backend/frontend.
- Module governance in Superadmin matches shared module contracts.
- Public UX only exposes flows enabled by module capabilities.
