package main

import (
	"bufio"
	"fmt"
	"net"
	"strconv"
	"strings"
	"time"
)

// ─── RCH Custom protocol adapter ──────────────────────────────────────────
// RCH fiscal devices (Print! RT, LPD33 RT, ...) speak the "protocollo Custom":
// framed binary commands over TCP (or RS232/USB):
//
//	<STX=0x02><CNT 2d><IDENT="0"><COMANDO><CKS 2d><ETX=0x03>
//
// CNT:  frame counter, 2 ASCII digits 00..99, incremented on every command.
// IDENT: fixed ASCII "0".
// COMANDO: HEADER1 (1 char, command group) + HEADER2 (3 chars, function) + data.
// CKS:  sum modulo 100 of CNT+IDENT+COMANDO bytes, formatted as 2 ASCII digits.
// Device answers <ACK=0x06> for a well-formed frame (then processes it and
// echoes <COMANDO><DATI>), <NACK=0x15> for corrupt frames, ERRxx for runtime
// errors (xx = error code).
//
// Sale flow (group 3, "stampante fiscale"):
//
//	3001 Operazione fiscale (vendita) : 3 001 TIPO LUN DESC IMP
//	     TIPO=1 vendita, LUN=2d length of DESC (0..22), DESC, IMP=9d cents
//	3003 Stampa subtotale             : 3 003
//	3004 Pagamento corrispettivo      : 3 004 LUN DESC IMP
//	3006 Pagamento EFT/POS            : 3 006 LUN DESC IMP
//	3011 Chiusura scontrino/fattura   : 3 011
//	2002 Chiusura giornaliera         : 2 002
//
// All amounts are integer cents, zero-padded to 9 digits.

const (
	rchSTX = 0x02
	rchETX = 0x03
	rchACK = 0x06
	rchNACK = 0x15
)

type RCHCustomClient struct {
	addr    string
	conn    net.Conn
	rd      *bufio.Reader
	counter int // frame counter 0..99
	mu      chan struct{}
}

func NewRCHCustomClient(printer *FiscalPrinter) *RCHCustomClient {
	port := printer.Port
	if port <= 0 {
		port = 9100 // raw TCP printing is the common default on RCH ethernet
	}
	return &RCHCustomClient{
		addr: net.JoinHostPort(printer.Host, strconv.Itoa(port)),
		mu:   make(chan struct{}, 1),
	}
}

