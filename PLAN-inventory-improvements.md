# Inventory System — Detailed Improvement Plan

## Context

The inventory system has been recently refactored: `prepareIngredient()` removed, `prep_items` table created, all creation forms migrated to modals. The backend fully supports prep items (CRUD + prepare), but the frontend has critical gaps where prep items are invisible in recipe editing.

---

## Phase 1 — P0: Connect Prep Items to Recipes

These are the most impactful fixes. Without them, the prep item system is half-built.

### 1.1 Add "Prep" option to ComponentPicker

**File**: `apps/web/src/components/inventory/ComponentPicker.tsx`

**Current**: `type` prop is `'ingredient' | 'bom'`. The `<select>` on line 95-102 only has two `<option>`s.

**Change**:
- Extend the `type` prop to `'ingredient' | 'bom' | 'prep'`
- Add `<option value="prep">Prep</option>` to the select
- The `candidates` prop already receives the right data from callers — just need callers to pass prep items

### 1.2 Add "Prep" option to RecipeBuilder

**File**: `apps/web/src/components/inventory/RecipeBuilder.tsx`

**Current**: `type` state on line 24 is `useState<'ingredient' | 'bom'>('ingredient')`. The `candidates` memo on line 32-45 only handles `'ingredient'` and `'bom'`.

**Change**:
- Extend `type` state to `'ingredient' | 'bom' | 'prep'`
- Add a new `prepItems` prop (type `PrepItem[]`)
- In the `candidates` memo, add a third branch: when `type === 'prep'`, map from `prepItems` to `{ id, label: item.name, unit: item.unit, stockLevel: item.stockQuantity }`
- Update `estimatedCost` memo to handle `componentType === 'prep'` — look up the prep item's ingredient and multiply `quantity * quantityPerUnit * ingredient.unitCost`

**Prop additions**: `prepItems: PrepItem[]`

### 1.3 Pass prepItems to RecipeBuilder from BomTab

**File**: `apps/web/src/components/inventory/BomTab.tsx`

**Current**: Line 464-483 — `RecipeBuilder` receives `inventory` and `bomItems` but no `prepItems`.

**Change**:
- Add `prepItems` prop to `BomTabProps`
- Pass `prepItems={prepItems}` to the `RecipeBuilder` on line 464
- In the create modal (line 562-606), add "Prep" to the `<select>` and extend `createComponentType` state to include `'prep'`
- Extend `createComponentCandidates` memo (line 122-127) to handle `createComponentType === 'prep'`

**Caller**: `InventoryTabs.tsx` line 339-351 needs to pass `prepItems` to `BomTab`. The store already has `prepItems` state.

### 1.4 Pass prepItems to RecipeBuilder from MenuItemsTab

**File**: `apps/web/src/components/inventory/MenuItemsTab.tsx`

**Current**: Line 498-504 — `RecipeBuilder` in the edit modal receives `inventory` and `bomItems` but no `prepItems`. Same issue in the create modal (line 610-617).

**Change**:
- Add `prepItems` prop to `MenuItemsTabProps`
- Pass `prepItems={prepItems}` to both `RecipeBuilder` instances (edit and create modals)

**Caller**: `InventoryTabs.tsx` line 354-370 needs to pass `prepItems` to `MenuItemsTab`.

### 1.5 Pass prepItems to RecipeBuilder from ProductEditor

**File**: `apps/web/src/components/inventory/ProductEditor.tsx`

**Current**: Line 204 — `ComponentPicker` receives `menuRecipeCandidates` which only maps from `inventory`. No prep items.

**Change**:
- Add `prepItems` prop to `ProductEditorProps`
- Extend `menuRecipeCandidates` to include prep items (or pass them separately to `ComponentPicker`)
- Since `ComponentPicker` is used inline here, the simplest approach: add a `prepCandidates` prop to `ProductEditor` and merge them into the candidates list when `recipeType === 'prep'`

