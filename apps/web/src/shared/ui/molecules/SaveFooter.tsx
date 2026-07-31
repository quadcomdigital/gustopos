import { Loader2 } from "lucide-react";
import Button from "../atoms/Button";

interface SaveFooterProps {
  /** Click handler for the cancel button. */
  onCancel: () => void;
  /** Click handler for the save button. */
  onSave: () => void;
  /** True while the save request is in flight. Disables both buttons and shows spinner. */
  saving: boolean;
  /** Optional extra disable (e.g. `!canSave` / `!formValid`). Combined with `saving` via `||`. */
  disabled?: boolean;
  /** Idle label (shown when not saving). Default: `'Salva'`. */
  label?: string;
  /** Loading label (shown while saving). Default: `'Salvataggio...'`. */
  loadingLabel?: string;
  /** Show Loader2 spinner next to the label. Default: `true`. */
  showSpinner?: boolean;
}

/**
 * Reusable footer for create/edit modals. Renders:
 *   Annulla (secondary)  +  Save (primary) with loading state.
 *
 * Replaces the duplicated pattern in 6 modals (Simple/Variable/FoodProduct, CreateIngredientInline,
 * CreatePrepInline, PrepView edit).
 *
 * **Layout contract**: SaveFooter's internal wrapper is `<div className="flex gap-2">` — shrink-to-fit
 * and right-aligns via the parent's `justify-end`. Designed to be used inside `<Modal>` whose footer
 * wrapper has `justify-end`. If used standalone (e.g. custom drawer), wrap in a flex parent with
 * `justify-end` or pass an explicit className override to the Save button.
 *
 * @example
 *   <Modal footer={<SaveFooter onCancel={onClose} onSave={handleSave} saving={saving} label="Crea prodotto" />}>
 */
export default function SaveFooter({
  onCancel,
  onSave,
  saving,
  disabled,
  label = "Salva",
  loadingLabel = "Salvataggio...",
  showSpinner = true,
}: SaveFooterProps) {
  return (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={onCancel} disabled={saving}>
        Annulla
      </Button>
      <Button
        variant="primary"
        onClick={onSave}
        disabled={saving || !!disabled}
      >
        {showSpinner && saving && <Loader2 size={14} className="animate-spin mr-1" />}
        {saving ? loadingLabel : label}
      </Button>
    </div>
  );
}
