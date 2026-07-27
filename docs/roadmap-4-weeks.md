# GustoPOS - Roadmap Operativa 4 Settimane

## Obiettivo

Consolidare i moduli live (`reservations`, `delivery`, `purchasing_suppliers`, `staff_shifts_timeclock`, `fiscal_exports`) e preparare il prossimo step ad alto ROI (`promotions_loyalty` foundation), con focus su:

- mobile UX reale in produzione
- affidabilita operativa e audit
- riduzione regressioni con smoke test E2E

## Priorita e criteri

- **P0**: bug/sicurezza/compliance, blocchi operativi
- **P1**: UX task-critical e performance
- **P2**: estensioni funzionali non bloccanti

Done definition comune:

- feature-gating modulo ON/OFF (UI + API 403)
- isolamento tenant verificato
- audit eventi chiave
- build web/api verde
- smoke test passato

---

## Settimana 1 - Stabilizzazione P0 (backend + wiring)

### Focus

- centralizzare wiring dei nuovi moduli nello store
- chiudere edge cases operativi su delivery/reservations/timeclock/fiscal

### Ticket

1. `OPS-001` (P0) - Store slice centralizzato per moduli ops
   - Spostare chiamate dirette da componenti a `app-store` per: purchasing, shifts, fiscal, reservations, delivery
   - Uniformare error mapping, offline queue, e blocco moduli
   - **Effort**: M

2. `OPS-002` (P0) - Delivery: transizioni e SLA guard
   - Validare transizioni stato lato API con codici 4xx coerenti
   - Aggiungere campi `statusChangedAt` / `assignedAt` (se non presenti)
   - **Effort**: M

3. `OPS-003` (P0) - Reservations: workflow no-show hardening
   - Endpoint reason codes (`no_show_reason`) e conferma pre-servizio
   - KPI base conversion funnel
   - **Effort**: M

4. `OPS-004` (P0) - Fiscal: export robustness
   - Uniformare preview/download API contract
   - Retry/error status persistito per export fallito
   - **Effort**: S

5. `OPS-005` (P0) - Timeclock anomaly policy
   - Garantire chiusura sicura entry `anomaly`
   - Verifica ownership tenant staff in ogni path
   - **Effort**: S

### Milestone fine settimana

- Tutti i moduli ops usano store centralizzato
- Nessuna azione critica con chiamata API diretta da component

---

## Settimana 2 - UX mobile task-first (P1)

### Focus

- rendere eseguibili i task principali in <= 3 tap su smartphone

### Ticket

1. `UX-001` (P1) - Mobile IA per moduli secondari
   - Rifinire `More` sheet con grouping per dominio: Operations, Finance, Admin
   - Persistenza ultimo modulo aperto
   - **Effort**: S

2. `UX-002` (P1) - Purchasing mobile flow
   - Stepper: Fornitore -> PO -> Ricezione
   - Quick action sticky bottom su card ordine
   - **Effort**: M

3. `UX-003` (P1) - Shifts mobile flow
   - Split UI “Pianifica” / “Timbra” con CTA full-width e stato corrente
   - **Effort**: M

4. `UX-004` (P1) - Fiscal mobile flow
   - Sezione separata: `Chiudi giornata`, `Genera export`, `Storico`
   - CTA primaria sticky e conferma custom (no browser confirm)
   - **Effort**: S

5. `UX-005` (P1) - Superadmin mobile cards v2
   - Migliorare card tenants con menu azioni contestuale
   - Drawer menu builder con footer sticky "Salva"
   - **Effort**: M

### Milestone fine settimana

- Tutti i moduli ops usabili su viewport 360x800 senza overflow/blocchi

---

## Settimana 3 - KPI, osservabilita, performance (P1/P2)

### Focus

- rendere la gestione quotidiana data-driven

### Ticket

1. `OBS-001` (P1) - Dashboard Ops unificata
   - Widget: PO aperti, delivery attivi, no-show rate reale, timbrature aperte, export pending
   - **Effort**: M

2. `OBS-002` (P1) - Badge tab multi-modulo
   - Estendere badge live anche a purchasing/shifts/fiscal
   - Polling leggero o websocket event mirati
   - **Effort**: S

3. `OBS-003` (P1) - Audit coverage completion
   - Eventi standardizzati e searchable per ogni mutazione critica
   - **Effort**: S

