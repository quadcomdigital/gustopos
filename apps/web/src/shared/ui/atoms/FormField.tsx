import { useId, type ReactNode } from 'react';
import { cn } from '../../../lib/utils';

interface FormFieldProps {
  label: string;
  error?: string;
  children: ReactNode;
  required?: boolean;
  className?: string;
  htmlFor?: string;
}

export default function FormField({ label, error, children, required, className, htmlFor }: FormFieldProps) {
  const autoId = useId();
  const fieldId = htmlFor ?? autoId;
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={fieldId} className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-[9px] text-danger font-medium">{error}</p>}
    </div>
  );
}
