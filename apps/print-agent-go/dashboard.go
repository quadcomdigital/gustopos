package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"strings"
	"time"
)

// dashboardCallbacks are the operations the dashboard can trigger in the agent
// loop. They are passed as callbacks to avoid a circular dependency.
type dashboardCallbacks struct {
	ReconnectQZ func()
	RequestPair func()
	TestPrint   func(area string) error
	Config      func() *Config
}

// dashboardServer is a loopback-only HTTP server exposing local diagnostics for
// the POS machine (association, status, live logs, job history, export).
type dashboardServer struct {
	server  *http.Server
	listen  net.Listener
	runtime *AgentRuntime
}

const dashboardDefaultPort = 8183

// StartDashboard binds the dashboard to 127.0.0.1. If the preferred port is
// busy it walks upward a few ports; it never binds a public interface, so
// multiple tenants on different machines never expose or share anything.
func StartDashboard(rt *AgentRuntime, cb dashboardCallbacks, preferredPort int) (*dashboardServer, error) {
	if preferredPort <= 0 {
		preferredPort = dashboardDefaultPort
	}
	listen, err := listenLoopback(preferredPort)
	if err != nil {
		return nil, err
	}

	mux := http.NewServeMux()
	ds := &dashboardServer{runtime: rt}
	mux.HandleFunc("/", ds.handleIndex)
	mux.HandleFunc("/api/state", ds.handleState)
	mux.HandleFunc("/api/diagnostics", ds.handleDiagnostics)
	mux.HandleFunc("/api/diagnostics/download", ds.handleDiagnosticsDownload)
	mux.HandleFunc("/api/qz/reconnect", ds.guardPost(func(w http.ResponseWriter, _ *http.Request) {
		if cb.ReconnectQZ != nil {
			cb.ReconnectQZ()
		}
		writeJSON(w, 200, map[string]any{"ok": true})
	}))
	mux.HandleFunc("/api/pair", ds.guardPost(func(w http.ResponseWriter, _ *http.Request) {
		if cb.RequestPair != nil {
			cb.RequestPair()
		}
		writeJSON(w, 200, map[string]any{"ok": true})
	}))
	mux.HandleFunc("/api/test-print", ds.guardPost(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Area string `json:"area"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if strings.TrimSpace(body.Area) == "" {
			body.Area = "kitchen"
		}
		if cb.TestPrint == nil {
			writeJSON(w, 501, map[string]any{"ok": false, "error": "test print not available"})
			return
		}
		if err := cb.TestPrint(body.Area); err != nil {
			writeJSON(w, 500, map[string]any{"ok": false, "error": err.Error()})
			return
		}
		writeJSON(w, 200, map[string]any{"ok": true})
	}))

	server := &http.Server{
		Handler:           securityHeaders(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}
	ds.server = server
	ds.listen = listen

	go func() {
		if err := server.Serve(listen); err != nil && err != http.ErrServerClosed {
			log.Printf("[dashboard] server stopped: %v", err)
		}
	}()

	return ds, nil
}

func listenLoopback(preferred int) (net.Listener, error) {
	var lastErr error
	for port := preferred; port < preferred+10; port++ {
		listener, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
		if err == nil {
			return listener, nil
		}
		lastErr = err
	}
	return nil, lastErr
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "no-referrer")
		next.ServeHTTP(w, r)
	})
}

func (d *dashboardServer) URL() string {
	return fmt.Sprintf("http://%s", d.listen.Addr().String())
}

func (d *dashboardServer) Stop() {
	if d.server != nil {
		_ = d.server.Close()
	}
}

func (d *dashboardServer) guardPost(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		next(w, r)
	}
}

func (d *dashboardServer) snapshot() map[string]any {
	status := d.runtime.Status.Snapshot()
	// Never expose the pairing credential on the (loopback) page either.
	return map[string]any{
		"status": status,
		"jobs":   d.runtime.Jobs.Snapshot(),
		"logs":   d.runtime.Logs.Snapshot(),
	}
}

func (d *dashboardServer) handleState(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, d.snapshot())
}

func (d *dashboardServer) handleDiagnostics(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, d.snapshot())
}

func (d *dashboardServer) handleDiagnosticsDownload(w http.ResponseWriter, _ *http.Request) {
	status := d.runtime.Status.Snapshot()
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Content-Disposition", "attachment; filename=\"gustopos-print-diagnostics.txt\"")
	var b strings.Builder
	fmt.Fprintf(&b, "GustoPOS print agent diagnostics\n")
	fmt.Fprintf(&b, "generated: %s\n\n", time.Now().UTC().Format(time.RFC3339))
	fmt.Fprintf(&b, "== STATUS ==\n")
	fmt.Fprintf(&b, "version: %s  os: %s\n", status.Version, status.OS)
	fmt.Fprintf(&b, "bridgeId: %s  apiBase: %s\n", status.BridgeID, status.APIBase)
	fmt.Fprintf(&b, "paired: %v  qzConnected: %v\n", status.Paired, status.QZConnected)
	fmt.Fprintf(&b, "claimedAreas: %s\n", strings.Join(status.ClaimedAreas, ","))
	fmt.Fprintf(&b, "mappings: %v\n", status.Mappings)
	fmt.Fprintf(&b, "printers: %s\n", strings.Join(status.DiscoveredPrinters, " | "))
	fmt.Fprintf(&b, "lastHeartbeatAt: %s  lastClaimAt: %s\n", status.LastHeartbeatAt, status.LastClaimAt)
	fmt.Fprintf(&b, "counters: claimed=%d printed=%d failed=%d\n", status.Claimed, status.Printed, status.Failed)
	fmt.Fprintf(&b, "lastError: %s\n\n", status.LastError)

	fmt.Fprintf(&b, "== JOB HISTORY (newest first) ==\n")
	for _, job := range d.runtime.Jobs.Snapshot() {
		fmt.Fprintf(&b, "%s %s %-8s %-8s %dms %s\n", job.Timestamp, job.Area, job.Status, job.JobID, job.DurationMs, job.Error)
	}

	fmt.Fprintf(&b, "\n== LOGS (oldest first) ==\n")
	for _, entry := range d.runtime.Logs.Snapshot() {
		component := ""
		if entry.Component != "" {
			component = "[" + entry.Component + "] "
		}
		fmt.Fprintf(&b, "%s %-5s %s%s\n", entry.Timestamp, entry.Level, component, entry.Message)
	}
	_, _ = w.Write([]byte(b.String()))
}

func (d *dashboardServer) handleIndex(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(dashboardHTML))
}

// dashboardHTML is intentionally dependency-free: one page, polled every 2s.
const dashboardHTML = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>GustoPOS · Print Agent</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.45 system-ui, sans-serif; background: #0f1216; color: #e6e9ef; }
  header { padding: 14px 18px; border-bottom: 1px solid #222933; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  h1 { font-size: 15px; margin: 0; font-weight: 600; }
  .pill { padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; }
  .ok { background: #16351f; color: #57d98a; }
  .bad { background: #3a1a1f; color: #ff7b88; }
  .muted { color: #8a94a6; }
  main { padding: 16px 18px 40px; display: grid; gap: 16px; max-width: 1100px; }
  section { background: #151a21; border: 1px solid #222933; border-radius: 10px; padding: 14px; }
  section h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .05em; color: #9aa4b5; margin: 0 0 10px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px 18px; }
  .kv { display: flex; justify-content: space-between; gap: 10px; border-bottom: 1px dashed #222933; padding: 4px 0; }
  .kv span:first-child { color: #9aa4b5; }
  .kv span:last-child { text-align: right; word-break: break-all; }
  button { background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: 7px 11px; font-weight: 600; cursor: pointer; }
  button.secondary { background: #2a3240; }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; }
  table { width: 100%; border-collapse: collapse; font-family: ui-monospace, monospace; font-size: 12px; }
  th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid #222933; vertical-align: top; }
  .lv-error { color: #ff7b88; }
  .lv-warn { color: #f0b85e; }
  .lv-info { color: #8ab4ff; }
  .scroller { max-height: 320px; overflow: auto; }
  code { background: #0b0e12; padding: 1px 5px; border-radius: 5px; }
</style>
</head>
<body>
<header>
  <h1>GustoPOS · Print Agent</h1>
  <span id="qz" class="pill bad">QZ …</span>
  <span id="paired" class="pill bad">…</span>
  <span class="muted" id="bridge"></span>
  <span class="muted" style="margin-left:auto" id="updated"></span>
</header>
<main>
  <section>
    <h2>Stato</h2>
    <div class="grid" id="status"></div>
    <div class="actions" style="margin-top:12px">
      <button class="secondary" onclick="post('/api/qz/reconnect')">Riconnetti QZ</button>
      <button class="secondary" onclick="post('/api/test-print')">Stampa di prova</button>
      <button class="secondary" onclick="post('/api/pair')">Riconfigura associazione</button>
      <a href="/api/diagnostics/download"><button class="secondary">Scarica diagnostica</button></a>
    </div>
    <p class="muted" style="margin:10px 0 0">Associazione: usa "Riconfigura associazione" per reinserire il codice a 6 cifre da Settings → Configurazioni Stampa.</p>
  </section>
  <section>
    <h2>Job recenti</h2>
    <div class="scroller"><table id="jobs"><tbody></tbody></table></div>
  </section>
  <section>
    <h2>Log</h2>
    <div class="scroller"><table id="logs"><tbody></tbody></table></div>
  </section>
</main>
<script>
function esc(v){ return String(v==null?'':v).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function post(url, body){
  fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body||{}) })
    .then(function(){ setTimeout(refresh, 400); });
}
function kv(label, value){ return '<div class="kv"><span>'+esc(label)+'</span><span>'+esc(value)+'</span></div>'; }
function render(state){
  var s = state.status || {};
  document.getElementById('qz').className = 'pill ' + (s.qzConnected ? 'ok' : 'bad');
  document.getElementById('qz').textContent = s.qzConnected ? 'QZ connesso' : 'QZ offline';
  document.getElementById('paired').className = 'pill ' + (s.paired ? 'ok' : 'bad');
  document.getElementById('paired').textContent = s.paired ? 'Associato' : 'Non associato';
  document.getElementById('bridge').textContent = (s.bridgeId||'') + ' → ' + (s.apiBase||'');
  document.getElementById('updated').textContent = 'agg. ' + new Date().toLocaleTimeString();
  var mappings = s.mappings && Object.keys(s.mappings).length ? Object.keys(s.mappings).map(function(a){ return a+': '+s.mappings[a]; }).join(', ') : '—';
  document.getElementById('status').innerHTML =
    kv('Versione', (s.version||'') + '  ·  ' + (s.os||'')) +
    kv('Aree', (s.claimedAreas||[]).join(', ') || '—') +
    kv('Stampanti QZ', (s.discoveredPrinters||[]).join(', ') || '—') +
    kv('Mappings', mappings) +
    kv('Ultimo heartbeat', s.lastHeartbeatAt || '—') +
    kv('Ultima claim', s.lastClaimAt || '—') +
    kv('Contatori', 'claim '+ (s.claimed||0) +' · stampati '+ (s.printed||0) +' · falliti '+ (s.failed||0)) +
    kv('Ultimo errore', s.lastError || '—');
  var jobs = state.jobs || [];
  document.querySelector('#jobs tbody').innerHTML = jobs.map(function(j){
    return '<tr><td>'+esc(j.timestamp)+'</td><td>'+esc(j.area)+'</td><td class="lv-'+(j.status==='failed'?'error':(j.status==='printed'?'info':''))+'">'+esc(j.status)+'</td><td>'+esc(j.jobId)+'</td><td>'+esc(j.durationMs)+'ms</td><td class="lv-error">'+esc(j.error||'')+'</td></tr>';
  }).join('') || '<tr><td class="muted">Nessun job</td></tr>';
  var logs = (state.logs||[]).slice(-300);
  document.querySelector('#logs tbody').innerHTML = logs.map(function(l){
    return '<tr><td>'+esc(l.timestamp)+'</td><td class="lv-'+esc(l.level)+'">'+esc(l.level)+'</td><td>'+esc(l.component||'')+'</td><td>'+esc(l.message)+'</td></tr>';
  }).join('') || '<tr><td class="muted">Nessun log</td></tr>';
}
function refresh(){ fetch('/api/state').then(function(r){ return r.json(); }).then(render).catch(function(){}); }
refresh();
setInterval(refresh, 2000);
</script>
</body>
</html>`
