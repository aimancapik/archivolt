import React from 'react';

const toneColor = (tone, theme) => tone === 'danger' ? '#ff5f57' : tone === 'success' ? '#28c840' : theme.textColor;

export const FeedbackLayer = ({ dialog, onCloseDialog, onDismissToast, onPromptChange, theme, toasts }) => (
  <>
    <div className="fixed right-4 top-4 z-[80] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => onDismissToast(toast.id)}
          className="text-left font-mono-tech uppercase shadow-2xl"
          style={{
            background: theme.bgColor,
            border: `1px solid ${toneColor(toast.tone, theme)}`,
            color: theme.textColor,
            fontSize: '10px',
            padding: '12px 14px'
          }}
        >
          <span style={{ color: toneColor(toast.tone, theme), marginRight: '8px' }}>STATUS</span>
          {toast.message}
        </button>
      ))}
    </div>
    {dialog && (
      <div className="fixed inset-0 z-[70] grid place-items-center px-4" style={{ background: 'rgba(0,0,0,0.58)' }}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-dialog-title"
          className="w-full max-w-md animate-fade-in"
          style={{ background: theme.bgColor, border: `2px solid ${toneColor(dialog.tone, theme)}`, color: theme.textColor, boxShadow: '18px 18px 0 rgba(0,0,0,0.28)' }}
        >
          <div className="border-b p-4" style={{ borderColor: theme.borderColor }}>
            <p className="font-mono-tech text-[9px] uppercase opacity-60">ARCHIVOLT_SIGNAL</p>
            <h2 id="feedback-dialog-title" className="font-serif text-2xl font-bold uppercase">{dialog.title}</h2>
          </div>
          <div className="space-y-4 p-4">
            <p className="font-mono-tech text-xs leading-relaxed opacity-80">{dialog.message}</p>
            {dialog.type === 'prompt' && (
              <input
                autoFocus
                value={dialog.value}
                onChange={(e) => onPromptChange(e.target.value)}
                className="w-full bg-transparent p-3 font-mono-tech uppercase focus:outline-none"
                style={{ border: `1px solid ${theme.textColor}`, color: theme.textColor, fontSize: '12px' }}
                aria-label={dialog.inputLabel || dialog.title}
              />
            )}
          </div>
          <div className="flex gap-2 border-t p-4" style={{ borderColor: theme.borderColor }}>
            <button
              type="button"
              onClick={() => onCloseDialog(dialog.type === 'prompt' ? null : false)}
              className="flex-1 border px-3 py-3 font-mono-tech text-[10px] uppercase"
              style={{ borderColor: theme.borderColor, color: theme.textColor }}
            >
              {dialog.cancelText || 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => onCloseDialog(dialog.type === 'prompt' ? dialog.value : true)}
              className="flex-1 border px-3 py-3 font-mono-tech text-[10px] uppercase"
              style={{ borderColor: toneColor(dialog.tone, theme), background: toneColor(dialog.tone, theme), color: dialog.tone === 'danger' ? '#111' : theme.bgColor }}
            >
              {dialog.confirmText || 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
);
