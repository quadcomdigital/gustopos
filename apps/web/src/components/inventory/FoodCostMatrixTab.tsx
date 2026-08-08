import { useState, useMemo, useCallback } from 'react';
import { Download, Upload, Filter, Search, ChevronDown, ChevronRight } from 'lucide-react';
import FoodCostImportModal from './FoodCostImportModal';

interface FoodCostMatrixRow {
  menuItemId: string;
  menuItemName: string;
  category: string;
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  ingredientCost: number;
  totalCost: number;
  menuItemPrice: number;
  margin: number;
  marginPercent: number;
  recommendedPrice: number;
  status: 'ok' | 'needs_change';
}

interface FoodCostMatrixSummary {
  menuItemId: string;
  menuItemName: string;
  category: string;
  totalCost: number;
  currentPrice: number;
  recommendedPrice: number;
  margin: number;
  marginPercent: number;
  status: 'ok' | 'needs_change';
  ingredientCount: number;
}

interface FoodCostMatrixTabProps {
  matrixData: {
    rows: FoodCostMatrixRow[];
    summary: FoodCostMatrixSummary[];
  };
  onRefresh?: () => Promise<void>;
  onUpdateCell?: (menuItemId: string, ingredientId: string, quantity: number, unit: string) => Promise<void>;
  onImport?: (
    ingredientCosts: Array<{ name: string; costPerKg: number; costPerPiece: number; gramsPerPortion: number; piecesPerPortion: number }>,
    recipeRows: Array<{ ingredientName: string; menuItemName: string; quantity: number; unit: string }>,
  ) => Promise<{ costsUpdated: number; recipesImported: number; recipesSkipped: number; errors: string[] }>;
  onImportXlsx?: (xlsxBase64: string) => Promise<{
    costsUpdated: number;
    costsSkipped: number;
    recipesImported: number;
    recipesSkipped: number;
    costMatches: Array<{ xlsxName: string; matchedTo: string; unitCost: number }>;
    recipeMatches: Array<{ ingredient: string; menuItem: string; qty: number }>;
    errors: string[];
  }>;
  onExport?: () => Promise<void>;
  isLoading?: boolean;
}

