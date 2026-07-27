import { useEffect, useRef, useState, useCallback } from 'react';
import { getAccessToken, fetchQzTrayConfig, completePrintJob, failPrintJob } from '../shared/api/client';
import { useAppStore } from '../store/app-store';

// ─── Types ────────────────────────────────────────────────────────────────

type QzConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'not_installed';

export interface QzTrayWorkerState {
  status: QzConnectionStatus;
  version: string | null;
  printers: string[];
  error: string | null;
  jobsPrinted: number;
  jobsFailed: number;
  debugLogs: string[];
  browserInfo: {
    url: string;
    protocol: string;
    hostname: string;
    port: string;
    isLocalhost: boolean;
  } | null;
}

// ─── Global state (shared across all component instances) ─────────────────

let globalState: QzTrayWorkerState = {
  status: 'disconnected',
  version: null,
  printers: [],
  error: null,
  jobsPrinted: 0,
  jobsFailed: 0,
  debugLogs: [],
  browserInfo: null,
};

let listeners: Set<(state: QzTrayWorkerState) => void> = new Set();

function notifyListeners() {
  for (const fn of listeners) {
    fn({ ...globalState });
  }
}

function setGlobalState(partial: Partial<QzTrayWorkerState>) {
  globalState = { ...globalState, ...partial };
  notifyListeners();
}

function addDebugLog(msg: string) {
  const ts = new Date().toLocaleTimeString();
  const line = `[${ts}] ${msg}`;
  globalState = {
    ...globalState,
    debugLogs: [...globalState.debugLogs.slice(-49), line],
  };
  notifyListeners();
  console.log(`[QZ DEBUG] ${msg}`);
}

// ─── Hook for consuming QZ state ──────────────────────────────────────────

export function useQzTrayStatus(): QzTrayWorkerState {
  const [state, setStateLocal] = useState<QzTrayWorkerState>(globalState);

  useEffect(() => {
    const listener = (s: QzTrayWorkerState) => setStateLocal(s);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return state;
}

// ─── Script loader ────────────────────────────────────────────────────────

function loadQzTrayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof (window as any).qz !== 'undefined') {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = '/qz-tray.js';
    script.onload = () => {
      addDebugLog('qz-tray.js script loaded successfully');
      resolve(typeof (window as any).qz !== 'undefined');
    };
    script.onerror = () => {
      addDebugLog('ERROR: Failed to load qz-tray.js script');
      resolve(false);
    };
    document.head.appendChild(script);
  });
}

// ─── Print job execution via QZ Tray ──────────────────────────────────────

interface PrinterTarget {
  name: string;
  ip?: string;
  port?: number;
}

async function executePrintJob(
  job: { id: string; orderId: string; area: string; protocol: string; payload: string },
  target: PrinterTarget,
): Promise<void> {
  const qz = (window as any).qz;
  if (!qz) throw new Error('QZ Tray not available');

  // Use IP:port if available, otherwise fallback to printer name
  const printerIdentifier = target.ip || target.name;
  const configOptions: any = {
    size: { width: 3.15, height: 11.69 },
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
  };
  if (target.ip && target.port) {
    configOptions.port = target.port;
  }

  const config = qz.configs.create(printerIdentifier, configOptions);

  // QZ Tray raw print data format for ESC/POS
  // Use base64 flavor to properly handle binary ESC/POS commands
  const data = [{
    type: 'raw',
    format: 'command',
    flavor: 'base64',
    data: job.payload, // base64 encoded ESC/POS binary data
  }];

  await qz.print(config, data);
}

// ─── Main Worker Component ────────────────────────────────────────────────