### 1.6 Wire prepItems through InventoryTabs

**File**: `apps/web/src/components/inventory/InventoryTabs.tsx`

**Current**: `PrepView` receives only `inventory` (line 403-407). `BomTab` and `MenuItemsTab` don't receive `prepItems`.

**Change**:
- Add `prepItems` to `InventoryTabsProps` (already has the type available from store)
- Pass `prepItems={prepItems}` to `BomTab`, `MenuItemsTab`, and `PrepView`
- The caller (`InventoryView.tsx`) already loads prep items into the store

### 1.7 Update RecipeTreeView for prep items

**File**: `apps/web/src/components/inventory/RecipeTreeView.tsx`

**Current**: Line 93-94 shows label "Ingred" or "BoM" — missing "Prep". Line 41-43 `getName` doesn't handle prep items.

**Change**:
- Add `prepItems` prop (or accept them via the existing `inventory`-like pattern)
- In `getName`, add a branch: `if (componentType === 'prep') return prepNameById.get(componentId) ?? componentId`
- Update the label on line 93-94 to handle `'prep'` → "Prep"
- In `TreeNode`, add an expandable branch for prep items if they have sub-ingredients (or just show them as leaf nodes with a different icon)

---

## Phase 2 — P1: Prep Item Management & Cost Accuracy

### 2.1 Add edit/delete to PrepView

**File**: `apps/web/src/components/inventory/PrepView.tsx`

**Current**: No edit or delete UI for existing prep items. The API supports `updatePrepItem` and `deletePrepItem`.

**Change**:
- Add an edit modal (similar pattern to IngredientsTab): state `selectedPrepItemId`, form fields for `name`, `quantityPerUnit`, `unit`
- Add a delete button with confirmation (`useConfirm` hook)
- Add an actions column to each prep item row: "Modifica" and "Elimina" buttons
- On mobile: add to the expanded details section

### 2.2 Add prep history/log

**File**: `apps/web/src/components/inventory/PrepView.tsx`

**Current**: No history view. The old `PreparationHistory.tsx` was deleted.

**Change**:
- Add a `prepHistory` state, populated from `preparePrepItem` responses (the API returns `previousStock` and `newStock`)
- Show a collapsible "Cronologia" section at the bottom of each ingredient group
- Or: add a "Cronologia" tab/section in the PrepView header
- Since there's no dedicated history API endpoint, store history in local state (session only) or add a simple in-component log

### 2.3 Fix BoM cost calculation

**File**: `apps/web/src/components/inventory/BomTab.tsx` (lines 318-325)
**File**: `apps/web/src/components/inventory/BomCards.tsx` (lines 33-39)

**Current**: Cost calculation only sums `componentType === 'ingredient'` costs. BoM sub-components and prep items are ignored.

**Change**:
- Create a helper function `explodeBomCost(bomId, bomItems, inventory, prepItems)` that recursively sums costs
- For `ingredient` components: `quantity * unitCost`
- For `bom` components: recursively explode the sub-BoM
- For `prep` components: `quantity * quantityPerUnit * ingredient.unitCost`
- Use this helper in both `BomTab` table rows and `BomCards`

### 2.4 Fix RecipeBuilder estimated cost

**File**: `apps/web/src/components/inventory/RecipeBuilder.tsx` (lines 72-82)

**Current**: `estimatedCost` only handles `ingredient` type.

**Change**:
- Add handling for `bom` type: look up the BoM, sum its component costs (use the same `explodeBomCost` helper)
- Add handling for `prep` type: `quantity * quantityPerUnit * ingredient.unitCost`

### 2.5 Fix ProductEditor estimated cost

**File**: `apps/web/src/components/inventory/ProductEditor.tsx` (lines 91-100)

**Current**: Same issue — only sums ingredient costs.

**Change**: Same fix as 2.4, using the shared helper.

### 2.6 Add margin warning in MenuItemsTab create modal

