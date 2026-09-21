package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// ─── Fiscal printer configuration (RT / Registratore Telematico) ──────────
// The certified fiscal device sits on the cashier PC's LAN. The agent talks
// to it over TCP using the generic "protocollo RT" text command family; the
// exact command strings vary by vendor, so they are centralized in
// FiscalCommandSet and can be tuned per model once the vendor docs arrive.

type FiscalPrinter struct {
	Enabled bool          `json:"enabled"`
	Model   string        `json:"model"` // generic-rt | epson-tm-s1000 | custom-vkp80iii
	Host    string        `json:"host"`  // printer local IP
	Port    int           `json:"port"`  // default 4001
	Timeout time.Duration `json:"-"`
}

func (f *FiscalPrinter) address() string {
	if f.Port <= 0 {
		return net.JoinHostPort(f.Host, "4001")
	}
	return net.JoinHostPort(f.Host, strconv.Itoa(f.Port))
}

// FiscalCommandSet holds the RT text commands for a given model. `generic-rt`
// uses the widely-shared @-command family; per-model adapters override the
// fields that differ on their hardware.
type FiscalCommandSet struct {
	OpenReceipt  string   // start a fiscal receipt (apertura scontrino)
	Line         string   // line template: {qty}|{price}|{desc}
	Subtotal     string   // subtotal
	Payment      string   // payment template: {method}|{amount}
	CloseReceipt string   // close + emit (chiusura scontrino)
	Chiusura     string   // end-of-day fiscal close (chiusura di giornata)
	Status       string   // read device status / progressive
	TestReceipt  []string // lines used for the self-test receipt
}

func commandsForModel(model string) FiscalCommandSet {
	switch model {
	case "epson-tm-s1000":
		// Epson RT devices accept the standard @-command set over TCP.
		return FiscalCommandSet{
			OpenReceipt:  "@A",
			Line:         "{qty}@{price}L{desc}",
			Subtotal:     "@T",
			Payment:      "@P{method}|{amount}",
			CloseReceipt: "@E",
			Chiusura:     "@F",
			Status:       "@X",
			TestReceipt:  []string{"1@0.00LGUSTOPOS TEST FISCALE", "@T", "@Pcash|0.00", "@E"},
		}
	default:
		// generic-rt / custom-vkp80iii: the common text protocol family.
		return FiscalCommandSet{
			OpenReceipt:  "@A",
			Line:         "{qty}@{price}L{desc}",
			Subtotal:     "@T",
			Payment:      "@P{method}|{amount}",
			CloseReceipt: "@E",
			Chiusura:     "@F",
			Status:       "@X",
			TestReceipt:  []string{"1@0.00LGUSTOPOS TEST FISCALE", "@T", "@Pcash|0.00", "@E"},
		}
	}
}

// FiscalClient talks to an RT printer over TCP and reads back responses so
// the emitted receipt's progressive (document number) can be captured.
type FiscalClient struct {
	addr string
	cmd  FiscalCommandSet
	conn net.Conn
	rd   *bufio.Reader
	mu   chan struct{} // serializes commands on the single device socket
}

// FiscalPrinterClient is the common surface used by the job processor. The
// generic RT text protocol and the RCH Custom framed protocol both implement
// it; NewFiscalClient returns the adapter matching the configured model.
type FiscalPrinterClient interface {
	Test() error
	ChiusuraGiornaliera() error
	EmitReceipt(items []fiscalItem, total float64, method string) (string, error)
}

var fiscalProgressiveRe = regexp.MustCompile(`(?i)(?:prog|nr|numero|doc)\D*(\d{1,9})`)

func NewFiscalClient(printer *FiscalPrinter) FiscalPrinterClient {
	if printer != nil && printer.Model == "rch-custom" {
		return NewRCHCustomClient(printer)
	}
	return newGenericFiscalClient(printer)
}

func newGenericFiscalClient(printer *FiscalPrinter) *FiscalClient {
	timeout := printer.Timeout
	if timeout <= 0 {
		timeout = 15 * time.Second
	}
	return &FiscalClient{
		addr: printer.address(),
		cmd:  commandsForModel(printer.Model),
		mu:   make(chan struct{}, 1),
	}
}

func (c *FiscalClient) connect() error {
	if c.conn != nil {
		return nil
	}
	conn, err := net.DialTimeout("tcp", c.addr, 10*time.Second)
	if err != nil {
		return fmt.Errorf("cannot reach fiscal printer at %s: %w", c.addr, err)
	}
	c.conn = conn
	c.rd = bufio.NewReader(conn)
	return nil
}

