# Print Station Setup Guide

This guide walks you through installing and configuring QZ Tray on the restaurant's local PC (the "Print Station"). The Print Station runs a browser page that connects to QZ Tray and automatically prints orders to thermal printers.

---

## Prerequisites

- A Windows PC or Linux machine (Ubuntu/Debian) on the same local network as the VPS
- One or more thermal printers (USB or network)
- Google Chrome (recommended) or another Chromium-based browser
- Network connectivity to the GustoPOS VPS

---

## Linux (Ubuntu/Debian) — Headless Mode

Use headless mode if the Print Station runs without a desktop environment (e.g., a dedicated mini-PC or Raspberry Pi).

### 1. Install Java (OpenJDK 11+)

```bash
sudo apt update && sudo apt install -y openjdk-11-jdk
```

Verify:

```bash
java -version
```

### 2. Download and Install QZ Tray

```bash
# Download latest QZ Tray (2.2.4)
wget https://github.com/qzind/tray/releases/download/2.2.4/qz-tray-2.2.4.run

# Make executable and install
chmod +x qz-tray-2.2.4.run
sudo bash qz-tray-2.2.4.run
```

### 3. Install the tenant certificate (silent printing)

QZ Tray only prints silently when the certificate it receives chains to a CA it
loaded from `<install dir>/override.crt`. Each tenant has its own root and its
own leaf, so download the installer **from the tenant's domain** — it is
rendered by the server with the current fingerprints, nothing is hardcoded:

```bash
# Linux / macOS (as root)
curl -fsSL https://<tenant-domain>/signing/install-qz-cert.sh | sudo bash
```

Windows: open `https://<tenant-domain>/signing/install-qz-cert.bat` and run it
**as Administrator** (without elevation neither `C:\Program Files\QZ Tray\override.crt`
nor `%PROGRAMDATA%\qz\allowed.dat` can be written — that is exactly what makes
QZ report the certificate as untrusted).

The script verifies the chain, pins the published SHA-1 fingerprints, writes
`override.crt`, whitelists the certificate (lowercase, the form QZ matches) and
restarts QZ Tray. Details: [`docs/qz-certificate-remediation.md`](qz-certificate-remediation.md).

### 4. Start QZ Tray in Headless Mode

```bash
/opt/qz-tray/qz-tray --headless
```

### 5. Auto-start on Boot (systemd)

Create a systemd service file:

```bash
sudo nano /etc/systemd/system/qz-tray.service
```

Paste the following:

```ini
[Unit]
Description=QZ Tray Print Server
After=network.target

[Service]
ExecStart=/opt/qz-tray/qz-tray --headless
Restart=always
RestartSec=5
User=printer

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable qz-tray
sudo systemctl start qz-tray
```

Check status:

```bash
sudo systemctl status qz-tray
```

---

## Windows

### 1. Install QZ Tray

