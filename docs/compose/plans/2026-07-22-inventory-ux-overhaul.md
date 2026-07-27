# Inventory UX Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform inventory modals from developer-grade to enterprise-grade UX across 15 improvement areas.

**Architecture:** Each task is independent — they touch different files/components. Priority 1 (dirty state) modifies the shared Modal component, so it must come first. All others can be done in parallel after that.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, motion/react (framer-motion), lucide-react icons.

## Global Constraints
- All touch targets must be ≥44px (`min-h-[44px]`)
- Italian locale for all user-facing strings
- No new npm dependencies — use existing patterns
- Mobile-first responsive (768px breakpoint)
- Follow existing design tokens: `bg`, `bg-bg`, `text-primary`, `text-secondary`, `text-text-muted`, `border-border`, `accent`

---

### Task 1: Dirty-State Protection on Modals (Priority 1)

**Files:**
- Create: `apps/web/src/shared/ui/hooks/useDirtyState.ts`
- Modify: `apps/web/src/shared/ui/molecules/Modal.tsx`
- Modify: `apps/web/src/components/inventory/IngredientsTab.tsx` (edit modal)
- Modify: `apps/web/src/components/inventory/BomTab.tsx` (edit modal)
- Modify: `apps/web/src/components/inventory/MenuItemsTab.tsx` (edit modal)
- Modify: `apps/web/src/components/inventory/CategoriesTab.tsx` (edit modal)

**Approach:** Create a `useDirtyState` hook that tracks snapshot vs current values. Add a `dirty` prop to Modal that shows a warning on close/escape if dirty. Replace `window.confirm` with ConfirmDialog for discard.

- [ ] Create `useDirtyState.ts` hook
- [ ] Add `dirty` prop + confirmation to Modal
- [ ] Wire into all 4 inventory edit modals
- [ ] Build & verify

### Task 2: Inline Validation on All Forms (Priority 2)

**Files:**
- Modify: `apps/web/src/components/inventory/IngredientsTab.tsx`
- Modify: `apps/web/src/components/inventory/BomTab.tsx`
- Modify: `apps/web/src/components/inventory/MenuItemsTab.tsx`
- Modify: `apps/web/src/components/inventory/CategoriesTab.tsx`

**Approach:** Add field-level validation state, red borders on invalid fields, inline error text. Disable create button until valid.

- [ ] IngredientsTab create + edit forms
- [ ] BomTab create form
- [ ] MenuItemsTab create + edit forms
- [ ] CategoriesTab create + edit forms
- [ ] Build & verify

### Task 3: Collapsible Create Forms (Priority 3)

**Files:**
- Modify: `apps/web/src/components/inventory/IngredientsTab.tsx`
- Modify: `apps/web/src/components/inventory/BomTab.tsx`
- Modify: `apps/web/src/components/inventory/MenuItemsTab.tsx`
- Modify: `apps/web/src/components/inventory/CategoriesTab.tsx`

**Approach:** Replace always-open create form with a "+ Nuovo" button that expands/collapses the form. Use framer-motion for smooth expand animation.

- [ ] IngredientsTab
- [ ] BomTab
- [ ] MenuItemsTab
- [ ] CategoriesTab
- [ ] Build & verify

### Task 4: Replace window.confirm with ConfirmDialog (Priority 4)

**Files:**
- Modify: `apps/web/src/components/inventory/IngredientsTab.tsx`
- Modify: `apps/web/src/components/inventory/BomTab.tsx`
- Modify: `apps/web/src/components/inventory/MenuItemsTab.tsx`
- Modify: `apps/web/src/components/inventory/CategoriesTab.tsx`

**Approach:** Replace all `window.confirm(...)` calls with a state-driven `ConfirmDialog` component. Add undo toast pattern via a `useToast` hook.

- [ ] Create `useToast.ts` hook + Toast component
- [ ] Replace all window.confirm calls
- [ ] Build & verify

### Task 5: Group Form Inputs into Logical Sections (Priority 5)

**Files:**
- Modify: `apps/web/src/components/inventory/IngredientsTab.tsx`
- Modify: `apps/web/src/components/inventory/BomTab.tsx`

**Approach:** Wrap related inputs in `<fieldset>` sections with `<legend>` headers. Use subtle bg/spacing to visually separate sections. Groups: "Anagrafica", "Magazzino", "Prezzi", "Opzioni".

- [ ] IngredientsTab create + edit
- [ ] BomTab create + edit
- [ ] Build & verify

### Task 6: Stock Adjust Modal with Current Stock + Preview

