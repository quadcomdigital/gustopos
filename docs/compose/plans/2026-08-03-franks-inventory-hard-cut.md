# Franks Inventory Hard-Cut — Execution Plan

> **Status:** Architecture plan — no implementation started
>
> **Target:** Tenant `franks` only, pre-production reset/reimport
>
> **Strategy:** Replace the current parallel inventory/menu model with one canonical model. Do not preserve backward compatibility, dual-read, dual-write, shadow BoM, or legacy tenant catalog data.

---

## 0. Executive decision

The current problem is not that BoM exists. BoM is required for recursive compound recipes.

The problem is that the same domain concepts are currently represented by multiple competing structures:

- three menu recipe tables;
- BoM components;
- prep components;
- prep rows that may point to either an ingredient or a BoM;
- shadow BoM generated from menu recipes;
- canonical menu components added beside, rather than replacing, the old paths.

The hard-cut model is:

```text
Ingredient = purchased/raw stock item
BoM        = recursive formula; not automatically stockable
Prep       = optional stockable materialization of one BoM
Menu       = explicit consumer of ingredient, BoM, or prep
```

The component type is authoritative and never inferred:

```text
ingredient → consume the ingredient stock directly
bom        → recursively explode the formula
prep       → consume the prep stock directly
```

There is no automatic fallback from `prep` to its BoM, or from `bom` to a prep that happens to exist for the same formula.

### Confirmed decisions

- A menu may use ingredients, BoMs, and preps.
- A BoM may exist without a prep/materialized stock.
- A prep must be produced from a BoM.
- A BoM may contain ingredients, other BoMs, and preps.
- Quantities are normalized and persisted in the referenced component's canonical/output unit.
- Sale and production resolve explicit component references; they never guess the user's intent.
- Franks catalog data can be erased and reimported from zero.

---

## 1. Goals and non-goals

### Goals

- Make the data model unambiguous and recursive.
- Make menu creation the primary admin workflow.
- Support direct ingredient use without requiring a BoM or prep.
- Support direct, made-to-order BoM use without creating stock.
- Support optional stockable prep output for any BoM.
- Track ingredient and prep stock independently.
- Normalize units at write time.
- Persist immutable order stock impacts for cancellation and quantity changes.
- Give production a transactional, recursive, cycle-safe path.
- Remove all legacy catalog paths from reads and writes.
- Reimport Franks from a clean, validated source file.

### Non-goals

- Preserving old Franks menu/ingredient/prep rows.
- Supporting old API payloads or old recipe endpoints.
- Keeping shadow BoMs as a compatibility mechanism.
- Automatically producing missing preps during sale.
- Automatically switching a `bom` reference to a `prep` reference.
- Migrating old catalog rows in place.

Operational tables unrelated to the catalog (staff, authentication, tenants, printing infrastructure, payments and other enabled modules) remain outside the catalog reset unless a separate reset decision is made.

---

## 2. Target domain model

### 2.1 Ingredients

Ingredients are purchased or manually adjusted stock items.

```text
Ingredient
- id
- tenant_id
- name
- sku
- canonical_unit
- stock_quantity
- min_threshold
- unit_cost
- sale_price (optional)
- category_id (optional)
- is_active
```

Examples:

```text
Manzo macinato → kg
Sale           → g
Formaggio      → kg
Pane           → pz
```

A menu quantity entered as `150 g` for an ingredient whose canonical unit is `kg` is persisted as `0.150 kg`.

### 2.2 BoM formulas

A BoM describes a transformation and has an output quantity/unit. It has no stock by itself.

```text
BoM Mix A+B
output: 1 kg
- A: 0.700 kg
- B: 0.300 kg
```

A BoM can contain:

- an ingredient — direct raw input;
- another BoM — recursively expand the formula;
- a prep — consume the existing stock of that prep.

This permits both forms:

```text
BoM C
- BoM A+B       → expand A+B
- Ingredient C  → consume C
```

and:

```text
BoM C
- Prep A+B      → consume stock of Prep A+B
- Ingredient C  → consume C
```

### 2.3 Preps

A prep is an optional stockable materialization of a BoM.

```text
Prep Mix A+B
- source_bom: Mix A+B
- output unit: kg
- stock: 10 kg
```

