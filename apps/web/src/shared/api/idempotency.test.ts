import { describe, it, expect } from 'vitest';
import { isDuplicateIdempotentError, resolveOrderIdempotencyKey } from './client';

describe('resolveOrderIdempotencyKey (H2: one key per logical order action)', () => {
  it('mints a fresh key on first submission of a payload', () => {
    const pending = new Map<string, string>();
    const first = resolveOrderIdempotencyKey('payload-fingerprint', pending);

    expect(first.key).toBeTruthy();
    expect(first.pending.get('payload-fingerprint')).toBe(first.key);
  });

  it('reuses the same key when the same payload is retried', () => {
    const pending = new Map<string, string>();
    const first = resolveOrderIdempotencyKey('same-cart', pending);
    const retry = resolveOrderIdempotencyKey('same-cart', first.pending);

    expect(retry.key).toBe(first.key);
  });

  it('mints a different key when the payload (cart) changes', () => {
    const pending = new Map<string, string>();
    const first = resolveOrderIdempotencyKey('table-3-cart', pending);
    const second = resolveOrderIdempotencyKey('table-4-cart', first.pending);

    expect(second.key).not.toBe(first.key);
    expect(second.pending.get('table-4-cart')).toBe(second.key);
  });

  it('mints a fresh key after the pending entry was dropped on success', () => {
    const pending = new Map<string, string>();
    const first = resolveOrderIdempotencyKey('same-cart', pending);

    // Simulate the success path in createOrder(): the entry is deleted once
    // the request reaches the server, so an identical NEW order gets a new key.
    const afterSuccess = new Map<string, string>();
    const second = resolveOrderIdempotencyKey('same-cart', afterSuccess);

    expect(second.key).not.toBe(first.key);
  });

  it('keeps distinct fingerprints independently in the same map', () => {
    const pending = new Map<string, string>();
    const a1 = resolveOrderIdempotencyKey('cart-a', pending);
    const b1 = resolveOrderIdempotencyKey('cart-b', a1.pending);
    const a2 = resolveOrderIdempotencyKey('cart-a', b1.pending);

    expect(a2.key).toBe(a1.key);
    expect(b1.key).not.toBe(a1.key);
  });

  it('caps the map to avoid unbounded growth', () => {
    let pending = new Map<string, string>();
    let last: string | undefined;
    for (let i = 0; i < 50; i += 1) {
      const result = resolveOrderIdempotencyKey(`payload-${i}`, pending);
      pending = result.pending;
      last = result.key;
    }
    expect(last).toBeTruthy();
    expect(pending.size).toBeLessThanOrEqual(20);
  });
});

describe('isDuplicateIdempotentError (softer 409 double-tap message)', () => {
  it('matches the middleware ConflictException message', () => {
    expect(isDuplicateIdempotentError(new Error('Duplicate idempotent request'))).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isDuplicateIdempotentError(new Error('DUPLICATE IDEMPOTENT REQUEST'))).toBe(true);
  });

  it('does not match unrelated errors', () => {
    expect(isDuplicateIdempotentError(new Error('Insufficient stock'))).toBe(false);
    expect(isDuplicateIdempotentError(new Error('Unauthorized'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isDuplicateIdempotentError('Duplicate idempotent request')).toBe(false);
    expect(isDuplicateIdempotentError(null)).toBe(false);
    expect(isDuplicateIdempotentError(undefined)).toBe(false);
  });
});
