import { useState, type ReactNode } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { unlockDashboard } from '../shared/api/client';
import { isDashboardUnlocked, setDashboardUnlocked } from '../lib/dashboard-unlock';
import { cn } from '../lib/utils';

interface DashboardGateProps {
  staffId: string;
  staffName: string;
  /** Rendered only when unlocked; `lock` re-arms the gate immediately. */
  children: (controls: { lock: () => void }) => ReactNode;
}

export default function DashboardGate({ staffId, staffName, children }: DashboardGateProps) {
  const [unlocked, setUnlocked] = useState(() => isDashboardUnlocked(staffId));
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const lock = () => {
    setDashboardUnlocked(staffId, false);
    setPin('');
    setError('');
    setUnlocked(false);
  };

  const submit = async (candidate: string) => {
    setVerifying(true);
    try {
      await unlockDashboard(candidate);
      setDashboardUnlocked(staffId, true);
      setPin('');
      setError('');
      setUnlocked(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(/too many/i.test(message) ? 'Troppi tentativi, attendi un minuto' : 'PIN errato');
      setPin('');
    } finally {
      setVerifying(false);
    }
  };

  const handleDigit = (digit: string) => {
    if (verifying || pin.length >= 4) return;
    const next = pin + digit;
    setError('');
    setPin(next);
    if (next.length === 4) {
      void submit(next);
    }
  };

  if (unlocked) {
    return <>{children({ lock })}</>;
  }

  return (
    <div className="h-full flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white border border-border rounded-2xl p-6 flex flex-col items-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-white">
          <Lock size={26} />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-lg font-bold text-primary uppercase tracking-tight">Pannello protetto</h2>
          <p className="text-xs text-text-muted">
            Inserisci il PIN di <span className="font-bold text-secondary">{staffName}</span> per aprire la dashboard.
          </p>
        </div>

        <div className="flex gap-4" aria-hidden="true">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={`gate-dot-${index}`}
              className={cn(
                'w-4 h-4 rounded-full border-2 transition-all duration-200',
                pin.length > index ? 'bg-accent border-accent scale-110' : 'border-border',
                error && 'bg-danger border-danger',
                verifying && 'animate-pulse',
              )}
            />
          ))}
        </div>

        <p
          role="status"
          aria-live="polite"
          className={cn('text-[10px] font-bold uppercase tracking-widest h-4', error ? 'text-danger' : 'text-text-muted')}
        >
          {error || (verifying ? 'Verifica...' : '')}
        </p>

        <div className="grid grid-cols-3 gap-2.5 w-full">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigit(String(num))}
              disabled={verifying}
              className="w-full aspect-square rounded-xl bg-white border border-border text-xl font-bold text-primary hover:bg-accent hover:text-white hover:border-accent transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setPin(''); setError(''); }}
            disabled={verifying}
            className="w-full aspect-square rounded-xl bg-white border border-border text-[10px] font-bold text-danger hover:bg-danger hover:text-white hover:border-danger transition-all active:scale-95 disabled:opacity-50 uppercase flex items-center justify-center"
          >
            Canc
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            disabled={verifying}
            className="w-full aspect-square rounded-xl bg-white border border-border text-xl font-bold text-primary hover:bg-accent hover:text-white hover:border-accent transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center"
          >
            0
          </button>
          <div className="w-full aspect-square flex items-center justify-center text-text-muted opacity-20">
            <ShieldCheck size={22} />
          </div>
        </div>
      </div>
    </div>
  );
}
