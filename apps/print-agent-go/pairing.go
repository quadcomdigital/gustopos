package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"html"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"runtime"
	"strings"
)

// ─── Pairing UI ─────────────────────────────────────────────────────────
//
// The "smallest possible GUI": a one-page localhost site that opens in the
// default browser. The staff types the 6-digit code from Settings and the
// agent binds itself to the tenant in one heartbeat. The server origin is
// pre-filled (and editable) on the page — so a double-click is enough, no
// flags and no manual config file. Pairing is also re-triggered automatically
// when the bridge is detached (credential revoked in Settings → API 401).

// pairingPage returns the pairing HTML with the server origin pre-filled.
func pairingPage(apiBase string) string {
	apiBase = html.EscapeString(apiBase)
	return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GustoPOS — Collega stampante</title>
<style>
  :root { --bg:#0f0f1a; --card:#1a1a2e; --border:#33335a; --text:#e0e0f0; --muted:#8888aa; --green:#00ff88; --red:#ff4444; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:var(--bg); color:var(--text); min-height:100vh; display:flex; align-items:center; justify-content:center; }
  .card { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:40px 36px; width:min(420px, 92vw); text-align:center; }
  .logo { font-size:14px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); margin-bottom:18px; }
  h1 { font-size:20px; margin-bottom:12px; }
  .hint { color:var(--muted); font-size:13px; line-height:1.6; margin-bottom:24px; }
  .hint strong { color:var(--text); }
  label { display:block; text-align:left; font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; margin:0 0 6px; }
  .server-wrap { margin-bottom:18px; }
  input.server { font-size:14px; letter-spacing:.02em; text-align:left; }
  input.code { font-size:26px; text-align:center; letter-spacing:.4em; }
  input { width:100%; padding:14px; font-size:14px; background:#0f0f1a; border:1px solid var(--border); border-radius:8px; color:var(--text); outline:none; }
  input:focus { border-color:var(--green); }
  button { width:100%; margin-top:14px; padding:14px; font-size:14px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; background:var(--green); border:none; border-radius:8px; color:#000; cursor:pointer; }
  button:disabled { opacity:.5; cursor:not-allowed; }
  #status { margin-top:14px; font-size:13px; min-height:20px; }
  #status.ok { color:var(--green); }
  #status.err { color:var(--red); }
</style>
</head>
<body>
  <div class="card">
    <div class="logo">GustoPOS · Print Agent</div>
    <h1>Collega questa stampante</h1>
    <p class="hint">Inserisci il codice di 6 cifre che trovi in <strong>Settings → Configurazioni Stampa</strong>.</p>
    <form id="f">
      <div class="server-wrap">
        <label for="server">Server GustoPOS</label>
        <input id="server" class="server" type="text" value="` + apiBase + `" spellcheck="false">
      </div>
      <label for="code">Codice di collegamento</label>
      <input id="code" class="code" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="000000" autocomplete="one-time-code" autofocus>
      <button type="submit">Collega</button>
    </form>
    <div id="status"></div>
  </div>
  <script>
    const f=document.getElementById('f'), c=document.getElementById('code'), sv=document.getElementById('server'), s=document.getElementById('status');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn=f.querySelector('button'); btn.disabled=true; s.className=''; s.textContent='Verifica…';
      try {
        const r=await fetch('/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:c.value, server:sv.value.trim()})});
        const d=await r.json();
        if(r.ok){ s.className='ok'; s.textContent='✅ Collegato! Puoi chiudere questa pagina.'; }
        else { s.className='err'; s.textContent='❌ '+(d.error||'Codice non valido o scaduto. Riprova.'); btn.disabled=false; }
      } catch(err){ s.className='err'; s.textContent='❌ Errore di rete: '+err; btn.disabled=false; }
    });
  </script>
</body>
</html>`
}

// PairingServer serves the pairing page on a random loopback port and opens
// the default browser once.
type PairingServer struct {
	ln         net.Listener
	srv        *http.Server
	done       chan *Config // receives the paired config (or nil on failure)
	api        *API
	bridgeID   string
	instanceID string
	prev       *Config // previous config on a re-pair (may be nil)
}

// StartPairingServer begins serving the pairing page and returns immediately.
// prev (optional) is the previous config on a re-pair; its QZ/area/printer
// settings are carried over into the freshly paired config.
func StartPairingServer(apiBase string, prev *Config) (*PairingServer, error) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return nil, err
	}
	// Generate a fresh bridge identity for this pairing attempt.
	host, _ := os.Hostname()
	bridgeID := "bridge_" + sanitizeID(host) + "_" + randomHex(3)
	instanceID := randomUUID()
	// Re-pairing must preserve the machine identity. The server uses this
	// stable value to reuse the existing bridge row instead of creating a
	// second bridge for every newly issued short code.
	if prev != nil && prev.InstanceID != "" {
		instanceID = prev.InstanceID
	}
	ps := &PairingServer{
		ln:         ln,
		done:       make(chan *Config, 1),
		api:        NewAPI(apiBase, "", "", instanceID),
		bridgeID:   bridgeID,
		instanceID: instanceID,
		prev:       prev,
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/", ps.handleIndex)
	mux.HandleFunc("/pair", ps.handlePair)
	ps.srv = &http.Server{Handler: mux}
	go func() { _ = ps.srv.Serve(ln) }()
	return ps, nil
}

// URL returns the localhost address of the pairing page.
func (p *PairingServer) URL() string {
	return fmt.Sprintf("http://127.0.0.1:%d", p.ln.Addr().(*net.TCPAddr).Port)
}

// Done returns the channel that receives the paired config.
func (p *PairingServer) Done() <-chan *Config { return p.done }

// Stop shuts down the pairing server.
func (p *PairingServer) Stop() { _ = p.srv.Close() }

func (p *PairingServer) handleIndex(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(pairingPage(p.api.Base)))
}

func (p *PairingServer) handlePair(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code   string `json:"code"`
		Server string `json:"server"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Richiesta non valida"})
		return
	}
	code := strings.TrimSpace(body.Code)
	if len(code) != 6 || !allDigits(code) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Il codice deve essere di 6 cifre."})
		return
	}
	// The pairing page carries an editable server field (pre-filled with the
	// default origin); if the user changed it, re-target the probe at it.
	rawServer := strings.TrimSpace(body.Server)
	server := normalizeServerURL(rawServer)
	if rawServer != "" && server == "" {
		// Non-empty but unusable — tell the user instead of silently pairing
		// against the default origin.
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Il campo server non è un indirizzo valido (es. https://test.franksbar.it)."})
		return
	}
	if server != "" {
		p.api.Base = server
		p.api.SignBase = server // keep cert/sign fetches on the same origin
	}

	// Probe with the code. A 401 means invalid/expired; any other failure is
	// transient and reported as such.
	p.api.Code = code
	if _, err := p.api.Heartbeat(&Config{
		APIBase:    p.api.Base,
		BridgeID:   p.bridgeID,
		InstanceID: p.instanceID,
		Code:       code,
		// The API schema requires `areas` to be an array (null is rejected),
		// so probe with the default areas like the running agent does.
		Areas: DefaultConfig().Areas,
	}, nil); err != nil {
		if IsDetached(err) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Codice non valido o scaduto. Generane uno nuovo in Settings."})
		} else {
			log.Printf("pairing heartbeat failed: %v", err)
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "Impossibile raggiungere il server. Riprova."})
		}
		return
	}

	cfg := &Config{
		APIBase:      p.api.Base,
		BridgeID:     p.bridgeID,
		InstanceID:   p.instanceID,
		Code:         code,
		QZPort:       8182, // QZ Tray insecure WS port
		Areas:        []string{"kitchen", "bar", "cashier"},
		PrinterNames: map[string]string{},
	}
	if p.prev != nil {
		// Re-pair: keep the machine's QZ + routing settings, only the
		// credential (code/bridge/instance) is new. Guard each field so a
		// degenerate hand-edited config can't wipe the defaults below.
		if p.prev.QZPort != 0 {
			cfg.QZPort = p.prev.QZPort
		}
		cfg.QZSecure = p.prev.QZSecure
		if len(p.prev.Areas) > 0 {
			cfg.Areas = p.prev.Areas
		}
		if p.prev.PrinterNames != nil {
			cfg.PrinterNames = p.prev.PrinterNames
		}
		if p.prev.PrinterTargets != nil {
			cfg.PrinterTargets = p.prev.PrinterTargets
		}
	}
	if err := cfg.Save(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Salvataggio configurazione fallito: " + err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"ok": "true"})
	select {
	case p.done <- cfg:
	default:
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

// openBrowser opens the pairing page in the default browser (best effort).
func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	if err := cmd.Start(); err != nil {
		log.Printf("could not open browser automatically — open %s manually", url)
	} else {
		_ = cmd.Process.Release()
	}
}

// ─── helpers ────────────────────────────────────────────────────────────

func sanitizeID(s string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(s) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			b.WriteRune(r)
		} else {
			b.WriteRune('-')
		}
	}
	out := strings.Trim(b.String(), "-")
	if out == "" {
		return "pos"
	}
	return out
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func randomUUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// normalizeServerURL makes a user-typed server value usable: strips trailing
// slashes and prepends https:// when no scheme is present (so a plain
// "test.franksbar.it" works). Returns "" when the value is empty, and a
// canonical https:// URL otherwise.
func normalizeServerURL(s string) string {
	if s == "" {
		return ""
	}
	s = strings.TrimRight(s, "/")
	if !strings.HasPrefix(s, "http://") && !strings.HasPrefix(s, "https://") {
		s = "https://" + s
	}
	u, err := url.Parse(s)
	if err != nil || u.Host == "" {
		return "" // not a usable URL — caller falls back to the default
	}
	// The API origin is the host root. Older setup instructions sometimes
	// saved `https://host/api`, but the public certificate route lives at
	// `/signing/digital-certificate.txt` (not `/api/signing/...`). Strip only
	// that exact API suffix so normal path-based deployments remain intact.
	if strings.TrimRight(u.Path, "/") == "/api" {
		u.Path = ""
		u.RawPath = ""
	}
	return strings.TrimRight(u.String(), "/")
}

func allDigits(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}
