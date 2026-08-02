import { useCallback, useEffect, useState, type ComponentType } from "react";
import type { PrintBridge, PrintBridgeOnboardingSecretCreateCode6DigitResponse } from "@gustopos/shared";
import { useAppStore } from "../../store/app-store";

interface QRProps {
  value: string;
  size: number;
  level?: "L" | "M" | "Q" | "H";
}

type QRComponent = ComponentType<QRProps>;

interface PairingState {
  secretId: string;
  code: string;
  qrPayload: string;
  ttlSeconds: number;
  expiresAt: string;
  suggestedBridgeId: string;
  issuedAt: number;
}

/**
 * PrintStationWizard — admin-side modal that mints a 6-digit pairing code
 * (90s TTL, qrcode.react SVG render), counts down, regenerates on expiry,
 * copies the code to clipboard, and detects when the remote kitchen PC
 * completes its first heartbeat via print-bridge polling.
 *
 * Designed to live alongside RegisterLocalBridgeModal in PrintBridgesPanel:
 *  - RegisterLocalBridgeModal handles THIS browser-as-bridge (QZ Tray local).
 *  - PrintStationWizard handles REMOTE kitchen PC bridge pairing.
 *
 * Modal is mount-and-forget: parent controls visibility via `wizardOpen`.
 */
