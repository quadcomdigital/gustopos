import { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Reservation } from '@gustopos/shared';
import { CalendarDays, Users, Phone, Clock, FileText, CheckCircle } from 'lucide-react';
import { createPublicReservation } from '../shared/api/client';

type BookingForm = {
  customerName: string;
  customerPhone: string;
  partySize: string;
  date: string;
  time: string;
  notes: string;
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildReservedFor(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PublicReservationPage() {
  const { tenantSlug = '' } = useParams();
  const [form, setForm] = useState<BookingForm>({
    customerName: '',
    customerPhone: '',
    partySize: '2',
    date: todayStr(),
    time: '19:00',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reserved, setReserved] = useState<Reservation | null>(null);

  const updateField = (field: keyof BookingForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const canSubmit =
    form.customerName.trim().length >= 2 &&
    form.partySize.trim().length > 0 &&
    Number(form.partySize) >= 1 &&
    Number(form.partySize) <= 50 &&
    form.date.length > 0 &&
    form.time.length > 0 &&
    !loading;

  const handleSubmit = async () => {
    if (!tenantSlug || !canSubmit) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const reservation = await createPublicReservation(tenantSlug, {
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim() || undefined,
        partySize: Number(form.partySize),
        reservedFor: buildReservedFor(form.date, form.time),
        notes: form.notes.trim() || undefined,
        source: 'online',
      });

      setReserved(reservation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prenotazione non riuscita. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  if (reserved) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
            <h1 className="text-lg font-bold text-slate-900">Prenotazione confermata</h1>
          </div>
          <div className="space-y-2 text-sm text-slate-700">
            <p><strong>Nome:</strong> {reserved.customerName}</p>
            {reserved.customerPhone && <p><strong>Telefono:</strong> {reserved.customerPhone}</p>}
            <p><strong>Coperti:</strong> {reserved.partySize}</p>
            <p><strong>Data e ora:</strong> {formatDateTime(reserved.reservedFor)}</p>
            {reserved.notes && <p><strong>Note:</strong> {reserved.notes}</p>}
            <p className="text-xs text-slate-500 mt-2">Stato: {reserved.status}</p>
          </div>
          <button
            onClick={() => {
              setReserved(null);
              setForm({
                customerName: '',
                customerPhone: '',
                partySize: '2',
                date: todayStr(),
                time: '19:00',
                notes: '',
              });
            }}
            className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-[0.14em] hover:bg-slate-800 transition-colors"
          >
            Nuova prenotazione
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-slate-900">Prenota un tavolo</h1>
          <p className="text-sm text-slate-500">Compila il form per prenotare il tuo tavolo</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <Users className="w-3.5 h-3.5" />
              Nome cliente *
            </label>
            <input
              value={form.customerName}
              onChange={(e) => updateField('customerName', e.target.value)}
              placeholder="Mario Rossi"
              className="w-full px-3 py-2 rounded border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <Phone className="w-3.5 h-3.5" />
              Telefono
            </label>
            <input
              value={form.customerPhone}
              onChange={(e) => updateField('customerPhone', e.target.value)}
              placeholder="+39 333 1234567"
              className="w-full px-3 py-2 rounded border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                <Users className="w-3.5 h-3.5" />
                Coperti *
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={form.partySize}
                onChange={(e) => updateField('partySize', e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full px-3 py-2 rounded border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400"
              />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                <CalendarDays className="w-3.5 h-3.5" />
                Data *
              </label>
              <input
                type="date"
                value={form.date}
                min={todayStr()}
                onChange={(e) => updateField('date', e.target.value)}
                className="w-full px-3 py-2 rounded border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5" />
              Ora *
            </label>
            <input
              type="time"
              value={form.time}
              onChange={(e) => updateField('time', e.target.value)}
              className="w-full px-3 py-2 rounded border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5" />
              Note
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="Allergie, richieste speciali..."
              rows={3}
              className="w-full px-3 py-2 rounded border border-slate-300 text-sm min-h-[72px] focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400"
            />
          </div>

          {error && (
            <div className="rounded border border-rose-200 bg-rose-50 p-3">
              <p className="text-xs text-rose-700">{error}</p>
            </div>
          )}

          <button
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-[0.14em] hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Prenotazione in corso...' : 'Prenota ora'}
          </button>
        </div>

        <p className="text-center text-[11px] text-slate-400">
          La tua prenotazione sar&agrave; confermata dal ristorante
        </p>
      </div>
    </main>
  );
}
