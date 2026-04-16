import React, { useState, useMemo } from 'react';
import { AppData, MenuItem, OrderItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Minus, Trash2, CreditCard, Banknote, User, ShoppingCart, ChefHat, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

interface POSViewProps {
  data: AppData;
  createOrder: (order: any) => Promise<any>;
  payTable: (tableId: string) => Promise<any>;
  initialTable?: string;
}

export default function POSView({ data, createOrder, payTable, initialTable = '1' }: POSViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('Tutti');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [tableNumber, setTableNumber] = useState(initialTable);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCartMobile, setShowCartMobile] = useState(false);

  // Update table number if initialTable changes
  React.useEffect(() => {
    setTableNumber(initialTable);
  }, [initialTable]);

  const categories = useMemo(() => {
    const cats = new Set(data.menu.map(item => item.category));
    return ['Tutti', ...Array.from(cats)];
  }, [data.menu]);

  const filteredMenu = useMemo(() => {
    if (selectedCategory === 'Tutti') return data.menu;
    return data.menu.filter(item => item.category === selectedCategory);
  }, [data.menu, selectedCategory]);

  const alreadyOrdered = useMemo(() => {
    const items = data.orders
      .filter(o => o.table === tableNumber && o.status !== 'paid')
      .flatMap(o => o.items);
    
    const grouped: Record<string, OrderItem> = {};
    items.forEach(item => {
      if (grouped[item.id]) {
        grouped[item.id].quantity += item.quantity;
      } else {
        grouped[item.id] = { ...item };
      }
    });
    return Object.values(grouped);
  }, [data.orders, tableNumber]);

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.id === id) {
        const newQty = Math.max(1, i.quantity + delta);
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const alreadyOrderedTotal = alreadyOrdered.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const grandTotal = cartTotal + alreadyOrderedTotal;

  const handleSendToKitchen = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);
    try {
      await createOrder({
        table: tableNumber,
        items: cart,
        total: cartTotal,
        staffId: 's1', // Mock current user
      });
      setCart([]);
      setShowCartMobile(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePay = async () => {
    const table = data.tables.find(t => t.number === tableNumber);
    if (table) {
      setIsProcessing(true);
      try {
        await payTable(table.id);
        setCart([]);
        setShowCartMobile(false);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="flex h-full gap-4 lg:gap-8 relative">
      {/* Menu Section */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 transition-all duration-300",
        showCartMobile ? "hidden lg:flex" : "flex"
      )}>
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar flex-1 mr-4">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 md:px-6 py-2 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                  selectedCategory === cat 
                    ? 'bg-accent text-white shadow-sm' 
                    : 'bg-white text-secondary hover:bg-gray-50 border border-border'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="relative flex items-center bg-white rounded-xl border border-border shadow-sm hover:border-accent transition-colors">
            <div className="pl-3 py-2 text-[10px] font-bold text-text-muted uppercase tracking-tight border-r border-border/50 mr-2">
              Tavolo
            </div>
            <select 
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="pl-1 pr-10 py-2 bg-transparent font-bold text-accent outline-none text-sm cursor-pointer appearance-none min-w-[60px]"
            >
              {data.tables.map(t => (
                <option key={t.id} value={t.number}>
                  {t.number}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 text-accent pointer-events-none" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 overflow-y-auto pr-2">
          {filteredMenu.map(item => (
            <motion.button
              whileTap={{ scale: 0.97 }}
              key={item.id}
              onClick={() => addToCart(item)}
              className="bg-white p-3 md:p-4 rounded-xl border border-border hover:border-accent hover:shadow-md transition-all text-left flex flex-col justify-between h-32 md:h-36 group"
            >
              <div>
                <span className="text-[9px] md:text-[10px] font-bold text-accent uppercase tracking-widest mb-1 block opacity-70">
                  {item.category}
                </span>
                <h3 className="font-bold text-primary leading-tight text-sm md:text-base group-hover:text-accent transition-colors line-clamp-2">
                  {item.name}
                </h3>
              </div>
              <div className="flex items-center justify-between mt-2 md:mt-4">
                <span className="text-base md:text-lg font-extrabold text-primary">€{item.price.toFixed(2)}</span>
                <div className="w-6 h-6 md:w-7 md:h-7 bg-bg rounded-lg flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-all">
                  <Plus size={14} />
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Cart Section */}
      <div className={cn(
        "bg-white rounded-xl border border-border flex flex-col shadow-sm overflow-hidden transition-all duration-300",
        "w-full lg:w-80",
        showCartMobile ? "flex" : "hidden lg:flex"
      )}>
        <div className="p-4 md:p-5 border-b border-border bg-bg/30">
          <h2 className="text-xs md:text-sm font-bold text-primary uppercase tracking-widest mb-1">Dettaglio Tavolo {tableNumber}</h2>
          <div className="flex items-center gap-2 text-[10px] md:text-xs text-text-muted">
            <User size={12} />
            <span>Cameriere: Marco R.</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-6">
          {/* Already Ordered Section */}
          {alreadyOrdered.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-widest border-b border-border pb-1">Già Ordinati</h3>
              <div className="space-y-2">
                {alreadyOrdered.map(item => (
                  <div key={item.id} className="flex items-center justify-between opacity-60">
                    <div className="flex-1">
                      <h4 className="font-bold text-secondary text-xs">{item.name}</h4>
                      <p className="text-[10px] text-text-muted">€{item.price.toFixed(2)} x {item.quantity}</p>
                    </div>
                    <span className="text-xs font-bold">€{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Items Section */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-accent uppercase tracking-widest border-b border-accent/20 pb-1">Nuovi Articoli</h3>
            <AnimatePresence initial={false}>
              {cart.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center text-text-muted space-y-2 opacity-40">
                  <ShoppingCart size={32} />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-center">Aggiungi articoli<br/>per la cucina</p>
                </div>
              ) : (
                cart.map(item => (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    key={item.id}
                    className="flex items-center justify-between group"
                  >
                    <div className="flex-1">
                      <h4 className="font-bold text-secondary text-xs">{item.name}</h4>
                      <p className="text-[10px] text-text-muted">€{item.price.toFixed(2)} / cad</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-bg rounded p-0.5">
                        <button 
                          onClick={() => updateQuantity(item.id, -1)}
                          className="p-1 hover:bg-white rounded transition-colors"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.id, 1)}
                          className="p-1 hover:bg-white rounded transition-colors"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="p-1.5 text-text-muted hover:text-danger transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="p-4 md:p-5 bg-bg/30 border-t border-border space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] md:text-xs text-text-muted">
              <span>Subtotale Sessione</span>
              <span>€{(grandTotal * 0.9).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[10px] md:text-xs text-text-muted">
              <span>IVA (10%)</span>
              <span>€{(grandTotal * 0.1).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base md:text-lg font-bold text-primary pt-2 border-t border-border">
              <span>Totale Conto</span>
              <span>€{grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <button 
              disabled={cart.length === 0 || isProcessing}
              onClick={handleSendToKitchen}
              className="w-full flex items-center justify-center gap-2 py-4 bg-accent text-white rounded-xl hover:bg-blue-700 shadow-md transition-all disabled:opacity-50 text-sm font-bold uppercase tracking-widest"
            >
              <ChefHat size={20} />
              Invia in Cucina (€{cartTotal.toFixed(2)})
            </button>
            
            <p className="text-[10px] text-center text-text-muted font-medium uppercase tracking-tighter">
              Il pagamento viene gestito dalla Mappa Tavoli
            </p>
          </div>
          
          {/* Back to Menu on Mobile */}
          <button 
            onClick={() => setShowCartMobile(false)}
            className="lg:hidden w-full py-2 text-[10px] font-bold text-accent uppercase tracking-widest"
          >
            Torna al Menù
          </button>
        </div>
      </div>

      {/* Mobile Cart Toggle Button */}
      {!showCartMobile && (cart.length > 0 || alreadyOrdered.length > 0) && (
        <button
          onClick={() => setShowCartMobile(true)}
          className="lg:hidden fixed bottom-20 right-4 bg-accent text-white p-4 rounded-full shadow-xl z-50 flex items-center gap-2"
        >
          <div className="relative">
            <ShoppingCart size={24} />
            {(cart.length > 0) && (
              <span className="absolute -top-2 -right-2 bg-danger text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold opacity-70 uppercase leading-none mb-1">Tavolo {tableNumber}</p>
            <p className="font-bold text-sm leading-none">€{grandTotal.toFixed(2)}</p>
          </div>
        </button>
      )}
    </div>
  );
}
