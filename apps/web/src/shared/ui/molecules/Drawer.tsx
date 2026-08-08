import { useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { lockBodyScroll, unlockBodyScroll } from '../utils/scrollLock';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: 'md' | 'lg';
}

export default function Drawer({ open, onClose, title, children, width = 'md' }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    const timer = setTimeout(() => {
      panelRef.current?.focus();
    }, 50);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
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
    lockBodyScroll();
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
      unlockBodyScroll();
      previousFocusRef.current?.focus();
    };
  }, [open, onClose]);

  const widthClass = width === 'lg' ? 'max-w-lg' : 'max-w-md';

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[1200] flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className={cn('relative bg-white w-full h-full shadow-2xl flex flex-col overflow-hidden outline-none', widthClass)}
          >
            <div className="flex items-center justify-between px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] md:pt-3 pb-3 border-b border-border shrink-0">
              <p className="text-xs font-bold uppercase tracking-widest text-primary truncate">{title}</p>
              <button onClick={onClose} className="min-w-[44px] min-h-[44px] flex items-center justify-center p-1.5 hover:bg-bg rounded-full transition-colors text-text-muted shrink-0" aria-label="Chiudi">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
