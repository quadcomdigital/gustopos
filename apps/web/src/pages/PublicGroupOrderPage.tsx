import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { socketEvents, onSocketEvent, type GroupOrderSession, type PublicMenuResponse } from '@gustopos/shared';
import {
  API_URL,
  createPublicGroupOrderSession,
  joinPublicGroupOrderSession,
  patchPublicGroupOrderCart,
  submitPublicGroupOrder,
} from '../shared/api/client';
import { BrandFooter, BrandHeader, resolvePublicBrand } from '../menu/brand';
import { formatPrice } from '../menu/lib/display';

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
    onSocketEvent(socket, socketEvents.groupOrderCartUpdated, (payload) => {
      setSession(payload.session);
    });
    onSocketEvent(socket, socketEvents.groupOrderJoined, (payload) => {
      setSession(payload.session);
    });
    onSocketEvent(socket, socketEvents.groupOrderSubmitted, (payload) => {
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

  const brand = useMemo(() => (menu ? resolvePublicBrand(menu) : null), [menu]);
  const currency = brand?.currency ?? 'EUR';
  const surfaceStyle = {
    backgroundColor: brand?.surface ?? '#ffffff',
    borderColor: brand?.border ?? '#e2e8f0',
    color: brand?.ink ?? '#0f172a',
  } as const;

  return (
    <main
      className="menu-brand min-h-[100dvh]"
      style={{ backgroundColor: brand?.pageBg ?? '#f8fafc', color: brand?.ink ?? '#0f172a' }}
    >
      <BrandHeader
        brand={brand}
        name={menu?.tenant.name ?? tenantSlug}
        action={
          <Link
            to={`/${tenantSlug}/menu`}
            className="min-h-[36px] rounded-full border border-white/25 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white/85 transition hover:bg-white/10"
          >
            Menu
          </Link>
        }
      />

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: brand?.muted ?? '#64748b' }}>
            Ordine condiviso
          </p>
          <h1 className="display mt-1 text-3xl font-extrabold">Ordina insieme</h1>
          <p className="mt-2 text-sm" style={{ color: brand?.muted ?? '#64748b' }}>
            Ogni partecipante aggiunge i propri piatti: il totale si aggiorna in tempo reale.
          </p>
        </div>

        {!session && (
          <div className="space-y-3 rounded-2xl border p-4 shadow-sm" style={surfaceStyle}>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: brand?.muted ?? '#64748b' }}>
                Il tuo nome
              </span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Nome"
                className="mt-1.5 min-h-[48px] w-full rounded-xl border px-3 text-sm outline-none focus:ring-2"
                style={{ backgroundColor: brand?.pageBg ?? '#f8fafc', borderColor: brand?.border ?? '#e2e8f0', color: brand?.ink ?? '#0f172a' }}
              />
            </label>
            <button
              onClick={() => void createOrJoin()}
              disabled={displayName.trim().length < 2}
              className="min-h-[48px] w-full rounded-xl text-xs font-extrabold uppercase tracking-[0.16em] transition active:scale-[0.99] disabled:opacity-50"
              style={{ backgroundColor: brand?.accent ?? '#0f172a', color: brand?.accentForeground ?? '#ffffff' }}
            >
              {joinCode === 'new' ? 'Crea sessione' : 'Entra nella sessione'}
            </button>
          </div>
        )}

        {session && (
          <div className="space-y-3">
            <div className="rounded-2xl border p-4 text-sm shadow-sm" style={surfaceStyle}>
              <div className="flex items-baseline justify-between gap-3">
                <span style={{ color: brand?.muted ?? '#64748b' }}>Codice</span>
                <strong className="display text-lg font-extrabold tracking-tight">{session.joinCode}</strong>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <span style={{ color: brand?.muted ?? '#64748b' }}>Partecipanti</span>
                <strong className="tabular-nums">{session.participants.length}</strong>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <span style={{ color: brand?.muted ?? '#64748b' }}>Totale</span>
                <strong className="tabular-nums">{formatPrice(currency, session.total)}</strong>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {(menu?.items ?? []).map((item) => {
                const current = session.items.find((entry) => entry.menuItemId === item.id)?.quantity ?? 0;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border p-3 shadow-sm"
                    style={surfaceStyle}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{item.name}</p>
                      <p className="text-xs tabular-nums" style={{ color: brand?.muted ?? '#64748b' }}>
                        {formatPrice(currency, item.price)}
                      </p>
                    </div>
                    <div className="flex flex-none items-center gap-1">
                      <button
                        onClick={() => void upsertQty(item.id, Math.max(0, current - 1))}
                        aria-label={`Riduci ${item.name}`}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border font-bold"
                        style={{ borderColor: brand?.border ?? '#e2e8f0' }}
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-bold tabular-nums">{current}</span>
                      <button
                        onClick={() => void upsertQty(item.id, current + 1)}
                        aria-label={`Aumenta ${item.name}`}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border font-bold"
                        style={{ borderColor: brand?.border ?? '#e2e8f0' }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => void submit()}
              disabled={!isMaster || submitting || session.status !== 'open'}
              className="min-h-[48px] w-full rounded-xl text-xs font-extrabold uppercase tracking-[0.16em] transition active:scale-[0.99] disabled:opacity-50"
              style={{ backgroundColor: brand?.accent ?? '#0f172a', color: brand?.accentForeground ?? '#ffffff' }}
            >
              {isMaster ? 'Conferma ordine' : 'Solo il master può confermare'}
            </button>
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}
      </div>

      <BrandFooter brand={brand} name={menu?.tenant.name ?? tenantSlug} />
    </main>
  );
}
