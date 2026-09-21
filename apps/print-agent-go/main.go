package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"os/signal"
	"runtime"
	"strconv"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

// var (not const) so the Makefile's -X linker flag can override it at build time.
var version = "0.1.0"

// defaultAPIBase is the server the agent pairs with on first run when no
// config, flag or env var is set. It is what makes the flow zero-config: a
// double-click opens the pairing page pre-filled with this origin and the user
// only types the 6-digit code. Override at build time with
// `-ldflags "-X main.defaultAPIBase=https://pos.example.com"`.
var defaultAPIBase = "https://test.franksbar.it"

// backgroundMode suppresses modal dialogs. Set by the -background flag (the
// Windows logon task passes it) so an unattended run never blocks on a dialog.
var backgroundMode bool

const (
	maxBackoff   = 60 * time.Second
	shutdownWait = 5 * time.Second
)

func main() {
	var (
		apiBase          = flag.String("api", envOr("GUSTOPOS_API_URL", defaultAPIBase), "GustoPOS API base URL (https://...) — pre-filled in the pairing page")
		versionFlag      = flag.Bool("version", false, "print version and exit")
		uninstallStartup = flag.Bool("uninstall-startup", false, "remove automatic startup registration and exit")
		background       = flag.Bool("background", envBool("GUSTOPOS_AGENT_BACKGROUND"), "run unattended (never show blocking dialogs)")
		startupDelay     = flag.Int("startup-delay", 0, "seconds to wait before starting (set by the self-updater so the old process can exit)")
	)
	flag.Parse()
	backgroundMode = *background

	if *versionFlag {
		fmt.Println("gustopos-print-agent", version)
		notifyUser("GustoPOS Print Agent", "Versione "+version)
		return
	}
	if *uninstallStartup {
		if err := removeStartup(); err != nil {
			fatalExit(fmt.Sprintf("cannot remove automatic startup: %v", err))
		}
		fmt.Println("automatic startup removed")
		notifyUser("GustoPOS Print Agent", "Autostart rimosso.")
		return
	}

	// The self-updater launches the new binary while the old one is still
	// shutting down; waiting here guarantees the single-instance lock is free.
	if *startupDelay > 0 {
		time.Sleep(time.Duration(*startupDelay) * time.Second)
	}

	log.SetFlags(log.LstdFlags | log.Lmsgprefix)
	log.SetPrefix("[print-agent] ")

	// Shared diagnostic state: captures every log line (ring buffer) and powers
	// both the local dashboard (127.0.0.1) and the log shipping to the API.
	runtimeState := newAgentRuntime()
	writers := []io.Writer{runtimeState.Logs, os.Stderr}
	if logWriter, err := newRotatingLogWriter(logFilePath()); err == nil {
		writers = append(writers, logWriter)
		defer logWriter.Close()
	} else {
		fmt.Fprintf(os.Stderr, "could not open log file: %v\n", err)
	}
	// bestEffortWriter keeps the ring/file even when os.Stderr is an invalid
	// handle (console-less Windows build).
	log.SetOutput(bestEffortWriter{writers: writers})
	log.Printf("gustopos-print-agent %s starting (os=%s arch=%s background=%v)", version, runtime.GOOS, runtime.GOARCH, backgroundMode)
	logPreviousExit()

	instanceRelease, alreadyRunning, err := acquireSingleInstance()
	if err != nil {
		fatalExit(fmt.Sprintf("cannot acquire single-instance lock: %v", err))
	}
	if alreadyRunning {
		log.Println("another print agent instance is already running; opening its dashboard")
		openRunningDashboard()
		return
	}
	var releaseOnce sync.Once
	releaseInstance := func() { releaseOnce.Do(instanceRelease) }
	defer releaseInstance()

	// Drop a partial download left by an interrupted self-update.
	cleanupStaleUpdate()

	cfg, err := LoadConfig()
	if err != nil {
		fatalExit(fmt.Sprintf("cannot read config: %v", err))
	}
	cfgPath := configPath()
	if cfg == nil {
		log.Printf("config: not found at %s — starting pairing", cfgPath)
	} else if !cfg.IsPaired() {
		log.Printf("config: incomplete at %s (apiBase=%v bridge=%q instance=%v code=%v) — starting pairing",
			cfgPath, cfg.APIBase != "", cfg.BridgeID, cfg.InstanceID != "", cfg.Code != "")
	} else {
		log.Printf("config: loaded from %s (bridge=%s)", cfgPath, cfg.BridgeID)
	}

	// First run (or detached): show the pairing UI. The pairing page carries a
	// pre-filled server URL, so the user only ever types the 6-digit code.
	// Reuse the machine identity so a re-pair attaches to the existing bridge
	// row instead of creating a duplicate.
	if cfg == nil || !cfg.IsPaired() {
		prev := cfg
		if prev == nil {
			prev = &Config{}
		}
		if identity := loadIdentity(); identity != nil {
			if prev.InstanceID == "" {
				prev.InstanceID = identity.InstanceID
			}
			if prev.BridgeID == "" {
				prev.BridgeID = identity.BridgeID
			}
			log.Printf("config: reusing identity instance=%s bridge=%s", prev.InstanceID, prev.BridgeID)
		}
		cfg = pairOnce(*apiBase, prev)
		if cfg == nil {
			return
		}
	}
	if err := ensureStartup(); err != nil {
		// Startup registration is best-effort: a policy-restricted machine
		// must still be able to run the agent manually.
		log.Printf("could not register automatic startup: %v", err)
	} else if runtime.GOOS == "windows" {
		log.Println("automatic startup registered for the current Windows user")
	}

	// One signal channel drives everything: SIGTERM/SIGINT and the tray "Esci".
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
	defer signal.Stop(sigCh)
	baseCtx, baseCancel := context.WithCancel(context.Background())
	defer baseCancel()
	go func() {
		select {
		case <-sigCh:
			baseCancel()
		case <-baseCtx.Done():
		}
	}()

	var agentRunning atomic.Bool
	var currentAgent atomic.Pointer[Agent]
	pairingRequests := make(chan struct{}, 1)
	updateReady := make(chan stagedUpdate, 1)

	dashboard, dashErr := StartDashboard(runtimeState, dashboardCallbacks{
		ReconnectQZ: func() {
			if a := currentAgent.Load(); a != nil {
				a.ReconnectQZ()
			}
		},
		TestPrint: func(area string) error {
			if a := currentAgent.Load(); a != nil {
				return a.TestPrint(area)
			}
			return fmt.Errorf("agent non ancora attivo")
		},
		RequestPair: func() {
			select {
			case pairingRequests <- struct{}{}:
			default:
			}
		},
		Restart: func() {
			log.Println("restart requested from dashboard")
			relaunchAndExit()
		},
	}, cfg.DashboardPort)
	dashboardURL := ""
	if dashErr != nil {
		log.Printf("could not start local diagnostics dashboard: %v", dashErr)
	} else {
		dashboardURL = dashboard.URL()
		log.Printf("diagnostics dashboard: %s", dashboardURL)
	}
	stopDashboard := func() {
		if dashboard != nil {
			dashboard.Stop()
		}
	}
	defer stopDashboard()

	trayCleanup, trayUpdateBridge := StartTray(cfg.BridgeID,
		func() string {
			if agentRunning.Load() {
				return "Connesso"
			}
			return "Disconnesso"
		},
		func() {
			select {
			case pairingRequests <- struct{}{}:
			default:
			}
		},
		func() {
			if dashboardURL != "" {
				openBrowser(dashboardURL)
			}
		},
		func() {
			select {
			case sigCh <- syscall.SIGTERM:
			default:
			}
		},
	)
	defer trayCleanup()

	// Heartbeat watchdog: if the agent stops heartbeating (hang/deadlock), a
	// fresh instance is launched and this one exits, so the POS keeps printing
	// without a manual restart. A guard prevents a crash loop.
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-baseCtx.Done():
				return
			case <-ticker.C:
			}
			agent := currentAgent.Load()
			if agent == nil {
				continue
			}
			last := agent.LastHeartbeatUnix()
			if last == 0 {
				continue
			}
			if stalled := time.Since(time.Unix(last, 0)); stalled > 2*agent.heartbeatEvery+30*time.Second {
				log.Printf("watchdog: no heartbeat for %s — relaunching agent", stalled.Round(time.Second))
				relaunchAndExit()
			}
		}
	}()

	// Supervisor loop. Transient failures restart the agent with exponential
	// backoff instead of killing the process; only an explicit shutdown, a
	// self-update hand-off or a failed pairing end it.
	backoff := time.Second
	for {
		agent, err := NewAgent(cfg, runtimeState, updateReady)
		if err != nil {
			log.Printf("agent init failed: %v — retrying in %s", err, backoff)
			if !sleepCtx(baseCtx, backoff) {
				break
			}
			backoff = nextBackoff(backoff)
			continue
		}
		currentAgent.Store(agent)

		runCtx, cancelAgent := context.WithCancel(baseCtx)
		errCh := make(chan error, 1)
		agentRunning.Store(true)
		go func() {
			defer agentRunning.Store(false)
			errCh <- agent.Run(runCtx)
		}()

		restart := false
		select {
		case <-baseCtx.Done():
			log.Println("shutdown requested")
			writeExitRecord("shutdown")
			cancelAgent()
			waitCh(errCh, shutdownWait)
			restart = false
		case <-pairingRequests:
			cancelAgent()
			waitCh(errCh, shutdownWait)
			log.Println("pairing requested from tray")
			log.Printf("config: removing %s (pairing requested)", configPath())
			_ = os.Remove(configPath())
			cfg = pairOnce(*apiBase, cfg)
			if cfg == nil {
				restart = false
				break
			}
			trayUpdateBridge(cfg.BridgeID)
			refreshStartup()
			backoff = time.Second
			restart = true
		case staged := <-updateReady:
			// Launch the updater FIRST. It waits for this process to exit
			// before swapping, so the single-instance lock is free and a
			// failure leaves the running agent untouched.
			if err := launchUpdater(staged.Path); err != nil {
				log.Printf("update launch failed: %v — keeping %s", err, version)
				if current := currentAgent.Load(); current != nil {
					current.updateStaged.Store(false)
				}
				backoff = time.Second
				restart = true
				break
			}
			log.Printf("update %s handed to the updater; exiting now for restart", staged.Version)
			writeExitRecord("update:" + staged.Version)
			// Exit IMMEDIATELY. The updater waits for this PID to disappear
			// before swapping and relaunching, so the OS releases the
			// single-instance mutex exactly when the new process may start.
			// Nothing else runs here on purpose: dashboard/tray teardown or
			// any other cleanup could hang and leave the agent stuck.
			os.Exit(0)
		case runErr := <-errCh:
			cancelAgent()
			if runErr == errDetachedSentinel {
				log.Println("bridge detached by tenant settings — showing pairing UI again")
				log.Printf("config: removing %s (bridge detached)", configPath())
				_ = os.Remove(configPath())
				if *apiBase == "" {
					*apiBase = cfg.APIBase
				}
				cfg = pairOnce(*apiBase, cfg)
				if cfg == nil {
					restart = false
					break
				}
				trayUpdateBridge(cfg.BridgeID)
				refreshStartup()
				backoff = time.Second
				restart = true
				break
			}
			if baseCtx.Err() != nil {
				restart = false
				break
			}
			log.Printf("agent stopped: %v — restarting in %s", runErr, backoff)
			if !sleepCtx(baseCtx, backoff) {
				restart = false
				break
			}
			backoff = nextBackoff(backoff)
			restart = true
		}
		if !restart {
			break
		}
	}
	writeExitRecord("stop")
	log.Printf("agent stopped")
}

