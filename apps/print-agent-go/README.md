# GustoPOS Print Agent (Go)

A single static binary that runs on the POS machine and keeps the tenant's
print bridge **permanently connected** — no browser, no JWT, no Node.js.

```
POS machine                    VPS
┌──────────────────┐           ┌─────────────────────────────┐
│ gustopos-print-  │  HTTPS    │ API                         │
│ agent (systemd)  │ ────────► │  POST /print-bridge/heartbeat│
│      │           │           │  POST /print-bridge/claim   │
│      │ ws://     │           │  POST /print-bridge/jobs/:id│
│      ▼ localhost │           └─────────────────────────────┘
│  QZ Tray ──► printer          (tenant resolved from the     │
└──────────────────┘             6-digit pairing code)       │
```

## The model

- **Pair once.** The staff opens the Settings → Configurazioni Stampa page,
  mints a **6-digit code** and types it into the pairing page the agent opens
  in the browser (`Inserisci il codice di 6 cifre che trovi in Settings`).
- **Claimed = tied to the tenant.** The code resolves to exactly one tenant
  server-side; the first heartbeat binds this machine's `bridgeId` to it.
  Every poll after that is tenant-scoped. An unbound bridge stays available
  to be claimed by any tenant; once claimed, nobody else can take it.
- **Permanent.** The agent authenticates with the bound code on every request.
  systemd restarts it on boot/crash; the browser can be closed; JWT expiry is
  irrelevant. The only failure mode is the admin **detaching** the bridge in
  Settings (revoking the secret) → the API answers 401 → the agent wipes its
  config and shows the 6-digit input again, ready to attach to the same or a
  different tenant.

## Protocol (talks directly to the API)

| Endpoint | Purpose |
|---|---|
| `POST /api/print-bridge/heartbeat` | register/refresh bridge, resolve tenant from code |
| `POST /api/print-bridge/claim` | poll for print jobs (scoped to the tenant) |
| `POST /api/print-bridge/jobs/:id/complete` | mark job printed |
| `POST /api/print-bridge/jobs/:id/fail` | mark job failed |
| `GET /api/print-bridge/sign?request=<sha256hex>` | bridge-authenticated server-side QZ message signing (no key on POS) |
| `GET /signing/digital-certificate.txt` | fetch the QZ signing certificate |
| `POST /api/fiscal-bridge/claim` | poll for certified fiscal jobs (receipt/chiusura/test) |
| `POST /api/fiscal-bridge/jobs/:id/complete` | report emitted receipt with the fiscal progressive |
| `POST /api/fiscal-bridge/jobs/:id/fail` | report emission failure |

Certified fiscal emission (Path B) is **opt-in**: the tenant enables it in the
web UI and the RT device config (host/port/model) is delivered to the agent via
the heartbeat response. The agent talks to the Registratore Telematico over TCP
using the generic protocollo RT text command family (`fiscal.go`); only agents
with a configured device claim fiscal jobs, and only `receipt` jobs require the
`enabled` toggle — connection tests and daily chiusura run before enabling.

Fiscal claims are **area-gated** like print jobs: only a bridge assigned to the
`cashier` claimed area may claim certified fiscal jobs (enforced both by the
API and locally by the agent). A kitchen- or bar-only agent never pulls a
cashier receipt, so the cashier station remains the sole owner of the RT
device.

All bridge requests carry:
- `X-Print-Bridge-Key: <6-digit code>` — the credential
- `X-Bridge-Instance-Id: <stable UUID>` — claim ownership (persisted in config)

The agent receives its administrative `claimedAreas` and station→printer
mappings from the heartbeat response. The admin configures these in Settings;
the agent persists them locally and uses them for subsequent queue claims and
routing. A bridge with no claimed areas intentionally receives no jobs.

### Transports: QZ Tray or raw network printer

A mapping can target either:
- **QZ Tray** (`name`): a printer installed on the POS PC, printed through the
  local QZ Tray WebSocket; or
- **Rete/IP** (`ip` + `port`, default `9100`): raw ESC/POS sent directly to the
  printer over TCP, bypassing QZ Tray and the OS driver entirely.

This means a station can be bound to a network printer by IP and print from any
POS PC on the same LAN, not only the machine where the printer was installed.

### Network autodiscovery

