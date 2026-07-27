import { useMemo, useState } from 'react';
import type {
  StaffAdmin,
  StaffCreateRequest,
  StaffResetPinRequest,
  StaffUpdateRequest,
} from '@gustopos/shared';
import { UserPlus, RotateCcw, Power, PowerOff, Shield } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import { cn } from '../lib/utils';

interface StaffViewProps {
  staff: StaffAdmin[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onCreate: (payload: StaffCreateRequest) => Promise<void>;
  onUpdate: (id: string, payload: StaffUpdateRequest) => Promise<void>;
  onResetPin: (id: string, payload: StaffResetPinRequest) => Promise<unknown>;
  onSetActive: (id: string, active: boolean) => Promise<unknown>;
}

const initialCreate: StaffCreateRequest = {
  name: '',
  role: 'waiter',
  pin: '',
};

const AVAILABLE_PERMISSIONS = [
  { key: 'tables:pay', label: 'Checkout Tavoli', description: 'Chiudi conto e gestisci pagamenti' },
  { key: 'orders:void', label: 'Annulla Ordini', description: 'Annulla ordini attivi' },
  { key: 'printing:dispatch', label: 'Dispatch Stampa', description: 'Invia job di stampa' },
] as const;

export default function StaffView({
  staff,
  loading,
  onRefresh,
  onCreate,
  onUpdate,
  onResetPin,
  onSetActive,
}: StaffViewProps) {
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<StaffCreateRequest>(initialCreate);
  const [resetPins, setResetPins] = useState<Record<string, string>>({});
  const [pendingAction, setPendingAction] = useState<{
    type: 'toggle' | 'reset_pin';
    staffId: string;
    active?: boolean;
    pin?: string;
  } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return staff;
    }

