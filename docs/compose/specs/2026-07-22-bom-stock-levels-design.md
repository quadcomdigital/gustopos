# BOM Stock Levels Design

## [S1] Problem

Le BOM "lavorate" (Cartoccio, Carbocrema) non hanno stock proprio. Quando un piatto usa una BOM preparata, il sistema esplode gli ingredienti direttamente — ma in cucina la preparazione potrebbe non essere disponibile, anche se gli ingredienti ci sono.

**Esempio:** Carbo Burger usa Carbocrema (sub-BOM). Se la Carbocrema è finita ma c'è ancora l'Albume, l'ordine va avanti e fallisce in cucina.

## [S2] Solution Overview

Aggiungere un **livello di stock sulle BOM** per le preparazioni pre-fatte:

1. **Nuovi campi** su `bom_items`: `stock_quantity` (numeric) e `is_pre_batched` (integer 0/1)
2. **Endpoint `POST /api/bom/:id/prepare`**: incrementa stock BOM e detratti ingredienti
3. **Logica ordine modificata**: per BOM pre-batched, controlla stock prima di servire
4. **Dashboard**: visualizza stock preparazioni e consenti preparazione rapida

## [S3] Data Model Changes

### `bom_items` — nuovi campi

```sql
ALTER TABLE bom_items ADD COLUMN stock_quantity numeric(12,3) NOT NULL DEFAULT 0;
ALTER TABLE bom_items ADD COLUMN is_pre_batched integer NOT NULL DEFAULT 0;
```

- `stock_quantity`: unità disponibili di questa BOM preparata
- `is_pre_batched`: 1 = ha stock proprio (Cartoccio, Carbocrema), 0 = comportamento attuale

### Nessun cambiamento alle tabelle esistenti

- `bom_components`: invariato
- `menu_item_bom_requirements`: invariato
- `inventory`: invariato

## [S4] API Endpoints

### `POST /api/bom/:id/prepare`

Prepara una BOM e detratti gli ingredienti.

**Request:**
```json
{ "quantity": 10 }
```

**Response:**
```json
{
  "bomId": "bom_mrnkkugn",
  "name": "Cartoccio",
  "previousStock": 0,
  "newStock": 10,
  "ingredientsDeducted": [
    { "id": "i_mrnh5e8r", "name": "Mozzarella", "quantity": 10, "unit": "pz" },
    { "id": "i_mrnh4mu7", "name": "Prosciutto", "quantity": 10, "unit": "pz" }
  ]
}
```

**Errori:**
- 400: BOM non trovata o non attiva
- 400: Ingredienti insufficienti
- 400: `is_pre_batched = 0` (non si può preparare una BOM normale)

### `GET /api/bom/stock`

Restituisce lo stock di tutte le BOM pre-batched.

**Response:**
```json
[
  { "id": "bom_mrnkkugn", "name": "Cartoccio", "stockQuantity": 15, "unit": "g" },
  { "id": "bom_mrnhssj1", "name": "Carbocrema", "stockQuantity": 8, "unit": "g" }
]
```

## [S5] Order Flow Changes

### Per BOM con `is_pre_batched = 0` (default)

Nessun cambiamento. Il sistema esplode la BOM e detratti gli ingredienti come prima.

### Per BOM con `is_pre_batched = 1`

1. **Check stock**: `stock_quantity >= required`
2. **Se OK**: detratti `stock_quantity` della BOM, servi l'ordine
3. **Se KO**: errore "Cartoccio non disponibile" — NON tenta di detrarre ingredienti

### Esempio flusso

```
Ordine: 1x Cartoccio
→ BOM: bom_mrnkkugn (is_pre_batched=1)
→ Check: stock=15 ≥ 1 ✅
→ Detrai: stock 15 → 14
→ Servito
```

```
Ordine: 1x Cartoccio
→ BOM: bom_mrnkkugn (is_pre_batched=1)
→ Check: stock=0 ≥ 1 ❌
→ Errore: "Cartoccio non disponibile"
```

## [S6] Repository Changes

### `explodeBomRequirements` — modifica

Il metodo attuale esplode sempre gli ingredienti. Modificare per:

1. Se `is_pre_batched = 1`: restituire la BOM stessa come "ingrediente" con quantità richiesta
2. Se `is_pre_batched = 0`: comportamento attuale (esplode ingredienti)

### `createOrder` — modifica

Prima di esplodere le BOM:
1. Raggruppa i requirements per BOM
2. Per ogni BOM `is_pre_batched = 1`: check stock
3. Se stock insufficiente: errore con nome BOM
4. Se stock OK: detratti stock BOM
5. Per BOM `is_pre_batched = 0`: esplode e detratti ingredienti (come prima)

### `prepareBom` — nuovo metodo

1. Valida BOM (esiste, attiva, `is_pre_batched = 1`)
2. Calcola ingredienti necessari da `bom_components`
3. Verifica stock ingredienti disponibili
4. In transazione:
   - Incrementa `stock_quantity` della BOM
   - Detrae ingredienti da `inventory`
   - Registra movimenti stock

## [S7] UI Changes

### Inventory Dashboard

Nuova sezione "Preparazioni" con:
- Lista BOM `is_pre_batched = 1` con stock attuale
- Bottoni "Prepara +1", "Prepara +5", "Prepara +10"
- Indicatore rosso quando stock = 0

### BomTab

Aggiungere alla griglia BOM:
- Badge "Stock: 15" per BOM pre-batched
- Toggle "Pre-preparata" nel modal di modifica BOM

### Order Error Messages

Quando una BOM pre-batched non è disponibile:
```
"Cartoccio non disponibile (stock: 0)"
```

## [S8] Migration Strategy

1. Aggiungere colonne `stock_quantity` e `is_pre_batched` a `bom_items`
2. Default: `stock_quantity = 0`, `is_pre_batched = 0` (nessun cambiamento)
3. Utente marca manualmente quali BOM sono "pre-preparate"
4. Nessun dato esistente viene modificato

## [S9] Scope

### In scope
- Schema DB (2 nuove colonne)
- API prepare/stock
- Logica ordine modificata
- Dashboard preparazioni
- BomTab: toggle + badge stock

### Out of scope
- Auto-produzione (produzione automatica quando stock basso)
- Ricette di produzione (multi-step preparation)
- Costo di produzione tracking
- Scadenza stock BOM