A prep has exactly one production source. It must not have an alternative ingredient recipe or a second component table.

The current fields `ingredient_id`, `bom_id` alternative semantics, `quantity_per_unit`, and `prep_item_components` are replaced by one explicit `source_bom_id` relationship.

### 2.4 Menu components

A menu item has one canonical component edge table:

```text
Cheese Burger
- Pane: 1 pz       → ingredient
- Patty: 1 pz      → prep
- Formaggio: 20 g  → ingredient
- Salsa: 30 g      → bom
```

The menu component type controls stock behavior. It is not inferred from names, matching BoMs, or available preps.

### 2.5 Immutable order impact

When an order is created, a `bom` menu component is recursively resolved to final stock effects. The order stores only the actual consumed stock effects:

```text
ingredient | prep
```

This is the snapshot used for cancellation, quantity edits, audit and reconciliation. Later recipe changes cannot change the historical effect of an existing order.

---

## 3. Target SQL schema

> This is the target relational shape for the hard-cut migration. The implementation must modify `apps/api/src/db/schema.ts` first and generate the Drizzle migration with `npm run db:generate --workspace @gustopos/api`. Do not hand-edit a generated migration.
>
> Existing operational tables are omitted below when unchanged. The SQL shows the catalog tables and new production/order-ledger constraints that must be implemented.

### 3.1 Canonical units

Use a shared canonical unit enum in contracts and service validation:

```text
mg | g | kg | ml | L | pz
```

PostgreSQL may continue storing unit values as `text`, but every write path must validate against the shared unit schema. A database enum can be introduced later if it does not complicate Drizzle generation.

### 3.2 Ingredients

```sql
CREATE TABLE inventory (
  id              text PRIMARY KEY,
  tenant_id       text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            text NOT NULL,
  sku             text,
  quantity        numeric(14,6) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit            text NOT NULL CHECK (unit IN ('mg','g','kg','ml','L','pz')),
  min_threshold   numeric(14,6) NOT NULL DEFAULT 0 CHECK (min_threshold >= 0),
  category_id     text REFERENCES categories(id) ON DELETE SET NULL,
  unit_cost       numeric(14,6) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  sale_price      numeric(14,6) CHECK (sale_price IS NULL OR sale_price >= 0),
  is_active       integer NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
```

The current `is_container` field is not part of the canonical inventory recipe model. Container handling must be explicitly re-evaluated as a separate operational concern instead of silently influencing recipe deduction.

### 3.3 BoM formulas

```sql
CREATE TABLE bom_items (
  id              text PRIMARY KEY,
  tenant_id       text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            text NOT NULL,
  output_unit     text NOT NULL CHECK (output_unit IN ('mg','g','kg','ml','L','pz')),
  yield_quantity  numeric(14,6) NOT NULL CHECK (yield_quantity > 0),
  category_id     text REFERENCES categories(id) ON DELETE SET NULL,
  is_active       integer NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE bom_components (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id       text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bom_id          text NOT NULL REFERENCES bom_items(id) ON DELETE CASCADE,
  component_type  text NOT NULL CHECK (component_type IN ('ingredient','bom','prep')),
  component_id    text NOT NULL,
  quantity        numeric(14,6) NOT NULL CHECK (quantity > 0),
  unit            text NOT NULL CHECK (unit IN ('mg','g','kg','ml','L','pz')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, bom_id, component_type, component_id)
);

CREATE INDEX bom_components_lookup_idx
  ON bom_components (tenant_id, bom_id);
```

`component_id` is polymorphic because PostgreSQL cannot enforce a conventional FK against three target tables. The service layer must validate the target exists, belongs to the same tenant, is active, and has a compatible unit.

Because these are polymorphic references, deletion guards are mandatory:

- an ingredient cannot be deleted while referenced by a BoM or menu component;
- a BoM cannot be deleted while referenced by another BoM, a prep, or a menu component;
- a prep cannot be deleted while referenced by a BoM or menu component;
- deactivation is allowed only if existing references remain valid for historical records, while new menu/production writes reject inactive targets;
- any approved replacement must update all dependent edges in one transaction, never leave an orphaned `component_id`.

The repository must expose reference checks and enforce them before destructive operations. SQL constraints alone cannot protect polymorphic references.

