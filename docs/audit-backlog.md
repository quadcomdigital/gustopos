# GustoPOS Audit - Backlog Sprint-by-Sprint

Questo documento traduce l'audit funzionale/tecnico in un backlog operativo pronto per pianificazione.

## Assunzioni di pianificazione

- Team: 2 backend, 1 frontend, 1 QA condiviso.
- Sprint: 2 settimane.
- Obiettivo: ridurre rischio operativo prima di espandere feature.

## Sprint 1 - Security Baseline + Test Harness (P0)

### Epic 1: Hardening autenticazione staff

1. **Hash PIN staff con migrazione backward-safe**
   - Tipo: Backend/DB
   - Stima: 8 pt
   - Dipendenze: nessuna
   - Task tecnici:
     - aggiungere colonna hash PIN (es. `pin_hash`) e piano di migrazione da PIN in chiaro;
     - aggiornare login (`findStaffByCredentials`) a verifica hash;
     - aggiornare reset PIN/staff create per scrivere solo hash;
     - script di migrazione per utenti esistenti con rollout controllato.
   - Acceptance criteria:
     - nessun PIN in chiaro scritto dopo deploy;
     - login staff esistenti ancora funzionante dopo migrazione;
     - test unit login hash pass.

2. **Rendere JWT secret obbligatorio e policy env sicura**
   - Tipo: Backend/DevOps
   - Stima: 3 pt
   - Dipendenze: nessuna
   - Task tecnici:
     - rimuovere fallback debole (`dev-secret`) in produzione;
     - validazione config all'avvio con errore bloccante se mancante;
     - aggiornare `.env.example` + README.
   - Acceptance criteria:
     - API non parte senza secret in env non-dev;
     - documentazione env aggiornata.

3. **Verifica sessione attiva in guard JWT e handshake socket**
   - Tipo: Backend
   - Stima: 5 pt
   - Dipendenze: task 2
   - Task tecnici:
     - controllare sessione non revocata/aduta ad ogni request autenticata;
     - applicare stesso controllo su Socket.IO handshake;
     - invalidare token associati a sessioni revocate.
   - Acceptance criteria:
     - token con sessione revocata riceve 401 sia REST sia socket;
     - test integrazione revoca pass.

### Epic 2: Quality gate minimo (test automatici)

4. **Test integration critici API (happy + failure path)**
   - Tipo: Backend/QA
   - Stima: 8 pt
   - Dipendenze: nessuna
   - Task tecnici:
     - coprire: login/refresh/logout, create order, close table, stock shortage;
     - fixture DB deterministiche;
     - comando CI per esecuzione test.
   - Acceptance criteria:
     - suite test eseguita in CI;
     - almeno i 6 flussi P0 coperti.

5. **Smoke test frontend su flussi core**
   - Tipo: Frontend/QA
   - Stima: 5 pt
   - Dipendenze: task 4
   - Task tecnici:
     - script smoke per login, apertura POS tavolo, invio ordine, chiusura conto;
     - baseline di regressione visual minima.
   - Acceptance criteria:
     - smoke eseguito su build preview;
     - report pass/fail visibile in pipeline.

## Sprint 2 - Cassa Reale (P0)

### Epic 3: Split bill persistente e pagamenti multipli

6. **Modello dati pagamenti multipli per tavolo/ordine**
   - Tipo: Backend/DB
   - Stima: 8 pt
   - Dipendenze: Sprint 1 completato
   - Task tecnici:
     - introdurre entità linee pagamento o payment allocations;
     - mantenere compatibilità API attuale dove possibile;
     - migrazione e strategia dati storici.
   - Acceptance criteria:
     - tavolo può avere N pagamenti parziali fino a saldo;
     - totale residuo calcolato server-side correttamente.

7. **API split-bill transazionale (non simulata)**
   - Tipo: Backend
   - Stima: 5 pt
   - Dipendenze: task 6
   - Task tecnici:
     - convertire split in operazione persistita;
     - gestire rounding e residui;
     - audit eventi split.
   - Acceptance criteria:
     - split produce record pagamenti reali;
     - non possibile over/under-payment senza errore esplicito.

8. **UI tavoli/cassa per pagamenti parziali**
   - Tipo: Frontend
   - Stima: 8 pt
   - Dipendenze: task 7
   - Task tecnici:
     - mostrare saldo residuo in tempo reale;
     - consentire multipli metodi e importi;
     - correggere ambiguità pulsanti metodo pagamento.
   - Acceptance criteria:
     - operatore può chiudere tavolo con più pagamenti consecutivi;
     - UX coerente metodo selezionato/metodo inviato.

### Epic 4: Refund/storno tracciato

9. **API refund/storno con causale e permessi**
   - Tipo: Backend
   - Stima: 5 pt
   - Dipendenze: task 6
   - Task tecnici:
     - endpoint dedicato per refund totale/parziale;
     - causale obbligatoria e staff actor;
     - regole RBAC (admin/manager policy).
   - Acceptance criteria:
     - ogni refund genera traccia audit;
     - saldo cassa aggiornato coerentemente.

10. **Vista storico movimenti cassa (incl. refund)**
    - Tipo: Frontend
    - Stima: 3 pt
    - Dipendenze: task 9
    - Task tecnici:
      - estendere `PaymentsView` con tipo movimento e stato;
      - filtri per refund/operator/date.
    - Acceptance criteria:
      - admin visualizza refund con causale e operatore;
      - export/print base (opzionale se in sprint capacity).

