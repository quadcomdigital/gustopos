package main

import (
	"encoding/base64"
	"encoding/hex"
	"net"
	"strings"
	"testing"
	"time"
)

// fakeRT è un RT finto: accetta una sessione, registra i byte ricevuti e
// risponde come farebbe un dispositivo PrintF (ACK + frame terminato da ETX).
type fakeRT struct {
	listener  net.Listener
	received  [][]byte
	responses [][]byte
	delay     time.Duration
}

func newFakeRT(t *testing.T, responses ...[]byte) *fakeRT {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	fake := &fakeRT{listener: listener, responses: responses}
	go func() {
		conn, err := listener.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		for _, response := range fake.responses {
			buf := make([]byte, 512)
			n, err := conn.Read(buf)
			if n > 0 {
				fake.received = append(fake.received, append([]byte(nil), buf[:n]...))
			}
			if err != nil {
				return
			}
			if fake.delay > 0 {
				time.Sleep(fake.delay)
			}
			if _, err := conn.Write(response); err != nil {
				return
			}
		}
	}()
	return fake
}

func (f *fakeRT) addr() string { return f.listener.Addr().String() }
func (f *fakeRT) close()       { _ = f.listener.Close() }

func frame(tx string) RTFrame {
	return RTFrame{Tx: base64.StdEncoding.EncodeToString([]byte(tx)), WaitMs: 1, Label: "prova"}
}

func TestRTTransportWritesFramesVerbatimAndReportsHex(t *testing.T) {
	// Risposta reale di una WALL-E: ACK + frame PrintF con <DATA_ANSW> ON00000000.
	response, _ := hex.DecodeString("060230313031304E4F4E303030303030303038343503")
	fake := newFakeRT(t, response)
	defer fake.close()

	wire := RTWire{
		ProtocolID: "versione-di-prova",
		Frames:     []RTFrame{frame("=C1")},
		Terminator: "etx",
		PacingMs:   1,
		TimeoutMs:  500,
	}
	result, err := RTTransport{Addr: fake.addr()}.Execute(wire)
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if len(result.Exchanges) != 1 {
		t.Fatalf("exchange attesi 1, ottenuti %d", len(result.Exchanges))
	}
	// hex.EncodeToString produce minuscole: il server deve accettare entrambi i
	// casi (Buffer.from(hex, "hex") è case-insensitive).
	if result.Exchanges[0].RxHex != hex.EncodeToString(response) {
		t.Errorf("RxHex = %q, atteso %q", result.Exchanges[0].RxHex, hex.EncodeToString(response))
	}
	if result.Exchanges[0].Error != "" {
		t.Errorf("errore inatteso: %s", result.Exchanges[0].Error)
	}
	// I byte scritti devono essere *esattamente* il frame decodificato: nessuna
	// interpretazione, nessuna trasformazione lato agente.
	if len(fake.received) != 1 || string(fake.received[0]) != "=C1" {
		t.Errorf("byte scritti = %q, attesi %q", fake.received, "=C1")
	}
}

func TestRTTransportSendsMultipleFramesInOneSession(t *testing.T) {
	first, _ := hex.DecodeString("060230313031304E4F4E303030303030303038343503")
	second, _ := hex.DecodeString("060230313031314E383334322E3431332C323838373603")
	fake := newFakeRT(t, first, second)
	defer fake.close()

	wire := RTWire{
		ProtocolID: "versione-di-prova",
		Frames:     []RTFrame{frame("=C1"), frame("<</?8")},
		Terminator: "etx",
		PacingMs:   1,
		TimeoutMs:  500,
	}
	result, err := RTTransport{Addr: fake.addr()}.Execute(wire)
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if len(result.Exchanges) != 2 {
		t.Fatalf("exchange attesi 2, ottenuti %d", len(result.Exchanges))
	}
	if len(fake.received) != 2 {
		t.Fatalf("il RT finto deve ricevere 2 frame, ricevuti %d", len(fake.received))
	}
	if string(fake.received[0]) != "=C1" || string(fake.received[1]) != "<</?8" {
		t.Errorf("frame ricevuti = %q", fake.received)
	}
}