The service must also reject cycles before saving a changed BoM. SQL constraints alone cannot safely enforce recursive acyclicity.

### 3.4 Optional stockable preps

```sql
CREATE TABLE prep_items (
  id              text PRIMARY KEY,
  tenant_id       text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_bom_id   text NOT NULL REFERENCES bom_items(id) ON DELETE RESTRICT,
  name            text NOT NULL,
  output_unit     text NOT NULL CHECK (output_unit IN ('mg','g','kg','ml','L','pz')),
  stock_quantity  numeric(14,6) NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  is_active       integer NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name),
  UNIQUE (tenant_id, name)
);

CREATE INDEX prep_items_lookup_idx
  ON prep_items (tenant_id, source_bom_id);
```

There is intentionally no uniqueness constraint on `source_bom_id`: the same formula may be materialized into more than one named stock identity when the operation needs it. The prep name is the stock identity and must remain unique per tenant.

The service must validate `prep_items.output_unit = bom_items.output_unit` on create/update. Once a prep exists for a BoM, the BoM output unit and yield are immutable unless a single transaction explicitly recalculates/approves every dependent prep and stock impact. The first hard-cut implementation will simply reject changes to a BoM's output unit or yield while materialized preps exist.

It must also validate the complete dependency graph `bom → prep → source_bom` so an indirect cycle cannot be introduced.

### 3.5 Menu items and one component table

```sql
CREATE TABLE menu_items (
  id              text PRIMARY KEY,
  tenant_id       text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            text NOT NULL,
  price           numeric(14,2) NOT NULL CHECK (price >= 0),
  category        text NOT NULL,
  category_id     text REFERENCES categories(id) ON DELETE SET NULL,
  print_areas     text NOT NULL DEFAULT '["kitchen"]',
  is_active       integer NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE menu_item_components (
  id              text PRIMARY KEY,
  tenant_id       text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  menu_item_id    text NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  component_type  text NOT NULL CHECK (component_type IN ('ingredient','bom','prep')),
  component_id    text NOT NULL,
  quantity        numeric(14,6) NOT NULL CHECK (quantity > 0),
  unit            text NOT NULL CHECK (unit IN ('mg','g','kg','ml','L','pz')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, menu_item_id, component_type, component_id)
);

CREATE INDEX menu_item_components_lookup_idx
  ON menu_item_components (tenant_id, menu_item_id);
```

Menu component units are persisted in the target's canonical/output unit. The UI may accept `g` while the target uses `kg`; the API converts before insert.

### 3.6 Production runs

A production run gives prep stock a first-class audit reference instead of relying on free-form movement notes.

```sql
CREATE TABLE prep_production_runs (
  id              text PRIMARY KEY,
  tenant_id       text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  prep_id         text NOT NULL REFERENCES prep_items(id) ON DELETE RESTRICT,
  quantity        numeric(14,6) NOT NULL CHECK (quantity > 0),
  unit            text NOT NULL CHECK (unit IN ('mg','g','kg','ml','L','pz')),
  staff_id        text REFERENCES staff(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE prep_production_impacts (
  id              text PRIMARY KEY,
  tenant_id       text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  production_id   text NOT NULL REFERENCES prep_production_runs(id) ON DELETE CASCADE,
  component_type  text NOT NULL CHECK (component_type IN ('ingredient','prep')),
  component_id    text NOT NULL,
  quantity        numeric(14,6) NOT NULL CHECK (quantity > 0),
  unit            text NOT NULL CHECK (unit IN ('mg','g','kg','ml','L','pz'))
);
```

The production engine resolves `bom` nodes recursively while producing a prep. A `prep` node consumes existing prep stock; it is not automatically produced.

### 3.7 Order stock impacts

```sql
CREATE TABLE order_stock_impacts (
  id              text PRIMARY KEY,
  tenant_id       text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id        text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id   bigint NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  component_type  text NOT NULL CHECK (component_type IN ('ingredient','prep')),
  component_id    text NOT NULL,
  quantity        numeric(14,6) NOT NULL CHECK (quantity > 0),
  unit            text NOT NULL CHECK (unit IN ('mg','g','kg','ml','L','pz')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX order_stock_impacts_order_lookup_idx
  ON order_stock_impacts (tenant_id, order_id);

CREATE INDEX order_stock_impacts_item_lookup_idx
  ON order_stock_impacts (tenant_id, order_item_id);
```

