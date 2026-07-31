import { useState } from 'react';
import LoyaltyWidget from './LoyaltyWidget';

export default function LoyaltyView() {
  const [customerId, setCustomerId] = useState('');
  const [searchId, setSearchId] = useState('');
  const [activeCustomerId, setActiveCustomerId] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchId.trim()) {
      setCustomerId(searchId.trim());
      setActiveCustomerId(searchId.trim());
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold uppercase tracking-widest text-primary">Loyalty Points</h2>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={searchId}
          onChange={(e) => setSearchId(e.target.value)}
          placeholder="ID Cliente (es. cus_xxx)"
          className="flex-1 px-3 py-2 rounded border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <button
          type="submit"
          disabled={!searchId.trim()}
          className="px-4 py-2 bg-primary text-white rounded text-sm font-bold uppercase tracking-wider disabled:opacity-50 hover:bg-primary/90 active:scale-[0.98] transition-all"
        >
          Cerca
        </button>
      </form>

      {!activeCustomerId && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-500">
            Inserisci un ID cliente per visualizzare e gestire i punti fedeltà.
          </p>
        </div>
      )}

      {activeCustomerId && (
        <LoyaltyWidget key={customerId} customerId={customerId} />
      )}
    </div>
  );
}
