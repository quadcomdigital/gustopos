package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"strconv"
	"strings"
	"time"
)

// ─── Registratore Telematico (Path B) ─────────────────────────────────────
//
// L'agente è un **puro trasporto**: riceve dal server i frame già composti
// (compresi framing e checksum del dialetto del RT) e si limita a scriverli e
// a riportare le risposte. Qui non c'è nessun comando fiscale: i codici di
// protocollo sono riservati ai tecnici autorizzati e vivono solo lato server
// (`apps/api/src/fiscal/dialects`), così il dialetto si aggiorna senza
// rilasciare i binary e il binary distribuito non li contiene.

// FiscalPrinter è la configurazione del RT applicata dal server via heartbeat.
// Contiene solo dati di collegamento e di identificazione: nessun comando.
type FiscalPrinter struct {
	Enabled   bool          `json:"enabled"`
	Model     string        `json:"model"`               // etichetta del modello (solo display/log)
	Host      string        `json:"host"`                // IP del RT sulla LAN della cassa (o dispositivo seriale)
	Port      int           `json:"port"`                // default 4001 (i dialetti dichiarano il proprio)
	Transport string        `json:"transport,omitempty"` // tcp | serial (usb non gestito)
	Baud      int           `json:"baud,omitempty"`      // solo per il trasporto seriale
	Timeout   time.Duration `json:"-"`
}

func (f *FiscalPrinter) address() string {
	if f.Port <= 0 {
		return net.JoinHostPort(f.Host, "4001")
	}
	return net.JoinHostPort(f.Host, strconv.Itoa(f.Port))
}

// serialDevice è il percorso della porta quando il trasporto è seriale: in quel
// caso il campo `host` porta il *dispositivo* (es. `/dev/ttyUSB0`, `COM3`), non
// un indirizzo di rete.
func (f *FiscalPrinter) serialDevice() string {
	if !strings.EqualFold(strings.TrimSpace(f.Transport), "serial") {
		return ""
	}
	return strings.TrimSpace(f.Host)
}

// transport è il collegamento verso il RT: TCP o seriale, secondo la
// configurazione del server. L'agente non sceglie: esegue quello che gli è
// stato configurato dal tenant.
func (f *FiscalPrinter) transport() RTTransport {
	return RTTransport{Addr: f.address(), Serial: f.serialDevice(), Baud: f.Baud}
}

// FiscalJob è un lavoro fiscale reclamato dal server.
type FiscalJob struct {
	ID      string `json:"id"`
	Type    string `json:"type"` // receipt | chiusura | test | read | program
	Status  string `json:"status"`
	Payload string `json:"payload"`
}

// fiscalWirePayload è il payload dei lavori eseguibili come trasporto: porta i
// frame già pronti e il contesto utile all'audit.
type fiscalWirePayload struct {
	Wire         *RTWire `json:"wire"`
	Purpose      string  `json:"purpose,omitempty"`
	PaymentID    string  `json:"paymentId,omitempty"`
	BusinessDate string  `json:"businessDate,omitempty"`
}

// parseFiscalWirePayload distingue un lavoro eseguibile (con `wire`) da uno
// scritto con il vecchio payload senza frame: quest'ultimo non è più
// eseguibile, perché l'agente non conosce i dialetti. Il chiamante fallisce il
// job con un messaggio esplicito invece di indovinare un protocollo.
func parseFiscalWirePayload(raw string) (fiscalWirePayload, error) {
	if strings.TrimSpace(raw) == "" {
		return fiscalWirePayload{}, fmt.Errorf("payload fiscale vuoto")
	}
	var payload fiscalWirePayload
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return fiscalWirePayload{}, fmt.Errorf("payload fiscale non valido: %w", err)
	}
	if payload.Wire == nil || len(payload.Wire.Frames) == 0 {
		return fiscalWirePayload{}, fmt.Errorf("job fiscale senza frame: il protocollo va selezionato in Impostazioni (il server compone i comandi)")
	}
	return payload, nil
}

func (a *Agent) fiscalEnabled() bool {
	return a.cfg.FiscalPrinter != nil && a.cfg.FiscalPrinter.Enabled && a.cfg.FiscalPrinter.Host != ""
}

// fiscalConfigured indica che un dispositivo è almeno indirizzabile (host
// impostato), a prescindere dal flag `enabled`: serve a decidere se questo
// agente può reclamare lavori fiscali. Le ricevute richiedono `enabled`.
func (a *Agent) fiscalConfigured() bool {
	return a.cfg.FiscalPrinter != nil && a.cfg.FiscalPrinter.Host != ""
}

