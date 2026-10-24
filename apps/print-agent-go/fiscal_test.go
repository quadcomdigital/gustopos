package main

import (
	"strings"
	"testing"
)

func TestFiscalAddressDefaults(t *testing.T) {
	p := &FiscalPrinter{Host: "192.168.1.50"}
	if addr := p.address(); addr != "192.168.1.50:4001" {
		t.Fatalf("expected default port 4001, got %q", addr)
	}
	p.Port = 9100
	if addr := p.address(); addr != "192.168.1.50:9100" {
		t.Fatalf("expected port 9100, got %q", addr)
	}
}

// Il collegamento lo decide il server: l'agente deve applicare transport, host e
// baud che arrivano nell'heartbeat, altrimenti la scelta "seriale" resterebbe
// nella UI e l'agente continuerebbe a bussare al TCP.
func TestMergeServerFiscalPrinterAppliesTransport(t *testing.T) {
	// Da TCP a seriale: host = dispositivo, baud dal server.
	serial := mergeServerFiscalPrinter(
		&FiscalPrinter{Host: "192.168.0.120", Port: 23, Transport: "tcp", Baud: 9600},
		&FiscalPrinter{Host: "/dev/ttyUSB0", Transport: "serial", Baud: 115200, Enabled: true, Model: "walle-mec-rt"},
	)
	if serial.transport().Serial != "/dev/ttyUSB0" {
		t.Errorf("Seriale = %q, atteso /dev/ttyUSB0", serial.transport().Serial)
	}
	if serial.transport().Baud != 115200 {
		t.Errorf("Baud = %d, atteso 115200", serial.transport().Baud)
	}
	if !serial.Enabled {
		t.Error("il flag enabled del server deve essere applicato")
	}

	// Da seriale a TCP: la seriale non deve restare appesa.
	tcp := mergeServerFiscalPrinter(
		&FiscalPrinter{Host: "/dev/ttyUSB0", Transport: "serial", Baud: 115200},
		&FiscalPrinter{Host: "192.168.0.120", Port: 23, Transport: "tcp"},
	)
	if tcp.transport().Serial != "" {
		t.Errorf("tornando al TCP la seriale deve sparire, ottenuto %q", tcp.transport().Serial)
	}
	if tcp.transport().Addr != "192.168.0.120:23" {
		t.Errorf("indirizzo TCP = %q", tcp.transport().Addr)
	}
	// Baud e porta non inviati (0) non azzerano i valori in uso.
	if tcp.Baud != 115200 {
		t.Errorf("un baud non inviato deve lasciare quello in uso, ottenuto %d", tcp.Baud)
	}
	if tcp.Port != 23 {
		t.Errorf("porta = %d, attesa 23", tcp.Port)
	}
}

func TestFiscalPrinterSerialDeviceOnlyForSerialTransport(t *testing.T) {
	// Il campo host è un IP finché il trasporto è TCP: non deve mai essere
	// interpretato come percorso di dispositivo.
	tcpPrinter := &FiscalPrinter{Host: "192.168.0.120", Transport: "tcp"}
	if device := tcpPrinter.serialDevice(); device != "" {
		t.Errorf("su TCP nessun dispositivo seriale, ottenuto %q", device)
	}
	serialPrinter := &FiscalPrinter{Host: "  COM3  ", Transport: "SERIAL"}
	if device := serialPrinter.serialDevice(); device != "COM3" {
		t.Errorf("dispositivo = %q, atteso COM3 (spazi rimossi, maiuscole indifferenti)", device)
	}
}

func TestParseFiscalWirePayloadAcceptsWireJobs(t *testing.T) {
	payload, err := parseFiscalWirePayload(`{
		"purpose": "receipt",
		"paymentId": "pay_1",
		"wire": {
			"protocolId": "etichetta-di-audit",
			"frames": [
				{"label": "chiave REG", "tx": "PTAx", "expectsAnswer": true, "waitMs": 200},
				{"label": "vendita reparto 1", "tx": "PTAx", "expectsAnswer": true}
			],
			"terminator": "etx"
		}
	}`)
	if err != nil {
		t.Fatalf("payload valido rifiutato: %v", err)
	}
	if payload.Purpose != "receipt" || payload.PaymentID != "pay_1" {
		t.Errorf("contesto non letto: %+v", payload)
	}
	if payload.Wire == nil || len(payload.Wire.Frames) != 2 {
		t.Fatalf("frames non lette: %+v", payload.Wire)
	}
	if payload.Wire.Frames[0].Label != "chiave REG" || payload.Wire.Frames[0].WaitMs != 200 {
		t.Errorf("frame non letto correttamente: %+v", payload.Wire.Frames[0])
	}
}

// L'agente non conosce i dialetti: un job senza frame non è eseguibile e deve
// fallire con un messaggio che rimanda alla configurazione, mai con un
// protocollo indovinato.
func TestParseFiscalWirePayloadRejectsLegacyPayloads(t *testing.T) {
	cases := map[string]string{
		"vuoto":            "",
		"senza wire":       `{"purpose":"test"}`,
		"wire senza frame": `{"wire":{"protocolId":"x","frames":[]}}`,
		"json invalido":    `{non-json`,
	}
	for name, raw := range cases {
		if _, err := parseFiscalWirePayload(raw); err == nil {
			t.Errorf("%s: atteso un errore", name)
		}
	}
	if _, err := parseFiscalWirePayload(`{"wire":{"frames":[]}}`); err == nil {
		t.Fatalf("atteso errore per frames vuote")
	}
}