A direct menu `bom` never appears as an order impact. It is resolved to ingredient/prep effects before persistence.

### 3.8 Unit conversions

Use one target-aware normalization service for all three component targets. Conversion is allowed only within the same physical dimension:

```text
mass:   mg ↔ g ↔ kg
volume: ml ↔ L
count:  pz ↔ pz
```

A mass quantity cannot be converted to a volume quantity without an explicit domain conversion that is outside this plan. The resolver must reject `kg → L`, `g → pz`, and equivalent invalid pairs before persistence.

Use one target-aware normalization service for all three component targets:

```text
ingredient target → ingredient canonical unit
bom target        → bom output unit
prep target       → prep output unit
```

Standard metric conversions (`g ↔ kg`, `ml ↔ L`) come from the shared conversion library. Ingredient-specific packaging conversions are used only when the target is an ingredient and the conversion is explicitly defined. A BoM/prep target must use its own output unit and must never accidentally read an ingredient conversion row.

Keep the existing ingredient-specific conversion table for packaging/purchasing, but make its boundary explicit:

```sql
CREATE TABLE inventory_unit_conversions (
  id              text PRIMARY KEY,
  tenant_id       text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  inventory_id    text NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  from_unit       text NOT NULL,
  to_unit         text NOT NULL,
  factor          numeric(14,8) NOT NULL CHECK (factor > 0),
  UNIQUE (tenant_id, inventory_id, from_unit)
);
```

Standard metric conversions (`g ↔ kg`, `ml ↔ L`) come from the shared conversion library. Ingredient-specific conversions are for boundaries such as `cartone → kg`, not for allowing recipe rows to remain in arbitrary units.

If later needed for non-metric BoM/prep packaging, introduce a separate target-aware conversion table. Do not silently reuse an ingredient-only conversion row for a BoM or prep.

### 3.9 RLS and tenant isolation

Every catalog and ledger table must follow the existing project convention:

```sql
ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.<table> FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.<table>;
CREATE POLICY tenant_isolation_policy ON public.<table>
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));
```

Apply this to `inventory`, `bom_items`, `bom_components`, `prep_items`, `menu_items`, `menu_item_components`, `prep_production_runs`, `prep_production_impacts`, `order_stock_impacts`, and `inventory_unit_conversions`. The generated migration must be reviewed to ensure RLS is enabled and forced on every new table.

---

## 4. Hard-cut migration and Franks reset

### 4.1 Migration order

1. Update `apps/api/src/db/schema.ts` to the target shape.
2. Update shared contracts and unit helpers.
3. Generate the migration using Drizzle.
4. Review generated SQL for FK order, checks, indexes and RLS.
5. Apply to a disposable database first.
6. Run the catalog reset for tenant `franks`.
7. Import the new Franks catalog.
8. Run integrity checks.
9. Only then enable the new inventory/menu module for Franks.

The migration is a code/schema change. The Franks reset and import are data operations and must be separate, repeatable commands.

### 4.2 Tenant catalog reset

Implement a guarded admin-only operation or one-shot script:

```text
resetTenantCatalog('franks')
```

It must require an explicit tenant ID and confirmation token. In one transaction, delete catalog-owned data in dependency order:

1. if any captured payment exists for the tenant, stop unless the operator explicitly enables destructive operational reset;
2. delete payment items and then payments for the approved destructive operational reset;
3. delete delivery/order extension rows, public tracking/group-order links, and open orders;
4. delete order items and order impacts;
5. delete production runs and production impacts;
6. delete stock movements and inventory audit rows;
7. delete goods receipt items, goods receipts, purchase order items and purchase orders for the approved catalog reset, or stop if purchasing history must be preserved;
8. delete supplier-ingredient links;
9. delete menu modifier option overrides, modifier options/groups, menu item modifiers and category pool options/categories;
10. delete menu item components and menu items;
11. delete prep items;
12. delete BoM components;
13. delete BoMs;
14. delete unit conversions;
15. delete inventory rows;
16. delete catalog categories.

The reset command must require an explicit policy flag for steps 2 and 7 (`preserve_operational_history` or `destructive_operational_reset`). The default is to stop when those rows exist, never silently delete them.

