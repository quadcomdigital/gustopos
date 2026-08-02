import { useEffect, useMemo, useState } from 'react';
import type { Shift, ShiftStatus, TimeEntry } from '@gustopos/shared';
import { pushToast } from '../shared/ui/toast';
import { useAppStore } from '../store/app-store';
import ConfirmDialog from './ConfirmDialog';

const statuses: ShiftStatus[] = ['scheduled', 'completed', 'cancelled'];

interface ShiftsViewProps {
  currentUserId: string;
}

export default function ShiftsView({ currentUserId }: ShiftsViewProps) {
  const [_loading, setLoading] = useState(false);
  const items = useAppStore((state) => state.shifts);
  const refreshShifts = useAppStore((state) => state.refreshShifts);
  const createShift = useAppStore((state) => state.createShift);
  const updateShift = useAppStore((state) => state.updateShift);
  const clockIn = useAppStore((state) => state.clockIn);
  const clockOut = useAppStore((state) => state.clockOut);
  const resolveTimeEntry = useAppStore((state) => state.resolveTimeEntry);
  const refreshTimeReport = useAppStore((state) => state.refreshTimeReport);
  const storeTimeEntries = useAppStore((state) => state.timeEntries);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [staffId, setStaffId] = useState(currentUserId);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startAt, setStartAt] = useState('09:00');
  const [endAt, setEndAt] = useState('17:00');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reportHours, setReportHours] = useState(0);
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{ id: string; status: ShiftStatus } | null>(null);

  const mapError = (value: unknown) => {
    const message = value instanceof Error ? value.message : 'Errore operazione turni';
    if (message.includes('Open time entry already exists')) return 'Esiste gia una timbratura aperta per questo staff.';
    if (message.includes('No open time entry')) return 'Nessuna timbratura aperta da chiudere.';
    return message;
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const from = new Date(`${date}T00:00:00`).toISOString();
      const to = new Date(`${date}T23:59:59`).toISOString();
      const [, report] = await Promise.all([
        refreshShifts({ from, to, limit: 300 }),
        refreshTimeReport({ from, to }),
      ]);
      setReportHours(report.totalHours);
    } catch (loadError) {
      setError(mapError(loadError));
    } finally {
      setLoading(false);
    }
  };

  /* eslint-disable react-hooks/exhaustive-deps -- [load-recursion] load is recreated each render; effect only refreshes on date change */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- [indirect-setstate] load() calls store set() asynchronously
    void load();
  }, [date]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const createShiftHandler = async () => {
    if (!staffId.trim()) {
      setError('Staff ID obbligatorio.');
      return;
    }
    if (new Date(`${date}T${endAt}:00`).getTime() <= new Date(`${date}T${startAt}:00`).getTime()) {
      setError('L\'orario fine deve essere successivo all\'orario inizio.');
      return;
    }
    setError('');
    setSuccess('');
    try {
      await createShift({
        staffId: staffId.trim(),
        shiftDate: date,
        startAt: new Date(`${date}T${startAt}:00`).toISOString(),
        endAt: new Date(`${date}T${endAt}:00`).toISOString(),
        toleranceEarlyMin: 15,
        toleranceLateMin: 15,
      });
      await load();
      setSuccess('Turno creato con successo.');
      pushToast('success', 'Turno creato con successo.');
    } catch (createError) {
      const message = mapError(createError);
      setError(message);
      pushToast('error', message);
    }
  };

  const updateStatus = async (id: string, status: ShiftStatus) => {
    setError('');
    setSuccess('');
    try {
      await updateShift(id, { status });
      await load();
      setSuccess(`Stato turno aggiornato a ${status}.`);
      pushToast('success', `Stato turno aggiornato a ${status}.`);
    } catch (updateError) {
      const message = mapError(updateError);
      setError(message);
      pushToast('error', message);
    }
  };

  const requestStatusUpdate = (id: string, nextStatus: ShiftStatus, currentStatus: ShiftStatus) => {
    if (nextStatus === currentStatus) {
      return;
    }
    setPendingStatusUpdate({ id, status: nextStatus });
  };

  const doClockIn = async (shiftId?: string) => {
    if (!staffId.trim()) {
      setError('Staff ID obbligatorio.');
      return;
    }
    if (hasOpenEntryForStaff) {
      setError('Esiste gia una timbratura aperta per questo staff.');
      return;
    }
    setError('');
    try {
      const entry = await clockIn({
        staffId: staffId.trim(),
        shiftId,
        source: 'web',
        at: new Date().toISOString(),
      });
      setEntries((prev) => [entry, ...prev]);
      setSuccess('Clock-in registrato.');
      pushToast('success', 'Clock-in registrato.');
    } catch (clockError) {
      const message = mapError(clockError);
      setError(message);
      pushToast('error', message);
    }
  };

  const doClockOut = async () => {
    if (!staffId.trim()) {
      setError('Staff ID obbligatorio.');
      return;
    }
    if (!hasOpenEntryForStaff) {
      setError('Nessuna timbratura aperta da chiudere.');
      return;
    }
    setError('');
    try {
      const entry = await clockOut({ staffId: staffId.trim(), at: new Date().toISOString() });
      setEntries((prev) => [entry, ...prev]);
      await load();
      setSuccess('Clock-out registrato.');
      pushToast('success', 'Clock-out registrato.');
    } catch (clockError) {
      const message = mapError(clockError);
      setError(message);
      pushToast('error', message);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<ShiftStatus, Shift[]>();
    for (const status of statuses) {
      map.set(status, []);
    }
    for (const item of items) {
      const bucket = map.get(item.status) ?? [];
      bucket.push(item);
      map.set(item.status, bucket);
    }
    return map;
  }, [items]);

  const hasOpenEntryForStaff = useMemo(() => {
    const normalizedStaffId = staffId.trim();
    if (!normalizedStaffId) return false;
    return [...entries, ...storeTimeEntries].some(
      (entry) => entry.staffId === normalizedStaffId && !entry.clockOutAt,
    );
  }, [entries, storeTimeEntries, staffId]);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-border rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-bold text-primary uppercase tracking-wide">Shifts & Timeclock</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <input value={staffId} onChange={(event) => setStaffId(event.target.value)} placeholder="Staff ID" className="px-3 py-2 rounded border border-border text-sm" />
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="px-3 py-2 rounded border border-border text-sm" />
          <input type="time" value={startAt} onChange={(event) => setStartAt(event.target.value)} className="px-3 py-2 rounded border border-border text-sm" />
          <input type="time" value={endAt} onChange={(event) => setEndAt(event.target.value)} className="px-3 py-2 rounded border border-border text-sm" />
          <button onClick={() => void createShiftHandler()} className="px-4 py-2 rounded bg-primary text-white text-xs font-bold uppercase tracking-wider min-h-10">Crea turno</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button onClick={() => void doClockIn()} disabled={hasOpenEntryForStaff} className="px-4 py-2 rounded border border-border text-xs font-bold uppercase tracking-wider min-h-10 disabled:opacity-50">Clock-in</button>
          <button onClick={() => void doClockOut()} disabled={!hasOpenEntryForStaff} className="px-4 py-2 rounded border border-border text-xs font-bold uppercase tracking-wider min-h-10 disabled:opacity-50">Clock-out</button>
          <button onClick={() => void load()} className="px-4 py-2 rounded border border-border text-xs font-bold uppercase tracking-wider min-h-10">Aggiorna</button>
        </div>
        <div className="text-xs font-semibold text-text-muted">Ore giornaliere: {reportHours.toFixed(2)}</div>
        {error && <p className="text-xs text-danger">{error}</p>}
        {success && <p className="text-xs text-emerald-600 font-semibold">{success}</p>}
      </div>

      <div className="bg-white border border-border rounded-xl p-4 space-y-3">
        {statuses.map((status) => (
          <div key={status} className="border border-border rounded p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">{status} ({(grouped.get(status) ?? []).length})</p>
            <div className="space-y-2">
              {(grouped.get(status) ?? []).map((item) => (
                <div key={item.id} className="border border-border rounded p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-bg/20">
                  <div>
                    <p className="text-sm font-bold text-secondary">{item.staffId} • {item.shiftDate}</p>
                    <p className="text-xs text-text-muted">{new Date(item.startAt).toLocaleTimeString()} - {new Date(item.endAt).toLocaleTimeString()}</p>
                  </div>
                  <select value={item.status} onChange={(event) => requestStatusUpdate(item.id, event.target.value as ShiftStatus, item.status)} className="px-2 py-2 rounded border border-border text-xs min-h-10 w-full sm:w-auto">
                    {statuses.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                  </select>
                </div>
              ))}
              {(grouped.get(status) ?? []).length === 0 && <p className="text-xs text-text-muted">Nessun turno.</p>}
            </div>
          </div>
        ))}
      </div>

      {entries.length > 0 && (
        <div className="bg-white border border-border rounded-xl p-4 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Ultime timbrature</p>
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between gap-3 text-xs text-text-muted border border-border rounded px-3 py-2">
              <span>
                {entry.staffId} • in: {new Date(entry.clockInAt).toLocaleString()} • out: {entry.clockOutAt ? new Date(entry.clockOutAt).toLocaleString() : '-'} • {entry.status}
              </span>
              {(entry.status === 'open' || entry.status === 'anomaly') && (
                <button
                  onClick={() => {
                    setLoading(true);
                    setError('');
                    void resolveTimeEntry(entry.id)
                      .then(() => {
                        setSuccess('Timbratura risolta correttamente.');
                        setEntries((previous) => previous.filter((e) => e.id !== entry.id));
                        return load();
                      })
                      .catch((err) => setError(mapError(err)))
                      .finally(() => setLoading(false));
                  }}
                  className="shrink-0 px-3 py-1.5 rounded border border-amber-500 text-amber-700 text-[11px] font-bold uppercase tracking-wider min-h-8 hover:bg-amber-50 transition-colors"
                >
                  Risolvi
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingStatusUpdate)}
        title="Conferma aggiornamento"
        message={pendingStatusUpdate ? `Confermi aggiornamento turno a ${pendingStatusUpdate.status}?` : ''}
        confirmLabel="Conferma"
        cancelLabel="Annulla"
        onCancel={() => setPendingStatusUpdate(null)}
        onConfirm={() => {
          const payload = pendingStatusUpdate;
          setPendingStatusUpdate(null);
          if (payload) {
            void updateStatus(payload.id, payload.status);
          }
        }}
      />
    </div>
  );
}
