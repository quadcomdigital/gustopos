package main

import (
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"net"
	"regexp"
	"strconv"
	"strings"
	"time"

	"go.bug.st/serial"
)

// ─── Trasporto RT (agnostico rispetto al dialetto) ────────────────────────
//
// L'agente NON conosce nessun protocollo fiscale: il server gli manda i frame
// già composti (base64), l'agente li scrive, legge quello che torna e lo
// riporta in esadecimale. Framing, checksum, comandi e semantica delle risposte
// vivono solo lato server: è così che i codici di dialetto (riservati ai
// tecnici autorizzati) non finiscono nel binary distribuito.
//
// Il trasporto gestisce solo ciò che è fisico/sessionale:
//   - una sola sessione verso il RT (TCP **o seriale RS232**), frame distanziati
//     (pacing);
//   - il terminatore di lettura, che è una proprietà del *dispositivo*
//     ("etx" per la famiglia PrintF, "lf" per i protocolli testuali);
//   - il tetto di byte letti e i timeout di scrittura/lettura.
//
// La seriale è il collegamento senza finestre temporali (cavo RJ45↔DB9 del
// manuale tecnico): serve a collaudare e a programmare un RT fuori servizio,
// dove la porta di rete è chiusa o cade in standby. Il baud **non è dichiarato**
// nei manuali delle piattaforme PrintF: arriva dal server con il resto della
// configurazione, così si corregge dalla UI senza rifare il binary.

const (
	rtDefaultWaitMs    = 250
	rtDefaultPacingMs  = 500
	rtDefaultTimeoutMs = 8000
	rtDefaultBaud      = 9600
	rtMaxFrames        = 64
)

// rtLink è la sessione verso il RT: TCP o seriale. Il trasporto usa solo
// lettura/scrittura e le due deadline, così la sequenza di frame resta identica
// sui due collegamenti (una sola implementazione di pacing e di terminatore).
type rtLink interface {
	io.ReadWriteCloser
	SetReadDeadline(time.Time) error
	SetWriteDeadline(time.Time) error
}

// tcpLink adatta net.Conn all'interfaccia del trasporto.
type tcpLink struct{ net.Conn }

func (l tcpLink) SetReadDeadline(at time.Time) error  { return l.Conn.SetReadDeadline(at) }
func (l tcpLink) SetWriteDeadline(at time.Time) error { return l.Conn.SetWriteDeadline(at) }

// serialLink adatta la porta seriale: dove net.Conn usa una deadline assoluta,
// la seriale usa un timeout relativo alla singola lettura/scrittura.
type serialLink struct{ port serial.Port }

func (l serialLink) Read(p []byte) (int, error)  { return l.port.Read(p) }
func (l serialLink) Write(p []byte) (int, error) { return l.port.Write(p) }
func (l serialLink) Close() error                { return l.port.Close() }

func (l serialLink) SetReadDeadline(at time.Time) error {
	return l.port.SetReadTimeout(untilDuration(at))
}

// SetWriteDeadline è un no-op: la libreria seriale espone solo il timeout di
// lettura. I frame inviati sono di poche decine di byte e la scrittura è
// sincrona sul buffer del driver, quindi non c'è nulla da limitare qui (il
// timeout di lettura è quello che conta per non restare appesi).
func (l serialLink) SetWriteDeadline(time.Time) error { return nil }

// untilDuration converte una deadline assoluta nel timeout relativo richiesto
// dalla seriale, mai negativo (0 = nessun timeout, che non vogliamo mai).
func untilDuration(at time.Time) time.Duration {
	remaining := time.Until(at)
	if remaining <= 0 {
		return time.Millisecond
	}
	return remaining
}

// RTFrame è un frame già pronto: l'agente non lo interpreta.
type RTFrame struct {
	// Label è una descrizione operativa ("vendita reparto 1"): finisce nei log
	// dell'agente e nella risposta, e non contiene codici di protocollo.
	Label string `json:"label,omitempty"`
	// Tx è il frame in base64.
	Tx string `json:"tx"`
	// ExpectsAnswer segnala che il RT risponde con la <DATA_ANSW> a 10 byte.
	ExpectsAnswer bool `json:"expectsAnswer,omitempty"`
	// WaitMs è la pausa dopo la scrittura, prima di leggere.
	WaitMs int `json:"waitMs,omitempty"`
}

