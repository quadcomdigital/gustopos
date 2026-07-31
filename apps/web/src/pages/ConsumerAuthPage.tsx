import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ConsumerUser } from '@gustopos/shared';
import {
  fetchConsumerMe,
  getConsumerAccessToken,
  loginConsumer,
  logoutConsumer,
  registerConsumer,
} from '../shared/api/client';

type AuthMode = 'login' | 'register';

export default function ConsumerAuthPage() {
  const { tenantSlug = '' } = useParams();
  const navigate = useNavigate();

  const [initialLoading, setInitialLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  // Authenticated user
  const [consumerUser, setConsumerUser] = useState<ConsumerUser | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    if (!tenantSlug || !getConsumerAccessToken(tenantSlug)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- [auth-check] sets loading=false on auth check result; setter receives constant primitive, no cascading risk
      setInitialLoading(false);
      return;
    }

    void fetchConsumerMe(tenantSlug)
      .then((user) => {
        setConsumerUser(user);
      })
      .catch(() => {
        setConsumerUser(null);
      })
      .finally(() => {
        setInitialLoading(false);
      });
  }, [tenantSlug]);

  const hasContactInfo = email.trim().length > 0 || phone.trim().length > 0;

  const canSubmit = authMode === 'register'
    ? fullName.trim().length >= 2 && hasContactInfo && password.length >= 6 && !authLoading
    : hasContactInfo && password.length >= 6 && !authLoading;

  const submitAuth = async () => {
    if (!tenantSlug || !canSubmit) {
      return;
    }

    try {
      setAuthLoading(true);
      setAuthError('');

      const result = authMode === 'register'
        ? await registerConsumer(tenantSlug, {
            fullName: fullName.trim(),
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
            password,
          })
        : await loginConsumer(tenantSlug, {
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
            password,
          });

      setConsumerUser(result.user);
      setPassword('');
    } catch (submitError) {
      setAuthError(submitError instanceof Error ? submitError.message : 'Autenticazione non riuscita');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!tenantSlug) {
      return;
    }

    await logoutConsumer(tenantSlug).catch(() => undefined);
    setConsumerUser(null);
    setFullName('');
    setEmail('');
    setPhone('');
    setPassword('');
  };

  const handleNavigateToOrders = () => {
    if (tenantSlug) {
      navigate(`/${tenantSlug}/account/orders`);
    }
  };

  const _toggleAuthMode = () => {
    setAuthMode((current) => current === 'login' ? 'register' : 'login');
    setAuthError('');
    setPassword('');
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="animate-pulse text-slate-600 text-sm font-medium">Caricamento...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Account</h1>
          <p className="text-sm text-slate-500 mt-1">
            {consumerUser
              ? 'Gestisci il tuo profilo'
              : authMode === 'login'
                ? 'Accedi al tuo account'
                : 'Crea un nuovo account'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {consumerUser ? (
            /* ─── Profile View ─── */
            <div className="p-6 space-y-6">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
                  <span className="text-xl font-bold text-slate-500">
                    {consumerUser.fullName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-800">{consumerUser.fullName}</h2>
                {consumerUser.email && (
                  <p className="text-sm text-slate-500">{consumerUser.email}</p>
                )}
                {consumerUser.phone && (
                  <p className="text-sm text-slate-500">{consumerUser.phone}</p>
                )}
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleNavigateToOrders}
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 text-white text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors"
                >
                  Visualizza Ordini
                </button>
                <button
                  onClick={() => void handleLogout()}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-widest hover:bg-slate-50 transition-colors"
                >
                  Esci
                </button>
              </div>
            </div>
          ) : (
            /* ─── Auth Form ─── */
            <div className="p-6 space-y-4">
              {/* Mode Toggle */}
              <div className="flex bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => { setAuthMode('login'); setAuthError(''); setPassword(''); }}
                  className={`flex-1 px-3 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all ${
                    authMode === 'login'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Accedi
                </button>
                <button
                  onClick={() => { setAuthMode('register'); setAuthError(''); setPassword(''); }}
                  className={`flex-1 px-3 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all ${
                    authMode === 'register'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Registrati
                </button>
              </div>

              {/* Register: Full Name */}
              {authMode === 'register' && (
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Nome e cognome"
                  className="w-full px-3 py-2 rounded border border-slate-300 text-sm min-h-[2.5rem]"
                />
              )}

              {/* Email */}
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                className="w-full px-3 py-2 rounded border border-slate-300 text-sm min-h-[2.5rem]"
              />

              {/* Phone */}
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Telefono"
                className="w-full px-3 py-2 rounded border border-slate-300 text-sm min-h-[2.5rem]"
              />

              {/* Contact hint */}
              <p className="text-[11px] text-slate-400 -mt-2">
                Inserisci email <strong>oppure</strong> telefono
              </p>

              {/* Password */}
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password (min. 6 caratteri)"
                className="w-full px-3 py-2 rounded border border-slate-300 text-sm min-h-[2.5rem]"
              />

              {/* Error */}
              {authError && (
                <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  {authError}
                </p>
              )}

              {/* Submit */}
              <button
                onClick={() => void submitAuth()}
                disabled={!canSubmit}
                className="w-full px-4 py-3 rounded-xl bg-slate-900 text-white text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {authLoading ? 'Attendi...' : authMode === 'login' ? 'Accedi' : 'Registrati'}
              </button>
            </div>
          )}
        </div>

        {/* Footer link back to menu */}
        {tenantSlug && (
          <div className="text-center mt-6">
            <button
              onClick={() => navigate(`/${tenantSlug}/menu`)}
              className="text-xs text-slate-500 underline hover:text-slate-700 transition-colors"
            >
              Torna al menu
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
