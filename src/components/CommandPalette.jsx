import React, { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';

export const CommandPalette = ({ commands, onClose, open, theme }) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? commands.filter((command) => [command.label, command.meta, command.keywords].join(' ').toLowerCase().includes(needle))
      : commands;
    return filtered.slice(0, 12);
  }, [commands, query]);

  if (!open) return null;

  const run = (command) => {
    onClose();
    command.run();
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-start justify-center px-3 pt-20" style={{ background: 'rgba(0,0,0,0.42)' }}>
      <div className="w-full max-w-2xl animate-fade-in shadow-2xl" role="dialog" aria-modal="true" aria-label="Search notes and commands" style={{ background: theme.bgColor, border: `2px solid ${theme.textColor}`, color: theme.textColor }}>
        <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: theme.borderColor }}>
          <Search className="h-4 w-4 opacity-65" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && matches[0]) run(matches[0]);
            }}
            className="min-w-0 flex-1 bg-transparent font-mono-tech text-sm uppercase focus:outline-none"
            style={{ color: theme.textColor }}
            placeholder="Search notes and commands…"
            aria-label="Search notes and commands"
          />
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center border" style={{ borderColor: theme.borderColor }} aria-label="Close command palette">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {matches.length ? matches.map((command) => (
            <button
              key={command.id}
              type="button"
              onClick={() => run(command)}
              className="grid w-full grid-cols-[1fr_auto] gap-4 p-3 text-left transition-colors hover:bg-[rgba(255,255,255,0.08)]"
            >
              <span>
                <span className="block font-display text-sm font-bold uppercase">{command.label}</span>
                <span className="mt-1 block font-mono-tech text-[10px] uppercase opacity-55">{command.meta}</span>
              </span>
              <span className="self-center border px-2 py-1 font-mono-tech text-[9px] uppercase opacity-65" style={{ borderColor: theme.borderColor }}>
                {command.type}
              </span>
            </button>
          )) : (
            <div className="p-6 text-center font-mono-tech text-[10px] uppercase opacity-55">No matches found</div>
          )}
        </div>
      </div>
    </div>
  );
};
