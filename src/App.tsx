import React, { useState } from 'react';
import { 
  BarChart3,
  LayoutDashboard, 
  ShoppingCart, 
  ChefHat, 
  Package, 
  Users, 
  Settings,
  Bell,
  Search,
  User,
  Utensils
} from 'lucide-react';
import { useStore } from './store';
import POSView from './components/POSView';
import KitchenView from './components/KitchenView';
import InventoryView from './components/InventoryView';
import DashboardView from './components/DashboardView';
import TablesView from './components/TablesView';
import LoginView from './components/LoginView';
import { cn } from './lib/utils';
import { Staff } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pos' | 'kitchen' | 'inventory' | 'staff' | 'tables'>('tables');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<Staff | null>(null);
  const { data, loading, createOrder, updateOrder, payTable } = useStore();

  const handleLogin = (user: Staff) => {
    setCurrentUser(user);
    if (user.role === 'chef') setActiveTab('kitchen');
    else if (user.role === 'waiter') setActiveTab('tables');
    else setActiveTab('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedTable(null);
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-text-muted font-medium animate-pulse">Caricamento GustoPOS...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView staff={data.staff} onLogin={handleLogin} />;
  }

  const allTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, roles: ['admin', 'waiter'] },
    { id: 'tables', label: 'Tavoli', icon: Utensils, roles: ['admin', 'waiter'] },
    { id: 'pos', label: 'Cassa', icon: ShoppingCart, roles: ['admin', 'waiter'] },
    { id: 'kitchen', label: 'Cucina', icon: ChefHat, roles: ['admin', 'chef'] },
    { id: 'inventory', label: 'Magazzino', icon: Package, roles: ['admin', 'chef'] },
    { id: 'staff', label: 'Staff', icon: Users, roles: ['admin'] },
  ];

  const filteredTabs = allTabs.filter(tab => 
    currentUser.role.toLowerCase() === 'admin' || 
    currentUser.role.toLowerCase() === 'manager' ||
    tab.roles.includes(currentUser.role.toLowerCase())
  );

  const handleSelectTable = (tableNumber: string) => {
    setSelectedTable(tableNumber);
    setActiveTab('pos');
  };

  const pendingOrdersCount = data.orders.filter(o => o.status !== 'served' && o.status !== 'paid').length;

  return (
    <div className="flex flex-col h-[100dvh] bg-bg text-text-main font-sans overflow-hidden">
      {/* Top Navigation */}
      <header className="h-14 md:h-16 bg-primary text-white flex items-center justify-between px-4 md:px-6 shadow-md z-50 shrink-0">
        <div className="flex items-center gap-2">
          <div className="font-bold text-lg md:text-xl tracking-wider flex items-center gap-2">
            GUSTOPOS <span className="font-light opacity-70 text-xs md:text-sm hidden sm:inline">| ENTERPRISE</span>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 text-[10px] md:text-xs">
          <div className="hidden xs:flex px-2 md:px-3 py-1 rounded-full bg-white/15 items-center gap-1 md:gap-2">
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-400 rounded-full animate-pulse" />
            <span>Online</span>
          </div>
          <div className="px-2 md:px-3 py-1 rounded-full bg-white/15 flex items-center gap-1 md:gap-2">
            <span className="md:hidden">⏰</span>
            <span className="hidden md:inline">Ora:</span>
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <button 
            onClick={handleLogout}
            className="px-2 md:px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 transition-colors flex items-center gap-1 md:gap-2"
          >
            <span className="md:hidden">👤</span>
            <span className="hidden md:inline">Utente:</span>
            <span className="font-bold">{currentUser.name}</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar - Desktop Only */}
        <nav className="hidden md:flex w-20 bg-white border-r border-border flex-col items-center py-6 gap-6 z-40">
          {filteredTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                title={tab.label}
                className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200",
                  isActive 
                    ? "bg-accent text-white shadow-sm" 
                    : "text-secondary hover:bg-bg"
                )}
              >
                <Icon size={22} />
              </button>
            );
          })}
          <div className="mt-auto">
            <button className="w-11 h-11 rounded-xl flex items-center justify-center text-secondary hover:bg-bg transition-colors">
              <Settings size={22} />
            </button>
          </div>
        </nav>

        {/* Workspace Container */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          {activeTab === 'tables' && (
            <TablesView 
              data={data} 
              onSelectTable={handleSelectTable} 
              onPayTable={payTable} 
            />
          )}
          {activeTab === 'pos' && (
            <POSView 
              data={data} 
              createOrder={createOrder} 
              payTable={payTable}
              initialTable={selectedTable || '1'} 
            />
          )}
          {activeTab === 'kitchen' && <KitchenView orders={data.orders} updateOrder={updateOrder} />}
          {activeTab === 'inventory' && <InventoryView inventory={data.inventory} />}
          {activeTab === 'dashboard' && <DashboardView data={data} />}
          {activeTab === 'staff' && (
            <div className="flex flex-col items-center justify-center h-full text-text-muted">
              <Users size={48} className="mb-4 opacity-20" />
              <p className="text-lg font-medium">Gestione Personale in arrivo</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation - Mobile Only */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-border z-[999] flex shadow-[0_-4px_10px_rgba(0,0,0,0.1)]">
        {(filteredTabs.length > 0 ? filteredTabs : allTabs).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 transition-all relative",
                isActive ? "text-accent bg-accent/5" : "text-text-muted hover:bg-gray-50"
              )}
            >
              <Icon size={22} className={cn("transition-transform", isActive && "scale-110")} />
              <span className="text-[8px] font-bold uppercase tracking-tighter text-center px-0.5">{tab.label}</span>
              {isActive && <div className="absolute top-0 left-0 right-0 h-0.5 bg-accent" />}
            </button>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex-1 flex flex-col items-center justify-center gap-1 text-danger hover:bg-red-50 transition-all border-l border-border"
        >
          <User size={22} />
          <span className="text-[8px] font-bold uppercase tracking-tighter">Esci</span>
        </button>
      </div>

      {/* Footer Stats - Desktop Only */}
      <footer className="hidden md:flex h-12 bg-white border-t border-border items-center px-6 gap-8 text-[13px] text-text-muted shrink-0">
        <div className="flex gap-1">Coperti Totali: <strong className="text-primary">15 / 42</strong></div>
        <div className="flex gap-1">Incasso Orario: <strong className="text-primary">317,50€</strong></div>
        <div className="flex gap-1">Ordini in Attesa: <strong className="text-primary">{pendingOrdersCount}</strong></div>
        <div className="ml-auto text-accent font-semibold">V 2.4.0-Enterprise Build</div>
      </footer>
    </div>
  );
}
