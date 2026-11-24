# Audit — race condition, root cause e problemi UX/UI

Data: 2026-11-24 · Perimetro: API (`apps/api/src`), web POS/cassa (`apps/web/src`), contratti condivisi.
Non coperto: fiscal RT, menu pubblico, print-agent Go, migrazioni.

Metodo: scansione dei pattern a rischio su tutto il repo (ID da timestamp, `FOR UPDATE`, `for("update")`, idempotenza, gestione errori, formattazione, target tattili, a11y) + lettura in profondità dei punti caldi già coinvolti dai fix di questa settimana. Ogni voce ha evidenza file:riga; le ipotesi smentite sono elencate in fondo, per non lasciare sospetti infondati.

---

## Sintesi

| # | Severità | Area | Sintesi |
|---|---|---|---|
| A1 | **Alta** | Concorrenza | Aggiunta voci mentre la cassa chiude: scontrino senza quelle voci |
| A2 | **Alta** | Robustezza | Errore di stampa post-commit → retry crea un **secondo ordine** |
| A3 | **Alta** | Concorrenza | ID pagamento `pay_<ms>` senza casuale → collisione PK |
| A4 | **Media** (latente) | Correttezza | Numero conto da `ms.slice(-4)` → due clienti sullo stesso conto |
| A5 | Media | Concorrenza | Lock ingredienti senza `ORDER BY` → deadlock |
| A6 | Media | Coerenza dati | Snapshot REST lento sovrascrive un push socket più recente |
| B1 | Media | UX errori | Errori API in inglese mostrati al banco |
| B2 | Media | Architettura | 3 sorgenti di verità del contesto POS (Fase 3 aperta) |
| C1 | **Alta** | UX | Mode picker della shell cambia modalità senza conferma, carrello pieno |
| C2 | Media | UX | 109 `toFixed(2)` → "13.00" invece di "13,00" |
| C3 | Media | UX touch | 29 target sotto 44px |
| C4 | Media | A11y | `ConfirmDialog` senza focus trap, senza portal |
| C5 | Media | A11y | Errori di invio POS senza `role="alert"` |
| A7/B3/B4/C6/C7 | Bassa | — | Vincoli e rifiniture (dettaglio sotto) |

---

## A. Concorrenza

### A1 — Aggiunta voci mentre la cassa chiude (Alta)

`closeTable` (`tables.repository.ts:499-538`), `settleTable` (:800), `paySelectedItems` (:1546), `markShareAsPaid` (:1853) prendono `FOR UPDATE` sulla riga `tables` e sugli ordini aperti. **`createOrder` no**: occupa il tavolo con un update non lockante (`app.repository.ts`, `occupyTableTx`).

