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

All bridge requests carry:
- `X-Print-Bridge-Key: <6-digit code>` — the credential
- `X-Bridge-Instance-Id: <stable UUID>` — claim ownership (persisted in config)

The agent receives its administrative `claimedAreas` and area→printer mappings
from the heartbeat response. The admin configures these in Settings; the agent
persists them locally and uses them for subsequent queue claims and QZ routing.
A bridge with no claimed areas intentionally receives no jobs.

## Build

Requires Go 1.22+ on the **build machine only** (nothing is installed on the POS).

```bash
make build          # local binary → bin/gustopos-print-agent
make linux          # static amd64+arm64
make windows        # gustopos-print-agent-windows-amd64.exe
make darwin
```

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
