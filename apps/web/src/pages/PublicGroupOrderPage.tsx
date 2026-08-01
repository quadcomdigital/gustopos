import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { socketEvents, type GroupOrderSession, type PublicMenuResponse } from '@gustopos/shared';
import {
  API_URL,
  createPublicGroupOrderSession,
  joinPublicGroupOrderSession,
  patchPublicGroupOrderCart,
  submitPublicGroupOrder,
} from '../shared/api/client';

type LocalIdentity = {
  sessionId: string;
  participantToken: string;
  participantId: string;
  joinCode: string;
};

function keyFor(tenantSlug: string, joinCode: string): string {
  return `gustopos:group-order:${tenantSlug}:${joinCode}`;
}

export default function PublicGroupOrderPage() {
  const navigate = useNavigate();
  const { tenantSlug = '', joinCode = '' } = useParams();
  const [menu, setMenu] = useState<PublicMenuResponse | null>(null);
  const [session, setSession] = useState<GroupOrderSession | null>(null);
  const [identity, setIdentity] = useState<LocalIdentity | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!tenantSlug) return;
    void fetch(`${API_URL}/api/public/menu?slug=${encodeURIComponent(tenantSlug)}`)
      .then((res) => res.json().then((payload) => ({ ok: res.ok, payload })))
      .then(({ ok, payload }) => {
        if (!ok) throw new Error(payload?.message ?? 'Menu load failed');
        setMenu(payload as PublicMenuResponse);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Menu load failed'));
  }, [tenantSlug]);

  useEffect(() => {
    if (!tenantSlug || !joinCode) return;
    const raw = localStorage.getItem(keyFor(tenantSlug, joinCode));
    if (!raw) return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- [form-sync] restores identity from localStorage on mount; safe because setter receives derived data, not state
      setIdentity(JSON.parse(raw) as LocalIdentity);
    } catch {
       
      setIdentity(null);
    }
  }, [tenantSlug, joinCode]);

  useEffect(() => {
    if (!identity?.sessionId) return;
    const socket: Socket = io(API_URL, {
      auth: { participantToken: identity.participantToken, sessionId: identity.sessionId, tenantSlug },
    });
    socket.emit('group_order_join_room', { sessionId: identity.sessionId, participantToken: identity.participantToken });
    socket.on(socketEvents.groupOrderCartUpdated, (payload: { session: GroupOrderSession }) => {
      setSession(payload.session);
    });
    socket.on(socketEvents.groupOrderJoined, (payload: { session: GroupOrderSession }) => {
      setSession(payload.session);
    });
    socket.on(socketEvents.groupOrderSubmitted, (payload: { session: GroupOrderSession }) => {
      setSession(payload.session);
    });
    return () => {
      socket.emit('group_order_leave_room', { sessionId: identity.sessionId });
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- identity object identity churns on every parent re-render; we only care about sessionId which is already in deps
  }, [identity?.sessionId]);

  const isMaster = useMemo(() => {
    if (!session || !identity) return false;
    return session.masterParticipantId === identity.participantId;
  }, [session, identity]);

  const upsertQty = async (menuItemId: string, quantity: number) => {
    if (!session || !identity || !tenantSlug) return;
    setError('');
    try {
      const updated = await patchPublicGroupOrderCart(tenantSlug, session.id, identity.joinCode, identity.participantToken, {
        expectedVersion: session.version,
        items: [{ menuItemId, quantity }],
      });
      setSession(updated.session);
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : 'Aggiornamento carrello non riuscito');
    }
  };

  const createOrJoin = async () => {
    if (!tenantSlug || !joinCode || displayName.trim().length < 2) return;
    setError('');
    try {
      const joined = joinCode === 'new'
        ? await createPublicGroupOrderSession(tenantSlug, { displayName: displayName.trim() })
        : await joinPublicGroupOrderSession(tenantSlug, joinCode, { displayName: displayName.trim() });
      const nextIdentity: LocalIdentity = {
        sessionId: joined.session.id,
        participantToken: joined.participantToken,
        participantId: joined.participant.id,
        joinCode: joined.session.joinCode,
      };
      localStorage.setItem(keyFor(tenantSlug, joined.session.joinCode), JSON.stringify(nextIdentity));
      setIdentity(nextIdentity);
      setSession(joined.session);
      if (joinCode === 'new') {
        navigate(`/${tenantSlug}/group-order/${joined.session.joinCode}`, { replace: true });
      }
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Join failed');
    }
  };

  const submit = async () => {
    if (!tenantSlug || !session || !identity || !isMaster) return;
    setSubmitting(true);
    try {
      const submitted = await submitPublicGroupOrder(tenantSlug, session.id, identity.joinCode, identity.participantToken, {
        expectedVersion: session.version,
        customerName: `Group order ${displayName || 'guest'}`,
        idempotencyKey: globalThis.crypto?.randomUUID?.(),
      });
      setSession(submitted.session);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 p-4 space-y-4">
      <h1 className="text-xl font-bold">Ordine condiviso</h1>
      {!session && (
        <div className="bg-white rounded border border-slate-200 p-4 space-y-2 max-w-md">
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Il tuo nome"
            className="w-full px-3 py-2 rounded border border-slate-300 text-sm"
          />
          <button onClick={() => void createOrJoin()} className="px-3 py-2 rounded bg-slate-900 text-white text-xs font-bold">
            {joinCode === 'new' ? 'Crea sessione' : 'Entra nella sessione'}
          </button>
        </div>
      )}
      {session && (
        <div className="space-y-3">
          <div className="bg-white rounded border border-slate-200 p-3 text-sm">
            <p>Codice: <strong>{session.joinCode}</strong></p>
            <p>Partecipanti: {session.participants.length}</p>
            <p>Totale: EUR {session.total.toFixed(2)}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(menu?.items ?? []).map((item) => {
              const current = session.items.find((entry) => entry.menuItemId === item.id)?.quantity ?? 0;
              return (
                <div key={item.id} className="bg-white rounded border border-slate-200 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{item.name}</p>
                    <p className="text-xs text-slate-500">EUR {item.price.toFixed(2)}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => void upsertQty(item.id, Math.max(0, current - 1))} className="px-2 py-1 border rounded">-</button>
                    <span className="px-2 py-1 text-sm">{current}</span>
                    <button onClick={() => void upsertQty(item.id, current + 1)} className="px-2 py-1 border rounded">+</button>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => void submit()}
            disabled={!isMaster || submitting || session.status !== 'open'}
            className="px-4 py-2 rounded bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
          >
            {isMaster ? 'Conferma ordine' : 'Solo master puo confermare'}
          </button>
        </div>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </main>
  );
}
