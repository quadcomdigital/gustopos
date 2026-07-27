import { useCallback, useState } from 'react';

export interface ConfirmState {
  message: string;
  onConfirm: () => void;
}

export function useConfirm() {
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const requestConfirm = useCallback((message: string, onConfirm: () => void) => {
    setConfirm({ message, onConfirm });
  }, []);

  const handleConfirm = useCallback(() => {
    confirm?.onConfirm();
    setConfirm(null);
  }, [confirm]);

  const handleCancel = useCallback(() => {
    setConfirm(null);
  }, []);

  return { confirm, requestConfirm, handleConfirm, handleCancel };
}