// pairOnce starts the pairing page, opens the browser, and blocks until the
// staff submits a valid 6-digit code (or the process is interrupted). prev is
// the previous config (on re-pair) whose QZ/area settings are preserved.
func pairOnce(apiBase string, prev *Config) *Config {
	ps, err := StartPairingServer(apiBase, prev)
	if err != nil {
		fatalExit(fmt.Sprintf("cannot start pairing server: %v", err))
	}
	defer ps.Stop()
	log.Printf("pairing page: %s", ps.URL())
	openBrowser(ps.URL())
	cfg := <-ps.Done()
	if cfg != nil {
		log.Printf("paired as bridge %s — starting agent", cfg.BridgeID)
	}
	return cfg
}

func refreshStartup() {
	if err := ensureStartup(); err != nil {
		log.Printf("could not refresh automatic startup: %v", err)
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envBool(key string) bool {
	value, err := strconv.ParseBool(os.Getenv(key))
	return err == nil && value
}

// sleepCtx waits for d or until ctx is cancelled. Returns false when cancelled.
func sleepCtx(ctx context.Context, d time.Duration) bool {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}

func nextBackoff(current time.Duration) time.Duration {
	next := current * 2
	if next > maxBackoff {
		next = maxBackoff
	}
	return next
}

// waitCh waits for the agent goroutine to finish, bounded by timeout so a hung
// poll can never block shutdown forever.
func waitCh(errCh <-chan error, timeout time.Duration) {
	select {
	case <-errCh:
	case <-time.After(timeout):
	}
}

// notifyUser logs always and, only when interactive, shows a native dialog.
// In background mode (Windows logon task) a modal dialog would hang forever, so
// it is never shown there.
func notifyUser(title, message string) {
	if backgroundMode {
		return
	}
	winMessageBox(title, message)
}

// fatalExit is used only for pre-loop startup failures. It logs to the file,
// shows a dialog only when interactive, then exits.
func fatalExit(msg string) {
	log.Printf("FATAL: %s", msg)
	writeExitRecord("fatal: " + msg)
	notifyUser("GustoPOS Print Agent — Errore", msg)
	os.Exit(1)
}
