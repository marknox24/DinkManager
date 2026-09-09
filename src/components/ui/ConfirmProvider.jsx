import { useCallback, useRef, useState } from 'react';
import { ConfirmContext } from '../../context/ConfirmContext';
import ConfirmDialog from './ConfirmDialog';

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((options) => {
    setDialog(typeof options === 'string' ? { message: options } : options);
    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = useCallback((result) => {
    setDialog(null);
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={!!dialog}
        title={dialog?.title || 'Are you sure?'}
        message={dialog?.message || ''}
        confirmLabel={dialog?.confirmLabel || 'Confirm'}
        danger={dialog?.danger !== false}
        onConfirm={() => close(true)}
        onCancel={() => close(false)}
      />
    </ConfirmContext.Provider>
  );
}
