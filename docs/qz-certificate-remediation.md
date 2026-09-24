# Certificati QZ Tray per tenant — modello, installazione, remediation

Questo documento spiega **come funziona davvero** la fiducia di QZ Tray, perché
a Franks funzionava e a Casale no, e la procedura che adesso va usata.

Riferimenti al sorgente QZ (2.x): `qz/auth/Certificate.java`,
`qz/auth/Request.java`, `qz/ws/PrintSocketClient.java`,
`qz/utils/FileUtilities.java`, `qz/utils/ByteUtilities.java`.

---

## 1. Il meccanismo (quattro pezzi indipendenti)

### a) L'ancora di fiducia — `override.crt`

All'avvio `Certificate.scanAdditionalCAs()` carica **una sola volta**:

1. i path dell'opzione `authcert.override`;
2. `override.crt` nella directory che contiene il JAR di QZ
   (`App.getJarParentPath()` → `C:\Program Files\QZ Tray\override.crt`,
   `/opt/qz-tray/override.crt`, `/Applications/QZ Tray.app/Contents/Resources/override.crt`).

Se il file manca, è di un altro tenant, o QZ non è stato riavviato dopo averlo
scritto, **l'ancora non esiste**.

### b) La catena (è qui che nasce "valido / non valido")

Quando il client manda `{"certificate": "<PEM>"}`, QZ costruisce la catena
leaf → root con un validatore PKIX e la root caricata come trust anchor:

| esito | cosa succede |
|---|---|
| catena valida e root ≠ quella built-in di QZ | `valid = true` **e** QZ scrive da solo il fingerprint in `allowed.dat` → **nessun dialog** |
| catena invalida | `valid = false` → dialog **"Untrusted website"** / `Invalid Certificate` |
| `notBefore > ora` | `Future Certificate` |
| `notAfter < ora` | `Expired Certificate` |
| CN vuoto | la certificate viene rifiutata: *"Common Name cannot be blank."* |

Con la root built-in di QZ (il **demo cert**) l'auto-approvazione è
**esplicitamente esclusa** (`!cert.equals(builtIn)`): il dialog appare sempre.

### c) `allowed.dat` — la memoria delle approvazioni

`Request.hasSavedCert()` = `cert.isTrusted() && cert.isSaved()`. Serve **sia**
la catena **sia** la presenza del fingerprint.

* Formato: `fingerprint\tCN\tO\tvalidFrom\tvalidTo\tTrue`
* Lettura da `%APPDATA%\qz` + `%PROGRAMDATA%\qz` (Windows), `~/.qz` +
  `/srv/qz` (Linux), `~/Library/Application Support/qz` +
  `/Library/Application Support/qz` (macOS)
* **Il confronto è `String.equals` su un SHA-1 in minuscolo**
  (`ByteUtilities.toHexString(digest, upperCase=false)`): una riga scritta in
  MAIUSCOLO (come produce `openssl x509 -fingerprint` e `.Thumbprint` di .NET)
  **è nel file ma invisibile a QZ**.
* Se la directory non è scrivibile, QZ non ricorda la decisione → dialog **ad
  ogni connessione** → l'agente Go scade a 15 s.

### d) La firma dei messaggi

RSA-SHA512 su `sha256Hex(JSON{call,params,timestamp})`, verificata con la
public key del leaf; la finestra è `Constants.VALID_SIGNING_PERIOD` = **15 minuti**.

> **Invariant**: il certificato servito e la chiave che firma devono essere lo
> **stesso paio**. Con un solo punto di risoluzione per entrambi (`resolveSigningMaterial`)
> non possono divergere; se divergono QZ logga `Bad signature on request`.

---

## 2. Perché a Franks funzionava e a Casale no

Causa **unica**, con quattro sintomi:

1. **La catena non validava** su Casale: `override.crt` assente/scritto senza
   amministratore/non ricaricato → dialog *"Untrusted website"*.
2. Gli script di install/diagnostica erano **hardcoded su Franks**: `debug-qz-cert.bat`
   e `.ps1` confrontavano la macchina con `https://test.franksbar.it/api/signing/...`
   → su Casale il confronto era **sempre** mismatch (il "messaggio test.frarksbar.it").
3. I fingerprint erano **hardcoded** nel `.bat`: alla rotazione del leaf
   (oggi `CN=GustoPOS`, SHA1 `4DBC…`) lo script cancellava l'entry vecchia e ne
   scriveva una che sul server non esisteva ancora.
4. I fingerprint venivano scritti in **MAIUSCOLO**, quindi QZ non li leggeva
   comunque: anche una macchina "già installata" riproponeva il dialog.

In più: `apps/web/dist/signing/digital-certificate.txt` (copia del build) poteva
ombreggiare la route esplicita `/signing/*` e servire un certificato **stale**
dopo una rotazione — fix in `fix/api: register QZ signing cert route before
static assets` + test `apps/api/src/security/signing-static-shadow.test.ts`.

---

## 3. Modello per tenant (isolamento pieno)

```
apps/print-bridge/certs/tenants/<slug>/
  ca-key.pem              root privata            (0600, mai in git)
  ca-cert.pem             root = override.crt     (pubblica)
  private-key.pem         leaf privata            (0600, mai in git)
  digital-certificate.pem leaf = digital-certificate.txt (pubblica)
  meta.json               domains + fingerprint + validità ← mappa host → tenant
  leaf.csr, ca-cert.srl   tracciabilità/seriali
```