export default function PrintStationWizard({ onClose }: { onClose: () => void }) {
  const createShortCodePairing = useAppStore((s) => s.createShortCodePairing);
  const refreshPrintBridges = useAppStore((s) => s.refreshPrintBridges);
  const refreshOnboardingSecrets = useAppStore((s) => s.refreshOnboardingSecrets);

  const [pairing, setPairing] = useState<PairingState | null>(null);
  const [timeLeftSec, setTimeLeftSec] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [QRCodeSVG, setQRCodeSVG] = useState<QRComponent | null>(null);
  const [bound, setBound] = useState(false);

  const reissue = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : undefined;
      const res: PrintBridgeOnboardingSecretCreateCode6DigitResponse =
        await createShortCodePairing({ publicBaseUrl: origin });
      setPairing({
        secretId: res.secretId,
        code: res.code,
        qrPayload: res.qrPayload,
        ttlSeconds: res.ttlSeconds,
        expiresAt: res.expiresAt,
        suggestedBridgeId: res.suggestedBridgeId,
        issuedAt: Date.now(),
      });
      setTimeLeftSec(res.ttlSeconds);
      setBound(false);
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : String(e);
      const friendly = raw.includes("SHORT_CODE_PEPPER")
        ? "Server non configurato: manca la variabile d'ambiente SHORT_CODE_PEPPER sull'API. Aggiungila e riavvia il backend, oppure usa la modalità \"long\"."
        : raw;
      setErrorMsg(friendly);
    } finally {
      setLoading(false);
    }
  }, [createShortCodePairing]);

  // Initial mint on mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- [indirect-setstate] reissue() calls store set() asynchronously
    void reissue();
  }, [reissue]);

  // Countdown + auto-reissue at zero.
  useEffect(() => {
    if (!pairing) return;
    const expiresMs = new Date(pairing.expiresAt).getTime();
    if (!Number.isFinite(expiresMs)) return;
    const tick = () => {
      const remaining = Math.max(0, Math.round((expiresMs - Date.now()) / 1000));
      setTimeLeftSec(remaining);
      if (remaining <= 0) {
        void reissue();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [pairing, reissue]);

  // Load qrcode.react lazily; gracefully fall back to URL text if not installed.
  useEffect(() => {
    let cancelled = false;
    // qrcode.react is optional; install with: npm install qrcode.react
    import("qrcode.react")
      .then((mod) => {
        const Cmp = (mod as { QRCodeSVG?: QRComponent }).QRCodeSVG;
        if (!cancelled && Cmp) setQRCodeSVG(() => Cmp);
      })
      .catch(() => {
        // qrcode.react not installed — fallback message renders inside the QR frame.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Refresh the bridge pool while waiting. Merely inspecting printBridges here
  // is insufficient because the parent pool may be stale after the remote agent
  // consumes the code; the heartbeat can succeed in the API without a socket
  // event reaching this modal.
  useEffect(() => {
    if (!pairing || bound) return;

    let cancelled = false;
    let checkInFlight = false;
    const checkPairing = async () => {
      // Do not let a slow request overlap the next interval and overwrite a
      // newer bridge list with an older response.
      if (checkInFlight) return;
      checkInFlight = true;
      try {
        await Promise.all([refreshPrintBridges(), refreshOnboardingSecrets()]);
        if (cancelled) return;
        const state = useAppStore.getState();
        const currentBridges = state.printBridges;
        const currentSecrets = state.onboardingSecrets;
        const matched: PrintBridge | undefined = currentBridges.find(
          (b) => b.id === pairing.suggestedBridgeId,
        );
        const secret = currentSecrets.find((item) => item.id === pairing.secretId);
        // The API canonicalizes the onboarding bind and persists boundBridgeId.
        // Check both signals: instance-based bridge reuse may intentionally keep
        // an older bridge primary key while the new code points to it.
        if (
          (matched?.lastHeartbeatAt && matched.status === "active") ||
          Boolean(secret?.boundBridgeId)
        ) {
          setBound(true);
        }
      } catch {
        // Pairing remains pending: the next interval retries. Swallowing the
        // fetch error prevents an unhandled rejection when the API briefly
        // reconnects or the session refresh is in progress.
      } finally {
        checkInFlight = false;
      }
    };

    void checkPairing();
    const id = setInterval(() => {
      void checkPairing();
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pairing, bound, refreshOnboardingSecrets, refreshPrintBridges]);

  // Give the operator a visible success state, then close the wizard so the
  // refreshed bridge is immediately visible in the Settings panel.
  useEffect(() => {
    if (!bound) return;
    const id = window.setTimeout(onClose, 1200);
    return () => window.clearTimeout(id);
  }, [bound, onClose]);

  const handleCopy = useCallback(async () => {
    if (!pairing) return;
    try {
      await navigator.clipboard.writeText(pairing.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrorMsg("Impossibile copiare negli appunti (permesso negato dal browser).");
    }
  }, [pairing]);

  const mm = String(Math.floor(timeLeftSec / 60)).padStart(2, "0");
  const ss = String(timeLeftSec % 60).padStart(2, "0");
  const lowTime = timeLeftSec > 0 && timeLeftSec <= 15;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="psw-title"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-border max-w-md w-full overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-start justify-between gap-3">
          <div className="flex-1">
            <h2
              id="psw-title"
              className="text-sm font-bold uppercase tracking-wider text-secondary"
            >
              Collega una stampante remota
            </h2>
            <p className="text-[11px] text-text-muted mt-0.5">
              Genera un codice a 6 cifre (valido 90 secondi) da inserire sul PC con la
              stampante. Una volta confermato, la connessione è automatica e permanente.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi wizard"
            className="text-text-muted hover:text-secondary text-2xl leading-none px-1"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-4">
          {bound ? (
            <div
              className="rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 p-4 space-y-3"
              role="status"
              aria-live="polite"
            >
              <div className="text-2xl font-bold uppercase tracking-wider text-center">
                ✓ Stampante collegata
              </div>
              <p className="text-xs text-center text-emerald-700">
                Il PC remoto <span className="font-mono">{pairing?.suggestedBridgeId}</span> ha
                completato l'accoppiamento ed è ora connesso: riceve e stampa i job in modo
                automatico, anche dopo un riavvio del PC (il print agent si riconnette da solo).
              </p>
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 rounded bg-emerald-600 text-white text-[11px] font-bold uppercase tracking-wider hover:bg-emerald-700 transition-colors"
                >
                  Chiudi
                </button>
              </div>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div
                  className="rounded border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-xs"
                  role="alert"
                >
                  {errorMsg}
                </div>
              )}

              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-[227px] h-[227px] border-2 border-border bg-white rounded flex items-center justify-center overflow-hidden"
                  aria-label="QR di accoppiamento 60x60mm"
                >
                  {QRCodeSVG && pairing ? (
                    <QRCodeSVG value={pairing.qrPayload} size={221} level="M" />
                  ) : pairing ? (
                    <div className="text-[10px] text-text-muted text-center px-2 leading-tight space-y-2">
                      <p className="font-mono break-all">{pairing.qrPayload}</p>
                      <p className="italic">
                        qrcode.react non installato. Esegui{" "}
                        <span className="font-mono">npm install qrcode.react</span> nel
                        workspace web per il rendering QR.
                      </p>
                    </div>
                  ) : (
                    <div className="text-[11px] text-text-muted">Caricamento…</div>
                  )}
                </div>

                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold">
                    Codice di associazione
                  </div>
                  <div
                    className="mt-1 inline-block px-4 py-2 rounded-lg bg-secondary text-white"
                    style={{
                      fontFamily:
                        "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: 40,
                      letterSpacing: "0.25em",
                      lineHeight: 1,
                      fontWeight: 700,
                    }}
                    aria-label="Codice a sei cifre"
                  >
                    {pairing ? pairing.code : "------"}
                  </div>
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopy}
                      disabled={!pairing || loading}
                      className="px-3 py-1 rounded border border-border text-[11px] font-bold uppercase tracking-wider hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      {copied ? "✓ Copiato" : "Copia negli appunti"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void reissue()}
                      disabled={loading}
                      className="px-3 py-1 rounded border border-border text-[11px] font-bold uppercase tracking-wider hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      {loading ? "Generazione…" : "Rigenera"}
                    </button>
                  </div>
                </div>

                <div className="text-center">
                  <div
                    className={`tabular-nums font-mono font-bold text-2xl ${
                      lowTime ? "text-red-600 animate-pulse" : "text-secondary"
                    }`}
                    aria-live="polite"
                  >
                    {pairing ? `${mm}:${ss}` : "--:--"}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-text-muted mt-0.5">
                    Scade tra
                  </div>
                </div>

                <div className="text-[11px] text-text-muted text-center max-w-[340px]">
                  Sul PC con la stampante apri il <strong>Print Agent</strong>, scansiona il QR
                  oppure digita questo codice a 6 cifre e premi <em>Collega</em>. Da quel
                  momento la connessione è automatica: nessun'altra configurazione necessaria.
                </div>

                <div className="text-[10px] text-text-muted font-mono text-center">
                  bridge: <strong>{pairing?.suggestedBridgeId ?? "—"}</strong>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => void refreshPrintBridges()}
            className="text-[11px] text-text-muted hover:text-secondary transition-colors"
          >
            ↻ Ricarica pool
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded border border-border text-[11px] font-bold uppercase tracking-wider hover:bg-gray-50 transition-colors"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
