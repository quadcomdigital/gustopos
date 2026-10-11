import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import {
  socketEvents,
  onSocketEvent,
  type GroupOrderCartItem,
  type GroupOrderPatchCartRequest,
  type GroupOrderSession,
  type PublicMenuResponse,
} from '@gustopos/shared';
import {
  API_URL,
  createPublicGroupOrderSession,
  fetchPublicGroupOrderSession,
  joinPublicGroupOrderSession,
  patchPublicGroupOrderCart,
  submitPublicGroupOrder,
} from '../shared/api/client';
import { BrandFooter, BrandHeader, resolvePublicBrand } from '../menu/brand';
import { formatPrice } from '../menu/lib/display';
import ModifierSheet from '../menu/overlays/ModifierSheet';
import ConsumerPushToggle from '../components/push/ConsumerPushToggle';

type MenuItem = PublicMenuResponse['items'][number];

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
  const [shareCopied, setShareCopied] = useState(false);
  const [modifierItem, setModifierItem] = useState<MenuItem | null>(null);

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

  // Resume: a participant with a stored identity (the master arriving from the
  // menu, or a guest after reload) loads the live session without rejoining.
  useEffect(() => {
    if (!identity?.sessionId || !tenantSlug || session) return;
    let cancelled = false;
    void fetchPublicGroupOrderSession(tenantSlug, identity.sessionId, identity.joinCode, identity.participantToken)
      .then((live) => {
        if (!cancelled) setSession(live);
      })
      .catch(() => {
        if (cancelled) return;
        localStorage.removeItem(keyFor(tenantSlug, identity.joinCode));
        setIdentity(null);
      });
    return () => {
      cancelled = true;
    };
  }, [identity, tenantSlug, session]);

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
    onSocketEvent(socket, socketEvents.groupOrderReviewUpdated, (payload) => {
      setSession((prev) => (prev ? { ...prev, status: payload.status } : prev));
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

  // Distance ordering: the master shares a plain link (WhatsApp), never a QR.
  const shareUrl = useMemo(() => {
    if (!session || typeof window === 'undefined') return '';
    return `${window.location.origin}/${tenantSlug}/group-order/${session.joinCode}`;
  }, [session, tenantSlug]);
  const shareMessage = useMemo(
    () => `Unisciti al mio ordine da ${menu?.tenant.name ?? tenantSlug}: ${shareUrl}`,
    [menu?.tenant.name, tenantSlug, shareUrl],
  );

  const copyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      setError('Copia del link non riuscita');
    }
  };

  const shareSession = async () => {
    if (!shareUrl) return;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Ordina insieme', text: shareMessage, url: shareUrl });
        return;
      } catch {
        // The user dismissed the native share sheet: fall back to copying.
      }
    }
    await copyShareLink();
  };

  const optionNameById = useMemo(() => {
    const map = new Map<string, string>();
    if (!menu) return map;
    for (const item of menu.items) {
      for (const group of item.modifierGroups ?? []) {
        for (const option of group.options) map.set(option.id, option.name);
      }
    }
    for (const pool of menu.categoryModifierPools) {
      for (const option of pool.options) map.set(option.id, option.name || option.componentId || option.id);
    }
    return map;
  }, [menu]);

  const itemsByParticipant = useMemo(() => {
    const map = new Map<string, { name: string; lines: GroupOrderCartItem[] }>();
    if (!session) return map;
    for (const line of session.items) {
      const entry = map.get(line.participantId) ?? { name: line.participantName, lines: [] };
      entry.lines.push(line);
      map.set(line.participantId, entry);
    }
    return map;
  }, [session]);

  const canEditLine = (line: GroupOrderCartItem): boolean =>
    isMaster || line.participantId === identity?.participantId;

  /** Apply one or more per-line cart operations (server re-prices + authz). */
  const patchCart = async (ops: GroupOrderPatchCartRequest['items']) => {
    if (!session || !identity || !tenantSlug || ops.length === 0) return;
    setError('');
    try {
      const updated = await patchPublicGroupOrderCart(tenantSlug, session.id, identity.joinCode, identity.participantToken, {
        expectedVersion: session.version,
        items: ops,
      });
      setSession(updated.session);
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : 'Aggiornamento carrello non riuscito');
    }
  };

  const addItem = (item: MenuItem, selectedModifiers: Array<{ groupId: string; optionId: string }> = []) => {
    void patchCart([{
      menuItemId: item.id,
      quantity: 1,
      selectedModifiers: selectedModifiers.length > 0 ? selectedModifiers : undefined,
    }]);
  };

  const onAddItem = (item: MenuItem) => {
    const hasModifiers = (item.modifierGroups?.length ?? 0) > 0 || (menu?.categoryModifierPools.length ?? 0) > 0;
    if (hasModifiers) {
      setModifierItem(item);
      return;
    }
    addItem(item);
  };

  const changeLineQuantity = (line: GroupOrderCartItem, delta: number) => {
    const quantity = line.quantity + delta;
    void patchCart([{
      lineId: line.id,
      menuItemId: line.menuItemId,
      quantity: Math.max(0, quantity),
      selectedModifiers: line.selectedModifiers.length > 0 ? line.selectedModifiers : undefined,
      notes: line.notes,
    }]);
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
      const masterName = session.participants.find((entry) => entry.id === session.masterParticipantId)?.displayName;
      const submitted = await submitPublicGroupOrder(tenantSlug, session.id, identity.joinCode, identity.participantToken, {
        expectedVersion: session.version,
        customerName: `Group order ${masterName ?? displayName ?? 'guest'}`,
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

            {session.status !== 'open' && (
              <div
                className="rounded-2xl border px-4 py-3 text-sm"
                style={{
                  ...surfaceStyle,
                  borderColor: session.status === 'rejected' ? '#fecdd3' : brand?.border ?? '#e2e8f0',
                  backgroundColor: session.status === 'rejected' ? '#fff1f2' : brand?.surface ?? '#ffffff',
                }}
              >
                {session.status === 'pending_review' && 'Inviato al locale: in attesa di approvazione.'}
                {session.status === 'approved' && 'Approvato dal locale: l’ordine è in preparazione.'}
                {session.status === 'rejected' && `Rifiutato dal locale${session.rejectionReason ? `: ${session.rejectionReason}` : '.'}`}
                {session.status === 'expired' && 'Sessione scaduta.'}
              </div>
            )}

            <div className="rounded-2xl border p-4 shadow-sm" style={surfaceStyle}>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: brand?.muted ?? '#64748b' }}>
                Invita gli amici
              </p>
              <p className="mt-2 break-all text-xs" style={{ color: brand?.muted ?? '#64748b' }}>
                {shareUrl || 'Link non disponibile'}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void shareSession()}
                  disabled={!shareUrl}
                  className="min-h-[44px] rounded-xl text-[11px] font-extrabold uppercase tracking-[0.14em] transition active:scale-[0.99] disabled:opacity-50"
                  style={{ backgroundColor: brand?.accent ?? '#0f172a', color: brand?.accentForeground ?? '#ffffff' }}
                >
                  {shareCopied ? 'Link copiato' : 'Condividi'}
                </button>
                <a
                  href={shareUrl ? `https://wa.me/?text=${encodeURIComponent(shareMessage)}` : undefined}
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={!shareUrl}
                  className={`flex min-h-[44px] items-center justify-center rounded-xl border text-[11px] font-extrabold uppercase tracking-[0.14em] ${shareUrl ? '' : 'pointer-events-none opacity-50'}`}
                  style={{ borderColor: brand?.border ?? '#e2e8f0', color: brand?.ink ?? '#0f172a' }}
                >
                  WhatsApp
                </a>
              </div>
            </div>

            {identity && (
              <ConsumerPushToggle
                tenantSlug={tenantSlug}
                context={{ kind: 'group_order', sessionId: identity.sessionId, participantToken: identity.participantToken }}
                categories={['group_order']}
              />
            )}

            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: brand?.muted ?? '#64748b' }}>
                Riepilogo per persona
              </p>
              {itemsByParticipant.size === 0 && (
                <p className="text-sm" style={{ color: brand?.muted ?? '#64748b' }}>
                  Nessun piatto ancora. Aggiungi il primo qui sotto.
                </p>
              )}
              {[...itemsByParticipant.entries()].map(([participantId, group]) => {
                const groupTotal = group.lines.reduce((sum, line) => sum + line.lineTotal, 0);
                return (
                  <div key={participantId} className="rounded-2xl border p-3 shadow-sm" style={surfaceStyle}>
                    <div className="flex items-baseline justify-between gap-3">
                      <strong className="text-sm">
                        {group.name}
                        {participantId === identity?.participantId ? ' (tu)' : ''}
                      </strong>
                      <span className="text-xs tabular-nums" style={{ color: brand?.muted ?? '#64748b' }}>
                        {formatPrice(currency, groupTotal)}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-2">
                      {group.lines.map((line) => (
                        <li key={line.id} className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {line.quantity}× {line.name}
                            </p>
                            {line.selectedModifiers.length > 0 && (
                              <p className="text-[11px]" style={{ color: brand?.muted ?? '#64748b' }}>
                                {line.selectedModifiers
                                  .map((selection) => optionNameById.get(selection.optionId) ?? selection.optionId)
                                  .join(', ')}
                              </p>
                            )}
                            {line.notes && <p className="text-[11px] italic">{line.notes}</p>}
                          </div>
                          {canEditLine(line) && session.status === 'open' ? (
                            <div className="flex flex-none items-center gap-1">
                              <button
                                type="button"
                                onClick={() => changeLineQuantity(line, -1)}
                                aria-label={`Riduci ${line.name}`}
                                className="flex h-11 w-11 items-center justify-center rounded-xl border font-bold"
                                style={{ borderColor: brand?.border ?? '#e2e8f0' }}
                              >
                                −
                              </button>
                              <span className="w-7 text-center text-sm font-bold tabular-nums">{line.quantity}</span>
                              <button
                                type="button"
                                onClick={() => changeLineQuantity(line, 1)}
                                aria-label={`Aumenta ${line.name}`}
                                className="flex h-11 w-11 items-center justify-center rounded-xl border font-bold"
                                style={{ borderColor: brand?.border ?? '#e2e8f0' }}
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <span className="flex-none text-xs font-bold tabular-nums">
                              {formatPrice(currency, line.lineTotal)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            {session.status === 'open' && (
              <div className="rounded-2xl border p-3 shadow-sm" style={surfaceStyle}>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: brand?.muted ?? '#64748b' }}>
                  Aggiungi piatti
                </p>
                <div className="mt-1 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {(menu?.items ?? []).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-xl border p-3"
                      style={{ borderColor: brand?.border ?? '#e2e8f0' }}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{item.name}</p>
                        <p className="text-xs tabular-nums" style={{ color: brand?.muted ?? '#64748b' }}>
                          {formatPrice(currency, item.price)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onAddItem(item)}
                        disabled={item.isSoldOut}
                        aria-label={`Aggiungi ${item.name}`}
                        className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border text-lg font-bold disabled:opacity-40"
                        style={{ borderColor: brand?.border ?? '#e2e8f0', color: brand?.accent ?? '#0f172a' }}
                      >
                        +
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => void submit()}
              disabled={!isMaster || submitting || session.status !== 'open' || session.items.length === 0}
              className="min-h-[48px] w-full rounded-xl text-xs font-extrabold uppercase tracking-[0.16em] transition active:scale-[0.99] disabled:opacity-50"
              style={{ backgroundColor: brand?.accent ?? '#0f172a', color: brand?.accentForeground ?? '#ffffff' }}
            >
              {!isMaster
                ? 'Solo il master può inviare'
                : session.status === 'pending_review'
                  ? 'In attesa di approvazione'
                  : session.status === 'approved'
                    ? 'Ordine approvato'
                    : 'Invia al locale'}
            </button>

            {menu?.capabilities.onlinePayments === false && (
              <button
                type="button"
                disabled
                title="Pagamento online non ancora disponibile"
                className="min-h-[44px] w-full cursor-not-allowed rounded-xl border text-[11px] font-bold uppercase tracking-[0.16em] opacity-50"
                style={{ borderColor: brand?.border ?? '#e2e8f0', color: brand?.muted ?? '#64748b' }}
              >
                Paga online (prossimamente)
              </button>
            )}
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}
      </div>

      {modifierItem && brand && (
        <ModifierSheet
          item={modifierItem}
          categoryPools={menu?.categoryModifierPools ?? []}
          appearance={brand}
          currency={currency}
          formatPrice={(value) => formatPrice(currency, value)}
          onClose={() => setModifierItem(null)}
          onConfirm={({ selectedModifiers }) => {
            addItem(modifierItem, selectedModifiers);
            setModifierItem(null);
          }}
        />
      )}

      <BrandFooter brand={brand} name={menu?.tenant.name ?? tenantSlug} />
    </main>
  );
}