// RTWire è il payload di un job fiscale da eseguire come puro trasporto.
type RTWire struct {
	// ProtocolID è solo un'etichetta di audit: l'agente non la usa per decidere nulla.
	ProtocolID string    `json:"protocolId"`
	Frames     []RTFrame `json:"frames"`
	// Terminator: "etx" (0x03), "lf" (0x0A) o "none" (una sola lettura).
	Terminator string `json:"terminator,omitempty"`
	// MaxResponseBytes limita la lettura per frame (default 4096).
	MaxResponseBytes int `json:"maxResponseBytes,omitempty"`
	// PacingMs è il distanziamento minimo fra frame (default 500: la famiglia
	// PrintF rifiuta le raffiche).
	PacingMs int `json:"pacingMs,omitempty"`
	// TimeoutMs è il timeout di lettura per frame (default 8000).
	TimeoutMs int `json:"timeoutMs,omitempty"`
}

// RTExchange è l'esito di un singolo frame.
type RTExchange struct {
	Label string `json:"label,omitempty"`
	RxHex string `json:"rxHex,omitempty"`
	Error string `json:"error,omitempty"`
}

// RTResponse è quello che l'agente riporta al server (campo `response`).
type RTResponse struct {
	Exchanges []RTExchange `json:"exchanges"`
}

// RTTransport apre la sessione verso il RT e la usa per una sequenza di frame.
// Con `Serial` valorizzato usa la porta seriale, altrimenti il TCP su `Addr`.
type RTTransport struct {
	Addr string
	// Serial è il percorso del dispositivo ("/dev/ttyUSB0", "COM3"): non vuoto
	// = collegamento seriale al posto del TCP.
	Serial string
	// Baud è la velocità della seriale (ignorata sul TCP).
	Baud int
}

// describe è l'etichetta del collegamento per i messaggi d'errore.
func (t RTTransport) describe() string {
	if device := strings.TrimSpace(t.Serial); device != "" {
		return fmt.Sprintf("seriale %s", device)
	}
	return fmt.Sprintf("TCP %s", t.Addr)
}

// dial apre il collegamento configurato. Sulla seriale il baud arriva dal
// server: senza indicazione si usa il default storico delle periferiche.
func (t RTTransport) dial() (rtLink, error) {
	if device := strings.TrimSpace(t.Serial); device != "" {
		baud := t.Baud
		if baud <= 0 {
			baud = rtDefaultBaud
		}
		port, err := serial.Open(device, &serial.Mode{
			BaudRate: baud,
			DataBits: 8,
			Parity:   serial.NoParity,
			StopBits: serial.OneStopBit,
		})
		if err != nil {
			return nil, fmt.Errorf("porta %s non apribile: %w", t.describe(), err)
		}
		return serialLink{port: port}, nil
	}
	conn, err := net.DialTimeout("tcp", t.Addr, 10*time.Second)
	if err != nil {
		return nil, fmt.Errorf("RT non raggiungibile su %s: %w", t.describe(), err)
	}
	return tcpLink{Conn: conn}, nil
}

func (t RTTransport) terminator(wire RTWire) byte {
	switch strings.ToLower(strings.TrimSpace(wire.Terminator)) {
	case "lf":
		return '\n'
	case "none":
		return 0
	default:
		return 0x03
	}
}

func (t RTTransport) executeFrame(conn rtLink, wire RTWire, frame RTFrame, terminator byte) (string, error) {
	payload, err := base64.StdEncoding.DecodeString(strings.TrimSpace(frame.Tx))
	if err != nil {
		return "", fmt.Errorf("frame non decodificabile (base64): %w", err)
	}
	if len(payload) == 0 {
		return "", fmt.Errorf("frame vuoto")
	}
	if err := conn.SetWriteDeadline(time.Now().Add(rtReadTimeout(wire))); err != nil {
		return "", err
	}
	if _, err := conn.Write(payload); err != nil {
		return "", fmt.Errorf("scrittura verso il RT fallita: %w", err)
	}

	wait := frame.WaitMs
	if wait <= 0 {
		wait = rtDefaultWaitMs
	}
	time.Sleep(time.Duration(wait) * time.Millisecond)

	maxBytes := wire.MaxResponseBytes
	if maxBytes <= 0 || maxBytes > rtMaxFrames*1024 {
		maxBytes = 4096
	}
	if err := conn.SetReadDeadline(time.Now().Add(rtReadTimeout(wire))); err != nil {
		return "", err
	}

	received := make([]byte, 0, 64)
	buf := make([]byte, 1)
	for len(received) < maxBytes {
		n, err := conn.Read(buf)
		if n > 0 {
			received = append(received, buf[0])
			// NACK = frame rifiutato: fine immediata, va riportato così com'è.
			if buf[0] == 0x15 {
				break
			}
			if terminator != 0 && buf[0] == terminator {
				break
			}
		}
		if n == 0 && err == nil {
			// Nessun byte e nessun errore: sulla seriale è così che si presenta
			// il timeout di lettura (la porta non lo segnala come errore). È
			// l'equivalente del timeout sul TCP: esito da riportare, non guasto.
			break
		}
		if err != nil {
			if err == io.EOF {
				break
			}
			if isTimeout(err) {
				// Nessuna risposta entro il timeout: non è un guasto del
				// trasporto, è un esito che il server deve valutare.
				break
			}
			return hex.EncodeToString(received), fmt.Errorf("lettura dal RT fallita: %w", err)
		}
		if terminator == 0 {
			break
		}
	}
	return hex.EncodeToString(received), nil
}

