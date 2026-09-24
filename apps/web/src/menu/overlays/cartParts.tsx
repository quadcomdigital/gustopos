import type { CSSProperties } from 'react';
import { Minus, Plus, ShoppingBag } from 'lucide-react';
import type { CartCustomerForm, CheckoutStep, MenuAppearance, PublicCartLine, TakeawayConfig } from '../types';
import type { CartAuthForm } from '../types';
import { formatDatetimeLocal } from '../lib/display';

/**
 * Presentational pieces of the cart/checkout overlay. They are intentionally
 * tenant-agnostic: every colour comes from `MenuAppearance`, so a scaffold can
 * re-compose the same pieces on its own chrome without forking the logic.
 */

const steps: Array<{ id: CheckoutStep; label: string }> = [
  { id: 'cart', label: 'Carrello' },
  { id: 'customer', label: 'Dati' },
  { id: 'confirm', label: 'Conferma' },
];

const inputStyle = (appearance: MenuAppearance): CSSProperties => ({
  backgroundColor: appearance.surface,
  borderColor: appearance.border,
  color: appearance.ink,
});

export function CheckoutStepper({
  step,
  onChange,
  appearance,
  activeVariant = 'ink',
}: {
  step: CheckoutStep;
  onChange: (step: CheckoutStep) => void;
  appearance: MenuAppearance;
  /** Which surface marks the current step: the dark chrome or the accent fill. */
  activeVariant?: 'ink' | 'accent';
}) {
  const activeBg = activeVariant === 'accent' ? appearance.accent : appearance.ink;
  const activeFg = activeVariant === 'accent' ? appearance.accentForeground : '#ffffff';
  return (
    <div className="grid grid-cols-3 gap-2">
      {steps.map((entry) => {
        const active = step === entry.id;
        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => onChange(entry.id)}
            aria-pressed={active}
            className="min-h-[38px] rounded border px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors"
            style={{
              backgroundColor: active ? activeBg : appearance.surface,
              color: active ? activeFg : appearance.muted,
              borderColor: active ? activeBg : appearance.border,
            }}
          >
            {entry.label}
          </button>
        );
      })}
    </div>
  );
}

export function CartEmpty({ appearance, onBrowse }: { appearance: MenuAppearance; onBrowse: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border"
        style={{ backgroundColor: appearance.accentSoft, borderColor: appearance.border }}
      >
        <ShoppingBag className="h-7 w-7" style={{ color: appearance.accentText }} />
      </div>
      <p className="font-bold" style={{ color: appearance.ink }}>
        Il carrello è vuoto
      </p>
      <p className="mt-1 text-sm" style={{ color: appearance.muted }}>
        Aggiungi qualcosa di buono dal menu.
      </p>
      <button
        type="button"
        onClick={onBrowse}
        className="mt-4 min-h-[44px] rounded-full border px-5 text-xs font-bold uppercase tracking-widest"
        style={{ borderColor: appearance.border, color: appearance.ink, backgroundColor: appearance.surface }}
      >
        Inizia a ordinare
      </button>
    </div>
  );
}

