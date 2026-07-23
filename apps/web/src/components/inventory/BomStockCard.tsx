import { useState, useEffect } from "react";
import { fetchBomStock, prepareBom } from "../../shared/api/client";
import Button from "../../shared/ui/atoms/Button";
import Skeleton from "../../shared/ui/atoms/Skeleton";

interface BomStockItem {
  id: string;
  name: string;
  stockQuantity: number;
  unit: string;
}

export default function BomStockCard() {
  const [stock, setStock] = useState<BomStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState<string | null>(null);

  const loadStock = async () => {
    try {
      const data = await fetchBomStock();
      setStock(data);
    } catch (e) {
      console.error("Failed to load BOM stock", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStock();
  }, []);

  const handlePrepare = async (bomId: string, quantity: number) => {
    setPreparing(bomId);
    try {
      await prepareBom(bomId, quantity);
      await loadStock();
    } catch (e: any) {
      alert(e.message || "Errore nella preparazione");
    } finally {
      setPreparing(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border p-4">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  if (stock.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border p-4">
      <h3 className="font-semibold text-sm mb-3">Preparazioni</h3>
      <div className="space-y-3">
        {stock.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
          >
            <div>
              <div className="font-medium text-sm">{item.name}</div>
              <div className="text-xs text-gray-500">
                Stock: <span className={item.stockQuantity === 0 ? "text-red-600 font-bold" : ""}>{item.stockQuantity}</span> {item.unit}
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handlePrepare(item.id, 1)}
                disabled={preparing === item.id}
              >
                +1
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handlePrepare(item.id, 5)}
                disabled={preparing === item.id}
              >
                +5
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handlePrepare(item.id, 10)}
                disabled={preparing === item.id}
              >
                +10
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