// Execute apre la sessione, spedisce i frame nell'ordine ricevuto e riporta le
// risposte. L'errore restituito è di trasporto (sessione): gli errori per
// singolo frame restano nella relativa voce, così il server vede esattamente
// dove si è fermata la sequenza.
func (t RTTransport) Execute(wire RTWire) (RTResponse, error) {
	response := RTResponse{Exchanges: make([]RTExchange, 0, len(wire.Frames))}
	if t.Addr == "" && strings.TrimSpace(t.Serial) == "" {
		return response, fmt.Errorf("nessun collegamento al RT configurato (né indirizzo TCP né porta seriale)")
	}
	if len(wire.Frames) == 0 {
		return response, fmt.Errorf("nessun frame da eseguire")
	}
	if len(wire.Frames) > rtMaxFrames {
		return response, fmt.Errorf("troppi frame in un job: %d (max %d)", len(wire.Frames), rtMaxFrames)
	}

	conn, err := t.dial()
	if err != nil {
		return response, err
	}
	defer conn.Close()

	terminator := t.terminator(wire)
	pacing := wire.PacingMs
	if pacing <= 0 {
		pacing = rtDefaultPacingMs
	}

	for index, frame := range wire.Frames {
		if index > 0 {
			// Una sola sessione, comandi distanziati: la famiglia PrintF rifiuta
			// le raffiche e chiude la porta dopo troppe connessioni ravvicinate.
			time.Sleep(time.Duration(pacing) * time.Millisecond)
		}
		rxHex, frameErr := t.executeFrame(conn, wire, frame, terminator)
		exchange := RTExchange{Label: frame.Label, RxHex: rxHex}
		if frameErr != nil {
			exchange.Error = frameErr.Error()
			response.Exchanges = append(response.Exchanges, exchange)
			return response, nil
		}
		response.Exchanges = append(response.Exchanges, exchange)
	}
	return response, nil
}

/**
 * agentVersionSatisfies dice se questo binary è abbastanza recente per il
 * protocollo richiesto dal server (`requiresAgentVersion`, es. "go-0.15.0").
 * È un avviso, non un gate: il gate vero è lato server, che non consegna i job
 * a un agente vecchio. Serve a rendere leggibile una diagnosi.
 */
func agentVersionSatisfies(required string) bool {
	requiredParts, ok := parseSemver(required)
	if !ok {
		return true
	}
	localParts, ok := parseSemver(version)
	if !ok {
		return false
	}
	for i := 0; i < 3; i++ {
		if localParts[i] > requiredParts[i] {
			return true
		}
		if localParts[i] < requiredParts[i] {
			return false
		}
	}
	return true
}

func parseSemver(value string) ([3]int, bool) {
	var out [3]int
	matches := semverRe.FindStringSubmatch(value)
	if len(matches) < 4 {
		return out, false
	}
	for i := 0; i < 3; i++ {
		n, err := strconv.Atoi(matches[i+1])
		if err != nil {
			return out, false
		}
		out[i] = n
	}
	return out, true
}

var semverRe = regexp.MustCompile(`(\d+)\.(\d+)\.(\d+)`)

func rtReadTimeout(wire RTWire) time.Duration {
	timeout := wire.TimeoutMs
	if timeout <= 0 {
		timeout = rtDefaultTimeoutMs
	}
	return time.Duration(timeout) * time.Millisecond
}

func isTimeout(err error) bool {
	type timeouter interface{ Timeout() bool }
	if t, ok := err.(timeouter); ok {
		return t.Timeout()
	}
	return false
}