The reset must explicitly account for `default_container_id`, modifier `inventory_item_id`/`bom_id`, category pool inventory references, supplier links, and every table with a catalog foreign key. If a dependent row is not in the approved reset scope, the operation must stop rather than rely on an accidental cascade.

Do not delete tenant, staff, auth, print bridge, payment infrastructure or unrelated operational configuration unless explicitly included in a separate reset scope.

The reset must report counts deleted per table and refuse to run if the tenant ID is missing or resolves to a different tenant.

### 4.3 Import order

The new import is deterministic and re-runnable only after reset. Because BoMs may reference other BoMs and preps may reference BoMs, use a two-pass graph import:

1. catalog categories;
2. ingredients with canonical units and opening stock;
3. create BoM headers and prep headers, collecting stable external keys;
4. resolve and insert all BoM components and prep `source_bom_id` references;
5. validate the complete graph, including indirect `bom → prep → source_bom` cycles;
6. menu items and explicit menu components;
7. supplier links and purchasing metadata;
8. optional initial prep stock through production runs, not direct silent stock writes;
9. final validation report.

Import failures must roll back the entire catalog import. The importer must reject:

- unknown component IDs;
- unit incompatibility;
- duplicate names within a tenant;
- recursive cycles;
- prep references without a source BoM;
- menu component quantities that cannot be normalized;
- active menu components pointing at inactive targets.

---

## 5. Legacy elimination map

This is part of the same plan, not a follow-up migration. Every phase below must remove the corresponding legacy dependency before the phase is considered complete.

### 5.1 Database/schema removal

Remove from `schema.ts` and the hard-cut database:

- `menu_item_ingredients`;
- `menu_item_bom_requirements`;
- `menu_item_prep_requirements`;
- `prep_item_components`;
- `prep_items.ingredient_id`;
- `prep_items.quantity_per_unit`;
- the old ambiguous `prep_items.bom_id` semantics, replaced by `source_bom_id`;
- `bom_items.is_pre_batched` and `bom_items.stock_quantity` if present in any environment;
- `bom_items.is_container` unless separately justified;
- legacy `menuItemModifiers`, `menuModifierOptions.bomId`, `defaultContainerId`, and category-pool inventory references from the Franks catalog path;
- any shadow-BoM naming convention or generated shadow rows.

Keep and normalize:

- `bom_items`;
- `bom_components`;
- `prep_items` as the optional materialized output;
- `menu_item_components`;
- `order_stock_impacts`;
- `inventory_unit_conversions`;
- `stock_movements`;
- the new production-run tables.

### 5.2 API/repository removal

`apps/api/src/repository/inventory.repository.ts`:

- delete `shadowBomName`, `findShadowBoMId`, `syncShadowBoM`;
- remove all reads/writes to the three legacy menu recipe tables;
- remove all reads/writes to `prepItemComponents`;
- replace prep creation/update with `sourceBomId` only;
- make BoM component validation traverse both direct BoM edges and prep source-BOM edges;
- validate recursive BoM references and target units in one service;
- make `createMenuProduct` the only menu creation path for inventory mode;
- make menu component mapping read only `menuItemComponents`;
- make menu/prep production use the same recursive resolver.

`apps/api/src/repository/app.repository.ts`:

- remove legacy menu recipe reads from public menu, admin mapping, food cost and order creation;
- remove all legacy order deduction branches;
- remove shadow BoM helpers and calls;
- remove legacy recipe writes from menu update methods;
- remove `menuModifierOptions.bomId`, `defaultContainerId`, legacy `menuItemModifiers` and category-pool inventory links from the Franks catalog path;
- if modifiers are required later, reintroduce them only as explicit `ingredient | bom | prep` component edges;
- keep `orderStockImpacts` as the sole source for canonical cancellation and quantity adjustment;
- resolve direct menu BoMs to final ingredient/prep impacts before order persistence.

### 5.3 API/controller/client contracts

Remove or replace:

- `createMenuItem` for inventory catalog creation;
- `replaceMenuItemRecipe`;
- `addMenuItemRecipeComponent`;
- `removeMenuItemRecipeComponent`;
- payloads with `recipe` split across legacy tables;
- prep payloads with optional `ingredientId`, optional `bomId`, and `quantityPerUnit`;
- `componentType` contracts that omit `bom` where the new menu flow must support it.