export default function QzTrayWorker() {
  const enabledModules = useAppStore((s) => s.enabledModules);
  const printingEnabled = enabledModules.includes('printing');

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectedRef = useRef(false);
  const processingRef = useRef(false);
  const hasAttemptedRef = useRef(false);

  const uiSettings = useAppStore((s) => s.uiSettings);
  const printJobs = useAppStore((s) => s.printJobs);
  const pollPrintJobs = useAppStore((s) => s.pollPrintJobs);

  const getPrinterForArea = useCallback(
    (area: string): PrinterTarget | null => {
      const printing = uiSettings.printing;
      if (!printing) return null;
      switch (area) {
        case 'kitchen':
          return {
            name: printing.kitchenPrinterName,
            ip: printing.kitchenPrinterIp || undefined,
            port: printing.kitchenPrinterPort || undefined,
          };
        case 'bar':
          return {
            name: printing.barPrinterName,
            ip: printing.barPrinterIp || undefined,
            port: printing.barPrinterPort || undefined,
          };
        case 'cashier':
          return {
            name: printing.cashierPrinterName,
            ip: printing.cashierPrinterIp || undefined,
            port: printing.cashierPrinterPort || undefined,
          };
        default:
          return null;
      }
    },
    [uiSettings.printing],
  );

  // ─── Load QZ config and connect ──────────────────────────────────────
  useEffect(() => {
    if (!printingEnabled) {
      setGlobalState({ status: 'disconnected' });
      return;
    }

    if (hasAttemptedRef.current) return;
    hasAttemptedRef.current = true;

    let cancelled = false;

    const init = async () => {
      addDebugLog('═══════════════════════════════════════════');
      addDebugLog('QZ TRAY CONNECTION DIAGNOSTIC START');
      addDebugLog('═══════════════════════════════════════════');

      setGlobalState({ status: 'connecting', error: null });

      // ─── Step 0: Browser diagnostics ─────────────────────────────────
      const browserInfo = {
        url: window.location.href,
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        port: window.location.port,
        isLocalhost: ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname),
      };
      setGlobalState({ browserInfo });

      addDebugLog(`Browser URL: ${browserInfo.url}`);
      addDebugLog(`Browser protocol: ${browserInfo.protocol}`);
      addDebugLog(`Browser hostname: ${browserInfo.hostname}`);
      addDebugLog(`Browser is localhost: ${browserInfo.isLocalhost}`);

      if (!browserInfo.isLocalhost) {
        addDebugLog('⚠️ WARNING: Browser is NOT on localhost!');
        addDebugLog('⚠️ QZ Tray only accepts connections from localhost.');
        addDebugLog('⚠️ You must open this page from the SAME PC where QZ Tray is installed.');
        addDebugLog('⚠️ If you are accessing via VPS IP (65.108.42.45), QZ Tray cannot work.');
      }

      // ─── Step 1: Load qz-tray.js ─────────────────────────────────────
      addDebugLog('Step 1: Loading qz-tray.js...');
      const scriptLoaded = await loadQzTrayScript();
      if (cancelled) return;

      if (!scriptLoaded) {
        addDebugLog('❌ FAILED: qz-tray.js not loaded');
        setGlobalState({ status: 'not_installed', error: 'qz-tray.js not found.' });
        return;
      }
      addDebugLog('✅ qz-tray.js loaded');

      const qz = (window as any).qz;
      if (!qz) {
        addDebugLog('❌ FAILED: qz object not found after script load');
        setGlobalState({ status: 'not_installed', error: 'QZ Tray library loaded but qz object not found.' });
        return;
      }
      addDebugLog('✅ qz object available');

      // ─── Step 1b: Set up QZ Tray signing (certificate + signature) ───
      // This replaces the "anonymous untrusted" popup with company info
      // and allows silent printing after first approval.
      addDebugLog('Step 1b: Setting up QZ Tray signing...');

      // Set certificate promise — QZ Tray calls this on connect
      qz.security.setCertificatePromise(function (resolve: (v: string) => void, reject: (e: string) => void) {
        fetch('/signing/digital-certificate.txt', { cache: 'no-store', headers: { 'Content-Type': 'text/plain' } })
          .then(function (data) { data.ok ? data.text().then(resolve) : data.text().then(reject); })
          .catch(function (e) { reject(String(e)); });
      });

      // Set signature algorithm
      qz.security.setSignatureAlgorithm('SHA512');

      // Set signature promise — QZ Tray calls this on each print/function call
      qz.security.setSignaturePromise(function (toSign: string) {
        return function (resolve: (v: string) => void, reject: (e: string) => void) {
          fetch('/api/sign?request=' + encodeURIComponent(toSign), { cache: 'no-store', headers: { 'Content-Type': 'text/plain' } })
            .then(function (data) { data.ok ? data.text().then(resolve) : data.text().then(reject); })
            .catch(function (e) { reject(String(e)); });
        };
      });

      addDebugLog('✅ Certificate and signature promises set');

      // ─── Step 2: Determine page protocol ──────────────────────────────
      const isHttps = window.location.protocol === 'https:';
      addDebugLog(`Step 2: Page protocol: ${isHttps ? 'HTTPS' : 'HTTP'}`);

      // ─── Step 3: Set up callbacks ────────────────────────────────────
      addDebugLog('Step 3: Setting up connection callbacks...');
      qz.websocket.setErrorCallbacks((evt: any) => {
        addDebugLog(`❌ QZ WebSocket ERROR: ${JSON.stringify(evt)}`);
      });

      qz.websocket.setClosedCallbacks((evt: any) => {
        addDebugLog(`🔌 QZ WebSocket CLOSED: code=${evt?.code}, reason=${evt?.reason || 'none'}`);
        if (!cancelled) {
          connectedRef.current = false;
          if (globalState.status === 'connected') {
            setGlobalState({ status: 'disconnected' });
          }
        }
      });
      addDebugLog('✅ Callbacks registered');

      // ─── Step 4: Connect using saved QZ Tray config ────────────────
      addDebugLog('Step 4: Loading QZ Tray config...');
      let qzHost = 'localhost';
      let usingSecure = isHttps;
      try {
        const qzConfigResponse = await fetchQzTrayConfig();
        const saved = qzConfigResponse.qzTray;
        if (saved.hosts?.[0]?.trim()) {
          qzHost = saved.hosts[0].trim();
        }
        if (typeof saved.useSecure === 'boolean') {
          usingSecure = saved.useSecure;
        }
        addDebugLog(`  config host: ${qzHost}`);
        addDebugLog(`  config useSecure: ${usingSecure}`);
        if (saved.securePorts?.length) {
          addDebugLog(`  config securePorts: ${saved.securePorts.join(', ')}`);
        }
        if (saved.insecurePorts?.length) {
          addDebugLog(`  config insecurePorts: ${saved.insecurePorts.join(', ')}`);
        }
      } catch (configErr) {
        addDebugLog(`⚠️ Could not load QZ config, using defaults: ${configErr}`);
      }

      addDebugLog('Step 4b: Connecting to QZ Tray...');
      addDebugLog(`  host: ${qzHost}`);
      addDebugLog(`  usingSecure: ${usingSecure}`);
      addDebugLog('  retries: 3');
      addDebugLog('  (QZ Tray will auto-cycle through all default ports)');

      // Disable surf domain for localhost
      qz.websocket.setUsingSurf(false);

      try {
        // Let QZ Tray try all ports with retries
        const connectPromise = qz.websocket.connect({
          host: qzHost,
          usingSecure,
          retries: 3,
          delay: 1,
        });

        addDebugLog('⏳ Waiting for QZ Tray to respond (allow popup should appear)...');

        const timeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout (15s)')), 15000);
        });

        await Promise.race([connectPromise, timeout]);

        if (cancelled) return;

        addDebugLog('✅ WebSocket connected!');
        addDebugLog('💡 If this is the first connection, check for QZ Tray "Allow" popup');

        // Get version
        let version: string | null = null;
        try {
          version = await qz.api.getVersion();
          addDebugLog(`✅ QZ Tray version: ${version}`);
        } catch (e) {
          addDebugLog(`⚠️ Could not get version: ${e}`);
        }

        // Get printers
        let printers: string[] = [];
        try {
          const found = await qz.printers.find();
          printers = Array.isArray(found) ? found : [];
          addDebugLog(`✅ Found ${printers.length} printer(s): ${printers.join(', ') || '(none)'}`);
        } catch (e) {
          addDebugLog(`⚠️ Printer discovery failed: ${e}`);
        }

        connectedRef.current = true;
        setGlobalState({
          status: 'connected',
          version,
          printers,
          error: null,
        });

        addDebugLog('═══════════════════════════════════════════');
        addDebugLog('✅ QZ TRAY FULLY CONNECTED AND READY');
        addDebugLog('═══════════════════════════════════════════');

      } catch (err) {
        if (cancelled) return;
        connectedRef.current = false;

        const msg = err instanceof Error ? err.message : String(err);
        addDebugLog(`❌ Connection failed: ${msg}`);

        if (msg.includes('timeout')) {
          addDebugLog('→ Timeout: QZ Tray did not respond in 15 seconds');
          addDebugLog('→ Possible causes:');
          addDebugLog('  1. QZ Tray is not installed or not running');
          addDebugLog('  2. Browser is not on the same PC as QZ Tray');
          addDebugLog('  3. Firewall blocking WebSocket connection');
        } else if (msg.toLowerCase().includes('connection') || msg.toLowerCase().includes('connect')) {
          addDebugLog('→ Connection refused: QZ Tray did not accept the connection');
          addDebugLog('→ Check the QZ Tray icon in system tray — is it running?');
          addDebugLog('→ If running, try right-clicking the icon → "Log Viewer" for details');
        } else if (msg.includes('denied') || msg.includes('permission')) {
          addDebugLog('→ Permission denied: User clicked "Deny" in QZ Tray popup');
        }

        setGlobalState({
          status: 'error',
          error: msg.includes('denied') || msg.includes('permission')
            ? 'Connessione negata. Riavvia QZ Tray e clicca "Allow".'
            : 'QZ Tray non è in esecuzione. Installa, avvia e clicca "Allow".',
        });
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, [printingEnabled]);

  // ─── Poll for print jobs using atomic claim ──────────────────────────
  useEffect(() => {
    if (globalState.status !== 'connected') {
      addDebugLog('⚠️ Polling skipped: QZ not connected');
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    const areas = (['kitchen', 'bar', 'cashier'] as const).filter(
      (area) => getPrinterForArea(area) !== null,
    );

    if (areas.length === 0) {
      addDebugLog('⚠️ Polling skipped: no areas configured');
      return;
    }

    addDebugLog(`✅ Polling started for areas: ${areas.join(', ')}`);

    const poll = async () => {
      if (processingRef.current) {
        addDebugLog('⏳ Poll skipped: still processing');
        return;
      }
      try {
        addDebugLog('📡 Polling for print jobs...');
        await pollPrintJobs();
        const currentJobs = useAppStore.getState().printJobs;
        const dispatchedCount = currentJobs.filter((j) => j.status === 'dispatched').length;
        addDebugLog(`📥 Poll complete: ${dispatchedCount} dispatched jobs in store`);
      } catch (err) {
        addDebugLog(`❌ Poll error: ${err}`);
      }
    };

    pollTimerRef.current = setInterval(poll, 3000);
    void poll();

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [globalState.status, getPrinterForArea, pollPrintJobs]);

  // ─── Process dispatched print jobs ─────────────────────────────────
  useEffect(() => {
    if (globalState.status !== 'connected') return;
    if (processingRef.current) return;

    const dispatchedJobs = printJobs.filter((j) => j.status === 'dispatched');
    if (dispatchedJobs.length === 0) return;

    const processJobs = async () => {
      processingRef.current = true;

      for (const job of dispatchedJobs) {
        const target = getPrinterForArea((job.area ?? "kitchen") as any);
        if (!target) {
          await failPrintJob(job.id, `No printer configured for area: ${job.area}`).catch(() => {});
          continue;
        }

        const printerLabel = target.ip ? `${target.ip}:${target.port || 9100}` : target.name;

        // If using IP, skip printer name check (IP printing doesn't require local printer discovery)
        if (!target.ip && !globalState.printers.includes(target.name)) {
          addDebugLog(`⚠️ Printer "${target.name}" not found in QZ Tray — marking job as failed`);
          await failPrintJob(job.id, `Printer "${target.name}" not found in QZ Tray`).catch(() => {});
          continue;
        }

        try {
          await (executePrintJob as any)(job as any, target as any);
          await completePrintJob(job.id);
          // Remove job from store to prevent reprocessing loop
          const currentJobs = useAppStore.getState().printJobs;
          useAppStore.setState({ printJobs: currentJobs.filter((j) => j.id !== job.id) });
          setGlobalState({ jobsPrinted: globalState.jobsPrinted + 1 });
          addDebugLog(`✅ Printed job ${job.id} → ${printerLabel}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setGlobalState({ jobsFailed: globalState.jobsFailed + 1 });
          addDebugLog(`❌ Job ${job.id} failed: ${msg}`);
          await failPrintJob(job.id, msg).catch(() => {});
          // Remove failed job from store to prevent retry loop
          const currentJobs = useAppStore.getState().printJobs;
          useAppStore.setState({ printJobs: currentJobs.filter((j) => j.id !== job.id) });
        }
      }

      processingRef.current = false;
    };

    void processJobs();
  }, [printJobs, globalState.status, getPrinterForArea]);

  // ─── Disconnect on unmount ───────────────────────────────────────────
  useEffect(() => {
    return () => {
      connectedRef.current = false;
      hasAttemptedRef.current = false;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      const qz = (window as any).qz;
      if (qz?.websocket?.disconnect) {
        qz.websocket.disconnect().catch(() => {});
      }
      setGlobalState({ status: 'disconnected' });
    };
  }, []);

  return null;
}