export function CartLine({
  line,
  appearance,
  currency,
  formatPrice,
  optionNameById,
  onIncrement,
  onDecrement,
  onRemove,
}: {
  line: PublicCartLine;
  appearance: MenuAppearance;
  currency: string;
  formatPrice: (value: number) => string;
  optionNameById: Map<string, string>;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const unit = line.basePrice + line.modifierPriceDelta;
  return (
    <div
      className="flex gap-3 rounded-xl border p-3"
      style={{ borderColor: appearance.border, backgroundColor: appearance.surface }}
    >
      <div
        className="h-14 w-14 flex-shrink-0 rounded-lg border"
        style={{
          borderColor: appearance.border,
          backgroundImage: `linear-gradient(135deg, ${appearance.accentSoft}, ${appearance.surface})`,
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-start justify-between gap-3">
          <h4 className="truncate text-sm font-bold" style={{ color: appearance.ink }}>
            {line.name}
          </h4>
          <span className="text-xs font-extrabold tabular-nums" style={{ color: appearance.ink }}>
            {formatPrice(unit * line.quantity)}
          </span>
        </div>
        {line.selectedModifiers.length > 0 && (
          <p className="mb-1 text-[11px] leading-snug" style={{ color: appearance.muted }}>
            {line.selectedModifiers
              .map((selection) => optionNameById.get(selection.optionId) ?? selection.optionId)
              .join(' · ')}
          </p>
        )}
        <p className="mb-2 text-[11px] tabular-nums" style={{ color: appearance.muted }}>
          Unitario {formatPrice(unit)}
        </p>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center rounded-lg border p-1"
            style={{ borderColor: appearance.border, backgroundColor: appearance.pageBg }}
          >
            <button
              type="button"
              onClick={() => onDecrement(line.id)}
              aria-label={`Riduci ${line.name}`}
              className="flex h-8 w-8 items-center justify-center rounded transition-colors active:scale-95"
              style={{ color: appearance.ink }}
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-8 text-center text-xs font-extrabold tabular-nums" style={{ color: appearance.ink }}>
              {line.quantity}
            </span>
            <button
              type="button"
              onClick={() => onIncrement(line.id)}
              aria-label={`Aumenta ${line.name}`}
              className="flex h-8 w-8 items-center justify-center rounded transition-colors active:scale-95"
              style={{ color: appearance.ink }}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => onRemove(line.id)}
            className="min-h-[32px] text-[10px] font-bold uppercase tracking-widest text-rose-600 transition-colors hover:text-rose-700"
          >
            Rimuovi
          </button>
        </div>
      </div>
    </div>
  );
}

export function AccountBlock({
  auth,
  appearance,
}: {
  auth: CartAuthForm;
  appearance: MenuAppearance;
}) {
  if (auth.user) {
    return (
      <div
        className="flex items-center justify-between gap-3 rounded border p-3"
        style={{ backgroundColor: appearance.accentSoft, borderColor: appearance.border }}
      >
        <p className="min-w-0 truncate text-xs font-semibold" style={{ color: appearance.ink }}>
          Account collegato: {auth.user.fullName}
        </p>
        <button
          type="button"
          onClick={() => void auth.logout()}
          className="min-h-[36px] flex-none text-[11px] font-semibold underline"
          style={{ color: appearance.accentText }}
        >
          Esci
        </button>
      </div>
    );
  }

  const fields = (
    <>
      {auth.mode === 'register' && (
        <input
          value={auth.fullName}
          onChange={(event) => auth.setFullName(event.target.value)}
          placeholder="Nome e cognome"
          className="min-h-[44px] w-full rounded border px-3 text-sm outline-none focus:ring-2"
          style={inputStyle(appearance)}
        />
      )}
      <input
        value={auth.email}
        onChange={(event) => auth.setEmail(event.target.value)}
        placeholder="Email (opzionale)"
        className="min-h-[44px] w-full rounded border px-3 text-sm outline-none focus:ring-2"
        style={inputStyle(appearance)}
      />
      <input
        value={auth.phone}
        onChange={(event) => auth.setPhone(event.target.value)}
        placeholder="Telefono (opzionale)"
        className="min-h-[44px] w-full rounded border px-3 text-sm outline-none focus:ring-2"
        style={inputStyle(appearance)}
      />
      <input
        type="password"
        value={auth.password}
        onChange={(event) => auth.setPassword(event.target.value)}
        placeholder="Password"
        className="min-h-[44px] w-full rounded border px-3 text-sm outline-none focus:ring-2"
        style={inputStyle(appearance)}
      />
      <button
        type="button"
        onClick={() => void auth.submit()}
        disabled={auth.loading}
        className="min-h-[44px] w-full rounded px-3 text-xs font-bold uppercase tracking-widest disabled:opacity-50"
        style={{ backgroundColor: appearance.accent, color: appearance.accentForeground }}
      >
        {auth.loading ? 'Attendi…' : auth.mode === 'login' ? 'Login cliente' : 'Registra account'}
      </button>
      {auth.error && <p className="text-xs text-rose-600">{auth.error}</p>}
    </>
  );

  return (
    <div
      className="space-y-2 rounded-lg border p-3"
      style={{ borderColor: appearance.border, backgroundColor: appearance.surface }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: appearance.ink }}>
          Account cliente
        </p>
        <button
          type="button"
          onClick={() => auth.setMode(auth.mode === 'login' ? 'register' : 'login')}
          className="min-h-[36px] text-[11px] font-semibold underline"
          style={{ color: appearance.accentText }}
        >
          {auth.mode === 'login' ? 'Registrati' : 'Login'}
        </button>
      </div>
      {fields}
    </div>
  );
}

export function CustomerFields({
  customer,
  takeawayConfig,
  appearance,
}: {
  customer: CartCustomerForm;
  takeawayConfig: TakeawayConfig;
  appearance: MenuAppearance;
}) {
  return (
    <div className="space-y-2">
      <input
        value={customer.name}
        onChange={(event) => customer.setName(event.target.value)}
        placeholder="Nome cliente"
        className="min-h-[44px] w-full rounded border px-3 text-sm outline-none focus:ring-2"
        style={inputStyle(appearance)}
      />
      <input
        value={customer.phone}
        onChange={(event) => customer.setPhone(event.target.value)}
        placeholder="Telefono (opzionale)"
        className="min-h-[44px] w-full rounded border px-3 text-sm outline-none focus:ring-2"
        style={inputStyle(appearance)}
      />
      <input
        type="datetime-local"
        value={customer.pickupEta}
        onChange={(event) => customer.setPickupEta(event.target.value)}
        className="min-h-[44px] w-full rounded border px-3 text-sm outline-none focus:ring-2"
        style={inputStyle(appearance)}
      />
      {takeawayConfig.allowNotes && (
        <textarea
          value={customer.notes}
          onChange={(event) => customer.setNotes(event.target.value)}
          placeholder="Note ordine (opzionale)"
          className="min-h-[72px] w-full rounded border px-3 py-2 text-sm outline-none focus:ring-2"
          style={inputStyle(appearance)}
        />
      )}
    </div>
  );
}

export function ConfirmSummary({
  customer,
  appearance,
}: {
  customer: CartCustomerForm;
  appearance: MenuAppearance;
}) {
  const row = (label: string, value: string) => (
    <p className="text-sm" style={{ color: appearance.ink }}>
      <span className="font-bold">{label}</span> {value}
    </p>
  );
  return (
    <div className="space-y-2 rounded border p-3" style={{ borderColor: appearance.border, backgroundColor: appearance.surface }}>
      <p className="text-xs" style={{ color: appearance.muted }}>
        Controlla i dati prima di inviare l&apos;ordine.
      </p>
      {row('Cliente:', customer.name || '-')}
      {row('Telefono:', customer.phone || '-')}
      {row('ETA:', customer.pickupEta ? formatDatetimeLocal(customer.pickupEta) : '-')}
      {row('Note:', customer.notes || '-')}
    </div>
  );
}