func TestRTTransportReportsNACKImmediately(t *testing.T) {
	fake := newFakeRT(t, []byte{0x15})
	defer fake.close()

	result, err := RTTransport{Addr: fake.addr()}.Execute(RTWire{
		ProtocolID: "versione-di-prova",
		Frames:     []RTFrame{frame("=C1")},
		Terminator: "etx",
		PacingMs:   1,
		TimeoutMs:  300,
	})
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if result.Exchanges[0].RxHex != "15" {
		t.Errorf("RxHex = %q, atteso 15 (NACK riportato così com'è)", result.Exchanges[0].RxHex)
	}
}

func TestRTTransportStopsOnFrameErrorAndKeepsWhatItGot(t *testing.T) {
	fake := newFakeRT(t, []byte{0x06, 0x02, 0x03})
	defer fake.close()

	result, err := RTTransport{Addr: fake.addr()}.Execute(RTWire{
		ProtocolID: "versione-di-prova",
		Frames:     []RTFrame{frame("=C1"), frame("=T1")},
		Terminator: "etx",
		PacingMs:   1,
		TimeoutMs:  300,
	})
	// Un solo frame viene scritto: il primo ha risposto con un terminatore, il
	// secondo riceve EOF/nessun byte e non genera un errore di trasporto.
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if len(result.Exchanges) != 2 {
		t.Fatalf("exchange attesi 2, ottenuti %d", len(result.Exchanges))
	}
	if !strings.HasPrefix(result.Exchanges[0].RxHex, "0602") {
		t.Errorf("primo exchange = %q", result.Exchanges[0].RxHex)
	}
}

func TestRTTransportRejectsBadInput(t *testing.T) {
	transport := RTTransport{Addr: "127.0.0.1:1"}
	if _, err := transport.Execute(RTWire{Frames: []RTFrame{frame("x")}}); err == nil {
		t.Errorf("un indirizzo irraggiungibile deve dare errore di trasporto")
	}
	if _, err := (RTTransport{}).Execute(RTWire{Frames: []RTFrame{frame("x")}}); err == nil {
		t.Errorf("indirizzo vuoto: atteso errore")
	}
	if _, err := (RTTransport{Addr: "127.0.0.1:1"}).Execute(RTWire{}); err == nil {
		t.Errorf("nessun frame: atteso errore")
	}
	// Un frame non decodificabile è un errore di *frame*: il trasporto resta
	// valido e il server vede l'esito sulla singola voce.
	response, _ := hex.DecodeString("060230313031304E4F4E303030303030303038343503")
	fake := newFakeRT(t, response)
	defer fake.close()
	result, err := (RTTransport{Addr: fake.addr()}).Execute(RTWire{Frames: []RTFrame{{Tx: "!!non-base64!!"}}})
	if err != nil {
		t.Fatalf("trasporto: %v", err)
	}
	if len(result.Exchanges) != 1 || result.Exchanges[0].Error == "" {
		t.Errorf("atteso un errore sul frame, ottenuto %+v", result.Exchanges)
	}
}

func TestRTTransportLFterminatorKeepsTrailingNewline(t *testing.T) {
	fake := newFakeRT(t, []byte("ON00000000\n"))
	defer fake.close()

	result, err := RTTransport{Addr: fake.addr()}.Execute(RTWire{
		ProtocolID: "testo",
		Frames:     []RTFrame{frame("@C1\n")},
		Terminator: "lf",
		PacingMs:   1,
		TimeoutMs:  300,
	})
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if result.Exchanges[0].RxHex != hex.EncodeToString([]byte("ON00000000\n")) {
		t.Errorf("RxHex = %q", result.Exchanges[0].RxHex)
	}
}
