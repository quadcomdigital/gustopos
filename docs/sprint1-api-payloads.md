# Sprint 1 - API Payloads (MVP)

Questo documento definisce i payload JSON per i moduli:

- `purchasing_suppliers`
- `staff_shifts_timeclock`
- `fiscal_exports`

Tutte le route sono tenant-aware e protette da feature flag modulo.

## Purchasing

### `GET /api/purchasing/suppliers`

Query params opzionali:

```json
{
  "active": true,
  "query": "fornitore",
  "limit": 100
}
```

Response 200:

```json
[
  {
    "id": "sup_01",
    "name": "Forniture Rossi",
    "vatNumber": "IT01234567890",
    "phone": "+3902123456",
    "email": "ordini@rossi.it",
    "isActive": true,
    "createdAt": "2026-04-19T10:00:00.000Z",
    "updatedAt": "2026-04-19T10:00:00.000Z"
  }
]
```

### `POST /api/purchasing/suppliers`

Request:

```json
{
  "name": "Forniture Rossi",
  "vatNumber": "IT01234567890",
  "phone": "+3902123456",
  "email": "ordini@rossi.it"
}
```

Response 201:

```json
{
  "id": "sup_01",
  "name": "Forniture Rossi",
  "vatNumber": "IT01234567890",
  "phone": "+3902123456",
  "email": "ordini@rossi.it",
  "isActive": true,
  "createdAt": "2026-04-19T10:00:00.000Z",
  "updatedAt": "2026-04-19T10:00:00.000Z"
}
```

### `PATCH /api/purchasing/suppliers/:id`

Request:

```json
{
  "name": "Forniture Rossi Srl",
  "phone": "+3902765432",
  "isActive": true
}
```

Response 200: stesso schema supplier.

### `GET /api/purchasing/orders`

Query params opzionali:

```json
{
  "supplierId": "sup_01",
  "status": "partial_received",
  "from": "2026-04-01T00:00:00.000Z",
  "to": "2026-04-30T23:59:59.000Z",
  "limit": 100
}
```

Response 200:

```json
[
  {
    "id": "po_01",
    "supplierId": "sup_01",
    "status": "partial_received",
    "expectedAt": "2026-04-20T08:00:00.000Z",
    "notes": "Consegna mattina",
    "items": [
      {
        "id": "poi_01",
        "inventoryId": "ing_01",
        "itemName": "Pomodoro",
        "unit": "kg",
        "orderedQty": 30,
        "unitCost": 2.4,
        "receivedQty": 12
      }
    ],
    "createdAt": "2026-04-19T10:00:00.000Z",
    "updatedAt": "2026-04-19T12:00:00.000Z"
  }
]
```

### `POST /api/purchasing/orders`

Request:

```json
{
  "supplierId": "sup_01",
  "expectedAt": "2026-04-20T08:00:00.000Z",
  "notes": "Consegna mattina",
  "items": [
    {
      "inventoryId": "ing_01",
      "itemName": "Pomodoro",
      "unit": "kg",
      "orderedQty": 30,
      "unitCost": 2.4
    }
  ]
}
```

Response 201: stesso schema purchase order.

### `PATCH /api/purchasing/orders/:id/status`

Request:

```json
{
  "status": "sent"
}
```

Response 200: stesso schema purchase order.

### `POST /api/purchasing/orders/:id/receipts` (ricezione parziale)

Request:

```json
{
  "receivedAt": "2026-04-20T08:30:00.000Z",
  "notes": "Prima parte ordine",
  "items": [
    {
      "purchaseOrderItemId": "poi_01",
      "receivedQty": 12,
      "unitCost": 2.5
    }
  ]
}
```

Response 201:

```json
{
  "id": "gr_01",
  "purchaseOrderId": "po_01",
  "receivedAt": "2026-04-20T08:30:00.000Z",
  "notes": "Prima parte ordine",
  "items": [
    {
      "purchaseOrderItemId": "poi_01",
      "receivedQty": 12,
      "unitCost": 2.5
    }
  ],
  "createdAt": "2026-04-20T08:31:00.000Z"
}
```

## Staff Shifts + Timeclock

### `GET /api/shifts`

Query params opzionali:

```json
{
  "staffId": "st_01",
  "from": "2026-04-19T00:00:00.000Z",
  "to": "2026-04-25T23:59:59.000Z",
  "status": "scheduled",
  "limit": 200
}
```

Response 200:

```json
[
  {
    "id": "sh_01",
    "staffId": "st_01",
    "shiftDate": "2026-04-19",
    "startAt": "2026-04-19T09:00:00.000Z",
    "endAt": "2026-04-19T17:00:00.000Z",
    "toleranceEarlyMin": 15,
    "toleranceLateMin": 15,
    "status": "scheduled",
    "notes": "Turno pranzo",
    "createdAt": "2026-04-18T10:00:00.000Z",
    "updatedAt": "2026-04-18T10:00:00.000Z"
  }
]
```

