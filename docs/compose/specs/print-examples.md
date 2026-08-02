# Esempi di Stampa — GustoPOS

## Riepilogo Tipi di Ricevuta

Il sistema genera **3 tipi di stampa** (areas) per ogni ordine, in base alle aree di stampa configurate per ogni piatto/bevanda:

| Area | Destinazione | Contiene Prezzi? | Quando Stampa |
|------|-------------|-------------------|---------------|
| **KITCHEN** | Stampante cucina | No | Ad ogni nuovo ordine |
| **BAR** | Stampante bar | No | Ad ogni nuovo ordine |
| **CASHIER** | Stampante cassa | Si | Ad ogni nuovo ordine (o a chiusura conto) |

Ogni ordine viene suddiviso automaticamente tra le aree in base ai `printAreas` configurati su ogni menu item o categoria.

---

## 1. RICEVUTA CUCINA (Kitchen)

### Ordine Dine-in — Tavolo 5

```
         KITCHEN

Ordine: m3x7k2p1 | Dine-in
Tavolo: 5

----------------------------------------------
              *** REFERENZE ***
----------------------------------------------
POMODORO                          3
MOZZARELLA DI BUFALA              2
PROSCIUTTO CRUDO                  1
----------------------------------------------

** 2x Margherita**
  [Senza olive]
  + Olio al tartufo
  *-allergico glutine

** 1x Pizza Prosciutto e Funghi**
  [Funghi champignon]

** 1x Tiramisu Classico**

```

**Note:**
- Nessun prezzo visibile
- `**` indica testo in grassetto (ESC/POS bold)
- Sezione "REFERENZE" mostra ingredienti totali da preparare (solo per gli ingredienti collegati)
- `+` indica ingrediente aggiunto, `-` indica ingrediente rimosso
- `*` indica note del cliente
- `[Modificatore]` indica le opzioni selezionate dal pool

---

### Ordine Takeaway — Con Orario Ritiro

```
         KITCHEN

Ordine: p8w2m4 | Take away
Cliente: Mario Rossi
Telefono: +39 333 1234567
Consegna: 18:30

** 2x Panino Classico**
  [Pane classico]
  [Salsa BBQ]

** 1x Patatine Fritte**
```

**Note:**
- Per takeaway/delivery si mostra `Cliente:` invece di `Tavolo:`
- Se c'è un telefono, si aggiunge la riga `Telefono:`
- Se c'è un orario di ritiro/consegna, si mostra in grassetto `Consegna: HH:mm`

---

### Ordine Delivery — Con Indirizzo

```
         KITCHEN

Ordine: q1r5n8 | Delivery
Cliente: Luca Bianchi
Telefono: +39 334 5678901
Consegna: 19:15

** 1x Burger Franks**
  [Burger 180g]
  [Cipolla croccante]
  - Lattuga

** 1x Insalata Mista**
```

---

## 2. RICEVUTA BAR

### Ordine Dine-in — Tavolo 5

```
           BAR

Ordine: m3x7k2p1 | Dine-in
Tavolo: 5

** 2x Birra Moretti**
  [Bionda]

** 1x Aperol Spritz**
  [Senza ghiaccio]

** 1x Coca Cola**

```

**Note:**
- Stessa struttura della cucina, ma solo gli item assegnati all'area `bar`
- Nessun prezzo
- Nessuna sezione "REFERENZE" (solo per cucina)

---

### Ordine Takeaway — Bevande

```
           BAR

Ordine: k9f3h1 | Take away
Cliente: Anna Verdi

** 3x Acqua Naturale**

** 2x Birra Artigianale**
```

---

## 3. RICEVUTA CASSA (Cashier — Ricevuta Cliente)

### Ordine Dine-in — Tavolo 5

```
         KITCHEN

Ordine: m3x7k2p1 | Dine-in
Tavolo: 5

2x Margherita                EUR 20.00
  [Senza olive]
  + Olio al tartufo

1x Pizza Prosciutto e Funghi  EUR 13.00
  [Funghi champignon]

1x Tiramisu Classico         EUR 7.00

1x Birra Moretti              EUR 5.00
  [Bionda]

1x Aperol Spritz              EUR 8.00
  [Senza ghiaccio]

1x Coca Cola                  EUR 3.00

----------------------------------------------
TOTALE                        EUR 56.00

        Grazie per aver scelto GustoPOS
```

**Note:**
- **Prezzi inclusi** a destra (formato `EUR XX.XX`)
- Separatore `----------------------------------------------`
- Totale in grassetto
- Footer personalizzabile nelle Impressioni

---

### Ordine Takeaway — Con Pagamento

```
         CASSA

Ordine: p8w2m4 | Take away
Cliente: Mario Rossi
Telefono: +39 333 1234567
Consegna: 18:30

2x Panino Classico            EUR 18.00
  [Pane classico]
  [Salsa BBQ]

1x Patatine Fritte             EUR 5.00

2x Birra Moretti              EUR 10.00

----------------------------------------------
TOTALE                        EUR 33.00

        Grazie per aver scelto GustoPOS
```

---

### Ordine Delivery — Con Orario

```
         CASSA

Ordine: q1r5n8 | Delivery
Cliente: Luca Bianchi
Telefono: +39 334 5678901
Consegna: 19:15

1x Burger Franks             EUR 12.00
  [Burger 180g]
  [Cipolla croccante]
  - Lattuga

1x Insalata Mista              EUR 6.00

1x Coca Cola                  EUR 3.00

----------------------------------------------
TOTALE                        EUR 21.00

        Grazie per aver scelto GustoPOS
```

---