**File**: `apps/web/src/components/inventory/MenuItemsTab.tsx`

**Current**: The create modal has no cost/price comparison. The edit modal (via `ProductEditor`) has `marginWarning`.

**Change**:
- Add `estimatedCost` calculation to the create modal
- Show a warning when `estimatedCost > Number(newPrice)` like `ProductEditor` does

---

## Phase 3 — P2: UX Polish

### 3.1 Visual stock indicators

**Files**: `IngredientsTab.tsx`, `PrepView.tsx`

**Change**:
- Replace plain number display with a progress bar: `current / (threshold * 2)` or similar
- Green when above threshold, amber when near, red when below
- Simple implementation: a `<div>` with `width` percentage and color class

### 3.2 Mobile tab scrolling

**File**: `InventoryTabs.tsx` (lines 291-308)

**Current**: `gridTemplateColumns: repeat(7, 1fr)` on mobile — tabs are too narrow.

**Change**:
- Replace grid with horizontal flex scroll: `flex overflow-x-auto gap-1`
- Add `scroll-snap-type: x mandatory` and `scroll-snap-align: start` on each tab
- Hide scrollbar with CSS (`-webkit-scrollbar-hide`)

### 3.3 Add prep item count to summary cards

**File**: `InventoryTabs.tsx` (lines 206-239)

**Change**:
- Add a 4th summary card showing prep items count: `prepItems.length`
- Use a `ChefHat` icon, similar style to existing cards

### 3.4 Improve ± Stock button label

**File**: `apps/web/src/components/inventory/IngredientsTab.tsx` (lines 679, 829-830)

**Change**: Replace `± Stock` with `Regola scorta` for consistency with the rest of the UI.

---

## Phase 4 — P3: Accessibility

### 4.1 Add aria-labels to action buttons

**Files**: All tabs

**Change**: Add `aria-label` attributes to icon-only buttons and action buttons:
- `aria-label="Modifica ingrediente"` on Edit buttons
- `aria-label="Elimina ingrediente"` on Delete buttons
- `aria-label="Regola scorta"` on stock adjustment buttons
- `aria-label="Mostra movimenti"` on movements buttons

### 4.2 Focus trapping in modals

**File**: `apps/web/src/shared/ui/molecules/Modal.tsx`

**Change**: Implement focus trap: when modal opens, trap Tab/Shift+Tab inside. Auto-focus the first input or the modal itself. Return focus to the trigger element on close.

### 4.3 Color + icon for status pills

**Files**: `IngredientsTab.tsx`, `BomCards.tsx`, `MenuItemsTab.tsx`

**Change**: Status pills already use `StatusPill` component with `tone` prop. Verify that `StatusPill` renders an icon alongside color. If not, add a small icon (checkmark for success, warning triangle for pending).

---

## Dependency Graph

```
Phase 1 (all independent of each other, can be done in parallel):
  1.1 ComponentPicker  ← 1.2 RecipeBuilder ← 1.3 BomTab
                                            ← 1.4 MenuItemsTab
                                            ← 1.5 ProductEditor
  1.6 InventoryTabs (wiring)
  1.7 RecipeTreeView

Phase 2 (depends on Phase 1 for prep item integration):
  2.1 PrepView edit/delete
  2.2 PrepView history
  2.3-2.5 Cost calculation (can use shared helper)
  2.6 Margin warning

Phase 3 (independent):
  3.1-3.5 visual polish

Phase 4 (independent):
  4.1-4.3 accessibility
```

---

## Estimated Effort

| Phase | Files | Effort |
|-------|-------|--------|
| Phase 1 | 7 files | ~2-3 hours |
| Phase 2 | 5 files | ~2-3 hours |
| Phase 3 | 3 files | ~1 hour |
| Phase 4 | 4 files | ~1-2 hours |
| **Total** | ~12 unique files | **~6-9 hours** |

---

## Files to Modify (Complete List)