### `POST /api/shifts`

Request:

```json
{
  "staffId": "st_01",
  "shiftDate": "2026-04-19",
  "startAt": "2026-04-19T09:00:00.000Z",
  "endAt": "2026-04-19T17:00:00.000Z",
  "toleranceEarlyMin": 15,
  "toleranceLateMin": 15,
  "notes": "Turno pranzo"
}
```

Response 201: stesso schema shift.

### `PATCH /api/shifts/:id`

Request:

```json
{
  "startAt": "2026-04-19T09:30:00.000Z",
  "endAt": "2026-04-19T17:30:00.000Z",
  "status": "scheduled"
}
```

Response 200: stesso schema shift.

### `POST /api/timeclock/in`

Request:

```json
{
  "staffId": "st_01",
  "shiftId": "sh_01",
  "source": "web",
  "at": "2026-04-19T08:55:00.000Z"
}
```

Response 201:

```json
{
  "id": "te_01",
  "staffId": "st_01",
  "shiftId": "sh_01",
  "clockInAt": "2026-04-19T08:55:00.000Z",
  "clockOutAt": null,
  "status": "open",
  "source": "web",
  "notes": null,
  "createdAt": "2026-04-19T08:55:00.000Z",
  "updatedAt": "2026-04-19T08:55:00.000Z"
}
```

### `POST /api/timeclock/out`

Request:

```json
{
  "staffId": "st_01",
  "at": "2026-04-19T17:05:00.000Z"
}
```

Response 200:

```json
{
  "id": "te_01",
  "staffId": "st_01",
  "shiftId": "sh_01",
  "clockInAt": "2026-04-19T08:55:00.000Z",
  "clockOutAt": "2026-04-19T17:05:00.000Z",
  "status": "closed",
  "source": "web",
  "notes": null,
  "createdAt": "2026-04-19T08:55:00.000Z",
  "updatedAt": "2026-04-19T17:05:00.000Z"
}
```

### `GET /api/timeclock/report`

Query params:

```json
{
  "from": "2026-04-01T00:00:00.000Z",
  "to": "2026-04-30T23:59:59.000Z",
  "staffId": "st_01"
}
```

Response 200:

```json
{
  "totalMinutes": 9600,
  "totalHours": 160,
  "entries": [
    {
      "staffId": "st_01",
      "minutes": 480,
      "date": "2026-04-19",
      "anomaly": false
    }
  ]
}
```

## Fiscal Exports (CSV only)

### `POST /api/fiscal/close-day`

Request:

```json
{
  "businessDate": "2026-04-19",
  "notes": "Chiusura fine giornata"
}
```

Response 201:

```json
{
  "id": "fc_01",
  "businessDate": "2026-04-19",
  "closedByStaffId": "st_admin_01",
  "totals": {
    "gross": 1320.4,
    "refunds": 45,
    "net": 1275.4,
    "cash": 640.2,
    "card": 635.2
  },
  "closedAt": "2026-04-19T23:05:00.000Z",
  "notes": "Chiusura fine giornata"
}
```

### `POST /api/fiscal/exports`

Request:

```json
{
  "businessDate": "2026-04-19",
  "format": "csv"
}
```

Response 201:

```json
{
  "id": "fx_01",
  "businessDate": "2026-04-19",
  "format": "csv",
  "status": "ready",
  "path": "/exports/tenant_x/fiscal_2026-04-19.csv",
  "generatedByStaffId": "st_admin_01",
  "generatedAt": "2026-04-19T23:06:00.000Z",
  "checksum": "sha256:abcd1234"
}
```

### `GET /api/fiscal/exports`

Query params opzionali:

```json
{
  "from": "2026-04-01T00:00:00.000Z",
  "to": "2026-04-30T23:59:59.000Z",
  "status": "ready",
  "limit": 100
}
```

Response 200: array `fiscalExportSchema`.

### `GET /api/fiscal/exports/:id/download`

Response 200:

- Content-Type: `text/csv; charset=utf-8`
- Content-Disposition: `attachment; filename="fiscal_YYYY-MM-DD.csv"`

Esempio righe CSV:

```csv
date;tenant_id;orders_count;gross;refunds;net;cash;card
2026-04-19;tenant_legacy;142;1320.40;45.00;1275.40;640.20;635.20
```

## Errori standard

- `403` modulo disabilitato (`@RequiresModule`)
- `400` payload invalido / transizione non valida
- `404` risorsa non trovata
- `409` conflitto stato (es: clock-out senza clock-in aperto)