export default function FoodCostMatrixTab({
  matrixData,
  onRefresh,
  onUpdateCell,
  onImport: _onImport,
  onImportXlsx,
  onExport,
  isLoading = false,
}: FoodCostMatrixTabProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ menuItemId: string; ingredientId: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(matrixData.summary.map((item) => item.category));
    return ['all', ...Array.from(cats).sort()];
  }, [matrixData.summary]);

  // Filter summary items
  const filteredSummary = useMemo(() => {
    return matrixData.summary.filter((item) => {
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchesSearch = searchQuery === '' || 
        item.menuItemName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [matrixData.summary, selectedCategory, searchQuery]);

  // Get rows for a specific menu item
  const getRowsForMenuItem = useCallback((menuItemId: string) => {
    return matrixData.rows.filter((row) => row.menuItemId === menuItemId);
  }, [matrixData.rows]);

  // Toggle expanded state
  const toggleExpanded = useCallback((menuItemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(menuItemId)) {
        next.delete(menuItemId);
      } else {
        next.add(menuItemId);
      }
      return next;
    });
  }, []);

  // Handle cell edit start
  const startEdit = useCallback((menuItemId: string, ingredientId: string, currentValue: number) => {
    setEditingCell({ menuItemId, ingredientId });
    setEditValue(String(currentValue));
  }, []);

  // Handle cell edit save
  const saveEdit = useCallback(async () => {
    if (!editingCell || !onUpdateCell) return;
    
    const newValue = parseFloat(editValue);
    if (isNaN(newValue) || newValue < 0) {
      setEditingCell(null);
      return;
    }

    const row = matrixData.rows.find(
      (r) => r.menuItemId === editingCell.menuItemId && r.ingredientId === editingCell.ingredientId,
    );
    if (!row) {
      setEditingCell(null);
      return;
    }

    try {
      await onUpdateCell(editingCell.menuItemId, editingCell.ingredientId, newValue, row.unit);
      setEditingCell(null);
    } catch (error) {
      console.error('Failed to update cell:', error);
      setEditingCell(null);
    }
  }, [editingCell, editValue, matrixData.rows, onUpdateCell]);

  // Format margin percentage
  const formatMargin = (margin: number) => {
    return `${(margin * 100).toFixed(1)}%`;
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return `€${amount.toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text-muted">Caricamento matrice food cost...</div>
      </div>
    );
  }

  if (matrixData.rows.length === 0 && matrixData.summary.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-text-muted text-center">
          <p className="text-sm font-medium mb-1">Nessun dato food cost disponibile</p>
          <p className="text-xs">Importa il file Excel con ingredienti (costi) e ricette per popolare la matrice.</p>
        </div>
        {onImportXlsx && (
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/90 flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Importa File XLSX
          </button>
        )}
        {onImportXlsx && (
          <FoodCostImportModal
            open={showImportModal}
            onClose={() => setShowImportModal(false)}
            onImportXlsx={onImportXlsx}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text">Food Cost Matrix</h2>
        <div className="flex items-center gap-2">
          {onImportXlsx && (
            <button
              onClick={() => setShowImportModal(true)}
              className="px-3 py-1.5 text-xs font-medium bg-bg border border-border/50 rounded-md hover:bg-border/20 flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Importa XLSX
            </button>
          )}
          {onExport && (
            <button
              onClick={onExport}
              className="px-3 py-1.5 text-xs font-medium bg-bg border border-border/50 rounded-md hover:bg-border/20 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Esporta XLSX
            </button>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-3 py-1.5 text-xs font-medium bg-bg border border-border/50 rounded-md hover:bg-border/20"
            >
              Aggiorna
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-text-muted" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2 py-1 text-xs bg-bg border border-border/50 rounded-md"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'Tutte le categorie' : cat}
              </option>
            ))}
          </select>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            placeholder="Cerca piatto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 pr-2 py-1 text-xs bg-bg border border-border/50 rounded-md w-48"
          />
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="p-3 bg-bg border border-border/50 rounded-lg">
          <div className="text-xs text-text-muted">Piatti Totali</div>
          <div className="text-lg font-semibold text-text">{filteredSummary.length}</div>
        </div>
        <div className="p-3 bg-bg border border-border/50 rounded-lg">
          <div className="text-xs text-text-muted">Costo Medio</div>
          <div className="text-lg font-semibold text-text">
            {formatCurrency(
              filteredSummary.reduce((sum, item) => sum + item.totalCost, 0) / (filteredSummary.length || 1),
            )}
          </div>
        </div>
        <div className="p-3 bg-bg border border-border/50 rounded-lg">
          <div className="text-xs text-text-muted">Margine Medio</div>
          <div className="text-lg font-semibold text-text">
            {formatMargin(
              filteredSummary.reduce((sum, item) => sum + item.marginPercent, 0) / (filteredSummary.length || 1),
            )}
          </div>
        </div>
        <div className="p-3 bg-bg border border-border/50 rounded-lg">
          <div className="text-xs text-text-muted">Da Correggere</div>
          <div className="text-lg font-semibold text-text">
            {filteredSummary.filter((item) => item.status === 'needs_change').length}
          </div>
        </div>
      </div>

      {/* Matrix table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left p-2 text-text-muted font-medium">Piatto</th>
              <th className="text-left p-2 text-text-muted font-medium">Categoria</th>
              <th className="text-right p-2 text-text-muted font-medium">Costo</th>
              <th className="text-right p-2 text-text-muted font-medium">Prezzo</th>
              <th className="text-right p-2 text-text-muted font-medium">Margine</th>
              <th className="text-right p-2 text-text-muted font-medium">Margine %</th>
              <th className="text-right p-2 text-text-muted font-medium">Prezzo Cons.</th>
              <th className="text-center p-2 text-text-muted font-medium">Stato</th>
              <th className="text-center p-2 text-text-muted font-medium">Dettaglio</th>
            </tr>
          </thead>
          <tbody>
            {filteredSummary.map((item) => {
              const isExpanded = expandedItems.has(item.menuItemId);
              const rows = getRowsForMenuItem(item.menuItemId);
              
              return (
                <>
                  <tr key={item.menuItemId} className="border-b border-border/30 hover:bg-border/10">
                    <td className="p-2 text-text font-medium">{item.menuItemName}</td>
                    <td className="p-2 text-text-muted">{item.category}</td>
                    <td className="p-2 text-text text-right">{formatCurrency(item.totalCost)}</td>
                    <td className="p-2 text-text text-right">{formatCurrency(item.currentPrice)}</td>
                    <td className="p-2 text-right">
                      <span className={item.margin >= 0 ? 'text-success-500' : 'text-danger-500'}>
                        {formatCurrency(item.margin)}
                      </span>
                    </td>
                    <td className="p-2 text-right">
                      <span className={item.marginPercent >= 0.6667 ? 'text-success-500' : 'text-warning-500'}>
                        {formatMargin(item.marginPercent)}
                      </span>
                    </td>
                    <td className="p-2 text-text-muted text-right">
                      {formatCurrency(item.recommendedPrice)}
                    </td>
                    <td className="p-2 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === 'ok'
                            ? 'bg-success-500/20 text-success-500'
                            : 'bg-warning-500/20 text-warning-500'
                        }`}
                      >
                        {item.status === 'ok' ? '✓ OK' : '⚠ Da Cambiare'}
                      </span>
                    </td>
                    <td className="p-2 text-center">
                      <button
                        onClick={() => toggleExpanded(item.menuItemId)}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-border/20 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                        aria-label={isExpanded ? `Comprimi dettagli ${item.menuItemName}` : `Espandi dettagli ${item.menuItemName}`}
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-text-muted" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-text-muted" />
                        )}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${item.menuItemId}-detail`}>
                      <td colSpan={9} className="p-0">
                        <div className="bg-bg/50 p-3">
                          <table className="w-full text-[11px]">
                            <thead>
                              <tr className="border-b border-border/30">
                                <th className="text-left p-1.5 text-text-muted font-medium">Ingrediente</th>
                                <th className="text-right p-1.5 text-text-muted font-medium">Quantità</th>
                                <th className="text-left p-1.5 text-text-muted font-medium">Unità</th>
                                <th className="text-right p-1.5 text-text-muted font-medium">Costo/Unità</th>
                                <th className="text-right p-1.5 text-text-muted font-medium">Costo Totale</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row) => {
                                const isEditing = 
                                  editingCell?.menuItemId === row.menuItemId && 
                                  editingCell?.ingredientId === row.ingredientId;
                                
                                return (
                                  <tr key={row.ingredientId} className="border-b border-border/20">
                                    <td className="p-1.5 text-text">{row.ingredientName}</td>
                                    <td className="p-1.5 text-right">
                                      {isEditing ? (
                                        <input
                                          type="number"
                                          value={editValue}
                                          onChange={(e) => setEditValue(e.target.value)}
                                          onBlur={saveEdit}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') saveEdit();
                                            if (e.key === 'Escape') setEditingCell(null);
                                          }}
                                          className="w-20 px-1 py-0.5 text-right bg-bg border border-border/50 rounded"
                                          autoFocus
                                        />
                                      ) : (
                                        <span
                                          className="cursor-pointer hover:bg-border/20 px-1 py-0.5 rounded"
                                          onClick={() => startEdit(row.menuItemId, row.ingredientId, row.quantity)}
                                        >
                                          {row.quantity}
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-1.5 text-text-muted">{row.unit}</td>
                                    <td className="p-1.5 text-text-muted text-right">{formatCurrency(row.ingredientCost)}</td>
                                    <td className="p-1.5 text-text text-right">{formatCurrency(row.totalCost)}</td>
                                  </tr>
                                );
                              })}
                              {rows.length === 0 && (
                                <tr>
                                  <td colSpan={5} className="p-1.5 text-text-muted text-center italic">
                                    Nessun ingrediente associato
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
      {onImportXlsx && (
        <FoodCostImportModal
          open={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImportXlsx={onImportXlsx}
        />
      )}
    </div>
  );
}