1. `apps/web/src/components/inventory/ComponentPicker.tsx` — add prep type
2. `apps/web/src/components/inventory/RecipeBuilder.tsx` — add prep support, fix cost
3. `apps/web/src/components/inventory/RecipeTreeView.tsx` — add prep rendering
4. `apps/web/src/components/inventory/BomTab.tsx` — pass prepItems, fix cost calc
5. `apps/web/src/components/inventory/BomCards.tsx` — fix cost calc, add prep labels
6. `apps/web/src/components/inventory/MenuItemsTab.tsx` — pass prepItems, add margin warning
7. `apps/web/src/components/inventory/ProductEditor.tsx` — add prep to recipe picker, fix cost
8. `apps/web/src/components/inventory/InventoryTabs.tsx` — wire prepItems, add summary card, fix mobile tabs
9. `apps/web/src/components/inventory/PrepView.tsx` — add edit/delete, add history, visual stock
10. `apps/web/src/components/inventory/IngredientsTab.tsx` — visual stock, button labels, aria
11. `apps/web/src/shared/ui/molecules/Modal.tsx` — focus trapping
12. `apps/web/src/components/inventory/InventoryView.tsx` — pass prepItems to InventoryTabs

---

## Phase 5 — Design System Audit (Frontend-Design Pass)

Mode: **Existing-codebase mode**. The inventory system has a mature design system. New work must look like it was built by the original team on a good day. Every finding below is a deviation from the existing token system or component library.

### Design Token System (extracted)

```
COLORS   --primary: #1a365d (deep navy)    --secondary: #2d3748 (dark gray-blue)
         --accent: #3182ce (blue)          --success: #38a169 (green)
         --warning: #dd6b20 (orange)       --danger: #e53e3e (red)
         --bg: #f7fafc (light gray)        --border: #e2e8f0
         --text-muted: #718096
TYPE     "Segoe UI", Helvetica, Arial, sans-serif — system stack, no web fonts
ATOMS    Button (4 variants, 3 sizes, min-h-[44px]), StatusPill (5 tones),
         EmptyState, Skeleton, SegmentedChips
MOLECULES Modal (with focus trap, dirty tracking, spring animation),
         SearchableSelect, UnitSelect, SectionHeader, Drawer
UTILS    .panel-card, .badge-*, .no-scrollbar, animate-fadeIn
```

### 5.1 Component Inconsistencies (Design Bugs)

#### 5.1.1 PrepView uses raw `<select>` instead of `UnitSelect`

**File**: `PrepView.tsx` line 423-439
**Issue**: The unit dropdown in the create modal is a native `<select>` with hardcoded `<option>` elements. Every other component uses the `UnitSelect` molecule.
**Fix**: Replace with `<UnitSelect value={createUnit} onChange={setCreateUnit} />`

#### 5.1.2 PrepView uses Loader2 spinner instead of Skeleton

**File**: `PrepView.tsx` line 246-249
**Issue**: Loading state shows a centered `Loader2` spinner. All other tabs (IngredientsTab, BomTab, MenuItemsTab) use `<Skeleton>` placeholders that match the content shape.
**Fix**: Replace spinner with skeleton rows matching the prep item card layout.

#### 5.1.3 IngredientsTab builds its own section header

**File**: `IngredientsTab.tsx` lines 382-396
**Issue**: Manually constructs a header with `px-4 py-3 border-b border-border bg-bg/40` and inline button layout. BomTab and MenuItemsTab both use the `<SectionHeader>` molecule for this.
**Fix**: Replace with `<SectionHeader title="Ingredienti Singoli" actions={...} />`

#### 5.1.4 BomTab create modal component type uses raw `<select>`

**File**: `BomTab.tsx` lines 565-572
**Issue**: The component type picker (`Ingrediente` / `BoM`) is a raw `<select>` with no styling. The `ComponentPicker` atom has its own styled select. Inconsistent with the rest of the form.
**Fix**: Either use `ComponentPicker` directly in the create modal, or style the `<select>` to match the design system (`px-3 py-2 rounded border border-border text-sm` is already close, but the raw `<option>` elements lack the uppercase tracking-wider treatment).