func (c *FiscalClient) close() {
	if c.conn != nil {
		_ = c.conn.Close()
		c.conn = nil
		c.rd = nil
	}
}

// send writes a command line (with a trailing newline) and returns the device
// response line(s). The RT protocol is request/response over the socket.
func (c *FiscalClient) send(command string) (string, error) {
	if _, err := c.conn.Write([]byte(command + "\n")); err != nil {
		return "", err
	}
	c.conn.SetReadDeadline(time.Now().Add(15 * time.Second))
	line, err := c.rd.ReadString('\n')
	if err != nil {
		return "", fmt.Errorf("fiscal printer response error: %w", err)
	}
	return strings.TrimSpace(line), nil
}

// Open / close around a batch of commands, capturing the progressive.
func (c *FiscalClient) runBatch(lines []string) (string, error) {
	c.mu <- struct{}{}
	defer func() { <-c.mu }()

	if err := c.connect(); err != nil {
		return "", err
	}
	defer c.close()

	var progressive string
	for _, raw := range lines {
		command := strings.TrimSpace(raw)
		if command == "" {
			continue
		}
		response, err := c.send(command)
		if err != nil {
			return "", err
		}
		if m := fiscalProgressiveRe.FindStringSubmatch(response); len(m) > 1 {
			progressive = m[1]
		}
	}
	return progressive, nil
}

// Test prints a minimal non-sale receipt (or reads status) to verify the link.
func (c *FiscalClient) Test() error {
	_, err := c.runBatch(append([]string{c.cmd.OpenReceipt}, append(c.cmd.TestReceipt, c.cmd.CloseReceipt)...))
	return err
}

// ChiusuraGiornaliera runs the end-of-day fiscal close on the device.
func (c *FiscalClient) ChiusuraGiornaliera() error {
	_, err := c.runBatch([]string{c.cmd.Chiusura})
	return err
}

// sanitizeRTText neutralizes RT command-injection characters in free-text
// fields. Menu item names are operator-entered: a description containing '@',
// CR/LF or other control characters could otherwise splice a bogus command
// (e.g. "@P") into the fiscal stream. Strip everything outside printable,
// non-@ ASCII and cap the length to the 42-column thermal receipt width.
func sanitizeRTText(value string) string {
	var b strings.Builder
	for _, r := range value {
		if r == '@' || r < 0x20 || r == 0x7F {
			// Skip control characters, DEL and the RT command introducer.
			continue
		}
		if b.Len() >= 42 {
			break
		}
		b.WriteRune(r)
	}
	return strings.TrimSpace(b.String())
}

// EmitReceipt sends a full fiscal receipt and returns the progressive number.
func (c *FiscalClient) EmitReceipt(items []fiscalItem, total float64, method string) (string, error) {
	lines := []string{c.cmd.OpenReceipt}
	for _, item := range items {
		line := strings.ReplaceAll(c.cmd.Line, "{qty}", strconv.Itoa(item.Quantity))
		line = strings.ReplaceAll(line, "{price}", strconv.FormatFloat(item.Price, 'f', 2, 64))
		line = strings.ReplaceAll(line, "{desc}", sanitizeRTText(item.Name))
		lines = append(lines, line)
	}
	lines = append(lines, c.cmd.Subtotal)
	lines = append(lines, strings.ReplaceAll(strings.ReplaceAll(c.cmd.Payment, "{method}", method), "{amount}", strconv.FormatFloat(total, 'f', 2, 64)))
	lines = append(lines, c.cmd.CloseReceipt)
	return c.runBatch(lines)
}

type fiscalItem struct {
	Name     string  `json:"name"`
	Quantity int     `json:"quantity"`
	Price    float64 `json:"price"`
}

// ─── Fiscal job processing (mirrors print jobs) ──────────────────────────

type FiscalJob struct {
	ID      string `json:"id"`
	Type    string `json:"type"` // receipt | chiusura | test
	Status  string `json:"status"`
	Payload string `json:"payload"`
}

type fiscalReceiptPayload struct {
	PaymentID string       `json:"paymentId"`
	Items     []fiscalItem `json:"items"`
	Subtotal  float64      `json:"subtotal"`
	Discount  float64      `json:"discountAmount"`
	Total     float64      `json:"total"`
	Method    string       `json:"method"`
}

