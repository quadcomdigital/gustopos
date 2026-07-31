import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  dirty?: boolean;
}

export default function Modal({ open, onClose, title, children, footer, size = 'md', dirty = false }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  // eslint-disable-next-line react-hooks/refs -- latest-ref pattern avoids stale callbacks in async paths
  onCloseRef.current = onClose;
  const dirtyRef = useRef(dirty);
  // eslint-disable-next-line react-hooks/refs -- latest-ref pattern avoids stale `dirty` reads in ESC handler
  dirtyRef.current = dirty;

  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Reset confirm state when modal closes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- [controlled-reset] resets confirm state when modal closes; setter receives constant primitive, no stale-closure risk
    if (!open) setConfirmDiscard(false);
  }, [open]);

  const handleClose = useCallback(() => {
    if (dirtyRef.current && !confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    setConfirmDiscard(false);
    onCloseRef.current();
  }, [confirmDiscard]);

  const handleBackdropClick = useCallback(() => {
    handleClose();
  }, [handleClose]);

  const handleConfirmDiscard = useCallback(() => {
    setConfirmDiscard(false);
    onCloseRef.current();
  }, []);

  const handleCancelDiscard = useCallback(() => {
    setConfirmDiscard(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    const timer = setTimeout(() => {
      dialogRef.current?.focus();
    }, 50);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previousFocusRef.current?.focus();
    };
  }, [open, handleClose]);

  const widthClass = size === 'sm' ? 'sm:max-w-sm' : size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-lg';

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleBackdropClick}
          />
          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className={cn('relative bg-white w-full rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[88vh] sm:max-h-[85vh] flex flex-col overflow-hidden outline-none', widthClass)}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-primary truncate">{title}</p>
                {dirty && (
                  <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-300">
                    Modificato
                  </span>
                )}
              </div>
              <button onClick={handleClose} className="p-1.5 hover:bg-bg rounded-full transition-colors text-text-muted shrink-0" aria-label="Chiudi">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {children}
            </div>
            {footer && (
              <div className="flex items-center justify-end shrink-0 p-4 border-t border-border">
                {footer}
              </div>
            )}

            {/* Discard confirmation overlay */}
            <AnimatePresence>
              {confirmDiscard && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-10 flex items-center justify-center bg-white/95 backdrop-blur-sm rounded-t-2xl sm:rounded-2xl"
                >
                  <div className="flex flex-col items-center gap-4 px-6 py-8 text-center max-w-xs">
                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                      <AlertTriangle size={24} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-primary">Modifiche non salvate</p>
                      <p className="text-xs text-text-muted mt-1">Vuoi scartare le modifiche?</p>
                    </div>
                    <div className="flex gap-2 w-full">
                      <button
                        onClick={handleCancelDiscard}
                        className="flex-1 min-h-[44px] px-4 py-2 rounded border border-border text-xs font-bold uppercase tracking-wider"
                      >
                        Continua
                      </button>
                      <button
                        onClick={handleConfirmDiscard}
                        className="flex-1 min-h-[44px] px-4 py-2 rounded bg-danger text-white text-xs font-bold uppercase tracking-wider"
                      >
                        Scarta
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