Keep one menu product contract with:

```ts
componentType: 'ingredient' | 'bom' | 'prep'
```

Keep separate contracts for:

- creating/updating a BoM formula;
- creating a materialized prep from a BoM;
- producing prep quantity;
- creating a menu product atomically.

### 5.4 Web/UI removal

`apps/web/src/components/inventory/product-builder`:

- remove separate persistence from `CreateIngredientInlineModal` and `CreatePrepInlineModal`;
- inline ingredient creation may produce drafts passed to the atomic menu-product request;
- inline BoM creation is not part of the first menu transaction: BoMs are authored and validated in the dedicated formula workflow before they can be selected by a menu product;
- inline prep creation is allowed only when it references an existing validated source BoM in the same atomic menu request;
- remove shadow-BoM creation from `FoodProductModal`;
- make the component selector expose ingredient, BoM and prep explicitly;
- show the resolved canonical unit beside every component;
- reject incompatible unit input before submit.

`MenuItemsTab` and route wiring:

- inventory product creation uses only `createMenuProduct`;
- legacy menu create/recipe actions are removed from props, store and routes;
- edits replace the entire canonical component set atomically, or use one canonical update endpoint;
- the normal navigation presents menu creation as the primary workflow.

BoM/prep UI:

- retain recursive BoM editing functionality, but remove the old parallel menu recipe workflow;
- prep management becomes “materialized stock from BoM” plus production;
- do not expose a separate legacy prep recipe editor;
- if a standalone BoM tab remains, it is an advanced formula editor, not a second menu-building path.

`FoodCostMatrix`:

- rebuild from canonical menu components and recursive resolution;
- distinguish direct ingredient cost, direct prep stock cost and expanded BoM theoretical cost;
- never query the deleted menu recipe tables.

### 5.5 Seed/import/docs/tests removal

- replace `apps/api/src/db/seed.ts` legacy tenant data with canonical fixture data or remove it from Franks import;
- remove `tenant_legacy` catalog assumptions from the new importer;
- update `docs/compose/specs/franks-menu-parse.md` to emit canonical ingredient/BoM/prep/menu records;
- retire tests that assert legacy table reads;
- retain and expand recursive BoM tests;
- add end-to-end tests for direct ingredient, direct BoM, stockable prep and nested prep use;
- add a valid duplicate-prep case: two differently named prep stock identities may reference the same source BoM;
- add invalid mixed-cycle cases: bom → prep → source_bom and bom → bom → prep → source_bom.

### 5.6 Destructive-operation integrity guards

Before deleting or changing the active/unit state of a catalog object, the API must run tenant-scoped reference checks across both canonical edge tables and recursive source relationships. Required cases:

```text
ingredient → bom_components / menu_item_components
bom        → bom_components / menu_item_components / prep_items.source_bom_id
prep       → bom_components / menu_item_components
```

The API must reject destructive operations with a clear dependency error, or perform an explicit transactional replacement. There must be no endpoint that deletes a polymorphic target and relies on database cascades to clean unknown references.

### 5.7 Completion gate for legacy removal

Before implementation is marked complete, run a repository search and require zero production-code matches for:

```text
menuItemIngredients
menuItemBomRequirements
menuItemPrepRequirements
prepItemComponents
shadowBomName
syncShadowBoM
isPreBatched
quantityPerUnit
menuModifierOptions.bomId
legacy defaultContainerId stock deduction
```

The only allowed matches should be historical documentation explicitly marked as superseded, or the migration/reset test fixtures that verify the old tables are absent.

---

## 6. Execution phases

### Phase 1 — Freeze and target contracts

- [ ] Add this plan to the repository.
- [ ] Mark current compatibility edits as superseded; do not extend them.
- [ ] Define canonical unit and component contracts.
- [ ] Define one target-aware normalization service for ingredient, BoM and prep component edges.
- [ ] Define recursive resolver input/output types.
- [ ] Define production and order impact response contracts.
- [ ] Add pure tests for unit normalization and cycle detection.

**Exit gate:** Contracts express `ingredient | bom | prep`; no menu contract uses the three legacy recipe shapes.

### Phase 2 — Schema hard cut