func (a *Agent) fiscalEnabled() bool {
	return a.cfg.FiscalPrinter != nil && a.cfg.FiscalPrinter.Enabled && a.cfg.FiscalPrinter.Host != ""
}

// fiscalConfigured reports whether a device is reachable at all (host set),
// regardless of the enabled flag. Used to decide whether this agent may claim
// fiscal jobs — receipts still require enabled below.
func (a *Agent) fiscalConfigured() bool {
	return a.cfg.FiscalPrinter != nil && a.cfg.FiscalPrinter.Host != ""
}

// hasArea reports whether the agent's server-assigned areas (claimedAreas
// synced from the heartbeat) include the given print area.
func hasArea(areas []string, area string) bool {
	for _, candidate := range areas {
		if candidate == area {
			return true
		}
	}
	return false
}

// logFiscalSkip logs the "not the cashier bridge" notice only when the claimed
// areas actually change, so the 5s fiscal poll does not flood the logs.
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
	// Only agents with a configured fiscal printer may claim fiscal jobs. A
	// kitchen-only agent polling the same tenant must not pull a cashier
	// receipt and fail it — the cashier station owns the RT device. The
	// enabled flag is enforced per-job in processFiscalJob so the admin can
	// still run a connection test before flipping the toggle.
	if !a.fiscalConfigured() {
		return nil
	}
	// Defense in depth, mirroring the API claim gate: only cashier-area
	// agents claim certified fiscal jobs. claimedAreas arrive via the
	// heartbeat response and are authoritative for Go agents.
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

func (a *Agent) processFiscalJob(job FiscalJob) {
	log.Printf("fiscal job %s received (type=%s)", job.ID, job.Type)

	// Only actual sale receipts require the enabled toggle. Connection tests
	// and manual chiusura are admin-initiated and must work before enabling.
	if job.Type == "receipt" && !a.fiscalEnabled() {
		err := fmt.Errorf("fiscal printer not enabled")
		log.Printf("fiscal job %s failed: %v", job.ID, err)
		_ = a.api.FailFiscal(a.cfg.BridgeID, job.ID, err.Error())
		return
	}

	client := NewFiscalClient(a.cfg.FiscalPrinter)
	switch job.Type {
	case "test":
		if err := client.Test(); err != nil {
			log.Printf("fiscal job %s test failed: %v", job.ID, err)
			_ = a.api.FailFiscal(a.cfg.BridgeID, job.ID, err.Error())
			return
		}
	case "chiusura":
		if err := client.ChiusuraGiornaliera(); err != nil {
			log.Printf("fiscal job %s chiusura failed: %v", job.ID, err)
			_ = a.api.FailFiscal(a.cfg.BridgeID, job.ID, err.Error())
			return
		}
	case "receipt":
		var payload fiscalReceiptPayload
		if err := json.Unmarshal([]byte(job.Payload), &payload); err != nil {
			_ = a.api.FailFiscal(a.cfg.BridgeID, job.ID, "invalid receipt payload")
			return
		}
		method := payload.Method
		if method != "cash" && method != "card" && method != "mixed" {
			method = "cash"
		}
		progressive, err := client.EmitReceipt(payload.Items, payload.Total, method)
		if err != nil {
			log.Printf("fiscal job %s receipt failed: %v", job.ID, err)
			_ = a.api.FailFiscal(a.cfg.BridgeID, job.ID, err.Error())
			return
		}
		if progressive == "" {
			// Receipt emitted but the progressive could not be parsed. Still
			// complete with a synthetic marker so the payment is not stuck in
			// "pending" forever; the admin can reconcile via the job history.
			progressive = "unparsed"
		}
		if err := a.api.CompleteFiscal(a.cfg.BridgeID, job.ID, progressive); err != nil {
			log.Printf("fiscal job %s emitted but complete report failed: %v", job.ID, err)
			return
		}
		log.Printf("fiscal job %s emitted (progressive=%s)", job.ID, progressive)
		return
	default:
		_ = a.api.FailFiscal(a.cfg.BridgeID, job.ID, "unknown fiscal job type")
		return
	}

	if err := a.api.CompleteFiscal(a.cfg.BridgeID, job.ID, ""); err != nil {
		log.Printf("fiscal job %s done but complete report failed: %v", job.ID, err)
		return
	}
	log.Printf("fiscal job %s completed", job.ID)
}