func (c *RCHCustomClient) connect() error {
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

func (c *RCHCustomClient) close() {
	if c.conn != nil {
		_ = c.conn.Close()
		c.conn = nil
		c.rd = nil
	}
}

// buildFrame assembles <STX><CNT><0><command><CKS><ETX>.
func (c *RCHCustomClient) buildFrame(command string) []byte {
	// CNT is 2 digits; the counter starts at 0 and wraps at 100.
	cn := c.counter % 100
	c.counter = (c.counter + 1) % 100
	cnt := fmt.Sprintf("%02d", cn)

	// CKS = sum modulo 100 of CNT + IDENT + COMANDO byte values.
	sum := 0
	for _, b := range []byte(cnt + "0" + command) {
		sum += int(b)
	}
	cks := fmt.Sprintf("%02d", sum%100)

	frame := make([]byte, 0, len(cnt)+1+len(command)+2+2)
	frame = append(frame, rchSTX)
	frame = append(frame, []byte(cnt)...)
	frame = append(frame, '0')
	frame = append(frame, []byte(command)...)
	frame = append(frame, []byte(cks)...)
	frame = append(frame, rchETX)
	return frame
}

// sendRaw writes a frame and waits for ACK, then the command echo/error.
// Returns the device data line (without the 4-char echo prefix), or an error
// containing the ERRxx code when the device reports a runtime error.
func (c *RCHCustomClient) sendRaw(command string) (string, error) {
	if err := c.connect(); err != nil {
		return "", err
	}
	frame := c.buildFrame(command)
	if _, err := c.conn.Write(frame); err != nil {
		return "", fmt.Errorf("fiscal write error: %w", err)
	}
	_ = c.conn.SetReadDeadline(time.Now().Add(15 * time.Second))

	// 1) ACK/NACK for the frame itself.
	ack, err := c.rd.ReadByte()
	if err != nil {
		return "", fmt.Errorf("fiscal ACK read error: %w", err)
	}
	if ack == rchNACK {
		return "", fmt.Errorf("fiscal NACK: malformed frame or duplicate counter")
	}
	if ack != rchACK {
		return "", fmt.Errorf("fiscal unexpected first byte 0x%02X (want ACK)", ack)
	}

	// 2) Command echo + data: <COMANDO(4 chars)><DATA...> or ERRxx.
	echo, err := c.rd.ReadString(rchETX)
	if err != nil {
		return "", fmt.Errorf("fiscal echo read error: %w", err)
	}
	echo = strings.TrimSuffix(echo, string([]byte{rchETX}))
	if len(echo) < 4 {
		return "", fmt.Errorf("fiscal short echo: %q", echo)
	}
	payload := echo[4:]
	if strings.HasPrefix(payload, "ERR") {
		return "", fmt.Errorf("fiscal device error: %s", payload)
	}
	return payload, nil
}

// cents formats a euro amount as 9-digit integer cents, e.g. 12.50 -> 000001250.
func rchCents(amount float64) string {
	cents := int64(amount*100 + 0.5) // banker-friendly rounding for POS amounts
	if cents < 0 {
		cents = 0
	}
	return fmt.Sprintf("%09d", cents)
}

// rchDesc sanitizes and caps a description to 22 chars (protocol limit).
func rchDesc(value string) string {
	var b strings.Builder
	for _, r := range value {
		if r < 0x20 || r == 0x7F || r == 0x02 || r == 0x03 {
			continue
		}
		if b.Len() >= 22 {
			break
		}
		b.WriteRune(r)
	}
	return strings.TrimSpace(b.String())
}

// line3001 builds an "operazione fiscale" command (group 3, function 001).
func (c *RCHCustomClient) line3001(desc string, cents string) string {
	d := rchDesc(desc)
	return fmt.Sprintf("3001 1 %02d %s %s", len(d), d, cents)
}

// Test prints a minimal non-sale receipt to verify the link.
func (c *RCHCustomClient) Test() error {
	c.mu <- struct{}{}
	defer func() { <-c.mu }()
	defer c.close()

	cmds := []string{
		c.line3001("GUSTOPOS TEST FISCALE", rchCents(0.01)),
		"3003",
		"3004 08 CONTANTI 000000001",
		"3011",
	}
	for _, cmd := range cmds {
		if _, err := c.sendRaw(cmd); err != nil {
			return err
		}
	}
	return nil
}

// ChiusuraGiornaliera runs the end-of-day fiscal close.
func (c *RCHCustomClient) ChiusuraGiornaliera() error {
	c.mu <- struct{}{}
	defer func() { <-c.mu }()
	defer c.close()
	_, err := c.sendRaw("2002")
	return err
}

// EmitReceipt sends a full fiscal receipt and returns the progressive number.
// The RCH 3011 response only carries rounding info, so the progressive is not
// available from the close itself; we return the last data payload seen (or
// "unparsed") — the server accepts that as a synthetic marker.
func (c *RCHCustomClient) EmitReceipt(items []fiscalItem, total float64, method string) (string, error) {
	c.mu <- struct{}{}
	defer func() { <-c.mu }()
	defer c.close()

	var last string
	for _, item := range items {
		for i := 0; i < item.Quantity; i++ {
			line := c.line3001(item.Name, rchCents(item.Price))
			resp, err := c.sendRaw(line)
			if err != nil {
				return "", err
			}
			last = resp
		}
	}
	if _, err := c.sendRaw("3003"); err != nil {
		return "", err
	}

	// Payment: cash uses 3004, card/EFT uses 3006.
	payCmd := "3004"
	payDesc := "CONTANTI"
	if method == "card" {
		payCmd = "3006"
		payDesc = "POS"
	}
	payLine := fmt.Sprintf("%s %02d %s %s", payCmd, len(payDesc), payDesc, rchCents(total))
	resp, err := c.sendRaw(payLine)
	if err != nil {
		return "", err
	}
	last = resp

	if _, err := c.sendRaw("3011"); err != nil {
		return "", err
	}
	if last == "" {
		return "unparsed", nil
	}
	return last, nil
}
