//go:build linux

package main

import (
	"encoding/hex"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"golang.org/x/sys/unix"
)

// ─── Prova del trasporto seriale su una pty reale ─────────────────────────
//
// La seriale non si può collaudare senza hardware, ma il *percorso di codice*
// sì: una pseudo-terminale è un dispositivo a caratteri come /dev/ttyUSB0, e
// l'agente la apre con la stessa chiamata (`serial.Open`) che userebbe in
// cassa. Il RT finto sta sull'altro capo della pty, quindi si verificano
// apertura, scrittura byte-per-byte e lettura col terminatore.

// openPty crea una coppia master/slave e restituisce il master (il lato del RT
// finto) e il percorso dello slave (il lato che l'agente apre come seriale).
func openPty(t *testing.T) (*os.File, string) {
	t.Helper()
	fd, err := unix.Open("/dev/ptmx", unix.O_RDWR|unix.O_NOCTTY, 0)
	if err != nil {
		t.Skipf("pty non disponibile in questo ambiente: %v", err)
	}
	master := os.NewFile(uintptr(fd), "/dev/ptmx")
	// Sblocca lo slave (TIOCSPTLCK) e chiedine il numero (TIOCGPTN): senza lo
	// sblocco l'apertura dello slave fallisce con EIO.
	if err := unix.IoctlSetPointerInt(fd, unix.TIOCSPTLCK, 0); err != nil {
		_ = master.Close()
		t.Skipf("pty non sbloccabile: %v", err)
	}
	number, err := unix.IoctlGetInt(fd, unix.TIOCGPTN)
	if err != nil {
		_ = master.Close()
		t.Skipf("numero dello slave non leggibile: %v", err)
	}
	slavePath := "/dev/pts/" + strconv.Itoa(number)
	t.Cleanup(func() { _ = master.Close() })
	return master, slavePath
}

// TestRTTransportSerialWritesVerbatimAndReportsHex esegue la stessa sequenza
// del trasporto TCP, ma su una porta seriale: i byte scritti devono essere
// esattamente il frame decodificato, e la risposta va riportata in esadecimale.
func TestRTTransportSerialWritesVerbatimAndReportsHex(t *testing.T) {
	master, slavePath := openPty(t)

	// Risposta reale di una WALL-E: ACK + frame PrintF con <DATA_ANSW>.
	response, _ := hex.DecodeString("060230313031304E4F4E303030303030303038343503")
	received := make(chan []byte, 1)
	go func() {
		buf := make([]byte, 512)
		n, err := master.Read(buf)
		if err != nil || n == 0 {
			received <- nil
			return
		}
		received <- append([]byte(nil), buf[:n]...)
		_, _ = master.Write(response)
	}()

	result, err := RTTransport{Serial: slavePath, Baud: 115200}.Execute(RTWire{
		ProtocolID: "versione-di-prova",
		Frames:     []RTFrame{frame("=C1")},
		Terminator: "etx",
		PacingMs:   1,
		TimeoutMs:  500,
	})
	if err != nil {
		t.Fatalf("Execute su seriale: %v", err)
	}
	if len(result.Exchanges) != 1 {
		t.Fatalf("exchange attesi 1, ottenuti %d", len(result.Exchanges))
	}
	if result.Exchanges[0].Error != "" {
		t.Fatalf("errore inatteso: %s", result.Exchanges[0].Error)
	}
	if result.Exchanges[0].RxHex != hex.EncodeToString(response) {
		t.Errorf("RxHex = %q, atteso %q", result.Exchanges[0].RxHex, hex.EncodeToString(response))
	}

	select {
	case written := <-received:
		if string(written) != "=C1" {
			t.Errorf("byte scritti sul collegamento seriale = %q, attesi %q", written, "=C1")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("il RT finto non ha ricevuto nulla entro il timeout")
	}
}

// TestRTTransportSerialMultipleFramesSamePort verifica che la sessione seriale
// resti aperta per tutta la sequenza: il pacing non richiude la porta (sulla
// seriale non esiste il budget di connessioni del TCP, ma la sessione è una).
func TestRTTransportSerialMultipleFramesSamePort(t *testing.T) {
	master, slavePath := openPty(t)

	go func() {
		buf := make([]byte, 64)
		for i := 0; i < 2; i++ {
			if _, err := master.Read(buf); err != nil {
				return
			}
			_, _ = master.Write([]byte{0x06, 0x01, 0x03})
		}
	}()

	result, err := RTTransport{Serial: slavePath}.Execute(RTWire{
		ProtocolID: "versione-di-prova",
		Frames:     []RTFrame{frame("=C1"), frame("<</?s")},
		Terminator: "etx",
		PacingMs:   1,
		TimeoutMs:  500,
	})
	if err != nil {
		t.Fatalf("Execute su seriale: %v", err)
	}
	if len(result.Exchanges) != 2 {
		t.Fatalf("exchange attesi 2, ottenuti %d", len(result.Exchanges))
	}
	for _, exchange := range result.Exchanges {
		if exchange.Error != "" {
			t.Errorf("errore inatteso: %s", exchange.Error)
		}
	}
}

// TestRTTransportSerialDeviceMissing è l'errore che si vede in cassa quando il
// cavo non c'è o il percorso è sbagliato: deve dire *quale* porta non si è
// aperta, così il tecnico lo legge nei log senza indovinare.
func TestRTTransportSerialDeviceMissing(t *testing.T) {
	_, err := RTTransport{Serial: "/dev/ttyUSB-non-esiste"}.Execute(RTWire{
		ProtocolID: "versione-di-prova",
		Frames:     []RTFrame{frame("=C1")},
	})
	if err == nil {
		t.Fatal("un dispositivo inesistente deve dare errore di trasporto")
	}
	if !strings.Contains(err.Error(), "/dev/ttyUSB-non-esiste") {
		t.Errorf("l'errore deve indicare la porta aperta: %v", err)
	}
}