**Ogni tenant ha la propria root**: il leaf di un tenant non è accettato dal POS
di un altro, perché l'ancora installata è diversa. Il silenzio della stampa non
cambia (catena valida ⇒ QZ si auto-approva).

Generazione:

```bash
cd apps/print-bridge
./scripts/gen-tenant-pki.sh casale \
  --domains test.anticocasalericevimenti.it,anticocasalericevimenti.it \
  --cn "GustoPOS Casale"
```

Rotazione **senza dialogo**:

```bash
./scripts/gen-tenant-pki.sh casale --rotate
```

`--rotate` mantiene root e dominii, emette un nuovo leaf e gli aggiunge nel
subject l'OID `2.5.4.13 = renewal-of-<sha1 del vecchio>`: QZ
(`Certificate.readRenewalInfo`) promuove automaticamente il nuovo cert se il
vecchio era già in `allowed.dat`.

### Risoluzione tenant (stesso algoritmo da entrambe le parti)

`apps/api/src/security/signing-tenants.ts` e
`apps/print-bridge/src/signing-tenants.ts`:

1. `?tenant=<slug>` (script/diagnostica);
2. `Origin`/`Host` della richiesta → `meta.json domains[]`
   (il bridge è su `127.0.0.1`, ma il browser manda l'Origin del dominio tenant);
3. label del dominio = slug (`casale.example.it`);
4. `PRINT_BRIDGE_TENANT` (solo bridge dedicato, come fallback);
5. `null` → **legacy** (certificato condiviso pre-tenant: le macchine già
   installate continuano a funzionare durante la migrazione).

---

## 4. Installazione su una macchina POS

1. Aprire il dominio **del tenant** (il link dal print-station funziona: il
   bridge reindirizza al dominio tenant).
2. Scaricare e lanciare **come amministratore**:
   * Windows: `https://<tenant>/signing/install-qz-cert.bat`
     (scarica ed esegue `install-qz-cert.ps1`)
   * Linux/macOS: `sudo bash install-qz-cert.sh`
3. Lo script:
   * scarica `/signing/override.crt` e `/signing/digital-certificate.txt`
     **dall'origine del tenant** e li confronta con i fingerprint pubblicati dal
     server (niente valori incollati nel file);
   * verifica la catena con `openssl verify` (POSIX) e i `basicConstraints`;
   * scrive `override.crt` nella directory di QZ e **riavvia QZ** (l'ancora si
     carica solo all'avvio);
   * mette il fingerprint **in minuscolo** in `%APPDATA%\qz` + `%PROGRAMDATA%\qz`
     + `%WINDIR%\...\systemprofile\...` (Linux: `~/.qz` + `/srv/qz`);
   * concede `Users:Modify` su `%PROGRAMDATA%\qz`;
   * rieseguibile: la seconda esecuzione non duplica righe.

### Diagnosi

* Windows: `https://<tenant>/signing/debug-qz-cert.ps1` (o `.bat`) → report con
  cert servito vs `override.crt` installato vs `allowed.dat` (3 locazioni +
  scrivibilità) + orologio + ultime righe di `debug.log`, opzione `-Zip`.
* Ovunque: **preflight dell'agente** (`qzpreflight.go`), che esegue gli stessi
  controlli in locale e:
  * blocca la connessione con il motivo **specifico** (invece del timeout a 15 s);
  * cura da solo il caso "catena valida ma fingerprint mancante" invocando
    `qz-tray-console --allow` / `qz-tray --whitelist`;
  * espone `GET/POST http://127.0.0.1:8183/api/qz/preflight` e il pannello
    **"Verifica QZ Tray"** nella dashboard;
  * manda ogni fallimento nei log → Settings → Stampa.

---

## 5. Rollout

1. `gen-tenant-pki.sh` per ogni tenant (le chiavi restano sul server).
2. Deploy API + print-bridge con le route tenant-aware.
3. **Casale**: scaricare l'installer dal dominio di Casale, eseguire da
   amministratore, preflight OK, stampa di prova.
4. Stessa cosa su **Franks** (passa dalla root condivisa alla propria).
5. Rotare le chiavi legacy (`apps/print-bridge/certs/*-key.pem`,
   `public/signing/private-key.pem`): sono in git history da `9d95392`, quindi
   la rimozione dal repo **non** basta — vanno rigenerate.
6. Solo alla fine rimuovere la vecchia `GustoPOS CA` condivisa.

### Rollback

La root condivisa resta valida finché non viene rimossa da `override.crt`:
migrare **un tenant alla volta**, mai tutti insieme.

---

## 6. Test

| cosa | dove |
|---|---|
| risoluzione host → tenant, cert servito = chiave usata | `apps/api/src/security/signing-tenants.test.ts` |
| template senza valori hardcoded, formato `allowed.dat` | `apps/api/src/security/signing-templates.test.ts` |
| nessuna chiave privata in git | `apps/api/src/security/signing-keys-not-tracked.test.ts` |
| route `/signing/*` prima di `useStaticAssets` | `apps/api/src/security/signing-static-shadow.test.ts` |
| cert per tenant servito dal bridge, redirect installer | `apps/print-bridge/src/server.test.ts` |
| preflight (ancora mancante/esterna, scadenze, CN vuoto, entry maiuscola, dir non scrivibile, auto-heal) | `apps/print-agent-go/qzpreflight_test.go` |
