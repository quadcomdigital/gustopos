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

## Secondo passaggio — fiscale, sospendi, QR

### Fiscale
- **Meccanica**: `fiscalEmit` marcava il pagamento `pending`; l'emissione vera
  partiva solo se il RT era `enabled` e con `host`. Se non lo era, la funzione
  usciva **in silenzio**: il pagamento restava "in attesa" per sempre e
  nessuna superficie lo diceva (in web `fiscalStatus`/`fiscalError` non erano
  letti da nessun componente).
- **Corretto (API)**: se il fiscale è richiesto ma il RT non è configurato, il
  pagamento viene marcato `failed` con il motivo ("Registratore fiscale non
  configurato: … Impostazioni → Fiscale, poi riemetti"). Non è più una bugia,
  e il motivo è persistito per la diagnostica.
- **Corretto (UI)**: la nota sotto il toggle in `CloseTableView` lo dice prima
  della chiusura. Il toggle resta visibile perché la config è admin-only: un
  cassiere non può leggerla, quindi la verità arriva dal server.
- Nota: la UI cassa non mostra ancora `fiscalError`; oggi il motivo è visibile
  solo dove si leggono i pagamenti (diagnostica/Settings). Da valutare un
  badge "fiscale non emesso" sul conto appena chiuso.

### Sospendi
- **Meccanica**: `suspendPreBill` esisteva nello stato ma **nessun controllo lo
  cambiava**: ogni sospensione stampava il preconto, senza scelta. In più, con
  modulo stampa spento l'etichetta prometteva comunque "Sospendi e stampa".
- **Corretto**: `ConfirmDialog` accetta un contenuto opzionale; la conferma di
  sospensione mostra uno switch "Stampa il preconto in cassa". Se il modulo
  stampa è spento lo switch è nascosto e il payload invia `printPreBill:false`,
  coerente con l'etichetta.

### QR self-order
- **Meccanica**: "Genera QR" ruotava la sessione del tavolo (il QR precedente
  smette di funzionare) e chiudeva la sheet **prima** dell'esito; un errore
  finiva in un toast da 4 secondi, un successo in un banner in basso.
- **Corretto**: la sheet resta aperta durante la generazione, mostra l'errore
  inline, e avvisa prima che il QR attuale verrà invalidato. Il banner del QR
  ora ha anche "Copia link" (con feedback), utile per stamparlo o inviarlo.

## Terzo passaggio — impostazioni: toggle inerti e azioni senza conferma

### Toggle senza effetto
- **`printing.autoPrintKitchen`** (Settings → Stampa → Avanzate, "Auto-print
  cucina"): nessuna lettura lato API. I ticket di produzione partivano sempre,
  qualunque valore avesse il flag. **Corretto**: `createPrintJobsForOrder` lo
  legge; il reinvio manuale ("Reinvia in cucina") passa `force: true` e resta
  disponibile anche a flag spento. Entrambi i tenant in produzione hanno il
  flag `true`, quindi il deploy non spegne nulla.
  - Etichetta resa esplicita: "Ticket produzione all'invio" + hint sul reinvio.

### Azioni distruttive senza conferma
- **Reset tema** ("Reset default tema"): sostituiva l'intero draft con
  `defaultUiSettings`, quindi nome brand, logo bitmap, footer, protocollo e
  auto-print; un salvataggio successivo cancellava anche quelli. **Corretto**:
  ripristina solo `theme` (label "Ripristina colori di default").
- **Protocollo stampa → Disabilitato**: ferma ogni ticket, scontrino e
  preconto, ma si salvava senza conferma. **Corretto**: conferma esplicita che
  elenca cosa smette di stampare; il valore nel select dice "nessuna stampa".
- **Zona di stampa "Attiva/Inattiva"**: il bottone mostrava lo stato, non
  l'azione (cliccando "Attiva" si disattivava) e applicava subito. **Corretto**:
  tooltip azione + conferma quando la zona ha articoli assegnati (che
  resterebbero senza destinazione).
- **Tenant "Disattiva"** (Superadmin): chiude l'accesso all'intero locale senza
  conferma, mentre la disattivazione di un modulo critico la chiedeva.
  **Corretto**: conferma prima di spegnere, con l'elenco degli effetti.
- **Moduli alternativi** (Superadmin): attivare `simple_catalog` disattivava
  `inventory` (e a cascata `purchasing_suppliers`) e viceversa; il cascade era
  raccontato solo nel messaggio di successo. **Corretto**: conferma prima.

### Verificati e lasciati come sono
- Zone che stampano: `[]` = tutte, l'ultima zona non è deselezionabile (già
  gestito, nessun toggle "senza effetto").
- Coda stampa e diagnostica (azioni esplicite), profili di stampa (attiva /
  snapshot / elimina già confermati), collaudo fiscale e chiusura giornata
  (già confermati), categorie notifiche (salvataggio esplicito).
- `taxRate` esiste nel contratto ma non è esposto da nessuna superficie:
  nessun toggle da correggere.
