import { useState } from 'react';
import type { PrintBridge } from '@gustopos/shared';

interface ConfirmDeleteBridgeModalProps {
  bridge: PrintBridge;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function ConfirmDeleteBridgeModal({
  bridge,
  onClose,
  onConfirm,
}: ConfirmDeleteBridgeModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setDeleting(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Eliminazione fallita');
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl border border-border w-full max-w-md overflow-hidden flex flex-col">
        <header className="px-5 py-4 border-b border-danger/30 bg-red-50/60 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold uppercase tracking-wider text-danger">
              Elimina stampante
            </h3>
            <p className="text-[11px] text-text-muted">
              Bridge <span className="font-mono">{bridge.name}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-border bg-white text-[11px] font-bold uppercase tracking-wider hover:bg-gray-50"
          >
            ✕
          </button>
        </header>

        <div className="px-5 py-4 space-y-3">
          {error && (
            <p className="rounded border border-danger/30 bg-red-50 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}
          <p className="text-sm text-secondary">
            Rimuovere <strong className="font-mono text-[13px]">{bridge.id}</strong> dal pool di
            stampa del tenant?
          </p>
          <ul className="space-y-1.5 text-[11px] text-text-muted list-disc pl-4">
            <li>il codice di accoppiamento viene <strong>revocato</strong>: il PC remoto non potrà più collegarsi;</li>
            <li>i job in coda su questo bridge tornano <strong>pending</strong> e saranno presi in carico da un altro bridge;</li>
            <li>per ricollegare il PC serve generare un <strong>nuovo codice</strong> dalla pagina stampa.</li>
          </ul>
        </div>

        <footer className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="px-3 py-1.5 rounded border border-border text-[11px] font-bold uppercase tracking-wider hover:bg-gray-50 disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={deleting}
            className="px-4 py-2 rounded bg-red-600 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? 'Eliminazione…' : 'Elimina bridge'}
          </button>
        </footer>
      </div>
    </div>
  );
}