- [ ] Modify `apps/api/src/db/schema.ts` to target tables/columns.
- [ ] Remove legacy table definitions and ambiguous prep fields.
- [ ] Add checks, indexes, unique constraints and RLS for canonical tables.
- [ ] Add production-run tables.
- [ ] Generate migration with Drizzle.
- [ ] Review generated SQL and apply to a disposable database.
- [ ] Add reset/import scripts.

**Exit gate:** Fresh database has only the canonical catalog schema; Franks reset produces an empty catalog with preserved operational identity.

### Phase 3 — Recursive domain engine

- [ ] Implement a single recursive resolver for `ingredient | bom | prep`.
- [ ] Resolve quantities against each target's canonical/output unit.
- [ ] Detect cycles, inactive targets, missing targets and incompatible units.
- [ ] Implement production from `prep.source_bom_id`.
- [ ] Ensure production consumes prep stock for explicit `prep` nodes and expands explicit `bom` nodes.
- [ ] Implement final stock impact collection for menu sale.
- [ ] Persist production and order impacts transactionally.

**Exit gate:** The same resolver semantics are used by production, sale simulation, food cost and validation.

### Phase 4 — Atomic menu-first workflow

- [ ] Rewrite `createMenuProduct` to create inline ingredients, menu item and canonical components in one transaction.
- [ ] Keep BoM authoring as a separate explicit formula workflow in the first hard-cut release. The menu transaction references an existing, already validated BoM or an existing prep; it does not create inline BoM headers.
- [ ] Remove `inlinePreps` from the first menu payload unless the prep is created atomically with a pre-existing source BoM. Do not allow a menu save to create an unvalidated formula graph.
- [ ] Normalize all component quantities before persistence.
- [ ] Remove all shadow-BoM logic.
- [ ] Remove legacy menu endpoints and repository branches.
- [ ] Remove legacy modifier/container stock paths from the Franks catalog, or rewrite them as explicit canonical component edges before enabling the module.
- [ ] Replace menu admin/public mapping with canonical-only reads.
- [ ] Rework menu edit to atomically replace canonical components.

**Exit gate:** Creating Cheese Burger from the menu builder creates no rows outside canonical tables.

### Phase 5 — UI and import

- [ ] Make menu creation the primary inventory entry point.
- [ ] Add explicit component type selection: ingredient, BoM, prep.
- [ ] Add recursive BoM editor usable inside/alongside menu creation.
- [ ] Add prep materialization and production screen.
- [ ] Remove legacy tabs/actions that create parallel recipes.
- [ ] Implement and run the Franks import.
- [ ] Generate an import report with counts, normalized units, rejected rows and unresolved references.

**Exit gate:** Admin can create and validate the complete examples in Section 7 without touching a legacy screen.

### Phase 6 — Order, cancellation and quantity validation

- [ ] Make sale deduction canonical-only.
- [ ] Persist final ingredient/prep impacts for every sold line.
- [ ] Restore exactly those impacts on cancellation.
- [ ] Update impacts and stock atomically on quantity changes.
- [ ] Reject changes to paid/cancelled orders.
- [ ] Test duplicate menu lines, direct BoM lines, prep lines and mixed lines.

**Exit gate:** Every stock-changing order has complete persisted impacts; no legacy item can enter the new order path.

### Phase 7 — Verification and cleanup

- [ ] Run the legacy search completion gate.
- [ ] Run shared build, API/web typechecks and API tests.
- [ ] Run migration on a clean PostgreSQL database.
- [ ] Run reset/import twice and confirm deterministic results.
- [ ] Run end-to-end inventory scenarios.
- [ ] Have code review inspect schema, resolver, reset safety and legacy removal.

Required commands:

```bash
npm run build --workspace @gustopos/shared
npm run lint --workspace @gustopos/api
npm run lint --workspace @gustopos/web
npm test --workspace @gustopos/api
npm run db:generate --workspace @gustopos/api
npm run db:migrate --workspace @gustopos/api
```

---

## 7. Final validation examples

### 7.1 Cheese Burger with stockable patty and direct ingredients

Ingredients:

```text
Pane       200 pz
Manzo      10 kg
Sale       500 g
Formaggio  2 kg
Lattuga    3 kg
```

BoM:

```text
Patty formula
output: 1 pz
- Manzo: 0.150 kg
- Sale: 0.002 kg
```

