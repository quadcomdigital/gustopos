import { useId, type ReactNode } from 'react';
import { cn } from '../../../lib/utils';

interface FieldProps {
  /** Visible label text */
  label: string;
  /** Optional validation/error message. When set, renders a `<p>` below the input and the
   * caller is expected to set `aria-describedby={errorId}` on the child control (via render-prop). */
  error?: string;
  /** Shows a red asterisk next to the label */
  required?: boolean;
  /** Override auto-generated id. Defaults to `React.useId()`. */
  htmlFor?: string;
  /** Render-prop: receives the stable id so the caller can wire `id={id}` and (optionally) `aria-describedby={errorId}` on the control. */
  children: (props: { id: string; errorId: string }) => ReactNode;
  className?: string;
  /** Optional hint shown in italics below the input, before the error message */
  hint?: string;
}

/**
 * Accessible form-field wrapper. Encapsulates the boilerplate of:
 *   <label htmlFor={id}>{label}</label>
 *   <input id={id} aria-describedby={errorId} />
 *   {error && <p id={errorId}>{error}</p>}
 *
 * Use the children-as-function form to wire the id onto either a raw `<input>` or
 * a custom control (e.g. SearchableSelect, UnitSelect) that forwards `id` to a
 * focusable element.
 *
 * Replaces the legacy `molecules/FormField` (no htmlFor) — see ESLint audit iter 3.
 */
export default function Field({ label, error, required: requiredByUser, htmlFor, children, className, hint }: FieldProps) {
  const autoId = useId();
  const id = htmlFor ?? autoId;
  const errorId = `${id}-error`;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label
        htmlFor={id}
        className="text-[10px] font-bold uppercase tracking-widest text-text-muted"
      >
        {label}
        {requiredByUser && <span className="text-danger ml-0.5" aria-hidden="true">*</span>}
      </label>
      {children({ id, errorId })}
      {hint && !error && (
        <p className="text-[9px] text-text-muted italic">{hint}</p>
      )}
      {error && (
        <p id={errorId} className="text-[9px] text-danger font-medium" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
