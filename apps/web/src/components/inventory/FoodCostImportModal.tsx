import { useState, useCallback } from 'react';
import Modal from '../../shared/ui/molecules/Modal';
import { FileSpreadsheet, Check, AlertTriangle } from 'lucide-react';

interface ImportResult {
  costsUpdated: number;
  costsSkipped: number;
  recipesImported: number;
  recipesSkipped: number;
  costMatches: Array<{ xlsxName: string; matchedTo: string; unitCost: number }>;
  recipeMatches: Array<{ ingredient: string; menuItem: string; qty: number }>;
  errors: string[];
}

interface FoodCostImportModalProps {
  open: boolean;
  onClose: () => void;
  onImportXlsx: (xlsxBase64: string) => Promise<ImportResult>;
}

export default function FoodCostImportModal({
  open,
  onClose,
  onImportXlsx,
}: FoodCostImportModalProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setError(null);
    setImportResult(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      const result = await onImportXlsx(base64);
      setImportResult(result);
    } catch (err) {
      setError(`Import fallito: ${(err as Error).message}`);
    } finally {
      setIsImporting(false);
    }
    e.target.value = '';
  }, [onImportXlsx]);

  const handleClose = useCallback(() => {
    setImportResult(null);
    setError(null);
    onClose();
  }, [onClose]);

  return (
    <Modal open={open} onClose={handleClose} title="Importa Food Cost da Excel">
      <div className="p-4 max-w-2xl">

        {/* File upload */}
        <div className="mb-4">
          <label className="block text-xs text-text-muted mb-1.5">File XLSX</label>
          <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-border/50 rounded-lg cursor-pointer hover:border-border/80">
            <FileSpreadsheet className="w-5 h-5 text-text-muted" />
            <span className="text-sm text-text-muted">
              Seleziona file Excel con ingredienti e ricette...
            </span>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
              disabled={isImporting}
            />
          </label>
        </div>

        {/* Import indicator */}
        {isImporting && (
          <div className="mb-4 p-3 bg-bg border border-border/50 rounded-lg text-center">
            <div className="text-sm text-text-muted">Importazione in corso...</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-danger-500/10 border border-danger-500/20 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-danger-500 mt-0.5" />
            <span className="text-sm text-danger-500">{error}</span>
          </div>
        )}

        {/* Import result */}
        {importResult && (
          <div className="mb-4 space-y-3">
            {/* Cost matches */}
            {importResult.costMatches.length > 0 && (
              <div className="p-3 bg-bg border border-border/50 rounded-lg">
                <div className="text-xs font-medium text-text mb-1">
                  <Check className="w-3.5 h-3.5 inline text-success-500 mr-1" />
                  {importResult.costsUpdated} costi ingredienti aggiornati
                </div>
                <div className="max-h-40 overflow-y-auto text-xs">
                  <table className="w-full">
                    <thead>
                      <tr className="text-text-muted">
                        <th className="text-left py-0.5">Nome xlsx</th>
                        <th className="text-left py-0.5">Mappato a</th>
                        <th className="text-right py-0.5">Costo/porzione</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.costMatches.map((m, i) => (
                        <tr key={i} className="border-t border-border/20">
                          <td className="py-0.5 text-text-muted">{m.xlsxName}</td>
                          <td className="py-0.5 text-text">{m.matchedTo}</td>
                          <td className="py-0.5 text-right text-text">€{m.unitCost.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recipe matches summary */}
            {importResult.recipesImported > 0 && (
              <div className="p-3 bg-bg border border-border/50 rounded-lg">
                <div className="text-xs font-medium text-text">
                  <Check className="w-3.5 h-3.5 inline text-success-500 mr-1" />
                  {importResult.recipesImported} ricette importate
                  {importResult.recipesSkipped > 0 && (
                    <span className="text-warning-500 ml-2">({importResult.recipesSkipped} saltate)</span>
                  )}
                </div>
              </div>
            )}

            {/* Errors */}
            {importResult.errors.length > 0 && (
              <div className="p-3 bg-danger-500/10 border border-danger-500/20 rounded-lg max-h-40 overflow-y-auto">
                {importResult.errors.slice(0, 30).map((err, i) => (
                  <div key={i} className="text-xs text-danger-500">{err}</div>
                ))}
                {importResult.errors.length > 30 && (
                  <div className="text-xs text-danger-500 mt-1">...e altri {importResult.errors.length - 30}</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-text-muted hover:text-text"
          >
            {importResult ? 'Chiudi' : 'Annulla'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