Prep:

```text
Patty Burger
source_bom: Patty formula
stock: 20 pz
```

Menu:

```text
Cheese Burger
- Pane: 1 pz
- Patty Burger: 1 pz       // prep
- Formaggio: 0.020 kg      // 20 g normalized to kg
- Lattuga: 0.015 kg        // 15 g normalized to kg
```

Production of 20 patties:

```text
Manzo: 10.000 kg → 7.000 kg
Sale: 0.500 kg → 0.460 kg
Patty Burger: 0 pz → 20 pz
```

Sale of two Cheese Burgers:

```text
Pane: 200 → 198
Patty Burger: 20 → 18
Formaggio: 2.000 → 1.960 kg
Lattuga: 3.000 → 2.970 kg
```

The order stores four final impacts. Cancellation restores exactly those four quantities.

### 7.2 Cheeseburger with direct, non-stockable sauce BoM

BoM:

```text
Salsa espressa
output: 1 kg
- Pomodoro: 0.800 kg
- Olio: 0.200 kg
```

Menu component:

```text
Salsa espressa: 0.030 kg  // bom, not prep
```

Sale of one burger resolves:

```text
Pomodoro: -0.024 kg
Olio: -0.006 kg
```

No sauce stock is created or consumed.

### 7.3 Same formula materialized as prep

Create:

```text
Prep Salsa
source_bom: Salsa espressa
stock: 5 kg
```

Change the menu component explicitly to:

```text
Prep Salsa: 0.030 kg  // prep
```

Sale now consumes:

```text
Prep Salsa: 5.000 → 4.970 kg
```

The system must not silently switch between `bom` and `prep` based on availability.

### 7.4 Recursive BoM with a prep boundary

```text
BoM Mix A+B
- A: 0.700 kg
- B: 0.300 kg

Prep Mix A+B
stock: 10 kg

BoM Mix C
- Prep Mix A+B: 1 kg
- C: 0.200 kg
```

Producing a separate `Prep Mix C` consumes stock of `Prep Mix A+B`. It does not explode A and B.

If `BoM Mix C` instead references `BoM Mix A+B`, it recursively consumes A and B. The reference type controls the behavior.

### 7.5 Direct simple ingredient with conversion

```text
Ingredient Mozzarella
canonical unit: kg

Menu input: 80 g
Persisted edge: 0.080 kg
```

The sale engine never needs to interpret `g` for this edge again.

### 7.6 Invalid cases that must fail

- A BoM references itself directly or through a cycle.
- A prep references an inactive or missing source BoM.
- A menu references a missing/inactive component.
- A `prep` edge uses a quantity that cannot convert to the prep output unit.
- A direct BoM has an invalid yield.
- Production lacks stock for an ingredient or explicit prep input.
- A sale lacks stock for a direct ingredient, explicit prep, or recursively resolved component.
- A legacy table/row is present in Franks after reset/import.
- A menu product is created partially; atomic transaction must leave no orphan records.
- A BoM references a prep whose source graph leads back to that BoM.
- Two distinct prep names reference the same source BoM; this is valid and produces independent stock.
- A BoM references a prep whose source graph leads back to that BoM.
- Two distinct prep names reference the same source BoM; this is valid and produces independent stock.

---

## 8. Final acceptance criteria

The hard cut is complete only when all statements are true:

- Franks has zero catalog rows before import.
- The importer creates only canonical catalog rows.
- No production code reads or writes the legacy recipe/prep tables.
- No shadow BoM is generated.
- Every menu component is explicitly typed as ingredient, BoM or prep.
- Every persisted recipe quantity is in its target canonical/output unit.
- BoM recursion is cycle-safe and shared by production/sale simulation/food cost.
- A BoM can be used directly without stock.
- A BoM can optionally be materialized as a prep with independent stock.
- A prep never has an alternate legacy recipe representation.
- Multiple named preps may reference the same source BoM and maintain independent stock.
- Multiple named preps may reference the same source BoM and maintain independent stock.
- Every stock-changing sale has immutable final order impacts.
- Cancellation and quantity changes restore/adjust exact impacts.
- The Cheese Burger and all examples in Section 7 pass end-to-end.
- Shared build, API/web typechecks, API tests, migration and import verification pass.
