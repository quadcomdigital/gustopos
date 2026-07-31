import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/app-store';

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '\u2014';
  try {
    return new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function OnboardingSecretsPanel() {
  const onboardingSecrets = useAppStore((s) => s.onboardingSecrets);
  const refresh = useAppStore((s) => s.refreshOnboardingSecrets);
  const mint = useAppStore((s) => s.createOnboardingSecret);
  const revoke = useAppStore((s) => s.revokeOnboardingSecret);
  const enabledModules = useAppStore((s) => s.enabledModules);

  const [bridgeHint, setBridgeHint] = useState('');
  const [minted, setMinted] = useState<{ plaintext: string; suggestedBridgeId: string; bootstrapSnippet: string } | null>(null);
  const [minting, setMinting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<'plaintext' | 'snippet' | null>(null);

  useEffect(() => {
    if (enabledModules.includes('printing')) {
      void refresh();
    }
  }, [enabledModules, refresh]);

  const sorted = useMemo(() => {
    const arr = [...onboardingSecrets];
    arr.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return arr;
  }, [onboardingSecrets]);

  const handleMint = async () => {
    if (minting) return;
    setMinting(true);
    try {
      const response = await mint(bridgeHint.trim() ? { bridgeIdHint: bridgeHint.trim() } : undefined);
      setMinted({
        plaintext: response.plaintext,
        suggestedBridgeId: response.suggestedBridgeId,
        bootstrapSnippet: response.bootstrapSnippet,
      });
      setBridgeHint('');
    } finally {
      setMinting(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (revokingId) return;
    if (!window.confirm('Revocare questo secret? Il bridge connesso verra disconnesso al prossimo heartbeat.')) return;
    setRevokingId(id);
    try {
      await revoke(id);
    } finally {
      setRevokingId(null);
    }
  };

  const copyToClipboard = async (text: string, field: 'plaintext' | 'snippet') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField((prev) => (prev === field ? null : prev)), 2000);
    } catch {}
  };

  return (
    <section className="rounded-xl border border-border p-4 space-y-3 bg-white">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-secondary">
            \ud83d\udd11 Secret di onboarding
          </h3>
          <p className="text-[11px] text-text-muted">
            Genera un secret per abilitare un nuovo bridge. Incollalo sulla macchina (cucina/cassa/bar)
            come <code className="font-mono">PRINT_BRIDGE_SECRET=...</code> insieme a{' '}
            <code className="font-mono">PRINT_BRIDGE_ID={'{suggerito}'}</code>.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={bridgeHint}
            onChange={(e) => setBridgeHint(e.target.value)}
            placeholder="bridge hint (es. cassa-1)"
            className="px-2 py-1.5 rounded border border-border text-[11px] font-mono w-40"
            maxLength={80}
            disabled={minting}
          />
          <button
            type="button"
            disabled={minting}
            onClick={() => void handleMint()}
            className="px-3 py-1.5 rounded border border-accent bg-accent text-white text-[11px] font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-50 transition-colors"
          >
            {minting ? 'Generazione...' : '+ Genera secret'}
          </button>
        </div>
      </div>

      {minted && (
        <div className="rounded-lg border-2 border-accent bg-accent/5 p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[12px] font-bold text-accent">
                \u2705 Secret generato.{' '}
                <span className="text-text-muted font-normal">Mostrato UNA volta sola \u2014 copialo ora.</span>
              </p>
              <p className="text-[11px] text-text-muted mt-1">
                id bridge suggerito: <code className="font-mono">{minted.suggestedBridgeId}</code>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMinted(null)}
              className="text-[11px] text-text-muted hover:text-secondary"
            >
              Chiudi
            </button>
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Plaintext secret</label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 px-3 py-2 rounded border border-border bg-white text-[11px] font-mono break-all select-all">
                  {minted.plaintext}
                </code>
                <button
                  type="button"
                  onClick={() => void copyToClipboard(minted.plaintext, 'plaintext')}
                  className="px-2 py-1.5 rounded border border-border text-[11px] hover:bg-gray-50 transition-colors"
                >
                  {copiedField === 'plaintext' ? '\u2713 Copiato' : '\ud83d\udccb Copia'}
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Comandi di bootstrap (per il PC cucina)</label>
              <div className="flex items-start gap-2 mt-1">
                <pre className="flex-1 px-3 py-2 rounded border border-border bg-white text-[11px] font-mono whitespace-pre-wrap overflow-x-auto select-all">
                  {minted.bootstrapSnippet}
                </pre>
                <button
                  type="button"
                  onClick={() => void copyToClipboard(minted.bootstrapSnippet, 'snippet')}
                  className="px-2 py-1.5 rounded border border-border text-[11px] hover:bg-gray-50 transition-colors"
                >
                  {copiedField === 'snippet' ? '\u2713 Copiato' : '\ud83d\udccb Copia'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {sorted.length === 0 ? (
          <p className="text-[11px] text-text-muted py-2">
            Nessun secret. Generane uno sopra per abilitare un nuovo bridge.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {sorted.map((secret) => (
              <article
                key={secret.id}
                className={
                  'rounded-lg border p-3 space-y-1 ' +
                  (secret.isActive
                    ? 'border-border bg-white'
                    : 'border-dashed border-border bg-gray-50 opacity-80')
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <code className="text-[11px] font-mono">{secret.suggestedBridgeId}</code>
                  <span
                    className={
                      'text-[10px] font-bold uppercase tracking-wider ' +
                      (secret.isActive ? 'text-emerald-600' : 'text-text-muted')
                    }
                  >
                    {secret.isActive ? 'Attivo' : 'Revocato'}
                  </span>
                </div>
                <p className="text-[10px] text-text-muted">Creato: {formatTimestamp(secret.createdAt)}</p>
                {secret.boundBridgeId ? (
                  <p className="text-[10px] text-text-muted">
                    Bind: <code className="font-mono">{secret.boundBridgeId}</code>
                  </p>
                ) : secret.isActive ? (
                  <p className="text-[10px] text-amber-700">Mai bindato \u2014 aspetta il primo heartbeat</p>
                ) : null}
                {secret.lastUsedAt && (
                  <p className="text-[10px] text-text-muted">Ultimo uso: {formatTimestamp(secret.lastUsedAt)}</p>
                )}
                {secret.isActive && (
                  <button
                    type="button"
                    disabled={revokingId === secret.id}
                    onClick={() => void handleRevoke(secret.id)}
                    className="mt-2 px-2 py-1 rounded border border-danger text-danger text-[10px] font-bold uppercase tracking-wider hover:bg-danger/10 disabled:opacity-50 transition-colors"
                  >
                    {revokingId === secret.id ? 'Revoca...' : 'Revoca'}
                  </button>
                )}
                {secret.revokedAt && (
                  <p className="text-[10px] text-text-muted">Revocato: {formatTimestamp(secret.revokedAt)}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