## Sprint 3 - Order UX avanzato + Turni Cassa (P1)

### Epic 5: Modificatori e note cucina

11. **Contratti shared per line item modifiers/note**
    - Tipo: Shared/Backend/Frontend
    - Stima: 5 pt
    - Dipendenze: Sprint 2
    - Task tecnici:
      - estendere schema `orderItem` e `createOrderRequest`;
      - versionare evento ordine aggiornato.
    - Acceptance criteria:
      - API valida modifiers e note;
      - payload compatibile con KDS.

12. **Persistenza backend + rendering KDS/POS note/modifier**
    - Tipo: Backend/Frontend
    - Stima: 8 pt
    - Dipendenze: task 11
    - Task tecnici:
      - migrazione DB per dettagli riga;
      - mostrare note/modifier in Kitchen e stampa job.
    - Acceptance criteria:
      - cuoco vede note complete su ordine;
      - stampa include personalizzazioni rilevanti.

### Epic 6: Gestione turni cassa

13. **Modello shift (open/close) + endpoint operativi**
    - Tipo: Backend/DB
    - Stima: 8 pt
    - Dipendenze: Sprint 2
    - Task tecnici:
      - tabella shift con opening float, closing count, variance;
      - endpoint open/close shift + lock se shift già aperto;
      - report turno.
    - Acceptance criteria:
      - un solo turno aperto per postazione/utente policy;
      - chiusura turno richiede riconciliazione importi.

14. **UI apertura/chiusura turno e report X/Z base**
    - Tipo: Frontend
    - Stima: 5 pt
    - Dipendenze: task 13
    - Task tecnici:
      - wizard open shift;
      - close shift con differenze e note;
      - pannello report sintetico.
    - Acceptance criteria:
      - flusso completo eseguibile da operatore autorizzato;
      - warning chiari su differenze cassa.

## Sprint 4 - Hardening realtime/stampa + piattaforma (P1/P2)

### Epic 7: Event contracts robusti

15. **Tipizzare payload eventi socket in shared**
    - Tipo: Shared/Backend/Frontend
    - Stima: 5 pt
    - Dipendenze: Sprint 3
    - Task tecnici:
      - schema Zod payload per ciascun evento;
      - helper publish/subscribe typed;
      - fallback compatibilità old payload se necessario.
    - Acceptance criteria:
      - nessun evento emesso senza validazione payload;
      - client consume type-safe.

### Epic 8: Print pipeline resiliente

16. **Retry + idempotenza + DLQ print jobs**
    - Tipo: Backend/Print-bridge
    - Stima: 8 pt
    - Dipendenze: Sprint 2
    - Task tecnici:
      - tentativi automatici con backoff;
      - chiave idempotenza dispatch;
      - stato `dead_letter` e tooling retry manuale.
    - Acceptance criteria:
      - failure transitori non perdono job;
      - osservabilità su tasso errore stampa.

17. **Monitoring operativo print-bridge**
    - Tipo: DevOps/Backend
    - Stima: 3 pt
    - Dipendenze: task 16
    - Task tecnici:
      - metriche health, queue depth, failure rate;
      - alerting base.
    - Acceptance criteria:
      - alert su failure rate sopra soglia;
      - dashboard minima disponibile.

### Epic 9: Routing e pulizia UX

18. **Refactor routing web con deep-link tab/page**
    - Tipo: Frontend
    - Stima: 5 pt
    - Dipendenze: nessuna critica
    - Task tecnici:
      - route dedicate per moduli principali;
      - preservare guard per ruolo;
      - fallback route legacy.
    - Acceptance criteria:
      - URL condivisibili per schermate principali;
      - nessuna regressione sui permessi visibilità tab.

19. **Rimozione valori hardcoded in UI dashboard/POS/inventory**
    - Tipo: Frontend
    - Stima: 3 pt
    - Dipendenze: task 18
    - Task tecnici:
      - sostituire placeholder statici con dati reali o hide fallback;
      - test snapshot visuale.
    - Acceptance criteria:
      - nessuna metrica fake visibile in produzione.

## Backlog trasversale (in parallelo)

20. **Migliorare vincoli DB (enum/foreign key mancanti)**
   - Tipo: Backend/DB
   - Stima: 8 pt
   - Priorità: P1
   - Note: eseguire per blocchi con migrazioni sicure e data cleanup.

21. **Sostituire ID `Date.now()` con UUID/ULID**
   - Tipo: Backend
   - Stima: 5 pt
   - Priorità: P1
   - Note: riduce collisioni in multi-nodo.

22. **Search clienti server-side completa (no post-filter limitato)**
   - Tipo: Backend
   - Stima: 3 pt
   - Priorità: P2

## KPI di successo programma (4 sprint)

- Zero credenziali staff in chiaro a riposo.
- Copertura test automatica su flussi P0 >= 70% (componenti critici).
- Errore stampa recuperabile automaticamente >= 90% casi transitori.
- Riduzione incidenti cassa legati split/refund > 80%.
- Tempo medio chiusura tavolo ridotto o invariato dopo nuove feature.

## Risk register sintetico

- **Rischio migrazione PIN**: lockout utenti -> mitigazione con rollout graduale e fallback temporaneo controllato.
- **Rischio regressione cassa**: introdurre feature flag per split persistente/refund.
- **Rischio complessità UI**: prototipazione rapida + test usabilità con 2-3 operatori reali.
- **Rischio printing**: staging con stampanti reali prima di go-live.
