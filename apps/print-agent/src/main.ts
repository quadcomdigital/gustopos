import { app, Tray, Menu, nativeImage, BrowserWindow, ipcMain, type MenuItemConstructorOptions } from "electron";
import path from "node:path";
import fs from "node:fs";
import { PrintAgent } from "./agent";

// ─── Configuration ──────────────────────────────────────────────────────

const CONFIG_PATH = path.join(app.getPath("userData"), "print-agent-config.json");

interface AgentConfig {
  bridgeUrl: string;
  bridgeSecret: string;
  bridgeId: string;
  qzPort: number;
  qzSecure: boolean;
}

function loadConfig(): AgentConfig | null {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) as AgentConfig;
    }
  } catch {
    console.error("[print-agent] failed to load config");
  }
  return null;
}

function saveConfig(config: AgentConfig): void {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

// ─── Globals ────────────────────────────────────────────────────────────

let tray: Tray | null = null;
let agent: PrintAgent | null = null;
let setupWindow: BrowserWindow | null = null;

/**
 * Build a minimal 16×16 PNG with a filled circle of the given colour.
 * Returns a nativeImage suitable for Tray.setImage().
 */
function createTrayIcon(
  r: number = 128,
  g: number = 128,
  b: number = 128,
): ReturnType<typeof nativeImage.createFromBuffer> {
  // Build RGBA pixel data
  const w = 16, h = 16;
  const pixels = Buffer.alloc(w * h * 4);
  const cx = 7.5, cy = 7.5, outerR = 6.5;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const offset = (y * w + x) * 4;

      if (dist <= outerR - 1) {
        // createFromBitmap expects BGRA order
        pixels[offset] = b;
        pixels[offset + 1] = g;
        pixels[offset + 2] = r;
        pixels[offset + 3] = 255;
      } else if (dist <= outerR) {
        // Anti-aliased edge (BGRA order)
        const alpha = Math.round((outerR - dist) * 255);
        pixels[offset] = b;
        pixels[offset + 1] = g;
        pixels[offset + 2] = r;
        pixels[offset + 3] = alpha;
      }
      // else: fully transparent
    }
  }

  // Encode as PNG via nativeImage.createFromBitmap
  return nativeImage.createFromBitmap(pixels, { width: w, height: h, scaleFactor: 1 });
}

function getStatusColor(status: string): [number, number, number] {
  switch (status) {
    case "connected":
      return [0, 200, 0];
    case "connecting":
      return [255, 165, 0];
    case "error":
      return [220, 50, 50];
    default:
      return [128, 128, 128];
  }
}

