import React, { useState } from 'react';
import { Staff } from '@gustopos/shared';
import { Lock, User, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

interface LoginViewProps {
  staff: Staff[];
  onLogin: (staffId: string, pin: string) => Promise<boolean>;
}

export default function LoginView({ staff, onLogin }: LoginViewProps) {
  const [selectedUser, setSelectedUser] = useState<Staff | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handlePinClick = async (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        if (selectedUser && (await onLogin(selectedUser.id, newPin))) {
          setPin("");
        } else {
          setError(true);
          setTimeout(() => {
            setPin('');
            setError(false);
          }, 1000);
        }
      }
    }
  };

  const handleClear = () => setPin('');

  return (
    <div className="fixed inset-0 bg-primary flex items-center justify-center p-0 md:p-4 z-[200]">
      <div className="w-full h-full md:h-auto md:max-w-4xl grid grid-cols-1 md:grid-cols-2 bg-white md:rounded-3xl shadow-2xl overflow-hidden">
        {/* Left Side: User Selection (Hidden on mobile if user selected) */}
        <div className={cn(
          "p-6 md:p-12 border-b md:border-b-0 md:border-r border-border flex flex-col transition-all duration-300",
          selectedUser ? "hidden md:flex" : "flex h-full md:h-auto"
        )}>
          <div className="mb-8 md:mb-12 text-center md:text-left shrink-0">
            <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">GUSTOPOS</h1>
            <p className="text-[10px] md:text-sm text-text-muted font-medium uppercase tracking-widest">Enterprise Management</p>
          </div>

          <div className="flex-1 space-y-3 md:space-y-4 overflow-y-auto pr-1 no-scrollbar">
            <h2 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-4">Seleziona Operatore</h2>
            <div className="grid grid-cols-1 gap-3">
              {staff.map((user) => (
                <button
                  key={user.id}
                  onClick={() => {
                    setSelectedUser(user);
                    setPin('');
                  }}
                  className={cn(
                    "w-full p-4 md:p-5 rounded-2xl border-2 transition-all flex items-center justify-between group",
                    selectedUser?.id === user.id
                      ? "border-accent bg-accent/5"
                      : "border-transparent bg-bg hover:bg-gray-100"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm",
                      user.role === 'admin' ? "bg-primary" : user.role === 'chef' ? "bg-amber-500" : "bg-accent"
                    )}>
                      <User size={24} />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-primary text-base md:text-lg">{user.name}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{user.role}</p>
                    </div>
                  </div>
                  <ChevronRight size={20} className={cn(
                    "transition-transform",
                    selectedUser?.id === user.id ? "text-accent translate-x-1" : "text-text-muted"
                  )} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: PIN Pad (Full screen on mobile if user selected) */}
        <div className={cn(
          "p-6 md:p-12 bg-bg/30 flex flex-col items-center justify-center transition-all duration-300",
          selectedUser ? "flex h-full md:h-auto" : "hidden md:flex"
        )}>
          {selectedUser ? (
              <div className="w-full max-w-[320px] flex flex-col items-center animate-fadeIn">
                {/* Mobile Back Button */}
                <button 
                  onClick={() => setSelectedUser(null)}
                  className="md:hidden absolute top-6 left-6 flex items-center gap-2 text-accent font-bold text-xs uppercase tracking-widest"
                >
                  <ChevronRight size={16} className="rotate-180" />
                  Indietro
                </button>

                <div className="mb-8 md:mb-12 text-center">
                  <div className={cn(
                    "w-16 h-16 md:w-20 md:h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white shadow-lg",
                    selectedUser.role === 'admin' ? "bg-primary" : selectedUser.role === 'chef' ? "bg-amber-500" : "bg-accent"
                  )}>
                    <User size={32} />
                  </div>
                  <p className="text-xs md:text-sm font-medium text-text-muted mb-1">Benvenuto,</p>
                  <p className="text-xl md:text-2xl font-bold text-primary">{selectedUser.name}</p>
                </div>

                {/* PIN Display */}
                <div className="flex gap-4 mb-8 md:mb-12">
                  {[0, 1, 2, 3].map((digitIndex) => (
                    <div
                      key={`pin-dot-${digitIndex}`}
                      className={cn(
                        "w-4 h-4 md:w-5 md:h-5 rounded-full border-2 transition-all duration-200",
                        pin.length > digitIndex ? "bg-accent border-accent scale-110" : "border-border",
                        error && "bg-danger border-danger animate-shake"
                      )}
                    />
                  ))}
                </div>

                {error && (
                  <p className="text-xs font-bold text-danger uppercase tracking-widest mb-6 animate-pulse">
                    PIN Errato. Riprova.
                  </p>
                )}

                {/* Number Pad */}
                <div className="grid grid-cols-3 gap-3 md:gap-4 w-full">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      onClick={() => handlePinClick(num.toString())}
                      className="w-full aspect-square rounded-2xl bg-white border border-border text-xl md:text-2xl font-bold text-primary hover:bg-accent hover:text-white hover:border-accent transition-all active:scale-95 shadow-sm flex items-center justify-center"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    onClick={handleClear}
                    className="w-full aspect-square rounded-2xl bg-white border border-border text-[10px] md:text-xs font-bold text-danger hover:bg-danger hover:text-white hover:border-danger transition-all active:scale-95 shadow-sm uppercase flex items-center justify-center"
                  >
                    Canc
                  </button>
                  <button
                    onClick={() => handlePinClick('0')}
                    className="w-full aspect-square rounded-2xl bg-white border border-border text-xl md:text-2xl font-bold text-primary hover:bg-accent hover:text-white hover:border-accent transition-all active:scale-95 shadow-sm flex items-center justify-center"
                  >
                    0
                  </button>
                  <div className="w-full aspect-square flex items-center justify-center text-text-muted opacity-20">
                    <Lock size={24} />
                  </div>
                </div>
              </div>
          ) : (
            <div className="text-center opacity-40">
              <User size={64} className="mx-auto mb-4" />
              <p className="font-bold uppercase tracking-widest text-sm">Seleziona un operatore</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
