import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Conferma',
  cancelLabel = 'Annulla',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    confirmButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} aria-label="Chiudi conferma" />
      <div className="relative w-full max-w-sm md:max-w-md bg-white border border-border rounded-xl shadow-2xl p-4 space-y-3 max-h-[95dvh] overflow-y-auto">
        <h3 className="text-sm font-bold text-secondary uppercase tracking-wider">{title}</h3>
        <p className="text-sm text-text-muted">{message}</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onCancel} className="min-h-[44px] px-3 py-2.5 rounded border border-border text-xs font-bold uppercase tracking-wider">
            {cancelLabel}
          </button>
          <button ref={confirmButtonRef} onClick={onConfirm} className="min-h-[44px] px-3 py-2.5 rounded bg-primary text-white text-xs font-bold uppercase tracking-wider">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
