import { useEffect, useMemo, useState } from 'react';
import type { Reservation, ReservationCreateRequest, ReservationStatus } from '@gustopos/shared';
import { CalendarDays, Clock3, Phone, Plus, RefreshCw, Users } from 'lucide-react';
import { useAppStore } from '../store/app-store';
import { trackUxMetric } from '../shared/ux/metrics';
import Button from '../shared/ui/atoms/Button';
import EmptyState from '../shared/ui/atoms/EmptyState';
import Skeleton from '../shared/ui/atoms/Skeleton';
import StatusPill from '../shared/ui/atoms/StatusPill';
import Modal from '../shared/ui/molecules/Modal';
import ConfirmDialog from './ConfirmDialog';

const statusOptions: ReservationStatus[] = ['pending', 'confirmed', 'seated', 'cancelled', 'no_show'];

const statusLabels: Record<ReservationStatus, string> = {
  pending: 'In attesa',
  confirmed: 'Confermata',
  seated: 'Al tavolo',
  cancelled: 'Annullata',
  no_show: 'No-show',
};

const statusTones: Record<ReservationStatus, 'pending' | 'info' | 'success' | 'danger'> = {
  pending: 'pending',
  confirmed: 'info',
  seated: 'success',
  cancelled: 'danger',
  no_show: 'danger',
};

const noShowReasonOptions: Array<{ value: string; label: string }> = [
  { value: 'no_call', label: 'Non ha risposto' },
  { value: 'late_cancel', label: 'Cancellazione tardiva' },
  { value: 'wrong_phone', label: 'Telefono errato' },
  { value: 'double_booking', label: 'Doppia prenotazione' },
  { value: 'other', label: 'Altro' },
];

const NO_SHOW_REASON_CODES = new Set(noShowReasonOptions.map((option) => option.value));

