import { useEffect, useMemo, useState } from 'react';
import type { Reservation, ReservationCreateRequest, ReservationStatus } from '@gustopos/shared';
import { useAppStore } from '../store/app-store';
import { trackUxMetric } from '../shared/ux/metrics';

const statusOptions: ReservationStatus[] = ['pending', 'confirmed', 'seated', 'cancelled', 'no_show'];

export default function ReservationsView() {
  const items = useAppStore((state) => state.reservations);
  const refreshReservations = useAppStore((state) => state.refreshReservations);
  const createReservation = useAppStore((state) => state.createReservation);
  const updateReservation = useAppStore((state) => state.updateReservation);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState<'' | ReservationStatus>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [reservedFor, setReservedFor] = useState('');
  const [noShowReasonById, setNoShowReasonById] = useState<Record<string, string>>({});
  const [statusDraftById, setStatusDraftById] = useState<Record<string, ReservationStatus>>({});
  const [rowBusyById, setRowBusyById] = useState<Record<string, boolean>>({});
  const [rowErrorById, setRowErrorById] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const fromDate = new Date(`${selectedDate}T00:00:00`);
      const toDate = new Date(`${selectedDate}T23:59:59`);
      await refreshReservations({
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        status: statusFilter || undefined,
        limit: 300,
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Errore caricamento prenotazioni');
    } finally {
      setLoading(false);
    }
  };

  /* eslint-disable react-hooks/exhaustive-deps -- [load-recursion] load is recreated each render; effect only refreshes on selectedDate / statusFilter changes */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- [indirect-setstate] load() calls store set() asynchronously
    void load();
  }, [selectedDate, statusFilter]);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    setStatusDraftById((prev) => { // eslint-disable-line react-hooks/set-state-in-effect -- [form-sync] sync draft status map to items; uses prev => callback form which is safe
      const next = { ...prev };
      for (const item of items) {
        next[item.id] = next[item.id] ?? item.status;
      }
      return next;
    });
  }, [items]);

  const groupedByHour = useMemo(() => {
    const slots = new Map<string, Reservation[]>();
    for (const item of items) {
      const date = new Date(item.reservedFor);
      const key = `${String(date.getHours()).padStart(2, '0')}:00`;
      const existing = slots.get(key) ?? [];
      existing.push(item);
      slots.set(key, existing);
    }

    return Array.from(slots.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([slot, reservations]) => ({
        slot,
        reservations: reservations.sort((a, b) => new Date(a.reservedFor).getTime() - new Date(b.reservedFor).getTime()),
      }));
  }, [items]);

  const submit = async () => {
    setError('');
    if (customerName.trim().length < 2) {
      setError('Inserisci un nome cliente valido (min 2 caratteri)');
      return;
    }
    const partySizeValue = Number(partySize);
    if (!Number.isFinite(partySizeValue) || partySizeValue < 1 || partySizeValue > 20) {
      setError('Numero persone non valido (1-20)');
      return;
    }
    if (!reservedFor) {
      setError('Seleziona data e ora della prenotazione');
      return;
    }
    try {
      const payload: ReservationCreateRequest = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        partySize: partySizeValue,
        reservedFor: new Date(reservedFor).toISOString(),
        source: 'manual',
      };
      await createReservation(payload);
      setCustomerName('');
      setCustomerPhone('');
      setPartySize('2');
      setReservedFor('');
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Errore creazione prenotazione');
    }
  };

  const updateStatus = async (id: string) => {
    const status = statusDraftById[id] ?? items.find((item) => item.id === id)?.status;
    if (!status) {
      return;
    }
    setError('');
    setRowErrorById((prev) => ({ ...prev, [id]: '' }));
    if (status === 'no_show') {
      const reason = (noShowReasonById[id] ?? '').trim();
      if (reason.length < 3) {
        const message = 'Motivazione no-show obbligatoria (min 3 caratteri)';
        setError(message);
        setRowErrorById((prev) => ({ ...prev, [id]: message }));
        return;
      }
    }
    try {
      setRowBusyById((prev) => ({ ...prev, [id]: true }));
      const noShowReason = noShowReasonById[id]?.trim();
      await updateReservation(id, {
        status,
        ...(status === 'no_show' && noShowReason ? { noShowReason } : {}),
      });
      if (status === 'no_show') {
        setNoShowReasonById((prev) => ({ ...prev, [id]: '' }));
      }
      setStatusDraftById((prev) => {
        const current = items.find((entry) => entry.id === id)?.status ?? status;
        return { ...prev, [id]: current };
      });
      await load();
      trackUxMetric('reservations.status.update.success');
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : 'Errore aggiornamento stato prenotazione';
      setError(message);
      setRowErrorById((prev) => ({ ...prev, [id]: message }));
      trackUxMetric('reservations.status.update.error');
    } finally {
      setRowBusyById((prev) => ({ ...prev, [id]: false }));
    }
  };

  const renderReservationRow = (item: Reservation, compact = false) => (
    <div key={compact ? item.id : `list-${item.id}`} className="border border-border rounded p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-bg/20">
      <div className="min-w-0">
        <p className="text-sm font-bold text-secondary">{item.customerName} ({item.partySize})</p>
        <p className="text-xs text-text-muted">
          {compact
            ? `${new Date(item.reservedFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • ${item.customerPhone ?? 'n.d.'}`
            : `${new Date(item.reservedFor).toLocaleString()} • ${item.customerPhone ?? 'n.d.'}`}
        </p>
        {item.status === 'no_show' && item.noShowReason && (
          <p className="text-[11px] text-danger mt-1">No-show: {item.noShowReason}</p>
        )}
      </div>
      <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto sm:min-w-[200px]">
        <select
          value={statusDraftById[item.id] ?? item.status}
          onChange={(event) =>
            setStatusDraftById((prev) => ({
              ...prev,
              [item.id]: event.target.value as ReservationStatus,
            }))
          }
          className="px-3 py-2 rounded border border-border text-xs min-h-10 w-full sm:w-auto"
          aria-label={`Stato prenotazione ${item.customerName}`}
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
        {(statusDraftById[item.id] ?? item.status) === 'no_show' && (
          <input
            value={noShowReasonById[item.id] ?? ''}
            onChange={(event) =>
              setNoShowReasonById((prev) => ({
                ...prev,
                [item.id]: event.target.value,
              }))
            }
            placeholder="Motivo no-show"
            className="px-3 py-2 rounded border border-border text-xs w-full"
            aria-label={`Motivazione no-show per ${item.customerName}`}
          />
        )}
        <button
          onClick={() => void updateStatus(item.id)}
          disabled={rowBusyById[item.id]}
          className="px-3 py-2 rounded border border-border text-xs font-bold w-full min-h-10 disabled:opacity-50"
        >
          {rowBusyById[item.id] ? 'Salvataggio...' : 'Applica'}
        </button>
        {rowErrorById[item.id] ? <p className="text-[11px] text-danger w-full text-right">{rowErrorById[item.id]}</p> : null}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-white border border-border rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-bold text-primary uppercase tracking-wide">Reservations</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="px-3 py-2 rounded border border-border text-sm min-h-10"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as '' | ReservationStatus)}
            className="px-3 py-2 rounded border border-border text-sm min-h-10"
          >
            <option value="">Tutti gli stati</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <button
            onClick={() => void load()}
            className="px-4 py-2 rounded border border-border text-xs font-bold uppercase tracking-wider min-h-10"
          >
            Ricarica Agenda
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          <input
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="Nome cliente"
            className="px-3 py-2 rounded border border-border text-sm min-h-10"
          />
          <input
            value={customerPhone}
            onChange={(event) => setCustomerPhone(event.target.value)}
            placeholder="Telefono"
            className="px-3 py-2 rounded border border-border text-sm min-h-10"
          />
          <input
            value={partySize}
            onChange={(event) => setPartySize(event.target.value.replace(/[^0-9]/g, ''))}
            placeholder="Persone"
            className="px-3 py-2 rounded border border-border text-sm min-h-10"
          />
          <input
            type="datetime-local"
            value={reservedFor}
            onChange={(event) => setReservedFor(event.target.value)}
            className="px-3 py-2 rounded border border-border text-sm min-h-10"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void submit()}
            className="px-4 py-2 rounded bg-primary text-white text-xs font-bold uppercase tracking-wider min-h-10"
          >
            Crea Prenotazione
          </button>
          <button
            onClick={() => void load()}
            className="px-4 py-2 rounded border border-border text-xs font-bold uppercase tracking-wider min-h-10"
          >
            Aggiorna
          </button>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>

      <div className="bg-white border border-border rounded-xl p-4">
        {loading ? (
          <p className="text-sm text-text-muted">Caricamento...</p>
        ) : (
          <div className="space-y-3">
            {groupedByHour.map((group) => (
              <div key={group.slot} className="border border-border rounded-lg p-3 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Slot {group.slot}</p>
                {group.reservations.map((item) => renderReservationRow(item, true))}
              </div>
            ))}
            {items.length === 0 && <p className="text-xs text-text-muted">Nessuna prenotazione.</p>}
          </div>
        )}
      </div>

      <div className="hidden md:block bg-white border border-border rounded-xl p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">Elenco Completo Giorno</p>
        <div className="space-y-2">
          {items.map((item) => renderReservationRow(item))}
          {items.length === 0 && <p className="text-xs text-text-muted">Nessuna prenotazione.</p>}
        </div>
      </div>
    </div>
  );
}