**Files:**
- Modify: `apps/web/src/components/inventory/IngredientsTab.tsx` (adjust modal)

**Approach:** Show current stock prominently, calculate and display resulting stock, add reason code dropdown.

- [ ] Enhance adjust modal UI
- [ ] Build & verify

### Task 7: BOM Edit — Unified Save Behavior

**Files:**
- Modify: `apps/web/src/components/inventory/BomTab.tsx`

**Approach:** Track dirty state on recipe changes. Show "Modifiche non salvate" indicator. Single Save button for all changes.

- [ ] Implement unified save for BOM edit
- [ ] Build & verify

### Task 8: Keyboard Shortcuts for List Navigation

**Files:**
- Modify: `apps/web/src/components/inventory/IngredientsTab.tsx`
- Modify: `apps/web/src/components/inventory/BomTab.tsx`

**Approach:** Add `useEffect` with keydown listener. ArrowUp/Down to navigate, Enter to open edit, N for new, Delete to delete selected.

- [ ] IngredientsTab keyboard nav
- [ ] BomTab keyboard nav
- [ ] Build & verify

### Task 9: Inline Category Editing (Replace Modal)

**Files:**
- Modify: `apps/web/src/components/inventory/CategoriesTab.tsx`

**Approach:** Replace edit modal with inline editing — click name to edit in place. Keep print area toggles inline.

- [ ] Implement inline category editing
- [ ] Build & verify

### Task 10: Split MenuItems Modal into Focused Views

**Files:**
- Modify: `apps/web/src/components/inventory/MenuItemsTab.tsx`

**Approach:** Keep tabbed modal but add "Unsaved changes" indicator per tab. Each tab has its own Save button. Add dirty tracking per tab.

- [ ] Add per-tab dirty tracking
- [ ] Build & verify

### Task 11: Styled ConfirmDialog + Undo Toast

**Files:**
- Create: `apps/web/src/shared/ui/molecules/Toast.tsx`
- Create: `apps/web/src/shared/ui/hooks/useToast.ts`

**Approach:** Toast component at top-right with auto-dismiss. useToast hook with `show(message, { action: { label, onClick } })` pattern.

- [ ] Create Toast component
- [ ] Create useToast hook
- [ ] Build & verify

### Task 12: Unit Dropdown with Autocomplete

**Files:**
- Create: `apps/web/src/shared/ui/molecules/UnitSelect.tsx`
- Modify: `apps/web/src/components/inventory/IngredientsTab.tsx`
- Modify: `apps/web/src/components/inventory/BomTab.tsx`
- Modify: `apps/web/src/components/inventory/RecipeBuilder.tsx`
- Modify: `apps/web/src/components/inventory/ComponentPicker.tsx`

**Approach:** Dropdown with predefined units (kg, g, L, ml, pz, bt, mt, cl, lt). Allow custom input via `<datalist>`.

- [ ] Create UnitSelect component
- [ ] Replace free-text unit inputs
- [ ] Build & verify

### Task 13: Native HTML5 Input Semantics

**Files:**
- Modify: `apps/web/src/components/inventory/IngredientsTab.tsx`
- Modify: `apps/web/src/components/inventory/BomTab.tsx`
- Modify: `apps/web/src/components/inventory/MenuItemsTab.tsx`

**Approach:** Change numeric inputs to `inputMode="decimal"`, add `aria-label`, add `min="0"` where appropriate.

- [ ] Fix all numeric inputs
- [ ] Build & verify

### Task 14: Bulk Operations on Inventory Lists

**Files:**
- Modify: `apps/web/src/components/inventory/IngredientsTab.tsx`
- Modify: `apps/web/src/components/inventory/BomTab.tsx`

**Approach:** Add checkbox column, "Select all" header checkbox, bulk action bar when items selected (Deactivate, Delete, Change Category).

- [ ] IngredientsTab bulk ops
- [ ] BomTab bulk ops
- [ ] Build & verify

### Task 15: Drag-to-Reorder in RecipeBuilder

**Files:**
- Modify: `apps/web/src/components/inventory/RecipeBuilder.tsx`

**Approach:** Add up/down arrow buttons on each recipe row for reordering (no new deps — simple array move).

- [ ] Add reorder controls
- [ ] Build & verify

---

## Execution Order

Tasks 1-5 are highest impact. Tasks 6-15 can be done in parallel. Recommended execution:
1. Task 1 (Modal dirty state) — foundation for everything
2. Tasks 2-5 in parallel (validation, collapsible, confirm, sections)
3. Tasks 6-15 in parallel