From **Settings → Stampa**, the admin can press **Scansiona rete** on a bridge.
The command is delivered in the heartbeat response; the agent then probes its
local RFC1918 subnets (auto-detected) for hosts with TCP port 9100 open, reads
the ARP table for the MAC/vendor, and reports the devices back
(`POST /api/print-bridge/discovered-printers`). Each discovered device has a
**Test** button that prints an identification ticket straight to `ip:port`, so
the operator can see which physical printer it is before binding it to a
station. The scan never leaves private ranges and is strictly opt-in.

The same one-shot command channel also powers a direct test print to an
arbitrary IP before it is mapped.

### Autostart (Windows)

On first run `ensureStartup` registers a per-user logon task
(`schtasks /SC ONLOGON`, name "GustoPOS Print Agent") running the agent in the
interactive session — required because QZ Tray also runs there. If the task
cannot be created (a pre-existing task owned by another account, or a
locked-down policy that denies `schtasks`), it falls back to the
`HKCU\...\Run` key, which needs no elevation. On Linux/macOS the
systemd/launchd unit provides autostart instead.

### Self-update

`AutoUpdate` (config, default enabled) makes the agent check the deploy
origin's public `/downloads/version.json` — the manifest written by
`make publish-downloads` — right after startup and then every 6 hours. When the
manifest advertises a newer semver, the agent:

1. picks the artifact for its `GOOS/GOARCH`;
2. downloads it from `<origin>/downloads/bin/<file>`;
3. verifies its SHA-256 against the manifest;
4. replaces the running binary and restarts itself.

Only the configured, trusted API origin is contacted and every artifact is
checksum-verified. On Windows a detached `cmd` waits for the process to exit,
moves the new binary into place (verifying the move) and relaunches it (no
console window); the single-instance mutex is released before the new process
starts. An admin can also force it from **Settings → Stampa** → *Aggiorna
agente* (one-shot `update` command delivered in the heartbeat response).

### Lifecycle & robustness

- **Supervised restart**: a transient failure (network, QZ, API 5xx) restarts
  the agent with exponential backoff (1s → 60s) instead of killing the process.
  Only an explicit shutdown, a failed pairing or a self-update end it.
- **Graceful shutdown**: SIGTERM/SIGINT and the tray *Esci* cancel the agent,
  close QZ Tray, stop the dashboard and release the single-instance lock; a
  bounded wait (5s) guarantees it exits even if a poll is in flight.
- **Single instance, all platforms**: a named Windows mutex or a Unix `flock`.
  A second launch does not run a duplicate: it opens the dashboard of the
  instance that is already running (and logs the URL when no browser is
  available).
- **Safe updates**: the updater is launched before anything is torn down and
  waits for the current process to exit, then swaps the binary only if the move
  succeeds, and only then starts the new one. A failed launch keeps the running
  version untouched; a watchdog forces exit if a cleanup hangs.
- **No blocking dialogs in background**: the Windows logon task runs the exe
  with `-background`, so an error is written to the log instead of opening a
  modal dialog that would hang an unattended run.
- **Persistent log**: `agent.log` (rotating, 2 MiB × 3) lives next to
  `config.json` — `%LOCALAPPDATA%\GustoPOS\PrintAgent\` on Windows,
  `/etc/gustopos-print-agent/` on Linux. The writer is error-tolerant, so the
  ring buffer and file are always written even when stderr is unavailable.
- **Panic recovery**: a panic in the agent loop or any goroutine is logged with
  its stack and does not take the process down.
- **`.last-exit.json`** records why the previous run stopped (shutdown, update,
  path) and is logged on the next start.
- **Anti-loop updates**: repeated failed swaps of the same version back off for
  an hour (`.update-attempt.json`) instead of retrying forever.
- **Quiet fiscal poll**: the "not the cashier bridge" notice is logged only when
  the claimed areas change.


## Local diagnostics dashboard

The agent exposes a **loopback-only** dashboard on `http://127.0.0.1:8183`
(config `dashboardPort`, env `GUSTOPOS_AGENT_DASHBOARD_PORT`; auto-falls back to
the next free port if busy). It is never bound to a public interface, so
nothing is exposed and machines/tenants cannot collide.

It shows: pairing/bridge state, QZ Tray connection, discovered printers,
claimed areas + area→printer mappings, job counters and the last error, a live
log view (in-memory ring buffer, 2000 entries), the recent job history, and a
**Scarica diagnostica** button that exports a text bundle for bug reports.

- Windows tray: "Apri pannello diagnostica".
- Actions: reconnect QZ, test print to an area (validates the mapping),
  re-pair (insert the 6-digit code again), download diagnostics.

