import { useCallback, useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog";

export function useConfirm() {
  const [state, setState] = useState(null);

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setState({
        message,
        title: options.title,
        confirmLabel: options.confirmLabel,
        resolve,
      });
    });
  }, []);

  const handleConfirm = () => {
    state?.resolve(true);
    setState(null);
  };
  const handleCancel = () => {
    state?.resolve(false);
    setState(null);
  };

  const dialog = state ? (
    <ConfirmDialog
      message={state.message}
      title={state.title}
      confirmLabel={state.confirmLabel}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return { confirm, dialog };
}