#### 5.1.5 StockMovementsDrawer filter buttons miss touch target

**File**: `StockMovementsDrawer.tsx` lines 44-63
**Issue**: Filter buttons use `px-2 py-1` — that's ~28px height, below the 44px minimum. `SegmentedChips` uses `min-h-[44px]`.
**Fix**: Replace with `SegmentedChips` component, or add `min-h-[44px]` to the filter buttons.

#### 5.1.6 InlineCategoryPicker create modal uses raw buttons

**File**: `InlineCategoryPicker.tsx` lines 147-154
**Issue**: The "Annulla" and "Crea" buttons are raw `<button>` elements with manual styling instead of the `<Button>` atom. The `Crea` button lacks the `border` class that `Button` applies.
**Fix**: Replace with `<Button variant="secondary">Annulla</Button>` and `<Button variant="primary">Crea</Button>`

#### 5.1.7 ConfirmDialog uses raw buttons

**File**: `ConfirmDialog.tsx` lines 48-55
**Issue**: Both buttons are raw `<button>` elements with manual classes. The confirm button uses `bg-primary` (navy) while the design system's `Button` primary variant uses `bg-accent` (blue). This creates a visual mismatch when ConfirmDialog appears near other modals.
**Fix**: Replace with `<Button variant="secondary">` and `<Button variant="danger">` (for destructive confirms) or `<Button variant="primary">` for neutral confirms.

#### 5.1.8 IngredientsTab create modal footer uses raw button

**File**: `IngredientsTab.tsx` line 457-460
**Issue**: The "Crea ingrediente" button is a raw `<Button>` but the `onClick` chains `.then()` inline. While functionally fine, the pattern differs from other modals where the create function is called directly.
**Fix**: Minor — wrap in an async handler for consistency.

### 5.2 Missing Design Patterns

#### 5.2.1 No empty state with CTA in BomTab edit modal

**File**: `BomTab.tsx` lines 464-483
**Issue**: When a BoM has no components, the `RecipeBuilder` shows the picker but no guidance. The `EmptyState` atom exists and is used in list views, but not in the recipe section.
**Fix**: When `selectedBom.components.length === 0`, show `<EmptyState icon={<Layers size={24} />} title="Nessun componente" description="Aggiungi ingredienti o BoM per creare la ricetta." />` above the `RecipeBuilder`.

#### 5.2.2 PrepView has no SectionHeader

**File**: `PrepView.tsx` lines 192-201
**Issue**: Builds its own header with `flex items-center justify-between` and inline `Button`. BomTab and MenuItemsTab use `SectionHeader`.
**Fix**: Replace with `<SectionHeader title="Preparazioni" actions={<Button variant="secondary" size="sm" onClick={...}><Plus size={14} />Nuova Variante</Button>} />`

#### 5.2.3 MenuItemsTab create modal has no field labels

**File**: `MenuItemsTab.tsx` lines 577-594
**Issue**: The create modal's first row has inputs without `<label>` elements — just `placeholder` text. The edit modal (via `ProductEditor`) and BomTab create modal both use `<label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">`.
**Fix**: Add labels above each input matching the existing pattern.

#### 5.2.4 PrepView create modal has no field labels

**File**: `PrepView.tsx` lines 373-541
**Issue**: Uses `<label>` elements but they're placed inside the form body, not consistently styled. The "Nome variante" and "Quantità per unità" labels use the correct class, but the "Unità" field uses a raw `<select>` with no label above it.
**Fix**: Add a `<label>` for the unit select, consistent with other fields.

### 5.3 Visual Hierarchy Issues

#### 5.3.1 Summary cards have inconsistent icon treatment

