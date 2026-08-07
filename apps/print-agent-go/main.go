package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"runtime"
	"sync/atomic"
	"syscall"
)

// var (not const) so the Makefile's -X linker flag can override it at build time.
var version = "0.1.0"

// defaultAPIBase is the server the agent pairs with on first run when no
// config, flag or env var is set. It is what makes the flow zero-config: a
// double-click opens the pairing page pre-filled with this origin and the user
// only types the 6-digit code. Override at build time with
// `-ldflags "-X main.defaultAPIBase=https://pos.example.com"`.
var defaultAPIBase = "https://test.franksbar.it"

func main() {
	var (
		apiBase          = flag.String("api", envOr("GUSTOPOS_API_URL", defaultAPIBase), "GustoPOS API base URL (https://...) — pre-filled in the pairing page")
		versionFlag      = flag.Bool("version", false, "print version and exit")
		uninstallStartup = flag.Bool("uninstall-startup", false, "remove automatic startup registration and exit")
	)
	flag.Parse()

	if *versionFlag {
		fmt.Println("gustopos-print-agent", version)
		return
	}
	if *uninstallStartup {
		if err := removeStartup(); err != nil {
			fatalExit(fmt.Sprintf("cannot remove automatic startup: %v", err))
		}
		fmt.Println("automatic startup removed")
		return
	}

	log.SetFlags(log.LstdFlags | log.Lmsgprefix)
	log.SetPrefix("[print-agent] ")

	releaseInstance, alreadyRunning, err := acquireSingleInstance()
	if err != nil {
		fatalExit(fmt.Sprintf("cannot acquire single-instance lock: %v", err))
	}
	if alreadyRunning {
		log.Println("another print agent instance is already running")
		return
	}
	defer releaseInstance()

	cfg, err := LoadConfig()
	if err != nil {
		fatalExit(fmt.Sprintf("cannot read config: %v", err))
	}

	// First run (or detached): show the pairing UI. The pairing page carries a
	// pre-filled server URL (default: the origin the agent was built/shipped
	// for), so the user only ever types the 6-digit code.
	if cfg == nil || !cfg.IsPaired() {
		cfg = pairOnce(*apiBase, nil)
		if cfg == nil {
			os.Exit(1)
		}
	}
	if err := ensureStartup(); err != nil {
		// Startup registration is best-effort: a policy-restricted machine
		// must still be able to run the agent manually.
		log.Printf("could not register automatic startup: %v", err)
	} else if runtime.GOOS == "windows" {
		log.Println("automatic startup registered for the current Windows user")
	}

	// The tray is an optional UI layer: it shares the main signal channel so
	// "Esci" follows the same shutdown path as SIGTERM/SIGINT.
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGTERM, syscall.SIGINT)
	defer signal.Stop(sig)
	var agentRunning atomic.Bool
	pairingRequests := make(chan struct{}, 1)
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
			select {
			case sig <- syscall.SIGTERM:
			default:
			}
		},
	)
	defer trayCleanup()

	// Re-pair loop: if the admin detaches the bridge in Settings, the API
	// answers 401, we wipe the credential and show the pairing page again so
	// the machine can attach to the same or another tenant.
	for {
		agent, err := NewAgent(cfg)
		if err != nil {
			fatalExit(fmt.Sprintf("agent init failed: %v", err))
		}
		runCtx, cancelAgent := context.WithCancel(context.Background())
		errCh := make(chan error, 1)
		agentRunning.Store(true)

		go func() {
			defer agentRunning.Store(false)
			errCh <- agent.Run(runCtx)
		}()

		select {
		case s := <-sig:
			log.Printf("received %s, shutting down", s)
			cancelAgent()
			<-errCh
			return
		case <-pairingRequests:
			log.Println("pairing requested from tray")
			cancelAgent()
			<-errCh
			_ = os.Remove(configPath())
			cfg = pairOnce(*apiBase, cfg)
			if cfg == nil {
				return
			}
			trayUpdateBridge(cfg.BridgeID)
			if err := ensureStartup(); err != nil {
				log.Printf("could not refresh automatic startup: %v", err)
			}
			continue
		case runErr := <-errCh:
			cancelAgent()
			if runErr == errDetachedSentinel {
				log.Println("bridge detached by tenant settings — showing pairing UI again")
				_ = os.Remove(configPath())
				if *apiBase == "" {
					*apiBase = cfg.APIBase
				}
				// Carry over the QZ Tray + area settings from the previous
				// pairing so a re-pair doesn't wipe the printer config.
				cfg = pairOnce(*apiBase, cfg)
				if cfg == nil {
					os.Exit(1)
				}
				trayUpdateBridge(cfg.BridgeID)
				if err := ensureStartup(); err != nil {
					log.Printf("could not refresh automatic startup: %v", err)
				}
				continue
			}
			if runErr != nil {
				log.Printf("agent stopped with error: %v", runErr)
				os.Exit(1)
			}
			return
		}
	}
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
	select {
	case cfg := <-ps.Done():
		if cfg != nil {
			log.Printf("paired as bridge %s — starting agent", cfg.BridgeID)
		}
		return cfg
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// fatalExit logs the error, shows a native Windows dialog when running on
// Windows (so a double-click launch doesn't close invisibly), then exits.
func fatalExit(msg string) {
	log.Print(msg)
	if runtime.GOOS == "windows" {
		winMessageBox("GustoPOS Print Agent — Errore", msg)
	}
	os.Exit(1)
}
