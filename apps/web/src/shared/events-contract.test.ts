import { describe, expect, it, vi } from 'vitest';
import {
  socketEvents,
  onSocketEvent,
  parseSocketEventPayload,
  isSocketEventName,
  ordersUpdatePatchSchema,
  type SocketEventSubscriber,
} from '@gustopos/shared';

function validOrder(): Record<string, unknown> {
  return {
    id: 'order_1',
    orderType: 'dine_in',
    table: '1',
    status: 'pending',
    items: [],
    total: 0,
    timestamp: new Date().toISOString(),
    staffId: 'staff_1',
  };
}

function validUiSettings(): Record<string, unknown> {
  return {
    brandName: 'GUSTOPOS',
    taxRate: 0.1,
    theme: {
      primary: '#1e3a5f',
      secondary: '#334155',
      accent: '#0f766e',
      success: '#16a34a',
      warning: '#d97706',
      danger: '#dc2626',
      bg: '#f8fafc',
      border: '#e2e8f0',
      textMain: '#0f172a',
      textMuted: '#64748b',
    },
    printing: {
      kitchenPrinterName: '',
      cashierPrinterName: '',
      barPrinterName: '',
      protocol: 'escpos',
      activeAreas: ['kitchen'],
      autoPrintKitchen: true,
      autoPrintOnClose: true,
      logoMode: 'none',
      logoWidth: 384,
      logoThreshold: 128,
      receiptFooter: '',
    },
  };
}

describe('socket event contract (Epic 7)', () => {
  it('recognizes every declared event name', () => {
    for (const name of Object.values(socketEvents)) {
      expect(isSocketEventName(name)).toBe(true);
    }
    expect(isSocketEventName('not:an:event')).toBe(false);
  });

  it('accepts a valid order:new payload', () => {
    const parsed = parseSocketEventPayload(socketEvents.orderNew, validOrder());
    expect(parsed).not.toBeNull();
    expect(parsed?.id).toBe('order_1');
  });

  it('rejects a malformed order:new payload', () => {
    const parsed = parseSocketEventPayload(socketEvents.orderNew, { id: 'nope' });
    expect(parsed).toBeNull();
  });

  it('validates orders:update discriminated union (set_paid / move)', () => {
    expect(ordersUpdatePatchSchema.safeParse({ action: 'set_paid', tableNumber: '2' }).success).toBe(true);
    expect(ordersUpdatePatchSchema.safeParse({ action: 'move', fromTableNumber: '2', toTableNumber: '5' }).success).toBe(true);
    expect(ordersUpdatePatchSchema.safeParse({ action: 'move', tableNumber: '2' }).success).toBe(false);
  });

  it('validates inventory:update as an array of ingredients', () => {
    const parsed = parseSocketEventPayload(socketEvents.inventoryUpdate, []);
    expect(parsed).toEqual([]);
    expect(parseSocketEventPayload(socketEvents.inventoryUpdate, { not: 'array' })).toBeNull();
  });

  it('validates bridge:removed payload', () => {
    expect(parseSocketEventPayload(socketEvents.bridgeRemoved, { id: 'b1' })).toEqual({ id: 'b1' });
    expect(parseSocketEventPayload(socketEvents.bridgeRemoved, {})).toBeNull();
  });

  it('validates settings:update payload', () => {
    const parsed = parseSocketEventPayload(socketEvents.settingsUpdate, validUiSettings());
    expect(parsed).not.toBeNull();
    expect((parsed as { brandName?: string } | null)?.brandName).toBe('GUSTOPOS');
    // A truncated settings payload must be rejected.
    expect(parseSocketEventPayload(socketEvents.settingsUpdate, { brandName: 'X' })).toBeNull();
  });

  it('onSocketEvent delivers validated payloads and drops invalid ones', () => {
    const handler = vi.fn();
    const listeners = new Map<string, (raw: unknown) => void>();
    const socket: SocketEventSubscriber = {
      on: (event, listener) => {
        listeners.set(event, listener);
        return socket;
      },
      off: () => socket,
    };

    onSocketEvent(socket, socketEvents.orderNew, handler);

    const listener = listeners.get(socketEvents.orderNew);
    expect(listener).toBeDefined();

    listener?.(validOrder());
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].id).toBe('order_1');

    listener?.({ id: 'broken' });
    expect(handler).toHaveBeenCalledTimes(1); // dropped
  });
});