**File**: `InventoryTabs.tsx` lines 208-238
**Issue**: Card 1 (Articoli) uses `bg-blue-50 text-accent`, Card 2 (BoM) uses `bg-indigo-50 text-indigo-600`, Card 3 (Valore) uses `bg-green-50 text-success`. The `indigo` color is not in the design token system — it's a Tailwind default that doesn't match the palette.
**Fix**: Change Card 2 to use `bg-accent/10 text-accent` (matching the pattern of other accent elements) or use a token-consistent color.

#### 5.3.2 LowStockAlert uses amber colors not in token system

**File**: `LowStockAlert.tsx` (entire file), `IngredientsTab.tsx` lines 398-420
**Issue**: Uses `amber-50`, `amber-100`, `amber-200`, `amber-300`, `amber-600`, `amber-800` — none of these are in the design token system. The `--warning` token is `#dd6b20` (orange), not amber.
**Fix**: Replace amber classes with warning-token-based classes: `bg-orange-50`, `border-orange-300`, `text-orange-800` to match `--warning: #dd6b20`. Or add `--color-warning-bg` to the token system.

#### 5.3.3 StockMovementsDrawer uses purple not in token system

**File**: `StockMovementsDrawer.tsx` lines 18-19
**Issue**: `text-purple-600` for preparation movements — purple is not in the design token system.
**Fix**: Use `text-accent` (blue) or add a prep-specific token.

#### 5.3.4 IngredientsTab expanded row has no visual separation

**File**: `IngredientsTab.tsx` lines 690-746
**Issue**: The expanded details row uses `bg-bg/30` which is nearly invisible against the white table. The details (threshold, cost, toggles) blend into the background.
**Fix**: Add a left border accent (`border-l-2 border-accent`) or slightly darker bg (`bg-bg/60`) to make the expanded section visually distinct.

### 5.4 Mobile-Specific Design Issues

#### 5.4.1 Mobile tab grid is too cramped

**File**: `InventoryTabs.tsx` lines 291-308
**Issue**: `gridTemplateColumns: repeat(7, 1fr)` on mobile. With 7 tabs, each is ~50px wide on a 375px screen. Labels like "Mod. Categoria" and "Ingredienti" will truncate or wrap.
**Fix**: Use `flex overflow-x-auto gap-1 no-scrollbar` with `scroll-snap-type: x mandatory` on the container and `scroll-snap-align: start` on each tab button.

#### 5.4.2 IngredientsTab mobile cards missing container toggle

**File**: `IngredientsTab.tsx` lines 807-848
**Issue**: The expanded mobile card shows "Movimenti", "± Stock", "Modifica", and active toggle — but no container toggle. The desktop expanded row (line 718-733) has it.
**Fix**: Add the container toggle to the mobile expanded section.

#### 5.4.3 BomCards mobile doesn't show yield quantity

**File**: `BomCards.tsx` line 52
**Issue**: Shows `{item.yieldQuantity} {item.unit} · €{costPerUnit.toFixed(2)}/{item.unit}` — actually this IS present. No change needed. (Verified on re-read.)

### 5.5 State Coverage Gaps

#### 5.5.1 PrepView has no error state design

**File**: `PrepView.tsx` lines 219-231
**Issue**: Error state is a red banner with `XCircle` icon. This is functional but inconsistent with how other tabs handle errors — they use `ConfirmDialog` or inline validation. The error banner also lacks a retry action.
**Fix**: Add a "Riprova" button to the error banner, and consider using `toast` if available, or keep the banner but add consistent styling.

#### 5.5.2 BomTab create modal has no validation feedback

**File**: `BomTab.tsx` lines 152-181
**Issue**: `createBom()` validates name and yield, but if `newBomComponents.length === 0`, it silently returns `false` with no user feedback.
**Fix**: Show an inline message: "Aggiungi almeno un componente prima di creare il BoM." (This text already exists on line 627 but only shows after the fact.)