4. `PERF-001` (P2) - Riduzione chunk web
   - Manual chunks + split più aggressivo moduli admin
   - target bundle principale < 500kb minified
   - **Effort**: M

5. `PERF-002` (P2) - Query tuning ops
   - review indici e filtri più usati (status/date/tenant)
   - **Effort**: S

### Milestone fine settimana

- Dashboard ops con KPI reali live per admin tenant

---

## Settimana 4 - Quality gate + foundation nuovo modulo

### Focus

- evitare regressioni e preparare crescita commerciale

### Ticket

1. `QA-001` (P0) - Smoke E2E automatici (critici)
   - Flussi:
     - superadmin login -> menu builder tenant-specific save
     - impersonation enter/exit
     - reservations create/confirm/cancel
     - delivery create/dispatch/delivered
     - timeclock in/out anti-spoof
     - fiscal close/export download
   - **Effort**: M

2. `QA-002` (P1) - Role x Module matrix test
   - Assert UI visibility + API 403 mapping per ruolo
   - **Effort**: S

3. `DOC-001` (P1) - Runbook operativo e troubleshooting
   - error catalog, codici, recovery steps
   - **Effort**: S

4. `NEW-001` (P2) - `promotions_loyalty` foundation
   - contracts + schema base + feature flag + placeholder API
   - senza UI completa in questa wave
   - **Effort**: M

### Milestone fine settimana

- Quality gate ripetibile CI + readiness per modulo successivo

---

## Dipendenze principali

- `OPS-001` prima di `UX-002/003/004`
- `OBS-001` dipende da `OPS-003/004/005`
- `QA-001` dipende da chiusura P0/P1 core
- `NEW-001` parte solo dopo quality gate minimo

## KPI di successo (fine 4 settimane)

- crash-free session mobile > 99.5%
- tempo medio task critico mobile (create delivery / close fiscal / clock-out) < 45s
- regressioni P0 in release = 0
- adozione moduli ops admin tenant > 70% tenant attivi

## Rischi e mitigazioni

- **Rischio**: scope creep UX
  - **Mitigazione**: bloccare backlog settimanale e mantenere no-change window ultimi 2 giorni
- **Rischio**: regressioni wiring store
  - **Mitigazione**: smoke E2E giornaliero + feature flags canary tenant
- **Rischio**: mismatch timezone in fiscal
  - **Mitigazione**: standardizzare timezone tenant e test date boundary

---

## Audit Follow-up Plan (moduli ON/OFF)

### P0 - Hardening blocchi critici

1. `MOD-001` (P0) - Public menu tenant-safe gating
   - allineare risoluzione tenant per `/api/public/menu?slug=` prima del guard modulo;
   - validare `public_menu` sul tenant target anche a livello repository;
   - mappare tenant assente/modulo OFF su risposta neutra (`404`) senza leak.
   - **Effort**: M

2. `MOD-002` (P0) - Sync moduli runtime in sessione attiva
   - refresh periodico moduli sessione (client) + normalizzazione mutual exclusion inventory/simple_catalog;
   - invalidare UI state modulo-disabilitato e forzare fallback tab immediato.
   - **Effort**: M

3. `MOD-003` (P0) - Realtime coherence con stato moduli live
   - socket auth deve usare moduli tenant correnti, non solo claim token;
   - filtrare eventi lato client in base a moduli attivi.
   - **Effort**: M

### P1 - Robustezza e regressioni

4. `MOD-004` (P1) - Matrix test automatica ruoli x moduli
   - aggiungere smoke per combinazioni ON/OFF principali (`inventory/simple_catalog`, `public_menu`, `analytics`, `printing`);
   - includere scenario toggle modulo a sessione attiva.
   - **Effort**: M

5. `MOD-005` (P1) - Cleanup hardcoded UI cross-tenant
   - rimuovere KPI/demo statici e riferimenti operatore hardcoded;
   - mostrare metriche solo se modulo dipendente e dati disponibili.
   - **Effort**: S

### P2 - Ottimizzazione e manutenzione

6. `MOD-006` (P2) - Dedup module guard patterns nel frontend store
   - helper unico per check modulo + enqueue blocked action + error mapping;
   - ridurre drift tra action simili.
   - **Effort**: S