Logs are also shipped to the API (`POST /api/print-bridge/diagnostics`) every
heartbeat, so an admin can read a remote POS agent's logs from
**Settings → Configurazioni Stampa → Diagnostica bridge** (retention 7 days).

## Build

Requires Go 1.22+ on the **build machine only** (nothing is installed on the POS).

```bash
make build          # local binary → bin/gustopos-print-agent
make linux          # static amd64+arm64
make windows        # gustopos-print-agent-windows-amd64.exe
make darwin
```

> The Windows target is linked with `-H=windowsgui` (see `WINDOWS_LDFLAGS` in
> the Makefile): the exe runs silently in the notification tray with **no
> console window**. Diagnostics stay available in the loopback dashboard and in
> the tray menu.

## Deploy (Linux POS with systemd)

```bash
make install               # copies binary to /usr/local/bin
# edit /etc/systemd/system/gustopos-print-agent.service → GUSTOPOS_API_URL
make install-service       # installs + enables the unit
systemctl start gustopos-print-agent
```

First boot: the agent opens the pairing page in the default browser
(`http://127.0.0.1:<port>`). If no display is available, the URL is printed to
the journal (`journalctl -u gustopos-print-agent`).

## Deploy (Windows POS)

> **First run is zero-config:** just double-click the exe. The pairing page
> opens in the browser with the GustoPOS server pre-filled (the agent's
> build-time default origin — `https://test.franksbar.it` for the current
> release) and an editable server field. Type the 6-digit code from
> **Settings → Configurazioni Stampa** → done. The agent saves `config.json`
> itself and auto-reconnects on every later start. No flags, no manual file.
>
> Only if the machine must pair against a *different* server than the one the
> binary was shipped for, either edit the server field on the pairing page or
> pass `-api https://...` / `GUSTOPOS_API_URL` once.

1. Copy `gustopos-print-agent-windows-amd64.exe` anywhere on the machine.
2. Double-click it → the pairing page opens with the server pre-filled → type
   the 6-digit code from **Settings → Configurazioni Stampa**.
3. After pairing, the agent registers an `ONLOGON` task automatically for the
   current Windows user. It reconnects using the saved `config.json`; no manual
   Task Scheduler setup is required. Starting the exe again is safe: a
   single-instance lock prevents duplicate agents.

## Configuration

The agent persists `config.json` **automatically** after pairing — users never
create or edit it. On Windows, new installations store it in
`%LOCALAPPDATA%\\GustoPOS\\PrintAgent\\config.json`; an existing legacy file in
`%ProgramData%\\gustopos-print-agent\\config.json` is preserved and continues
to be used. The same pairing registers the current executable for automatic
startup at user logon; the task is refreshed on each run so upgrades and moved
executables do not retain a stale path. Remove it with
`gustopos-print-agent-windows-amd64.exe -uninstall-startup`. The default server origin is baked into the binary
(`defaultAPIBase`, overridable at build time via
`-ldflags "-X main.defaultAPIBase=..."`) and is pre-filled in the pairing page:


```json
{
  "apiBase": "https://pos.example.com",
  "bridgeId": "bridge_pos-ab12_9f3c",
  "instanceId": "c9a2…-uuid",
  "code": "123456",
  "qzPort": 8182,
  "qzSecure": false,
  "areas": ["kitchen", "bar", "cashier"],
  "printerNames": { "kitchen": "Epson-TM88", "bar": "Epson-TM88" },
  "discoveredPrinters": ["Epson-TM88", "Star TSP100"]
}
```

- `code` is the bound 6-digit credential (stored for auto-reconnect).
- `printerNames` maps area → QZ printer name. For Go agents, these names are
  selected from the `discoveredPrinters` list returned by QZ Tray; the admin UI
  does not accept arbitrary names for this path.
- `discoveredPrinters` is the last successful local QZ Tray discovery and is
  cached locally so a temporary QZ restart does not erase the UI options.
- `qzPort`/`qzSecure`: QZ Tray listener (default 8182 ws:// — the insecure
  port; 8181 is the secure WSS port). Use `wss://` + 8181 if the local QZ
  Tray config requires a secure connection.
- Override the config path with `GUSTOPOS_AGENT_CONFIG`.
- Windows startup runs as the logged-in user (not SYSTEM) so it can communicate with QZ Tray.

## Notes

- The 6-digit code becomes a **permanent credential once bound** (the 90s TTL
  only guards unbound codes against brute force). Detaching = revoke the
  secret in Settings; the agent re-pairs automatically.
- QZ Tray must already be installed and trust the GustoPOS signing certificate
  (the standard cert installers apply — silent printing).
