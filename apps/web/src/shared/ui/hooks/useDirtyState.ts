import { useCallback, useRef, useState } from 'react';

export interface UseDirtyStateReturn {
  isDirty: boolean;
  snapshot: <T>(value: T) => T;
  markDirty: () => void;
  reset: () => void;
}

/**
 * Tracks whether a form has unsaved changes.
 * Call `snapshot(value)` to record the "clean" state of each field.
 * When current values differ from the snapshot, `isDirty` becomes true.
 * Call `reset()` after save to re-snapshot.
 */
export function useDirtyState(): UseDirtyStateReturn {
  const [dirtyCount, setDirtyCount] = useState(0);
  const snapshotsRef = useRef<Map<string, unknown>>(new Map());

   
  const snapshot = useCallback(<T>(value: T): T => {
    const key = String(snapshotsRef.current.size);
    if (!snapshotsRef.current.has(key)) {
      snapshotsRef.current.set(key, value);
    }
    return value;
  }, []);

  const markDirty = useCallback(() => {
    setDirtyCount((c) => c + 1);
  }, []);

   
  const reset = useCallback(() => {
    snapshotsRef.current.clear();
    setDirtyCount(0);
  }, []);

  return {
    isDirty: dirtyCount > 0,
    snapshot,
    markDirty,
    reset,
  };
}

/**
 * Simple dirty tracking: compare current value to a stored reference.
 * Returns true if value differs from the initial value.
 */
export function useFieldDirty(initial: string | number | boolean): {
  isDirty: boolean;
  setValue: (v: string | number | boolean) => void;
  value: string | number | boolean;
  reset: (v?: string | number | boolean) => void;
} {
  const [value, setValue] = useState(initial);
  const [initialValue, setInitialValue] = useState(initial);

  const reset = useCallback((v?: string | number | boolean) => {
    const resetTo = v !== undefined ? v : initialValue;
    setValue(resetTo);
    setInitialValue(resetTo);
  }, [initialValue]);

  return {
    isDirty: value !== initialValue,
    value,
    setValue,
    reset,
  };
}