Sequenza (READ COMMITTED):
1. Cassa: apre la tx, locka la riga `tables`, legge gli ordini aperti visibili (€20), calcola il totale.
2. Cameriere: `createOrder` **inserisce la riga ordine prima** di toccare il tavolo (`app.repository.ts:4188`, poi l'occupazione ~:4222). L'insert non è bloccato dal lock della cassa e non è visibile alla sua `SELECT`.
3. Cassa: marca `paid` gli ordini letti, libera il tavolo, committa.
4. Cameriere: l'`UPDATE` del tavolo sblocca e riporta `occupied`.

Esito: la portata resta `pending` fuori dallo scontrino, il tavolo torna occupato con un conto che nessuno ha incassato. **Scontrino emesso senza una consumazione** — problema fiscale, non solo estetico.

Mitigazione: all'inizio del binding tavolo in `createOrder`, dopo aver risolto l'id:
`await lockTableTx(tx, tenantId, tableId)` (helper già esistente in `repository/kernel/table-lifecycle.ts`), e **rifiutare** se il tavolo è `free` mentre si aggiungono voci a un conto esistente. Serializza i due flussi: o la portata entra prima del conteggio, o la cassa la vede dopo.

### A2 — Errore di stampa dopo il commit → ordine duplicato (Alta)

`createPrintJobsForOrder` è chiamato **fuori** dalla transazione dell'ordine e **senza try/catch**, in 4 punti:
`app.repository.ts:4106`, `:4783`, `:5462`, `:6093`.

Se l'enqueue fallisce (lettura config, insert `print_jobs`, payload), l'API risponde 5xx **dopo** che l'ordine è committato. Il middleware di idempotenza, sui 5xx, rilascia il lock (`tenant/idempotency.middleware.ts:101-110`), quindi il retry del POS riesegue e crea un **secondo ordine** con un id nuovo: doppio invio in cucina, doppio addebito atteso.

Mitigazione: la stampa non è la sorgente di verità dell'ordine.
```ts
if (!options.skipPrint) {
  try { await this.createPrintJobsForOrder(order); }
  catch (error) { console.error("[print] enqueue failed", { orderId: order.id, error }); }
}
```
In più: job marcato per retry manuale (la diagnostica stampa esiste già) e alert nel pannello Stampe. Meglio ancora: enqueue nella stessa tx dell'ordine, così o entrambi o nessuno.

### A3 — ID pagamento senza casuale (Alta)

`tables.repository.ts:680` e `:1672`: `const paymentId = \`pay_${Date.now().toString(36)}\``.
Granularità 1 ms, nessun suffisso casuale. Due incassi nello stesso millisecondo (due terminali, o due richieste parallele) → violazione di PK → **rollback dell'intero incasso** con errore DB grezzo. `pay_${Date.now()}_${idx+1}` (:1461) è al sicuro solo dentro la stessa chiamata.

Mitigazione: `pay_${crypto.randomUUID()}` (o `pay_${Date.now()}_${crypto.randomUUID().slice(0,8)}`).

### A4 — Numero conto che si ripete ogni 10 secondi (Media, ma insidiosa)

`app.repository.ts:4157-4159` (POS), `:3685` (takeaway pubblico), `:2949` (group order):
`TA-${yyyyMMdd}-${Date.now().toString().slice(-4)}`.

Le ultime 4 cifre dei millisecondi **ciclicano ogni 10 s**. Due conti creati a 10 s (o 20, 30…) di distanza ottengono lo stesso numero. Poiché il numero del conto *è* il numero del tavolo virtuale:
- se il primo conto è ancora aperto, `openOrReuseVirtualContoTx` lo **riusa**: due clienti diversi finiscono sullo stesso conto, totale sommato, chiusura congiunta;
- se è già ritirato, si crea una riga nuova (comportamento corretto).

Impatto: fusione silenziosa di conti di clienti diversi — peggio di un 500, perché non lascia traccia evidente.

Evidenza sui dati reali: **0 ticket duplicati** oggi (query `GROUP BY ticket_number HAVING count(*) > 1` su tutti i tenant) → difetto **latente**, non ancora materializzato. Il meccanismo però è deterministico, non casuale: la probabilità per coppia di ordini è 1/10.000 e cresce col volume.

Mitigazione: `crypto.randomUUID().slice(0,8)` o contatore per tenant/giorno (`SELECT max` sotto lock, o sequenza). Da correggere in tutti e 4 i siti per coerenza.

### A5 — Deadlock sui lock di magazzino (Media)

`app.repository.ts:4608-4612` (ingredienti) e `:4704-4708` (prep): `inArray(ids).for("update")` **senza `ORDER BY`**. Due ordini con ingredienti in ordine fisico opposto possono incrociarsi → Postgres aborta uno con `deadlock detected`, l'ordine fallisce con errore grezzo.

Mitigazione: `[...ids].sort()` prima della query (o `.orderBy(inventory.id)`), così ogni transazione acquisisce i lock nello stesso ordine. Stesso trattamento in `payments.repository.ts:99`.

### A6 — Snapshot REST che clobbera il realtime (Media)

`reconcileOperationalData` (`app-store.ts`, nuova) e `refreshAllData` fanno `set({ data })` senza guardia di versione. Se una risposta REST parte prima di un evento socket e arriva dopo, il client torna a uno stato più vecchio finché non arriva l'evento successivo: tavoli/totali stagnanti, senza alcun indicatore.

Mitigazione: timestamp `fetchedAt` sullo snapshot e applicare solo se più recente dell'ultimo `dataUpdate` ricevuto; oppure far vincere sempre il socket e usare il REST solo come fallback quando il socket è disconnesso.

### A7 — Presenza POS solo in memoria (Bassa, ma è un vincolo)

`realtime.gateway.ts:64` — `Map` per processo, chiave `socket.id`, pulita su `disconnect`. Con **una sola istanza** (l'ecosystem non usa `cluster`) è corretta. Al primo scale-out o `pm2 -i 2` i chip "POS · Mario" compaiono solo sui terminali collegati alla stessa istanza. Non è un bug oggi: è un vincolo non documentato. Mitigazione: Redis hash con TTL e snapshot aggregato, quando servirà.

---

## B. Root cause e robustezza

### B1 — Errori in inglese al banco (Media)

Messaggi lanciati dall'API e mostrati così come sono nella UI: `No payable balance for this table` (`tables.repository.ts:542`, `:551`), `Not all items have been paid. Paid: X, Total: Y` (:604), `Paid amount is lower than total` (:645), `Table "X" not found`.

Un cameriere riceve "No payable balance for this table" e non sa cosa fare. Mitigazione: codici d'errore stabili (`code: "table_no_payable_balance"`) + mappa di traduzione lato web; i messaggi italiani già presenti (es. "Restano €X da incassare…") dimostrano che la convenzione esiste, è solo disomogenea.

### B2 — Tre sorgenti di verità del contesto POS (Media)

`posOrderMode` + `posOrder` + `orderContext` derivato da `data.orders`, più `?order=` in URL. `effectiveOrderMode` corregge a runtime, ma ogni entry point può bypassarla: è già successo due volte questa settimana (shell mode picker, shell table picker). Fase 3 del piano (`nextPosContext` nello store, un solo scrittore) è la mitigazione strutturale ed è pronta all'uso.

### B3 — Stampa in transazione separata, senza alert (Bassa)

Anche quando l'enqueue riesce, il job vive in una tx diversa dall'ordine. Se il bridge/agent è offline il job resta `pending` (corretto: viene reclamato al ritorno), ma **nessuno avvisa l'operatore** che quella comanda non è ancora stampata: solo il pannello Diagnostica lo mostra. Mitigazione: badge "N stampe in attesa" nella shell quando i `print_jobs` pending superano una soglia.

### B4 — Degrado realtime silenzioso (Bassa)

Presenza, ghost orders e aggiornamenti tavoli passano dal socket; se cade, il POS continua a funzionare su dati stantii senza indicatore. Mitigazione: pallino di stato connessione nella topbar del POS (esiste già `isOnline` nella shell, ma è la connettività browser, non il socket).

---

## C. UX / UI

### C1 — Il mode picker della shell scarta il carrello senza chiedere (Alta)

`BackofficeShell.tsx:516` cambia modalità anche con articoli non inviati. `POSView.handleSelectMode` in quel caso apre un `ConfirmDialog` ("Ci sono N articoli non inviati…"), la shell no. Risultato: l'operatore cambia modalità dalla topbar, gli articoli restano nel carrello del contesto precedente e **sembrano spariti**.

Mitigazione: la shell legge `posCart` e riusa la stessa conferma; oppure il selettore modalità vive solo nel POS (dove la regola è già implementata).

### C2 — Importi con il punto decimale (Media)

109 occorrenze di `€{x.toFixed(2)}` nei componenti contro **1** uso di `Intl.NumberFormat('it-IT')` (`OrderApprovalsView.tsx:6`). In una UI italiana "€13.00" è sbagliato e, su scontrini/preconti, incoerente con il formato fiscale.

Mitigazione: helper unico in `shared` (`formatCurrency`) e sostituzione progressiva; non serve toccare la logica di calcolo.

### C3 — Target tattili sotto 44px (Media)

29 occorrenze: `min-h-[40px]` ×14, `min-h-[36px]` ×8, `min-h-[32px]` ×7. In cassa, su tablet, con la fretta (o i guanti), un bottone da 32px è un errore di tocco che genera un ordine sbagliato. Priorità ai bottoni distruttivi/irreversibili (Scarta bozza, Invia, Paga).

### C4 — `ConfirmDialog` senza focus trap e senza portal (Media)

`ConfirmDialog.tsx:27-54`: ha ESC, focus iniziale sul confirm, `role="dialog"`, `aria-modal`. Manca:
- **focus trap**: Tab porta il focus sugli elementi dietro il modale;
- `aria-describedby` per il messaggio;
- **nessun `createPortal`**: `fixed inset-0` dentro un antenato con `transform` (frequente con `motion.div`) viene posizionato rispetto a quell'antenato, non al viewport. Da verificare nei casi concreti, ma è la classica causa di "modale che appare a metà schermo".

### C5 — Errori di invio non annunciati (Media)

`POSView.tsx:1949`: `<p className="text-[10px] text-danger">` senza `role="alert"` né `aria-live`. `TablesView` lo fa correttamente (`role="alert"`): l'incoerenza significa che un non vedente non sa che l'invio è fallito. Il testo è anche a 10px, sotto la soglia di leggibilità sul banco.

### C6 — "Bozze in sala": dettaglio con `<details>` nativo (Bassa)

`TablesView.tsx` usa `<details><summary>` per gli articoli della bozza: bersaglio piccolo, nessuna icona di stato, e su iPad il tocco sul summary apre/chiude con difficoltà. Meglio un toggle esplicito con `aria-expanded`.

### C7 — Nessun feedback di "dati non aggiornati" (Bassa)

Vedi B4 lato dati; lato UI manca un indicatore. Un cameriere che vede un tavolo "libero" mentre un altro terminale l'ha appena occupato perde tempo e può creare un conto doppio (mitigato da A1 una volta risolto).

---

## Ordine di intervento consigliato

1. **A2** — è l'unica che può duplicare un ordine reale; fix di 3 righe + log.
2. **A1** — `lockTableTx` in `createOrder`: chiude la classe "scontrino senza consumazione".
3. **A3 + A4** — ID e numeri conto: due righe ciascuno, eliminano collisioni e fusioni di conti.
4. **C1** — conferma nella shell: evita la perdita percepita del carrello.
5. **B1 + C2 + C5** — tre interventi piccoli e trasversali su messaggi/formato/a11y.
6. **A5, A6** — deadlock e coerenza snapshot.
7. **B2 (Fase 3), B3, B4, A7, C3, C4, C6, C7** — rifiniture pianificabili.

---

## Ipotesi verificate e smentite (per non lasciare sospetti)

- **Overselling / stock negativo sotto concorrenza**: *non* si verifica. Ingredienti e prep sono letti con `FOR UPDATE` (`app.repository.ts:4612`, `:4708`), quindi il controllo di disponibilità e la deduzione sono serializzati. Resta solo il rischio di deadlock (A5), non di stock negativo.
- **Arrotondamento delle quote di divisione**: corretto. `makeShares` (`tables.repository.ts:1310-1320`) arrotonda per difetto e assegna il resto all'ultima quota: la somma coincide sempre col totale.
- **"Lock atomico" sulla selezione tavolo**: non esiste e non serve. `selectPosTable` è un singolo `set()`; il problema era la molteplicità di scrittori, non la concorrenza.
- **Presenza POS multi-istanza**: oggi irrilevante, l'API gira in fork singolo. Vincolo documentato in A7, non bug.
- **Doppio tap su "Invia"**: già mitigato (bottone disabilitato durante `isProcessing` + chiave idempotenza per fingerprint). Il buco è solo il caso A2 (errore post-commit).

---

## Esito interventi (24/11/2026)

| ID | Stato | Dove |
| --- | --- | --- |
| A1 | **Fatto** | `createOrderTx`: `lockTableTx` + guard "tavolo esiste" prima di `insert(orders)`; conto virtuale con `reuseExisting` esplicito. |
| A2 | **Fatto** | `enqueuePrintJobsSafely` nei 3 call site post-commit (ordine, ghost commit, invio conto); `resendPrintJobs` resta throwing (azione manuale). |
| A3 | **Fatto** | id pagamento `pay_<uuid>` (3 punti in `tables.repository.ts`). |
| A4 | **Fatto** | `makeTicketNumber()` (6 cifre random) + 5 test; 4 call site. |
| A5 | **Fatto** | `ORDER BY id` sui `FOR UPDATE` di ingredienti e prep. |
| A6 | **Fatto** | `shouldApplySnapshot` + `dataRevision` nello store. |
| A7 | Documentato | Vincolo fork singolo per `posPresence` (non un bug). |
| B1 | **Fatto** | Messaggi cassa/POS in italiano in `tables.repository.ts` / `app.repository.ts`. |
| B2 | **Fatto** | `applyPosContextAction` = unico scrittore (modalità+tavolo+conto in un `set()`), `selectPosTable` delega a `nextPosContext`; rimossi 5 `setState({posOrderMode})` e le selezioni manuali in POSView/Shell/module-routes. 6 test in `apps/web/src/store/pos-context.test.ts`. |
| B3 | **Rinviato (serve un evento server)** | I job nascono dentro `AppRepository`, che non ha (e non può avere senza ciclo DI) il `RealtimeGateway`: serve `job:created`. Nel frattempo la vista Stampa mostra i job al refresh. |
| B4/C7 | **Fatto** | `socketConnected` nello store (connect/disconnect) + badge "Offline" con `role="status"` nell'header POS. |
| C1 | **Fatto** | Conferma cambio modalità in `BackofficeShell` (`ConfirmDialog`). |
| C2 | **Fatto** | `formatCurrency` condiviso + 6 test, applicato alle superfici cassa/POS. |
| C3 | **Fatto (superfici POS)** | Bottoni critici ≥44px in `POSView`, `TablesView`, `checkout/*`, `POSProductModal`; gli editor desktop di backoffice restano invariati. |
| C4 | **Fatto** | `ConfirmDialog` con portal, focus trap, `aria-labelledby/describedby`, ripristino focus. |
| C5 | **Fatto** | `role="alert"`/`aria-live` sugli errori POS. |
| C6 | **Fatto** | Toggle "Vedi/Nascondi articoli" con `aria-expanded` al posto di `<details>`. |
