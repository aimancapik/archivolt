import React, { useCallback, useMemo, useState } from 'react';
import { FeedbackLayer } from '../components/FeedbackLayer';

export const useFeedback = (theme) => {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);

  const notify = useCallback((message, tone = 'info') => {
    const id = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 3200);
  }, []);

  const confirmAction = useCallback((options) => new Promise((resolve) => {
    setDialog({ type: 'confirm', tone: 'info', ...options, resolve });
  }), []);

  const promptAction = useCallback((options) => new Promise((resolve) => {
    setDialog({ type: 'prompt', tone: 'danger', value: '', ...options, resolve });
  }), []);

  const closeDialog = useCallback((value) => {
    setDialog((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  const node = useMemo(() => (
    <FeedbackLayer
      dialog={dialog}
      toasts={toasts}
      theme={theme}
      onCloseDialog={closeDialog}
      onDismissToast={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))}
      onPromptChange={(value) => setDialog((current) => current ? { ...current, value } : current)}
    />
  ), [closeDialog, dialog, theme, toasts]);

  return { confirmAction, node, notify, promptAction };
};
