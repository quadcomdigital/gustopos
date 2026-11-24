import { describe, expect, it } from 'vitest';
import { shouldApplySnapshot } from './snapshot-freshness';

describe('shouldApplySnapshot', () => {
  it('applica la risposta se nessun aggiornamento è arrivato nel frattempo', () => {
    expect(shouldApplySnapshot({ capturedRevision: 7, currentRevision: 7 })).toBe(true);
  });

  it('scarta una risposta REST se un push socket più recente è già stato applicato', () => {
    expect(shouldApplySnapshot({ capturedRevision: 7, currentRevision: 8 })).toBe(false);
  });

  it('regge il caso di molti eventi durante una fetch lenta', () => {
    expect(shouldApplySnapshot({ capturedRevision: 0, currentRevision: 42 })).toBe(false);
  });
});
