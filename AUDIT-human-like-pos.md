# Audit human-like — cassa/POS (superficie vs meccaniche)

Obiettivo: verificare che le meccaniche introdotte (lock, settle, quote,
presenza, gate, snapshot) siano leggibili dall'operatore in superficie.
Una meccanica corretta ma invisibile è un comportamento bloccante: l'operatore
non la vede, non la capisce e non riesce ad agire.

## Mappa per area

### 1. POS — contesto e carrello
- **Meccanica**: `applyPosContextAction` unico scrittore; carrello keyed per
  contesto (`dine_in:<table>`, `takeaway`, `delivery`); memoria ultimo tavolo
  di sala; deep link one-shot dalla mappa.
- **Superficie**: picker Sala/Asporto/Delivery in shell + POS; badge Offline
  quando il socket è giù.
- **Rischio human-like**: il carrello "sparisce" cambiando modalità (è nel
  contesto vecchio, non cancellato). Mitigato con conferma esplicita in shell
  e POS. Resta il rischio che l'operatore non capisca che i suoi articoli sono
  "nell'altro carrello": il messaggio di conferma ora lo dice in parole, non
  in termini di chiavi.

### 2. Cassa — chiusura conto
- **Meccanica**: lock tavolo in `createOrderTx`; stampa post-commit; settle a
  saldo zero; sessioni pagamento; numeri conto random.
- **Superficie**: `CheckoutMainView` (righe + residuo), `CloseTableView`
  (metodo, resto, fiscale, stampa), `CheckoutErrorBanner` (recovery guidato).
- **Difetto trovato e corretto**: in `CheckoutMainView`, a conto saldato, il
  bottone diceva **"Chiudi"** e chiudeva solo il pannello: il tavolo restava
  occupato. Ora è **"Libera il tavolo"** e porta allo step `close` dove
  avviene davvero la liberazione.
- **Difetto trovato e corretto**: **"Libera il tavolo"** (settle) era un tap
  singolo, irreversibile, senza conferma. Ora chiede conferma con la
  descrizione delle conseguenze (ordini pagati, nessun incasso/scontrino).
- **Difetto trovato e corretto**: errore di caricamento stato pagamenti in
  inglese e senza azione. Ora in italiano con l'azione suggerita.
- **Difetto trovato e corretto**: bottone incasso disabilitato per riferimento
  carta < 3 caratteri senza spiegazione. Ora hint visibile sotto l'input in
  `CloseTableView`, `PayItemsView` e per-quota in `SplitBillView`.

### 3. Divisione conto (split)
- **Meccanica**: quote persistite server-side; `updateSplitShares` e
  `cancelSplitBill`; blocco dopo la prima quota incassata.
- **Superficie**: `SplitBillView` (persone, quota, resto, modifica quote).
- **Difetto trovato e corretto**: dopo la prima quota incassata, i controlli
  "Modifica quote" e "Annulla divisione" **sparivano in silenzio**. Ora un
  avviso spiega il motivo e cosa fare (completare le quote rimaste).

### 4. Sala / tavoli
- **Meccanica**: presenza POS via socket (`pos_claim_table`); bozze di sala
  (ghost) con commit/discarta da cassa; retirement soft dei tavoli virtuali.
- **Superficie**: badge `POS · <nome>` sulla card, sezione "Bozza" con
  Invia / Senza stampa / Scarta, toggle articoli.
- **Difetto trovato e corretto**: il badge di presenza era solo decorativo:
  il tavolo si apriva comunque, senza avviso, creando conti doppi. Ora
  l'apertura chiede conferma ("Tavolo già in lavoro … Apri comunque?").
- Bozze: l'invio/scartazione da cassa svuota il carrello del cameriere con
  messaggio esplicito ("La bozza è stata chiusa dalla cassa…"). Già presente.

### 5. Analytics / dashboard gate
- **Meccanica**: `POST /analytics/unlock` verificato server-side, throttle,
  audit; gate code per-tenant (franks) accettato oltre al PIN personale.
- **Superficie**: `DashboardGate` (tastierino PIN), lock button in dashboard.
- **Difetto trovato e corretto**: il copy parlava solo del "PIN di <nome>",
  ma franks accetta anche il codice del locale: un admin che prova solo il
  proprio PIN può fallire senza capire perché. Ora: "il tuo PIN personale,
  oppure il codice del locale se ne ha uno".
- Sessione: l'unlock vive in `sessionStorage` (sopravvive al reload, non al
  logout). È una scelta, non un blocco: il terminale lasciato aperto resta
  però sbloccato finché non si preme il lucchetto.

### 6. Stampa / profili bridge
- **Meccanica**: snapshot del routing live nel profilo.
- **Superficie**: `PrintProfilesPanel`.
- Già corretto: conferma esplicita prima di sovrascrivere un profilo
  (nessun tap distruttivo silenzioso).

### 7. Formato importi
- `formatCurrency` unico ("€1.234,50"). Nessun blocco: il rischio era la
  lettura, non l'azione.

## Verifiche
- Test aggiornati per i due comportamenti cambiati (label "Libera il tavolo",
  errore in italiano).
- `npm run lint`, suite web/api/shared, `npm run build`, restart PM2 e health
  dopo le correzioni.