1. Download the installer from [QZ Tray Releases](https://github.com/qzind/tray/releases)
2. Run the `.exe` installer
3. Follow the installation wizard
4. QZ Tray starts automatically and appears in the system tray (bottom-right corner)

### 2. Verify QZ Tray is Running

Look for the QZ Tray icon in the system tray. Right-click it to see available printers and settings.

### 3. Configure Windows Firewall

If connecting from a remote browser, allow QZ Tray ports:

```powershell
# Run in PowerShell as Administrator
netsh advfirewall firewall add rule name="QZ Tray" dir=in action=allow protocol=TCP localport=8181-8484
```

---

## Printer Configuration

### Network Printers (TCP/IP)

For printers connected via Ethernet (e.g., Epson TM-T88V with network interface):

**Linux (CUPS):**

```bash
# Add a network printer
lpadmin -p "Kitchen-Printer" -E -v socket://192.168.1.50:9100 -m raw

# Verify
lpstat -p Kitchen-Printer
```

**Windows:**

1. Open **Settings > Devices > Printers & scanners**
2. Click **Add a printer or scanner**
3. Select **The printer that I want isn't listed**
4. Choose **Add a printer using a TCP/IP address or hostname**
5. Enter the printer's IP address (e.g., `192.168.1.50`) and port `9100`

### USB Printers

1. Connect the printer via USB
2. Install the manufacturer driver (Epson, Star, Bixolon, etc.)
3. Note the **exact printer name** as shown in the OS — this name must match in the Print Station settings

### Printer Naming Convention

Use clear, area-specific names:

| Area     | Example Name         |
|----------|----------------------|
| Kitchen  | `Kitchen-Printer`    |
| Bar      | `Bar-Printer`        |
| Cashier  | `Cashier-Printer`    |

---

## Print Station Setup

The Print Station is a browser-based interface that polls the GustoPOS API for pending print jobs and sends them to local printers via QZ Tray.

### 1. Access the Print Station

Open Chrome on the Print Station PC and navigate to:

```
http://YOUR_VPS_IP:11901/print-station.html
```

Or copy the `print-station.html` file to the PC and open it locally in Chrome.

### 2. Configure Settings

In the Print Station UI, configure:

| Setting           | Value                                      |
|-------------------|--------------------------------------------|
| **API Base URL**  | `http://YOUR_VPS_IP:11901`                 |
| **Kitchen Printer** | Select from dropdown (e.g., `Kitchen-Printer`) |
| **Bar Printer**     | Select from dropdown (e.g., `Bar-Printer`)     |
| **Cashier Printer** | Select from dropdown (e.g., `Cashier-Printer`) |

### 3. Connect to QZ Tray

1. Click the **Connect** button
2. **No dialog should appear** — the certificate is already trusted and
   whitelisted. If QZ Tray prompts anyway, stop and diagnose it:
   open `https://<tenant-domain>/signing/debug-qz-cert.ps1`, or run
   **"Verifica QZ Tray"** in the agent dashboard (`http://127.0.0.1:8183`),
   which names the failing check (override.crt, catena, orologio, allowed.dat)
3. The status indicator should turn green

### 4. Enable Auto-Connect

Check the **Auto-connect** option so the Print Station reconnects automatically after restarts.

### 5. Verify Printers

Once connected, the Print Station lists all available printers detected by QZ Tray. Select the correct printer for each area (kitchen, bar, cashier).

---

## How It Works

```
┌─────────────┐     HTTP Poll     ┌──────────────┐     Print Job     ┌──────────┐
│   GustoPOS   │ ◄──────────────► │ Print Station │ ──────────────►  │  QZ Tray │
│   (VPS)      │                   │  (Browser)    │                   │ (Local)  │
│  Port 11901  │                   │  Chrome       │                   │ WS:8181  │
└─────────────┘                    └──────────────┘                   └────┬─────┘
                                                                          │
                                                                          ▼
                                                                     ┌──────────┐
                                                                     │ Thermal  │
                                                                     │ Printer  │
                                                                     └──────────┘
```

1. **GustoPOS** creates print jobs when orders are placed
2. **Print Station** polls `GET /api/print-jobs/poll?areas=kitchen,bar,cashier` every few seconds
3. Pending jobs are sent to **QZ Tray** via WebSocket
4. **QZ Tray** sends the ESC/POS data to the physical printer

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **QZ Tray not found** | Ensure QZ Tray is running — check system tray (Windows) or `systemctl status qz-tray` (Linux) |
| **Printer not listed** | Check USB connection, install the correct driver, restart QZ Tray |
| **Connection refused** | Verify firewall allows ports 8181–8484; ensure QZ Tray is listening |
| **Print job fails** | Verify the printer name in Print Station settings matches the OS printer name **exactly** (case-sensitive) |
| **Jobs not appearing** | Check the API Base URL is correct and the VPS is reachable from the local network |
| **QZ Tray certificate error** | Run the preflight: agent dashboard → "Verifica QZ Tray", or `https://<tenant>/signing/debug-qz-cert.ps1`. It tells you whether `override.crt` is missing/foreign, the chain fails, the clock is wrong or `allowed.dat` is not writable |
| **Browser blocks connection** | Use `http://` (not `https://`) for local network, or add a security exception for the QZ Tray WebSocket |
| **Prints blank pages** | Ensure the printer paper is loaded correctly and the ESC/POS protocol is selected in GustoPOS settings |

---

## Ports Reference

| Port   | Service            | Direction |
|--------|--------------------|-----------|
| 8181–8484 | QZ Tray WebSocket | Local only |
| 11901  | GustoPOS API       | From local network to VPS |
| 11905  | Print Bridge       | Optional (spool fallback) |
| 9100   | Printer raw TCP    | Local network |

---

## Quick Start Checklist

- [ ] QZ Tray installed and running
- [ ] Thermal printer(s) connected and drivers installed
- [ ] Printer names noted (exact names from OS)
- [ ] Print Station page opened in Chrome
- [ ] API Base URL configured
- [ ] Printer mapping configured for each area
- [ ] QZ Tray connected (green status)
- [ ] Auto-connect enabled
- [ ] Test print successful