#### 5.5.3 MenuItemsTab create modal recipe error is a plain `<p>`

**File**: `MenuItemsTab.tsx` line 635
**Issue**: `newError` is shown as `<p className="text-xs text-danger">` — a plain red text. Other forms use the `getErrorClass` pattern with validation errors.
**Fix**: Use the same validation error pattern: set `createErrors.recipe` and display with `{createErrors.recipe && <p className="text-[9px] text-danger mt-0.5">{createErrors.recipe.message}</p>}`

### 5.6 Focus & Keyboard Gaps

#### 5.6.1 Modal focus trapping already implemented

**File**: `Modal.tsx` lines 53-88
**Finding**: The Modal component ALREADY implements focus trapping (Tab cycling, Escape to close, restore previous focus). This was listed as a P3 item in the original plan — it's already done.
**Action**: Remove 4.2 from the plan or mark as resolved.

#### 5.6.2 Drawer focus trapping already implemented

**File**: `Drawer.tsx` lines 18-50
**Finding**: Same as Modal — Drawer already has focus trapping.
**Action**: No change needed.

#### 5.6.3 ConfirmDialog lacks focus trap

**File**: `ConfirmDialog.tsx` lines 24-36
**Issue**: Only handles Escape key, no Tab trapping. Focus can escape the dialog.
**Fix**: Add Tab cycling logic matching Modal/Drawer pattern.

#### 5.6.4 IngredientsTab table checkbox missing aria-label

**File**: `IngredientsTab.tsx` lines 591-595
**Issue**: The select-all checkbox has no `aria-label`. Screen readers will announce "checkbox" with no context.
**Fix**: Add `aria-label="Seleziona tutti gli ingredienti"`

---

## Revised Estimated Effort

| Phase | Files | Effort |
|-------|-------|--------|
| Phase 1 | 7 files | ~2-3 hours |
| Phase 2 | 5 files | ~2-3 hours |
| Phase 3 | 3 files | ~1 hour |
| Phase 4 | 2 files | ~0.5 hours (4.2 already done) |
| Phase 5 | 10 files | ~2-3 hours |
| **Total** | ~15 unique files | **~8-12 hours** |

---

## Revised Files to Modify (Complete List)

1. `apps/web/src/components/inventory/ComponentPicker.tsx` — add prep type
2. `apps/web/src/components/inventory/RecipeBuilder.tsx` — add prep support, fix cost
3. `apps/web/src/components/inventory/RecipeTreeView.tsx` — add prep rendering
4. `apps/web/src/components/inventory/BomTab.tsx` — pass prepItems, fix cost calc, style component type select
5. `apps/web/src/components/inventory/BomCards.tsx` — fix cost calc, add prep labels
6. `apps/web/src/components/inventory/MenuItemsTab.tsx` — pass prepItems, add margin warning, add field labels to create modal
7. `apps/web/src/components/inventory/ProductEditor.tsx` — add prep to recipe picker, fix cost
8. `apps/web/src/components/inventory/InventoryTabs.tsx` — wire prepItems, add summary card, fix mobile tabs, fix summary card colors
9. `apps/web/src/components/inventory/PrepView.tsx` — add edit/delete, add history, use UnitSelect, use Skeleton, use SectionHeader, add field labels
10. `apps/web/src/components/inventory/IngredientsTab.tsx` — use SectionHeader, fix expanded row bg, add aria-labels, add container toggle to mobile
11. `apps/web/src/components/inventory/ConfirmDialog.tsx` — add focus trap, use Button component
12. `apps/web/src/components/inventory/InlineCategoryPicker.tsx` — use Button in create modal
13. `apps/web/src/components/inventory/StockMovementsDrawer.tsx` — use SegmentedChips, fix purple color
14. `apps/web/src/components/inventory/LowStockAlert.tsx` — fix amber colors to use warning token
15. `apps/web/src/components/inventory/InventoryView.tsx` — pass prepItems to InventoryTabs
