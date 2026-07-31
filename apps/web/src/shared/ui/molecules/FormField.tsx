import type { ReactNode } from 'react';
import { cn } from '../../../lib/utils';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Standardised form field wrapping a label, children (input/select/etc), and
 * a conditional error message. Replaces the repetitive:
 *
 *   <div className="flex flex-col gap-1">
 *     <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">X</label>
 *     <input ... />
 *     {error && <p className="text-[9px] text-danger">...</p>}
 *   </div>
 */
export default function FormField({ label, error, required: isRequired, className, children }: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block">
        {label}
        {isRequired && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-[9px] text-danger mt-0.5">{error}</p>}
    </div>
  );
}