function buildTrayMenu(status: string): MenuItemConstructorOptions[] {
  return [
    { label: `Status: ${status}`, enabled: false },
    { type: "separator" },
    {
      label: "Setup",
      click: () => {
        void openSetupWindow();
      },
    },
    {
      label: "Reconnect",
      click: () => {
        if (agent) {
          agent.stop();
          void agent.start();
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.quit();
      },
    },
  ];
}

// ─── Setup Window ───────────────────────────────────────────────────────

async function openSetupWindow(): Promise<void> {
  if (setupWindow) {
    setupWindow.focus();
    return;
  }

  const existingConfig = loadConfig();

  setupWindow = new BrowserWindow({
    width: 480,
    height: 420,
    resizable: false,
    title: "GustoPOS Print Agent — Setup",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Build a simple setup form as inline HTML
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>GustoPOS Print Agent Setup</title>
  <style>
    body { font-family: -apple-system, sans-serif; padding: 24px; background: #f5f5f5; }
    h2 { margin: 0 0 16px; color: #1a365d; }
    label { display: block; font-size: 13px; font-weight: 600; color: #4a5568; margin: 12px 0 4px; }
    input { width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
    input:focus { outline: none; border-color: #3182ce; box-shadow: 0 0 0 2px rgba(49,130,206,0.2); }
    button { margin-top: 20px; width: 100%; padding: 10px; background: #1a365d; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; }
    button:hover { background: #2d3748; }
    .status { margin-top: 12px; font-size: 13px; text-align: center; }
    .error { color: #e53e3e; }
    .success { color: #38a169; }
  </style>
</head>
<body>
  <h2>GustoPOS Print Agent</h2>
  <form id="setupForm">
    <label for="bridgeUrl">Bridge URL</label>
    <input id="bridgeUrl" type="text" placeholder="ws://your-vps:11905" value="${escapeHtml(existingConfig?.bridgeUrl ?? '')}" required>

    <label for="bridgeSecret">Bridge Secret</label>
    <input id="bridgeSecret" type="password" placeholder="pbos_..." value="${escapeHtml(existingConfig?.bridgeSecret ?? '')}" required>

    <label for="bridgeId">Bridge ID (unique for this machine)</label>
    <input id="bridgeId" type="text" placeholder="kitchen-1" value="${escapeHtml(existingConfig?.bridgeId ?? '')}" required>

    <label for="qzPort">QZ Tray Port</label>
    <input id="qzPort" type="number" placeholder="8181" value="${existingConfig?.qzPort ?? 8181}" required>

    <label style="display:flex;align-items:center;gap:8px;margin-top:12px;">
      <input id="qzSecure" type="checkbox" ${existingConfig?.qzSecure ? 'checked' : ''} style="width:auto;">
      Use secure connection (wss://) to QZ Tray
    </label>

    <button type="submit">Save & Connect</button>
  </form>
  <div id="status" class="status"></div>
  <script>
    const { ipcRenderer } = require('electron');
    document.getElementById('setupForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const config = {
        bridgeUrl: document.getElementById('bridgeUrl').value.trim(),
        bridgeSecret: document.getElementById('bridgeSecret').value.trim(),
        bridgeId: document.getElementById('bridgeId').value.trim(),
        qzPort: parseInt(document.getElementById('qzPort').value, 10),
        qzSecure: document.getElementById('qzSecure').checked,
      };
      if (!config.bridgeUrl || !config.bridgeSecret || !config.bridgeId) {
        document.getElementById('status').innerHTML = '<span class="error">All fields are required</span>';
        return;
      }
      ipcRenderer.send('save-config', config);
      document.getElementById('status').innerHTML = '<span class="success">Saved! Restarting agent...</span>';
    });
    function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  </script>
</body>
</html>`;

  setupWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  setupWindow.on("closed", () => {
    setupWindow = null;
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── App Lifecycle ──────────────────────────────────────────────────────

function updateTray(status: string): void {
  if (!tray) return;
  const [r, g, b] = getStatusColor(status);
  tray.setImage(createTrayIcon(r, g, b));
  tray.setToolTip(`GustoPOS Print Agent — ${status}`);
  tray.setContextMenu(Menu.buildFromTemplate(buildTrayMenu(status)));
}

function startAgent(): void {
  const config = loadConfig();
  if (!config) {
    // No config — open setup on first run
    void openSetupWindow();
    return;
  }

  if (agent) {
    agent.stop();
  }

  agent = new PrintAgent(config, (status) => {
    updateTray(status);
  });

  void agent.start();
}

app.whenReady().then(() => {
  // Tray icon
  tray = new Tray(createTrayIcon(128, 128, 128));
  tray.setToolTip("GustoPOS Print Agent");
  tray.setContextMenu(Menu.buildFromTemplate(buildTrayMenu("starting")));

  // Handle config save from setup window
  ipcMain.on("save-config", (_event, config: AgentConfig) => {
    saveConfig(config);
    if (setupWindow) {
      setupWindow.close();
    }
    startAgent();
  });

  // Start the agent
  startAgent();
});

// Prevent app from quitting when all windows are closed (tray app)
app.on("window-all-closed", () => {
  // Don't quit — tray app stays alive
});

app.on("before-quit", () => {
  if (agent) {
    agent.stop();
  }
});

// Auto-start on login via electron.app.setLoginItemSettings
app.setLoginItemSettings({
  openAtLogin: true,
  openAsHidden: true,
});