func TestAgentVersionSatisfies(t *testing.T) {
	saved := version
	defer func() { version = saved }()

	version = "0.14.0"
	if agentVersionSatisfies("go-0.15.0") {
		t.Errorf("0.14.0 non soddisfa go-0.15.0")
	}
	if !agentVersionSatisfies("go-0.14.0") {
		t.Errorf("0.14.0 deve soddisfare go-0.14.0")
	}
	version = "1.2.3"
	if !agentVersionSatisfies("go-1.2.2") {
		t.Errorf("1.2.3 deve soddisfare go-1.2.2")
	}
	if agentVersionSatisfies("go-1.3.0") {
		t.Errorf("1.2.3 non deve soddisfare go-1.3.0")
	}
	// Requisito non numerico: non si blocca nulla.
	version = "0.14.0"
	if !agentVersionSatisfies("versione-sconosciuta") {
		t.Errorf("un requisito non numerico non deve bloccare")
	}
}

// Il briefing dei reparti arriva nell'heartbeat (protocollo attivo + reparti
// risolti dal server): l'agente lo registra per la diagnosi. Non lo interpreta e
// non lo usa per comporre comandi — i frame restano del server — ma senza questo
// una diagnosi dal locale non direbbe su quale protocollo è configurato il RT.
func TestApplyFiscalBriefingStoresInstruction(t *testing.T) {
	saved := version
	defer func() { version = saved }()
	version = "0.15.0"

	a := &Agent{}
	a.applyFiscalBriefing(nil)
	if a.fiscalBriefing != nil {
		t.Fatalf("un briefing assente non deve sovrascrivere nulla")
	}

	fallback := 4
	briefing := &FiscalDepartmentBriefing{
		ProtocolID:           "rch-walle",
		RequiresAgentVersion: "go-0.15.0",
		DefaultDepartment:    &fallback,
		Departments: []FiscalDepartment{
			{Department: 1, Label: "PIZZE", Kind: "good", CategoryIDs: []string{"cat_pizza"}},
			{Department: 4, Label: "BEVANDE", Kind: "service", IsDefault: true},
		},
	}
	a.applyFiscalBriefing(briefing)
	if a.fiscalBriefing == nil || a.fiscalBriefing.ProtocolID != "rch-walle" {
		t.Fatalf("briefing non registrato: %+v", a.fiscalBriefing)
	}
	if len(a.fiscalBriefing.Departments) != 2 {
		t.Fatalf("reparti non registrati: %+v", a.fiscalBriefing.Departments)
	}
	first := a.lastFiscalBriefing
	if first == "" {
		t.Fatal("la firma del briefing deve essere registrata per non ripetere i log")
	}

	// Stesso briefing: la firma non cambia (nessun log ripetuto a ogni heartbeat).
	a.applyFiscalBriefing(briefing)
	if a.lastFiscalBriefing != first {
		t.Errorf("firma cambiata per lo stesso briefing: %q -> %q", first, a.lastFiscalBriefing)
	}

	// Un reparto in più cambia la firma.
	briefing.Departments = append(briefing.Departments, FiscalDepartment{Department: 7, Label: "SERVIZI"})
	a.applyFiscalBriefing(briefing)
	if a.lastFiscalBriefing == first {
		t.Error("la firma deve cambiare quando cambia il briefing")
	}
}

func TestFiscalBriefingSignatureTracksContent(t *testing.T) {
	base := &FiscalDepartmentBriefing{ProtocolID: "rch-walle", Departments: []FiscalDepartment{{Department: 1, VatRate: intPtr(10)}}}
	other := &FiscalDepartmentBriefing{ProtocolID: "rch-walle", Departments: []FiscalDepartment{{Department: 1, VatRate: intPtr(22)}}}
	if fiscalBriefingSignature(base) == fiscalBriefingSignature(other) {
		t.Error("aliquote diverse devono dare firme diverse")
	}
	if fiscalBriefingSignature(base) != fiscalBriefingSignature(base) {
		t.Error("la firma deve essere stabile")
	}
}

func intPtr(value int) *int { return &value }

func TestHasArea(t *testing.T) {
	cases := []struct {
		areas []string
		area  string
		want  bool
	}{
		{[]string{"kitchen", "bar", "cashier"}, "cashier", true},
		{[]string{"kitchen"}, "cashier", false},
		{nil, "cashier", false},
		{[]string{"cashier"}, "cashier", true},
	}
	for _, tc := range cases {
		if got := hasArea(tc.areas, tc.area); got != tc.want {
			t.Errorf("hasArea(%v, %q) = %v, want %v", tc.areas, tc.area, got, tc.want)
		}
	}
}

// Il binary non deve contenere comandi di dialetto: la sola cosa che l'agente
// fa con un frame è spedirlo così com'è (la verifica byte-per-byte è in
// rt_transport_test.go). Questo test fissa il contratto: nessun campo di
// comando nel payload del job.
func TestFiscalJobPayloadHasNoCommandFields(t *testing.T) {
	payload, err := parseFiscalWirePayload(`{"wire":{"protocolId":"x","frames":[{"tx":"AA=="}]}}`)
	if err != nil {
		t.Fatalf("payload valido rifiutato: %v", err)
	}
	if payload.Wire.Frames[0].Tx != "AA==" {
		t.Fatalf("il frame deve arrivare già pronto: %+v", payload.Wire.Frames[0])
	}
	if strings.Contains(payload.Wire.Frames[0].Label, "=") {
		t.Errorf("la label è descrittiva, non un comando: %q", payload.Wire.Frames[0].Label)
	}
}