    return staff.filter((item) =>
      item.name.toLowerCase().includes(q) ||
      item.role.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q),
    );
  }, [search, staff]);

  const submitCreate = async () => {
    if (createForm.name.trim().length < 2 || createForm.pin.length !== 4) {
      return;
    }

    setCreating(true);
    try {
      await onCreate({
        name: createForm.name.trim(),
        role: createForm.role,
        pin: createForm.pin,
      });
      setCreateForm(initialCreate);
    } finally {
      setCreating(false);
    }
  };

  const togglePermission = (member: StaffAdmin, permissionKey: string) => {
    const current = member.customPermissions ?? [];
    const hasPermission = current.includes(permissionKey);
    const next = hasPermission
      ? current.filter((p) => p !== permissionKey)
      : [...current, permissionKey];
    void onUpdate(member.id, { customPermissions: next });
  };

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-primary tracking-tight uppercase">Gestione Staff</h2>
          <p className="text-text-muted text-sm font-medium">Creazione utenti, ruoli, permessi e stato account</p>
        </div>
        <button
          onClick={() => void onRefresh()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-xs font-bold uppercase tracking-wider hover:bg-bg"
        >
          <RotateCcw size={14} />
          Aggiorna
        </button>
      </div>

      <div className="bg-white border border-border rounded-xl p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <input
          value={createForm.name}
          onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Nome operatore"
          className="md:col-span-2 px-3 py-2 rounded-lg border border-border text-sm"
        />
        <select
          value={createForm.role}
          onChange={(e) =>
            setCreateForm((prev) => ({ ...prev, role: e.target.value as StaffCreateRequest['role'] }))
          }
          className="px-3 py-2 rounded-lg border border-border text-sm"
        >
          <option value="admin">Admin</option>
          <option value="waiter">Waiter</option>
          <option value="chef">Chef</option>
        </select>
        <input
          value={createForm.pin}
          onChange={(e) => setCreateForm((prev) => ({ ...prev, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
          placeholder="PIN 4 cifre"
          className="px-3 py-2 rounded-lg border border-border text-sm"
        />
        <button
          disabled={creating}
          onClick={() => void submitCreate()}
          className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-accent text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
        >
          <UserPlus size={14} />
          Crea
        </button>
      </div>

      <div className="bg-white border border-border rounded-xl p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca per nome, ruolo o id"
          className="w-full px-3 py-2 rounded-lg border border-border text-sm mb-4"
        />

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {filtered.map((member) => (
            <div key={member.id} className="border border-border rounded-lg p-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="font-bold text-primary text-sm">{member.name}</p>
                  <p className="text-[10px] text-text-muted uppercase tracking-widest">
                    {member.role} • {member.id} • {member.isActive ? 'attivo' : 'disattivo'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setPendingAction({ type: 'toggle', staffId: member.id, active: !member.isActive })}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-[10px] font-bold uppercase tracking-wider"
                  >
                    {member.isActive ? <PowerOff size={12} /> : <Power size={12} />}
                    {member.isActive ? 'Disattiva' : 'Attiva'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-3">
                <input
                  defaultValue={member.name}
                  onBlur={(e) => {
                    const next = e.target.value.trim();
                    if (next && next !== member.name) {
                      void onUpdate(member.id, { name: next });
                    }
                  }}
                  className="px-2 py-1 rounded border border-border text-xs"
                />
                <select
                  value={member.role}
                  onChange={(e) =>
                    void onUpdate(member.id, { role: e.target.value as StaffUpdateRequest['role'] })
                  }
                  className="px-2 py-1 rounded border border-border text-xs"
                >
                  <option value="admin">admin</option>
                  <option value="waiter">waiter</option>
                  <option value="chef">chef</option>
                </select>
                <input
                  value={resetPins[member.id] ?? ''}
                  onChange={(e) =>
                    setResetPins((prev) => ({
                      ...prev,
                      [member.id]: e.target.value.replace(/\D/g, '').slice(0, 4),
                    }))
                  }
                  placeholder="Nuovo PIN"
                  className="px-2 py-1 rounded border border-border text-xs"
                />
                <button
                  onClick={() => {
                    const pin = resetPins[member.id] ?? '';
                    if (pin.length === 4) {
                      setPendingAction({ type: 'reset_pin', staffId: member.id, pin });
                    }
                  }}
                  className="px-2 py-1 rounded bg-primary text-white text-xs font-bold uppercase tracking-wider"
                >
                  Reset PIN
                </button>
              </div>

              {/* Permessi custom - solo per non-admin */}
              {member.role !== 'admin' && (
                <div className="mt-3 pt-3 border-t border-border/60">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Shield size={12} className="text-text-muted" />
                    <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">
                      Permessi custom
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {AVAILABLE_PERMISSIONS.map((perm) => {
                      const hasPerm = (member.customPermissions ?? []).includes(perm.key);
                      return (
                        <button
                          key={perm.key}
                          onClick={() => togglePermission(member, perm.key)}
                          title={perm.description}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all active:scale-95',
                            hasPerm
                              ? 'bg-accent/10 border-accent text-accent'
                              : 'bg-white border-border text-text-muted hover:border-accent/50',
                          )}
                        >
                          {perm.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && !loading && (
            <p className="text-sm text-text-muted text-center py-6">Nessun operatore trovato</p>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={Boolean(pendingAction)}
        title="Conferma operazione staff"
        message={
          pendingAction?.type === 'toggle'
            ? `Confermi ${pendingAction.active ? 'attivazione' : 'disattivazione'} account staff?`
            : 'Confermi reset PIN per questo account staff?'
        }
        confirmLabel="Conferma"
        cancelLabel="Annulla"
        onCancel={() => setPendingAction(null)}
        onConfirm={() => {
          const action = pendingAction;
          setPendingAction(null);
          if (!action) return;
          if (action.type === 'toggle' && action.active !== undefined) {
            void onSetActive(action.staffId, action.active);
          }
          if (action.type === 'reset_pin' && action.pin) {
            void onResetPin(action.staffId, { pin: action.pin });
            setResetPins((prev) => ({ ...prev, [action.staffId]: '' }));
          }
        }}
      />
    </div>
  );
}