## 4. STAMPA DI TEST

Dalla pagina Impressioni, ogni area ha un pulsante "Test" che genera un ricevuta di verifica:

```
        *** GUSTOPOS ***

      TEST STAMPA - CUCINA
================================
Data: 22/07/2026, 15:30:45
Stampante: 192.168.1.50:9100
================================

Se leggi questo messaggio,
la stampante funziona correttamente!


```

**Note:**
- Generato lato client (non passa dall'API)
- Mostra data/ora attuale e indirizzo stampante
- Utile per verificare la connessione QZ Tray

---

## 5. LOGO BITMAP

Se configurato nelle Impressioni, il logo viene aggiunto **solo sullo scontrino cassa**
(chiusura tavolo), mai sui ticket cucina/bar:

```
[BITMAP LOGO 384px wide]
         GUSTOPOS

SCONTRINO NON FISCALE
...
```

### Upload e conversione

- Endpoint: `POST /api/settings/printing/logo` (multipart, campo `file`, opzionali
  `width` e `threshold`) — protetto da `@Roles("admin")` + `settings:update` + modulo
  `printing`.
- Validazione input: MIME consentito (PNG/JPEG/BMP/GIF — WebP non è supportato
  dal decoder jimp 0.22), max 2 MB, magic bytes sniffati (un'estensione farlocca
  viene rifiutata; `application/octet-stream` passa solo se i magic bytes sono validi).
- Conversione: l'immagine viene ridimensionata alla larghezza richiesta (default 384,
  arrotondata al multiplo di 8, clamp 8-576), convertita in scala di grigi e
  sogliata (threshold default 160): i pixel più scuri della soglia stampano come
  punti. L'alpha quasi trasparente viene trattato come bianco.
- Output: base64 del **comando raster completo `GS v 0`**
  (`\x1D\x76\x30\x00 xL xH yL yH d1..dk`) salvato in `settings.printing.logoBitmap`.

### Stampa

Lo scontrino cassa (`buildCashierReceiptPayload`) splitta i byte raster salvati
verboatim subito dopo l'header `\x1B\x33\x0A` (interlinea) e prima del reset
`\x1B\x32`. I builder dei ticket area (`buildEscPosPayload`) NON includono il logo.

---

## 6. CODICE ESC/POS GENERATO

Ogni ricevuta è un payload base64 che contiene escape sequences ESC/POS:

| Sequenza | Funzione |
|----------|----------|
| `\x1B\x40` | Inizializza stampante |
| `\x1B\x61\x01` | Allinea al centro |
| `\x1B\x61\x00` | Allinea a sinistra |
| `\x1B\x45\x01` | Grassetto ON |
| `\x1B\x45\x00` | Grassetto OFF |
| `\x1B\x21\x30` | Doppia larghezza + altezza |
| `\x1B\x21\x00` | Normale |
| `\x1D\x56\x00` | Taglia carta (completo) |
| `\x1D\x56\x01` | Taglia carta (parziale) |

Larghezza carta: **42 caratteri** (standard ricevute termiche 80mm).

---

## 7. FLUSSO DI STAMPA

```
Ordine Creato
  └─► createPrintJobsForOrder()
        ├─ Risolve print areas per ogni menu item
        ├─ buildEscPosPayload() → ESC/POS base64
        └─ INSERT into print_jobs (status: pending)
              │
              ├─► QzTrayWorker (browser polling)
              │     └─ decode base64 → QZ Tray → stampante
              │
              ├─► Print Station HTML (kiosk polling)
              │     └─ decode base64 → QZ Tray → stampante
              │
              └─► API dispatch endpoint → print-bridge
                    └─ scrive file .escpos nello spool
```

---

## 8. CONFIGURAZIONE STAMPANTI

Nelle Impressioni si configurano:

| Campo | Descrizione |
|-------|-------------|
| **Protocollo** | ESC/POS (attivo) o Disabilitato |
| **Logo** | Nessuno o Bitmap termica (base64, larghezza, threshold) |
| **Aree attive** | Kitchen, Bar, Cashier (toggle singoli) |
| **Printer Name** | Nome stampante nel sistema operativo |
| **Printer IP** | Indirizzo IP locale della stampante |
| **Printer Port** | Porta di rete (default 9100) |
| **Auto-print cucina** | Stampa automatica alla creazione ordine |
| **Auto-print cassa** | Stampa automatica alla chiusura conto |
| **Footer receipt** | Messaggio finale personalizzabile |

---

## 9. ESEMPIO COMPLETO — Ordine Complesso

Ordine misto con modificatori, override, e multi-aree:

```
         KITCHEN

Ordine: a7b3c9 | Dine-in
Tavolo: 3

----------------------------------------------
              *** REFERENZE ***
----------------------------------------------
POMODORINI                        2
MOZZARELLA                        3
PROSCIUTTO CRUDO                  1
SALSA BBQ                         2
PATATINE                          1
----------------------------------------------

** 2x Panino Franks**
  [Togli: Pomodoro, Insalata]
  [Aggiunte: Cipolla croccante, Hamburger]
  + Prosciutto cotto
  *senza pepe

** 1x Margherita**
  [Doppio formaggio]
  - Mozzarella

** 1x Patatine Fritte**

```

**Dettagli:**
- `2x Panino Franks` ha modificatori pool (Togli/Aggiunte) + override ingrediente (+ Prosciutto cotto) + note
- `1x Margherita` ha modificatore pool + override rimozione (- Mozzarella)
- Le REFERENZE sommano tutti gli ingredienti degli item con pool options collegati all'inventario
- Ogni item con area kitchen apparirà qui
