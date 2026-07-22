import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Command, FileText, Layers3, X } from 'lucide-react';

export const QuickNoteComposer = ({
  open,
  projects,
  defaultProjectId,
  theme,
  onClose,
  onSave,
  onAdvanced
}) => {
  const [projectId, setProjectId] = useState(defaultProjectId || '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const fallbackProjectId = projects[defaultProjectId] ? defaultProjectId : Object.keys(projects)[0] || '';
      setProjectId(fallbackProjectId);
      setTitle('');
      setBody('');
      setError('');
      setIsSaving(false);
    }
    wasOpenRef.current = open;
  }, [defaultProjectId, open, projects]);

  if (!open) return null;

  const draft = { projectId, title: title.trim(), body: body.trim() };

  const submit = async (event) => {
    event.preventDefault();
    if (!draft.projectId) {
      setError('Choose a project first.');
      return;
    }
    if (!draft.title) {
      setError('Give your note a title.');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      await onSave(draft);
    } catch (saveError) {
      setError(saveError.message || 'Could not save this note.');
      setIsSaving(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Tab') {
      const focusable = [...event.currentTarget.querySelectorAll('button:not(:disabled), input, select, textarea')];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose({ isDirty: Boolean(title.trim() || body.trim()) });
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.requestSubmit();
    }
  };

  return (
    <div
      className="quick-note-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose({ isDirty: Boolean(title.trim() || body.trim()) })}
    >
      <section
        aria-labelledby="quick-note-title"
        aria-modal="true"
        className="quick-note-shell"
        role="dialog"
        style={{
          '--quick-bg': theme?.bgColor || '#e4decd',
          '--quick-ink': theme?.textColor || '#1a1b1c',
          '--quick-accent': theme?.accentColor || '#4a5240'
        }}
      >
        <aside className="quick-note-intro" aria-hidden="true">
          <div>
            <p className="quick-note-eyebrow">Fast capture / 01</p>
            <FileText className="quick-note-mark" strokeWidth={1.2} />
          </div>
          <div>
            <p className="quick-note-intro-copy">Get the thought out of your head. Structure can come later.</p>
            <p className="quick-note-shortcut"><Command className="h-3.5 w-3.5" /> Enter to save</p>
          </div>
        </aside>

        <form className="quick-note-form" onSubmit={submit} onKeyDown={handleKeyDown}>
          <div className="quick-note-heading">
            <div>
              <p className="quick-note-eyebrow">New note</p>
              <h2 id="quick-note-title">Capture it now.</h2>
            </div>
            <button className="quick-note-close" type="button" onClick={() => onClose({ isDirty: Boolean(title.trim() || body.trim()) })} aria-label="Close new note">
              <X aria-hidden="true" />
            </button>
          </div>

          <label className="quick-note-field">
            <span>Project</span>
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              {Object.values(projects).map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>

          <label className="quick-note-field quick-note-title-field">
            <span>Title</span>
            <input
              autoFocus
              maxLength={120}
              onChange={(event) => {
                setTitle(event.target.value);
                setError('');
              }}
              placeholder="What do you want to remember?"
              value={title}
            />
          </label>

          <label className="quick-note-field quick-note-body-field">
            <span>Note <small>Markdown works</small></span>
            <textarea
              onChange={(event) => setBody(event.target.value)}
              placeholder="Start typing… links, lists, code, and checkboxes are welcome."
              value={body}
            />
          </label>

          {error && <p className="quick-note-error" role="alert">{error}</p>}

          <div className="quick-note-actions">
            <button className="quick-note-advanced" type="button" onClick={() => onAdvanced(draft)}>
              <Layers3 aria-hidden="true" />
              <span>Advanced editor<small>Blocks, images & boards</small></span>
            </button>
            <button className="quick-note-save" type="submit" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save note'}
              {!isSaving && <ArrowRight aria-hidden="true" />}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