// hasArea indica se fra le aree assegnate dal server (claimedAreas) c'è quella
// richiesta.
func hasArea(areas []string, area string) bool {
	for _, candidate := range areas {
		if candidate == area {
			return true
		}
	}
	return false
}

// logFiscalSkip logga l'avviso "non sono il bridge cassa" solo quando le aree
// cambiano, così il polling fiscale non inonda i log.
func (a *Agent) logFiscalSkip(areas []string) {
	key := strings.Join(areas, ",")
	a.mu.Lock()
	changed := a.lastFiscalSkipAreas != key
	if changed {
		a.lastFiscalSkipAreas = key
	}
	a.mu.Unlock()
	if changed {
		log.Printf("fiscal claim skipped: bridge not assigned to the cashier area (areas=%v)", areas)
	}
}

func (a *Agent) claimFiscalOnce() error {
	// Solo un agente con un RT configurato reclama lavori fiscali: un agente di
	// sola cucina che fa polling sullo stesso tenant non deve tirare a sé una
	// ricevuta della cassa e farla fallire.
	if !a.fiscalConfigured() {
		return nil
	}
	// Difesa in profondità, come il gate dell'API: solo la postazione cassa
	// reclama lavori fiscali certificati.
	if !hasArea(a.cfg.Areas, "cashier") {
		a.logFiscalSkip(a.cfg.Areas)
		return nil
	}
	jobs, err := a.api.ClaimFiscal(a.cfg.BridgeID, 5)
	if err != nil {
		if IsDetached(err) {
			return errDetachedSentinel
		}
		log.Printf("fiscal claim failed: %v", err)
		return nil
	}
	for _, job := range jobs {
		a.processFiscalJob(job)
	}
	return nil
}

// processFiscalJob esegue la sequenza di frame del server sul RT e riporta
// l'esito. Non interpreta nulla: la valutazione di <TIPO>/<CODICE>, del
// progressivo e della quadratura è del server, che è anche il posto giusto per
// l'audit fiscale.
func (a *Agent) processFiscalJob(job FiscalJob) {
	log.Printf("fiscal job %s received (type=%s)", job.ID, job.Type)

	// I soli corrispettivi richiedono il flag `enabled`: test e chiusura sono
	// avviati dall'admin e devono funzionare anche prima di attivare l'emissione.
	if job.Type == "receipt" && !a.fiscalEnabled() {
		err := fmt.Errorf("fiscal printer not enabled")
		log.Printf("fiscal job %s failed: %v", job.ID, err)
		_ = a.api.FailFiscal(a.cfg.BridgeID, job.ID, err.Error())
		return
	}

	payload, err := parseFiscalWirePayload(job.Payload)
	if err != nil {
		log.Printf("fiscal job %s failed: %v", job.ID, err)
		_ = a.api.FailFiscal(a.cfg.BridgeID, job.ID, err.Error())
		return
	}
	if payload.Wire.ProtocolID == "" && a.fiscalBriefing != nil {
		// Nessuna azione: solo contesto utile nei log di assistenza.
		payload.Wire.ProtocolID = a.fiscalBriefing.ProtocolID
	}

	transport := a.cfg.FiscalPrinter.transport()
	response, err := transport.Execute(*payload.Wire)
	if err != nil {
		log.Printf("fiscal job %s transport failed: %v", job.ID, err)
		_ = a.api.FailFiscal(a.cfg.BridgeID, job.ID, err.Error())
		return
	}

	labels := make([]string, 0, len(response.Exchanges))
	for _, exchange := range response.Exchanges {
		if exchange.Error != "" {
			labels = append(labels, fmt.Sprintf("%s: %s", exchange.Label, exchange.Error))
		}
	}
	if len(labels) > 0 {
		err := fmt.Errorf("errore durante la sequenza: %s", strings.Join(labels, "; "))
		log.Printf("fiscal job %s failed: %v", job.ID, err)
		_ = a.api.FailFiscal(a.cfg.BridgeID, job.ID, err.Error())
		return
	}

	// Il progressivo lo ricava il server dalla risposta: l'agente non sa cosa
	// significhi un documento fiscale, quindi non inventa un numero.
	if err := a.api.CompleteFiscal(a.cfg.BridgeID, job.ID, response); err != nil {
		log.Printf("fiscal job %s executed but complete report failed: %v", job.ID, err)
		return
	}
	log.Printf("fiscal job %s completed (%d frames)", job.ID, len(response.Exchanges))
}