function formatDateHeading(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

export default function ReservationsView() {
  const items = useAppStore((state) => state.reservations);
  const refreshReservations = useAppStore((state) => state.refreshReservations);
  const createReservation = useAppStore((state) => state.createReservation);
  const updateReservation = useAppStore((state) => state.updateReservation);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState<'' | ReservationStatus>('');
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [reservedFor, setReservedFor] = useState('');
  const [noShowReasonById, setNoShowReasonById] = useState<Record<string, string>>({});
  const [statusDraftById, setStatusDraftById] = useState<Record<string, ReservationStatus>>({});
  const [rowBusyById, setRowBusyById] = useState<Record<string, boolean>>({});
  const [rowErrorById, setRowErrorById] = useState<Record<string, string>>({});
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);

  const load = async (force = false) => {
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
      }, force);
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
    setStatusDraftById((prev) => { // eslint-disable-line react-hooks/set-state-in-effect -- [form-sync] sync server status while a row is not being saved
      const next = { ...prev };
      for (const item of items) {
        next[item.id] = rowBusyById[item.id] ? (next[item.id] ?? item.status) : item.status;
      }
      return next;
    });
  }, [items, rowBusyById]);

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
        reservations: [...reservations].sort((a, b) => new Date(a.reservedFor).getTime() - new Date(b.reservedFor).getTime()),
      }));
  }, [items]);

  const resetForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setPartySize('2');
    setReservedFor('');
    setFormError('');
  };

  const closeForm = () => {
    setFormOpen(false);
    resetForm();
  };

  const submit = async () => {
    setFormError('');
    if (customerName.trim().length < 2) {
      setFormError('Inserisci un nome cliente valido (min 2 caratteri).');
      return;
    }
    const partySizeValue = Number(partySize);
    if (!Number.isFinite(partySizeValue) || partySizeValue < 1 || partySizeValue > 20) {
      setFormError('Numero persone non valido (1-20).');
      return;
    }
    if (!reservedFor) {
      setFormError('Seleziona data e ora della prenotazione.');
      return;
    }

    try {
      setCreating(true);
      const payload: ReservationCreateRequest = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        partySize: partySizeValue,
        reservedFor: new Date(reservedFor).toISOString(),
        source: 'manual',
      };
      await createReservation(payload);
      closeForm();
      await load();
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : 'Errore creazione prenotazione.');
    } finally {
      setCreating(false);
    }
  };

  const updateStatus = async (id: string, requestedStatus?: ReservationStatus, skipCancelConfirm = false) => {
    const status = requestedStatus ?? statusDraftById[id] ?? items.find((item) => item.id === id)?.status;
    if (!status) return;

    if (status === 'cancelled' && !skipCancelConfirm) {
      setPendingCancelId(id);
      return;
    }

    setError('');
    setRowErrorById((prev) => ({ ...prev, [id]: '' }));
    if (status === 'no_show') {
      const reason = (noShowReasonById[id] ?? '').trim();
      if (!NO_SHOW_REASON_CODES.has(reason)) {
        const message = 'Seleziona un motivo no-show.';
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

  const pendingCancelItem = pendingCancelId ? items.find((item) => item.id === pendingCancelId) : null;

  const renderReservationRow = (item: Reservation) => {
    const draftStatus = statusDraftById[item.id] ?? item.status;
    const busy = rowBusyById[item.id] ?? false;

    return (
      <article key={item.id} className="rounded-xl border border-border bg-white p-3 sm:p-4 shadow-sm transition-shadow hover:shadow-md">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-primary truncate">{item.customerName}</h3>
              <StatusPill label={statusLabels[item.status]} tone={statusTones[item.status]} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
              <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-secondary">
                <Clock3 size={13} aria-hidden="true" />
                {formatTime(item.reservedFor)}
              </span>
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Users size={13} aria-hidden="true" />
                {item.partySize} {item.partySize === 1 ? 'persona' : 'persone'}
              </span>
              <span className="inline-flex items-center gap-1">
                <Phone size={13} aria-hidden="true" />
                {item.customerPhone ?? 'Telefono non disponibile'}
              </span>
            </div>
            {item.status === 'no_show' && item.noShowReason && (
              <p className="mt-2 text-[11px] font-medium text-danger">Motivo no-show: {item.noShowReason}</p>
            )}
          </div>

          <div className="grid w-full gap-2 sm:grid-cols-[minmax(0,180px)_minmax(0,210px)] lg:w-auto lg:min-w-[390px]">
            <label className="sr-only" htmlFor={`reservation-status-${item.id}`}>Stato prenotazione di {item.customerName}</label>
            <select
              id={`reservation-status-${item.id}`}
              value={draftStatus}
              onChange={(event) => setStatusDraftById((prev) => ({ ...prev, [item.id]: event.target.value as ReservationStatus }))}
              className="min-h-[44px] w-full rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label={`Stato prenotazione ${item.customerName}`}
              disabled={busy}
            >
              {statusOptions.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
            </select>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void updateStatus(item.id)}
              disabled={busy}
              loading={busy}
              className="w-full"
              aria-label={`Salva stato ${statusLabels[draftStatus]} per ${item.customerName}`}
            >
              Applica stato
            </Button>
            {item.status === 'pending' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => void updateStatus(item.id, 'confirmed')}
                disabled={busy}
                className="w-full"
                aria-label={`Conferma prenotazione di ${item.customerName}`}
              >
                Conferma
              </Button>
            )}
            {item.status !== 'cancelled' && item.status !== 'no_show' && (
              <>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => void updateStatus(item.id, 'cancelled')}
                  disabled={busy}
                  className="w-full"
                  aria-label={`Annulla prenotazione di ${item.customerName}`}
                >
                  Annulla
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setStatusDraftById((prev) => ({ ...prev, [item.id]: 'no_show' }))}
                  disabled={busy}
                  className="w-full"
                  aria-label={`Segna come no-show la prenotazione di ${item.customerName}`}
                >
                  Seleziona no-show
                </Button>
              </>
            )}
            {draftStatus === 'no_show' && (
              <>
                <label className="sr-only" htmlFor={`reservation-no-show-${item.id}`}>Motivo no-show per {item.customerName}</label>
                <select
                  id={`reservation-no-show-${item.id}`}
                  value={noShowReasonById[item.id] ?? ''}
                  onChange={(event) => setNoShowReasonById((prev) => ({ ...prev, [item.id]: event.target.value }))}
                  className="min-h-[44px] w-full rounded-lg border border-border bg-white px-3 py-2 text-xs text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:col-span-2"
                  aria-label={`Motivo no-show per ${item.customerName}`}
                  disabled={busy}
                >
                  <option value="">Seleziona motivo no-show</option>
                  {noShowReasonOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </>
            )}
            {rowErrorById[item.id] && (
              <p className="text-[11px] font-medium text-danger sm:col-span-2" role="alert">{rowErrorById[item.id]}</p>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-4 pb-20 md:pb-4">
      <header className="flex flex-col gap-3 rounded-xl border border-border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays size={20} className="text-accent" aria-hidden="true" />
            <h2 className="text-lg font-bold tracking-tight text-primary">Agenda prenotazioni</h2>
          </div>
          <p className="mt-1 text-xs text-text-muted">Gestisci gli arrivi della giornata in un’unica vista.</p>
        </div>
        <Button variant="primary" size="md" onClick={() => { setFormError(''); setFormOpen(true); }}>
          <Plus size={16} aria-hidden="true" />
          Nuova prenotazione
        </Button>
      </header>

      <section className="rounded-xl border border-border bg-white p-3 shadow-sm sm:p-4" aria-label="Filtri agenda">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="reservations-date" className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-text-muted">Giorno</label>
            <input
              id="reservations-date"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-border px-3 py-2 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor="reservations-status-filter" className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-text-muted">Stato</label>
            <select
              id="reservations-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as '' | ReservationStatus)}
              className="min-h-[44px] w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <option value="">Tutti gli stati</option>
              {statusOptions.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
            </select>
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={() => void load(true)}
            disabled={loading}
            loading={loading}
            className="w-full sm:w-auto"
            aria-label="Aggiorna agenda prenotazioni"
          >
            <RefreshCw size={15} aria-hidden="true" />
            Aggiorna
          </Button>
        </div>
      </section>

      {error && (
        <div className="flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger sm:flex-row sm:items-center sm:justify-between" role="alert">
          <p>{error}</p>
          <Button variant="danger" size="sm" onClick={() => void load(true)} disabled={loading} loading={loading}>
            Riprova
          </Button>
        </div>
      )}

      <section className="rounded-xl border border-border bg-white p-3 shadow-sm sm:p-4" aria-labelledby="reservations-agenda-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-border pb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Agenda del giorno</p>
            <h1 id="reservations-agenda-title" className="mt-1 text-base font-bold capitalize text-primary">{formatDateHeading(selectedDate)}</h1>
          </div>
          {!loading && items.length > 0 && <p className="text-xs font-semibold text-text-muted">{items.length} {items.length === 1 ? 'prenotazione' : 'prenotazioni'}</p>}
        </div>

        {loading ? (
          <div className="space-y-2" aria-label="Caricamento agenda" aria-busy="true">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-20 w-full" count={4} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={24} />}
            title="Nessuna prenotazione per questo giorno"
            description="Prova a scegliere un'altra data o crea una nuova prenotazione."
            action={<Button variant="primary" size="sm" onClick={() => { setFormError(''); setFormOpen(true); }}><Plus size={14} /> Nuova prenotazione</Button>}
          />
        ) : (
          <div className="space-y-4">
            {groupedByHour.map((group) => (
              <div key={group.slot} className="space-y-2">
                <div className="flex items-center gap-2" aria-label={`Slot delle ${group.slot}`}>
                  <span className="rounded-md bg-bg px-2 py-1 text-xs font-bold tabular-nums text-secondary">{group.slot}</span>
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{group.reservations.length} {group.reservations.length === 1 ? 'arrivo' : 'arrivi'}</span>
                </div>
                <div className="space-y-2">{group.reservations.map((item) => renderReservationRow(item))}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={formOpen}
        onClose={closeForm}
        title="Nuova prenotazione"
        size="md"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" size="md" onClick={closeForm}>Annulla</Button>
            <Button variant="primary" size="md" onClick={() => void submit()} disabled={creating} loading={creating}>Crea prenotazione</Button>
          </div>
        }
      >
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          {formError && <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs font-medium text-danger" role="alert">{formError}</p>}
          <div>
            <label htmlFor="reservation-customer-name" className="mb-1 block text-xs font-bold text-secondary">Nome cliente</label>
            <input id="reservation-customer-name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="es. Mario Rossi" autoComplete="name" className="min-h-[44px] w-full rounded-lg border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" />
          </div>
          <div>
            <label htmlFor="reservation-customer-phone" className="mb-1 block text-xs font-bold text-secondary">Telefono <span className="font-normal text-text-muted">(opzionale)</span></label>
            <input id="reservation-customer-phone" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="es. 333 1234567" autoComplete="tel" className="min-h-[44px] w-full rounded-lg border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="reservation-party-size" className="mb-1 block text-xs font-bold text-secondary">Numero persone</label>
              <input id="reservation-party-size" type="number" min="1" max="20" value={partySize} onChange={(event) => setPartySize(event.target.value)} className="min-h-[44px] w-full rounded-lg border border-border px-3 py-2 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" />
            </div>
            <div>
              <label htmlFor="reservation-reserved-for" className="mb-1 block text-xs font-bold text-secondary">Data e ora</label>
              <input id="reservation-reserved-for" type="datetime-local" value={reservedFor} onChange={(event) => setReservedFor(event.target.value)} className="min-h-[44px] w-full rounded-lg border border-border px-3 py-2 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" />
            </div>
          </div>
          <p className="text-[11px] text-text-muted">La prenotazione sarà registrata come inserita manualmente.</p>
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingCancelId !== null}
        title="Annulla prenotazione"
        message={pendingCancelItem ? `Confermi l'annullamento della prenotazione di ${pendingCancelItem.customerName}?` : 'Confermi l’annullamento della prenotazione?'}
        confirmLabel="Annulla prenotazione"
        onConfirm={() => {
          if (!pendingCancelId) return;
          const id = pendingCancelId;
          setPendingCancelId(null);
          void updateStatus(id, 'cancelled', true);
        }}
        onCancel={() => {
          if (pendingCancelId) {
            const item = items.find((entry) => entry.id === pendingCancelId);
            if (item) setStatusDraftById((prev) => ({ ...prev, [item.id]: item.status }));
          }
          setPendingCancelId(null);
        }}
      />
    </div>
  );
}
