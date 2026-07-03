import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, GripVertical, Trash2, Save, Plus, Image, ChevronUp, ChevronDown, RotateCcw, Upload, FileText, Copy, Check, Undo2, Eye, Pencil, Heading1, Pilcrow, Code, Play, List, ListChecks, Sticker, FolderOpen, PanelTop } from 'lucide-react';
import { cn } from '../utils/helpers';
import { checklistItemsFromText, checklistTextFromItems } from '../utils/checklist';
import { markdownToBlocks } from '../utils/markdownToBlocks';
import { normalizeSticker, pointerToStickerPoint, STICKER_STAGE_HEIGHT, stickerPlacementStyle } from '../utils/stickerPlacement';

const stickerFromContent = (sticker, index) => {
  const normalized = normalizeSticker(sticker);

  return {
    id: sticker.id || `${Date.now()}-sticker-${index}`,
    url: sticker.url,
    ...normalized,
    placed: sticker.placed ?? true
  };
};

const blockFromContent = (block, index) => {
  const stickers = block.type === 'stickers' ? (block.items || []).map(stickerFromContent) : block.type === 'sticker' ? [stickerFromContent(block, 0)] : [];
  const value = block.type === 'list' ? (block.items || []).join('\n') : block.type === 'checklist' ? checklistTextFromItems(block.items) : block.caption || block.value || block.defaultCode || '';
  return {
    id: `${Date.now()}-${index}`,
    type: block.type === 'sticker' ? 'stickers' : block.type,
    value,
    language: block.language,
    url: block.url,
    x: block.x || 0,
    y: block.y || 0,
    width: block.width || 180,
    rotation: block.rotation || 0,
    galleryFiles: block.type === 'gallery' ? [] : undefined,
    stickers,
    selectedStickerId: stickers[0]?.id || null
  };
};

const formSignature = ({ recordType, projectName, version, pageTitle, blocks }) => JSON.stringify({
  recordType,
  projectName,
  version,
  pageTitle,
  blocks: blocks.map(({ type, value, language, url, file, x, y, width, rotation, stickers, galleryFiles }) => ({
    type,
    value,
    language,
    url,
    fileName: file?.name || '',
    x,
    y,
    width,
    rotation,
    galleryFiles: galleryFiles?.map((galleryFile) => galleryFile.file?.name || ''),
    stickers: stickers?.map(({ url, file, x, y, width, rotation, placed }) => ({ url, fileName: file?.name || '', x, y, width, rotation, placed }))
  }))
});

const previewBlockForRender = (block) => {
  if (block.type === 'list') {
    return { ...block, items: block.value.split('\n').map((item) => item.trim()).filter(Boolean) };
  }
  if (block.type === 'checklist') {
    return {
      ...block,
      items: checklistItemsFromText(block.value)
    };
  }
  if (block.type === 'image') {
    return { ...block, url: block.previewUrl || block.url, caption: block.value };
  }
  if (block.type === 'playground') {
    return { ...block, defaultCode: block.value };
  }
  if (block.type === 'gallery') {
    return {
      ...block,
      value: [
        block.value,
        ...(block.galleryFiles || []).map((galleryFile) => galleryFile.previewUrl)
      ].filter(Boolean).join('\n')
    };
  }
  if (block.type === 'stickers') {
    return {
      ...block,
      items: (block.stickers || []).map((sticker) => ({
        ...sticker,
        url: sticker.previewUrl || sticker.url
      }))
    };
  }
  return block;
};

const ARCHIVOLT_PROMPT = [
  'Create an Archivolt documentation note for the code/function/file I provide.',
  '',
  'Return Markdown only. Follow this exact format:',
  '',
  '# [Short title]',
  '',
  '## Purpose',
  'Explain what this code does in 1-3 short paragraphs.',
  '',
  '## Code',
  '```js',
  '[paste the most important code here]',
  '```',
  '',
  '## How It Works',
  '- Explain the main steps',
  '- Mention inputs and outputs',
  '- Mention where data is saved or returned',
  '',
  '## Usage',
  '```js',
  '[show a realistic usage example]',
  '```',
  '',
  '## Notes',
  '- Mention edge cases',
  '- Mention related files/functions',
  '- Mention anything future me should remember',
  '',
  'Rules:',
  '- Do not add intro text before the Markdown.',
  '- Do not add closing commentary after the Markdown.',
  '- Keep it practical, like internal project notes.',
  '- If the language is not JavaScript, change the code fence language.',
  '- Use headings, bullet lists, paragraphs, and fenced code blocks only.',
  '',
  'Document this code:',
  '',
  '[paste code/function/file here]'
].join('\n');

export const DataEntryForm = ({ onSave, onCancel, onDelete, onDirtyChange, activeColorTheme: theme, activeProject, confirmAction, initialData = null, mode = 'create', notify = () => {}, renderContent }) => {
  const isEditing = mode === 'edit';
  // Form States
  const [recordType, setRecordType] = useState(initialData?.recordType || 'document');
  const [projectName, setProjectName] = useState('');
  const [version, setVersion] = useState(initialData?.version || 'CODE_009 // TEST');
  const [pageTitle, setPageTitle] = useState(initialData?.pageTitle || 'NEW REC');
  const [isSaving, setIsSaving] = useState(false);
  const [markdownInput, setMarkdownInput] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);
  const [collapsedBlockIds, setCollapsedBlockIds] = useState(() => new Set());
  const [canUndoBlocks, setCanUndoBlocks] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Blocks list state - initialized with a Heading block and a Text block
  const [blocks, setBlocks] = useState(() => {
    if (!initialData?.blocks) {
      return [
        { id: '1', type: 'heading', value: 'NEW SECTION' },
        { id: '2', type: 'text', value: 'Enter description or notes here...' }
      ];
    }
    const mapped = initialData.blocks.map(blockFromContent);
    const stickerBlocks = mapped.filter((block) => block.type === 'stickers');
    if (stickerBlocks.length <= 1) return mapped;

    return [
      ...mapped.filter((block) => block.type !== 'stickers'),
      {
        ...stickerBlocks[0],
        stickers: stickerBlocks.flatMap((block) => block.stickers),
        selectedStickerId: stickerBlocks[0].stickers[0]?.id || null
      }
    ];
  });
  const undoBlocksRef = useRef(null);
  const currentSignature = useMemo(
    () => formSignature({ recordType, projectName, version, pageTitle, blocks }),
    [recordType, projectName, version, pageTitle, blocks]
  );
  const [initialSignature] = useState(currentSignature);
  const isDirty = currentSignature !== initialSignature;

  // Drag states
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragReadyBlockId, setDragReadyBlockId] = useState(null);
  const hasStickerBlock = blocks.some((block) => block.type === 'stickers');
  const insertButtons = [
    ['heading', Heading1, 'HEADING'],
    ['text', Pilcrow, 'NOTE / TEXT'],
    ['blackboard', PanelTop, 'BLACKBOARD'],
    ['code', Code, 'CODE BLOCK'],
    ['playground', Play, 'PLAYGROUND'],
    ['list', List, 'LIST'],
    ['checklist', ListChecks, 'CHECKLIST'],
    ['image', Image, 'IMAGE'],
    ['gallery', FolderOpen, 'GALLERY'],
    ['stickers', Sticker, 'STICKERS', hasStickerBlock]
  ];

  const blockSummary = (block) => {
    if (block.type === 'stickers') return `${block.stickers?.filter((sticker) => sticker.placed).length || 0}/${block.stickers?.length || 0} placed`;
    if (block.type === 'image') return block.file?.name || block.url || 'No image';
    return (block.value || block.type).replace(/\s+/g, ' ').slice(0, 42);
  };

  const addBlockGroupBreaks = new Set(['playground', 'checklist']);
  const renderAddBlockButtons = (buttonClassName = '') => insertButtons.map(([type, Icon, label, isUnavailable]) => {
    const tooltip = isUnavailable ? 'Sticker block already exists' : `Add ${label.toLowerCase()}`;

    return (
      <React.Fragment key={type}>
        <button
          type="button"
          onClick={() => {
            if (isUnavailable) {
              setIsPreviewing(false);
              notify('Sticker block already exists');
              return;
            }
            addBlock(type);
          }}
          className={cn("editor-add-button grid h-9 w-9 shrink-0 place-items-center border cursor-pointer transition-colors hover:bg-[rgba(255,255,255,0.05)]", buttonClassName)}
          style={{ borderColor: theme.borderColor, color: theme.textColor, borderRadius: '4px', background: 'transparent', opacity: isUnavailable ? 0.45 : 1 }}
          title={tooltip}
          aria-label={tooltip}
          aria-disabled={isUnavailable}
          data-tooltip={tooltip}
        >
          <Icon className="w-4 h-4" />
        </button>
        {addBlockGroupBreaks.has(type) && <span className="editor-add-divider" aria-hidden="true" />}
      </React.Fragment>
    );
  });

  const toggleBlockCollapsed = (id) => {
    setCollapsedBlockIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clampPercent = (value) => Math.min(100, Math.max(0, Number(value) || 0));

  const updateBlocks = (updater) => {
    setBlocks((prev) => {
      undoBlocksRef.current = prev;
      setCanUndoBlocks(true);
      return typeof updater === 'function' ? updater(prev) : updater;
    });
  };

  const undoBlocks = () => {
    if (!undoBlocksRef.current) return;
    setBlocks(undoBlocksRef.current);
    undoBlocksRef.current = null;
    setCanUndoBlocks(false);
  };

  useEffect(() => {
    onDirtyChange?.(currentSignature !== initialSignature);
  }, [currentSignature, initialSignature, onDirtyChange]);

  // Actions
  const addBlock = (type) => {
    let defaultVal = '';
    if (type === 'blackboard') {
      defaultVal = '{\n  "title": "System map",\n  "nodes": [\n    { "id": "input", "label": "Input" },\n    { "id": "model", "label": "Model" },\n    { "id": "board", "label": "Board" }\n  ],\n  "edges": [\n    { "from": "input", "to": "model", "label": "prompt" },\n    { "from": "model", "to": "board", "label": "graph" }\n  ]\n}';
    }
    if (type === 'playground') {
      defaultVal = "<style>\n  body { background: #111; color: #e4decd; font-family: monospace; padding: 2rem; }\n  button { background: #e4decd; color: #111; border: 1px solid #111; padding: 0.5rem 1rem; cursor: pointer; font-weight: bold; box-shadow: 2px 2px 0px #000; transition: all 0.1s ease; }\n  button:hover { background: #f0ebd9; transform: translate(-1px, -1px); box-shadow: 3px 3px 0px #000; }\n  button:active { background: #c3baa2; transform: translate(1px, 1px); box-shadow: 1px 1px 0px #000; }\n</style>\n\n<h1>>> READY</h1>\n<p id=\"state\">IDLE</p>\n<button onclick=\"document.getElementById('state').textContent='RUNNING'\">CLICK</button>";
    }
    if (type === 'list') {
      defaultVal = 'First item\nSecond item';
    }
    if (type === 'checklist') {
      defaultVal = '[ ] ';
    }
    if (type === 'gallery') {
      defaultVal = [
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1604871000636-074fa5117945?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?q=80&w=800&auto=format&fit=crop'
      ].join('\n');
    }
    const newBlock = {
      id: `${Date.now()}${Math.random().toString(36).substr(2, 5)}`,
      type,
      value: defaultVal,
      language: type === 'code' ? 'javascript' : type === 'gallery' ? 'VISUAL_REFERENCES.gallery' : undefined,
      galleryFiles: type === 'gallery' ? [] : undefined,
      stickers: type === 'stickers' ? [] : undefined,
      selectedStickerId: null
    };
    updateBlocks((prev) => [...prev, newBlock]);
  };

  const importMarkdown = async () => {
    if (!markdownInput.trim()) {
      notify('Markdown input is empty', 'danger');
      return;
    }
    if (blocks.length && confirmAction && !await confirmAction({
      title: 'Import markdown',
      message: 'Replace current unsaved blocks with imported Markdown?',
      confirmText: 'Import'
    })) return;
    updateBlocks(markdownToBlocks(markdownInput));
    notify('Markdown imported', 'success');
  };

  const copyArchivoltPrompt = () => {
    navigator.clipboard.writeText(ARCHIVOLT_PROMPT).then(() => {
      setPromptCopied(true);
      notify('Prompt copied', 'success');
      setTimeout(() => setPromptCopied(false), 2000);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = ARCHIVOLT_PROMPT;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setPromptCopied(true);
      notify('Prompt copied', 'success');
      setTimeout(() => setPromptCopied(false), 2000);
    });
  };

  const removeBlock = (id) => {
    updateBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const updateBlockValue = (id, val) => {
    updateBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, value: val } : b))
    );
  };

  const updateBlockLanguage = (id, lang) => {
    updateBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, language: lang } : b))
    );
  };

  const updateChecklistItems = (id, updater) => {
    updateBlocks((prev) => prev.map((b) => {
      if (b.id !== id) return b;
      const items = updater(checklistItemsFromText(b.value, { keepEmpty: true, preserveWhitespace: true }));
      return { ...b, value: checklistTextFromItems(items) };
    }));
  };

  const updateBlockFile = (id, file) => {
    updateBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, file, previewUrl: file ? URL.createObjectURL(file) : '' } : b))
    );
  };

  const addGalleryFiles = (id, files) => {
    const galleryFiles = Array.from(files || []).map((file) => ({
      id: `${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
      file,
      previewUrl: URL.createObjectURL(file)
    }));
    updateBlocks((prev) => prev.map((b) => b.id === id ? {
      ...b,
      galleryFiles: [...(b.galleryFiles || []), ...galleryFiles]
    } : b));
  };

  const deleteGalleryFile = (blockId, fileId) => {
    updateBlocks((prev) => prev.map((b) => b.id === blockId ? {
      ...b,
      galleryFiles: (b.galleryFiles || []).filter((galleryFile) => galleryFile.id !== fileId)
    } : b));
  };

  const updateBlockMeta = (id, key, value) => {
    updateBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [key]: value } : b))
    );
  };

  const addStickerFiles = (id, files) => {
    const nextStickers = Array.from(files || []).map((file) => ({
      id: `${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      x: 50,
      y: 50,
      width: 22,
      rotation: 0,
      placed: false
    }));
    updateBlocks((prev) => prev.map((b) => b.id === id ? {
      ...b,
      stickers: [...(b.stickers || []), ...nextStickers],
      selectedStickerId: b.selectedStickerId || (nextStickers.length === 1 ? nextStickers[0]?.id : null)
    } : b));
  };

  const updateSelectedSticker = (blockId, patch) => {
    updateBlocks((prev) => prev.map((b) => b.id === blockId ? {
      ...b,
      stickers: (b.stickers || []).map((sticker) => sticker.id === b.selectedStickerId ? { ...sticker, ...patch } : sticker)
    } : b));
  };

  const deleteSelectedSticker = (blockId) => {
    updateBlocks((prev) => prev.map((b) => {
      if (b.id !== blockId) return b;
      const stickers = (b.stickers || []).filter((sticker) => sticker.id !== b.selectedStickerId);
      return { ...b, stickers, selectedStickerId: stickers[0]?.id || null };
    }));
  };

  const deleteSticker = (blockId, stickerId) => {
    updateBlocks((prev) => prev.map((b) => {
      if (b.id !== blockId) return b;
      const stickers = (b.stickers || []).filter((sticker) => sticker.id !== stickerId);
      return { ...b, stickers, selectedStickerId: b.selectedStickerId === stickerId ? stickers[0]?.id || null : b.selectedStickerId };
    }));
  };

  const placeSelectedSticker = (blockId, target, clientX, clientY) => {
    updateSelectedSticker(blockId, {
      ...pointerToStickerPoint(clientX, clientY, target.getBoundingClientRect()),
      placed: true
    });
  };

  const nudgeSelectedSticker = (blockId, sticker, dx, dy) => {
    updateSelectedSticker(blockId, {
      x: clampPercent(Number(sticker.x ?? 50) + dx),
      y: clampPercent(Number(sticker.y ?? 50) + dy),
      placed: true
    });
  };

  // HTML5 Drag Handlers
  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    updateBlocks((prev) => {
      const next = [...prev];
      const [item] = next.splice(draggedIndex, 1);
      next.splice(index, 0, item);
      return next;
    });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragReadyBlockId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pageTitle.trim()) {
      notify('PAGE_TITLE is required', 'danger');
      return;
    }
    if (recordType === 'project' && !projectName.trim()) {
      notify('DIRECTORY_NAME is required', 'danger');
      return;
    }
    if (blocks.length === 0) {
      notify('At least one content block is required', 'danger');
      return;
    }

    // Validate that all blocks have content
    for (let i = 0; i < blocks.length; i++) {
      if (['image', 'sticker'].includes(blocks[i].type) && !blocks[i].file && !blocks[i].url) {
        notify(`Block #${i + 1} needs an image file`, 'danger');
        return;
      }
      if (blocks[i].type === 'stickers' && !blocks[i].stickers?.some((sticker) => sticker.placed)) {
        notify(`Block #${i + 1} needs at least one placed sticker`, 'danger');
        return;
      }
      if (blocks[i].type === 'gallery' && !blocks[i].value.trim() && !blocks[i].galleryFiles?.length) {
        notify(`Block #${i + 1} needs at least one gallery image`, 'danger');
        return;
      }
      if (!['image', 'sticker', 'stickers', 'demo-input', 'gallery'].includes(blocks[i].type) && !blocks[i].value.trim()) {
        notify(`Block #${i + 1} (${blocks[i].type.toUpperCase()}) cannot be empty`, 'danger');
        return;
      }
    }

    setIsSaving(true);
    try {
      await onSave({
        recordType,
        projectName,
        version,
        pageTitle,
        blocks
      });
    } catch (error) {
      notify(error.message, 'danger');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-fade-in text-inherit">
      <div className="flex items-center justify-between gap-4 mb-8 pb-4" style={{ borderBottom: `2px solid ${theme.textColor}` }}>
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-2xl font-bold uppercase" style={{ letterSpacing: '-0.03em' }}>DATA ENTRY TERMINAL</h2>
            <span
              className="border px-2 py-1 font-mono-tech text-[9px] font-bold uppercase"
              style={{ borderColor: isDirty ? theme.textColor : theme.borderColor, opacity: isDirty ? 1 : 0.5 }}
              aria-live="polite"
            >
              {isDirty ? 'UNSAVED' : 'SAVED'}
            </span>
          </div>
          <p className="font-mono-tech mt-1" style={{ fontSize: '10px', opacity: 0.6 }}>
            {isEditing ? `EDITING: ${pageTitle}` : recordType === 'document' ? `AWAITING NEW DOCUMENT LOG FOR ${activeProject ? activeProject.name : ''}` : 'AWAITING NEW DIRECTORY INPUT...'}
          </p>
        </div>
        <button type="button" onClick={onCancel} className="p-2 transition-colors cursor-pointer" style={{ border: `1px solid ${theme.textColor}`, background: 'transparent', color: 'inherit' }} aria-label="Close editor">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" aria-label="Data entry form">
        {/* Record Type Selector */}
        {!isEditing && <div className="space-y-2 mb-6">
          <label className="font-mono-tech uppercase font-bold block" style={{ fontSize: '9px', letterSpacing: '0.12em' }}>RECORD_TYPE</label>
          <div className="retro-toggle-group" style={{ borderColor: theme.textColor }}>
            <button
              type="button"
              onClick={() => { setRecordType('document'); setVersion('CODE_009 // TEST'); }}
              className="retro-toggle-btn cursor-pointer"
              style={recordType === 'document' ? { backgroundColor: theme.textColor, color: theme.bgColor } : { color: theme.textColor }}
            >
              DOCUMENT
            </button>
            <button
              type="button"
              onClick={() => { setRecordType('project'); setVersion('01-NEW'); }}
              className="retro-toggle-btn cursor-pointer"
              style={recordType === 'project' ? { backgroundColor: theme.textColor, color: theme.bgColor } : { color: theme.textColor }}
            >
              PROJECT
            </button>
          </div>
        </div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {recordType === 'document' ? (
            <div className="space-y-2">
              <label className="font-mono-tech uppercase font-bold block" style={{ fontSize: '9px', letterSpacing: '0.12em' }}>TARGET_PROJECT</label>
              <input type="text" disabled value={activeProject ? activeProject.name : ''}
                aria-label="Target project"
                className="w-full p-3 bg-transparent font-mono-tech focus:outline-none uppercase opacity-60"
                style={{ border: `1px dashed ${theme.textColor}`, fontSize: '13px', cursor: 'not-allowed' }} />
            </div>
          ) : (
            <div className="space-y-2">
              <label className="font-mono-tech uppercase font-bold block" style={{ fontSize: '9px', letterSpacing: '0.12em' }}>DIRECTORY_NAME</label>
              <input type="text" required placeholder="e.g. SYSTEM_CORE" value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                aria-label="Directory name"
                className="w-full p-3 bg-transparent font-mono-tech focus:outline-none uppercase"
                style={{ border: `1px solid ${theme.textColor}`, fontSize: '13px', color: 'inherit' }} />
            </div>
          )}

          <div className="space-y-2">
            <label className="font-mono-tech uppercase font-bold block" style={{ fontSize: '9px', letterSpacing: '0.12em' }}>
              {recordType === 'document' ? 'SUBTITLE_STAMP' : 'VERSION_TAG'}
            </label>
            <input type="text" value={version}
              onChange={(e) => setVersion(e.target.value)}
              aria-label={recordType === 'document' ? 'Subtitle stamp' : 'Version tag'}
              className="w-full p-3 bg-transparent font-mono-tech focus:outline-none uppercase"
              style={{ border: `1px solid ${theme.textColor}`, fontSize: '13px', color: 'inherit' }} />
          </div>
        </div>

        <div className="space-y-2">
          <label className="font-mono-tech uppercase font-bold block" style={{ fontSize: '9px', letterSpacing: '0.12em' }}>PAGE_TITLE</label>
          <input type="text" required value={pageTitle}
            onChange={(e) => setPageTitle(e.target.value)}
            aria-label="Page title"
            className="w-full p-3 bg-transparent font-mono-tech focus:outline-none uppercase"
            style={{ border: `1px solid ${theme.textColor}`, fontSize: '13px', color: 'inherit' }} />
        </div>

        {/* Dynamic Blocks Section */}
        <div className="space-y-3">
          <div className="editor-toolbar sticky top-0 z-20 border-b px-2 py-2 backdrop-blur" style={{ borderColor: theme.borderColor, background: theme.bgColor }}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-baseline gap-3">
                <label className="font-mono-tech uppercase font-bold" style={{ fontSize: '9px', letterSpacing: '0.12em' }}>DOCUMENT_STRUCTURE</label>
                <span className="font-mono-tech text-[9px] uppercase opacity-45">{blocks.length} blocks</span>
              </div>
              <div className="retro-toggle-group editor-mode-toggle shrink-0" style={{ borderColor: theme.textColor }}>
                <button
                  type="button"
                  onClick={() => setIsPreviewing(false)}
                  className="retro-toggle-btn cursor-pointer flex items-center gap-1.5"
                  style={!isPreviewing ? { backgroundColor: theme.textColor, color: theme.bgColor } : { color: theme.textColor }}
                >
                  <Pencil className="w-3.5 h-3.5" /> EDIT
                </button>
                <button
                  type="button"
                  onClick={() => setIsPreviewing(true)}
                  className="retro-toggle-btn cursor-pointer flex items-center gap-1.5"
                  style={isPreviewing ? { backgroundColor: theme.textColor, color: theme.bgColor } : { color: theme.textColor }}
                >
                  <Eye className="w-3.5 h-3.5" /> PREVIEW
                </button>
              </div>
            </div>
            <div className="editor-toolbar-add flex items-center gap-2">
              <span className="shrink-0 font-mono-tech text-[9px] uppercase opacity-50">ADD</span>
              <div className="editor-add-tray">
                {renderAddBlockButtons()}
              </div>
            </div>
          </div>
          
          <div className="editor-workspace">
            <aside
              className="editor-add-rail"
              aria-label="Add content block"
              style={{ borderColor: theme.borderColor, background: theme.bgColor }}
            >
              <span className="font-mono-tech text-[9px] uppercase opacity-50">ADD</span>
              <div className="editor-add-tray editor-add-tray--rail">
                {renderAddBlockButtons('editor-add-rail__button')}
              </div>
            </aside>
            <div className={`editor-workspace__edit ${isPreviewing ? 'is-hidden-mobile' : ''}`}>
              <div className="block-editor-list">
              {blocks.map((block, index) => {
              const isDragged = draggedIndex === index;
              const isCollapsed = collapsedBlockIds.has(block.id);
              const selectedSticker = block.stickers?.find((sticker) => sticker.id === block.selectedStickerId);

              return (
                <div
                  key={block.id}
                  draggable={dragReadyBlockId === block.id}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={cn("block-editor-item", isDragged ? "dragging" : "")}
                  style={{ color: 'inherit' }}
                >
                  {/* Grip handle and index */}
                  <div className="flex flex-col items-center gap-1.5 self-stretch justify-start pt-1.5">
                    <div
                      className="block-drag-handle"
                      onMouseDown={() => setDragReadyBlockId(block.id)}
                      onMouseUp={() => setDragReadyBlockId(null)}
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>
                    <span className="font-mono-tech text-[9px] opacity-40">{String(index + 1).padStart(2, '0')}</span>
                  </div>

                  {/* Block content editor */}
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleBlockCollapsed(block.id)}
                      className="mb-3 flex w-full items-center justify-between gap-3 text-left font-mono-tech uppercase"
                      style={{ color: 'inherit' }}
                      aria-expanded={!isCollapsed}
                    >
                      <span className="text-[10px] font-bold">{block.type}</span>
                      <span className="min-w-0 flex-1 truncate text-[10px] opacity-45">{blockSummary(block)}</span>
                      {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </button>
                    <div hidden={isCollapsed}>
                    {block.type === 'heading' && (
                      <div>
                        <label className="font-mono-tech block text-[9px] uppercase opacity-45 mb-1">HEADING</label>
                        <input
                          type="text"
                          value={block.value}
                          onChange={(e) => updateBlockValue(block.id, e.target.value)}
                          aria-label={`Heading block ${index + 1}`}
                          className="w-full p-2 bg-transparent font-serif font-bold uppercase focus:outline-none"
                          style={{ borderBottom: `1px solid ${theme.textColor}`, fontSize: '15px', color: 'inherit' }}
                          placeholder="SECTION HEADING..."
                          required
                        />
                      </div>
                    )}

                    {block.type === 'text' && (
                      <div>
                        <label className="font-mono-tech block text-[9px] uppercase opacity-45 mb-1">NOTE / TEXT</label>
                        <textarea
                          value={block.value}
                          onChange={(e) => updateBlockValue(block.id, e.target.value)}
                          aria-label={`Text block ${index + 1}`}
                          className="w-full p-2 bg-transparent font-mono-tech focus:outline-none resize-y"
                          style={{ borderBottom: `1px solid ${theme.textColor}`, fontSize: '13px', minHeight: '60px', color: 'inherit' }}
                          placeholder="Write notes or description here..."
                          required
                        />
                      </div>
                    )}

                    {block.type === 'blackboard' && (
                      <div>
                        <label className="font-mono-tech block text-[9px] uppercase opacity-45 mb-1">BLACKBOARD AUTO DETECT</label>
                        <textarea
                          value={block.value}
                          onChange={(e) => updateBlockValue(block.id, e.target.value)}
                          aria-label={`Blackboard block ${index + 1}`}
                          className="w-full p-3 font-mono-tech focus:outline-none resize-y"
                          style={{
                            background: 'rgba(0,0,0,0.3)',
                            border: `1px solid ${theme.borderColor}`,
                            color: '#e4decd',
                            fontSize: '12px',
                            minHeight: '180px'
                          }}
                          placeholder={'Paste Mermaid, graph JSON, chart JSON, or notes...\n\nExample:\n{\n  "type": "bar",\n  "labels": ["Q1", "Q2"],\n  "values": [12, 19]\n}'}
                          required
                          spellCheck="false"
                        />
                      </div>
                    )}

                    {block.type === 'code' && (
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="font-mono-tech block text-[9px] uppercase opacity-45">CODE BLOCK</label>
                          <div className="flex items-center text-[10px]" style={{ color: theme.textColor }}>
                            <span className="font-mono-tech uppercase opacity-50 mr-1.5">LANG:</span>
                            <select
                              value={block.language || 'javascript'}
                              onChange={(e) => updateBlockLanguage(block.id, e.target.value)}
                              aria-label={`Code language for block ${index + 1}`}
                              className="bg-transparent font-mono-tech focus:outline-none uppercase cursor-pointer"
                              style={{ color: 'inherit' }}
                            >
                              <option value="javascript" style={{ color: '#1a1b1c', background: '#e4decd' }}>JavaScript</option>
                              <option value="typescript" style={{ color: '#1a1b1c', background: '#e4decd' }}>TypeScript</option>
                              <option value="html" style={{ color: '#1a1b1c', background: '#e4decd' }}>HTML</option>
                              <option value="bash" style={{ color: '#1a1b1c', background: '#e4decd' }}>Bash</option>
                              <option value="css" style={{ color: '#1a1b1c', background: '#e4decd' }}>CSS</option>
                            </select>
                          </div>
                        </div>
                        <textarea
                          value={block.value}
                          onChange={(e) => updateBlockValue(block.id, e.target.value)}
                          aria-label={`Code block ${index + 1}`}
                          className="w-full p-3 font-mono-tech focus:outline-none resize-y"
                          style={{
                            background: 'rgba(0,0,0,0.3)',
                            border: `1px solid ${theme.borderColor}`,
                            color: '#e4decd',
                            fontSize: '12px',
                            minHeight: '100px'
                          }}
                          placeholder="// Write code here..."
                          required
                          spellCheck="false"
                        />
                      </div>
                    )}

                    {block.type === 'playground' && (
                      <div>
                        <label className="font-mono-tech block text-[9px] uppercase opacity-45 mb-1">LIVE PLAYGROUND</label>
                        <textarea
                          value={block.value}
                          onChange={(e) => updateBlockValue(block.id, e.target.value)}
                          aria-label={`Playground block ${index + 1}`}
                          className="w-full p-3 font-mono-tech focus:outline-none resize-y"
                          style={{
                            background: 'rgba(0,0,0,0.3)',
                            border: `1px solid ${theme.borderColor}`,
                            color: '#e4decd',
                            fontSize: '12px',
                            minHeight: '100px'
                          }}
                          placeholder="<!-- Write HTML, style and script here -->"
                          required
                          spellCheck="false"
                        />
                      </div>
                    )}

                    {block.type === 'gallery' && (
                      <div className="space-y-3">
                        <div>
                          <label className="font-mono-tech block text-[9px] uppercase opacity-45 mb-1">FOLDER NAME</label>
                          <input
                            type="text"
                            value={block.language || ''}
                            onChange={(e) => updateBlockLanguage(block.id, e.target.value)}
                            aria-label={`Gallery folder name for block ${index + 1}`}
                            className="w-full p-2 bg-transparent font-mono-tech focus:outline-none"
                            style={{ borderBottom: `1px solid ${theme.textColor}`, fontSize: '13px', color: 'inherit' }}
                            placeholder="VISUAL_REFERENCES.gallery"
                          />
                        </div>
                        <div>
                          <label className="font-mono-tech block text-[9px] uppercase opacity-45 mb-1">IMAGE URLS</label>
                          <textarea
                            value={block.value}
                            onChange={(e) => updateBlockValue(block.id, e.target.value)}
                            aria-label={`Gallery image URLs for block ${index + 1}`}
                            className="w-full p-3 font-mono-tech focus:outline-none resize-y"
                            style={{
                              background: 'rgba(0,0,0,0.3)',
                              border: `1px solid ${theme.borderColor}`,
                              color: '#e4decd',
                              fontSize: '12px',
                              minHeight: '100px'
                            }}
                            placeholder="One image URL per line..."
                          />
                        </div>
                        <input
                          id={`gallery-upload-${block.id}`}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => addGalleryFiles(block.id, e.target.files)}
                          aria-label={`Gallery files for block ${index + 1}`}
                          className="sr-only"
                        />
                        <div className="flex flex-wrap items-center gap-3">
                          <label
                            htmlFor={`gallery-upload-${block.id}`}
                            className="inline-flex items-center gap-2 border px-3 py-2 font-mono-tech text-[10px] uppercase cursor-pointer transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                            style={{ borderColor: theme.textColor, color: theme.textColor }}
                          >
                            <Upload size={14} /> Upload Images
                          </label>
                          <span className="font-mono-tech text-[10px] uppercase opacity-55">
                            {(block.galleryFiles || []).length ? `${block.galleryFiles.length} pending upload` : 'Paste URLs or upload files'}
                          </span>
                        </div>
                        {!!block.galleryFiles?.length && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {block.galleryFiles.map((galleryFile) => (
                              <div
                                key={galleryFile.id}
                                className="relative h-20 w-20"
                                style={{ border: `1px solid ${theme.borderColor}` }}
                              >
                                <img src={galleryFile.previewUrl} alt="" className="h-full w-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => deleteGalleryFile(block.id, galleryFile.id)}
                                  className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center border cursor-pointer opacity-75 transition-opacity hover:opacity-100"
                                  style={{ borderColor: theme.borderColor, background: theme.bgColor, color: theme.textColor }}
                                  aria-label="Remove gallery image"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {block.type === 'list' && (
                      <div>
                        <label className="font-mono-tech block text-[9px] uppercase opacity-45 mb-1">LIST ITEMS</label>
                        <textarea
                          value={block.value}
                          onChange={(e) => updateBlockValue(block.id, e.target.value)}
                          aria-label={`List block ${index + 1}`}
                          className="w-full p-2 bg-transparent font-mono-tech focus:outline-none resize-y"
                          style={{ borderBottom: `1px solid ${theme.textColor}`, fontSize: '13px', minHeight: '80px', color: 'inherit' }}
                          placeholder="One item per line..."
                          required
                        />
                      </div>
                    )}

                    {block.type === 'checklist' && (
                      <div>
                        <label className="font-mono-tech block text-[9px] uppercase opacity-45 mb-2">CHECKLIST ITEMS</label>
                        <div className="space-y-2">
                          {checklistItemsFromText(block.value, { keepEmpty: true, preserveWhitespace: true }).map((item, itemIndex) => (
                            <div
                              key={itemIndex}
                              className="flex items-center gap-2 p-2"
                              style={{
                                border: `1px solid ${item.checked ? 'rgba(40,200,64,0.35)' : theme.borderColor}`,
                                background: item.checked ? 'rgba(40,200,64,0.08)' : 'rgba(0,0,0,0.08)',
                                borderRadius: '6px'
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => updateChecklistItems(block.id, (items) => items.map((nextItem, index) => index === itemIndex ? { ...nextItem, checked: !nextItem.checked } : nextItem))}
                                className="grid h-8 w-8 shrink-0 place-items-center border font-mono-tech text-xs cursor-pointer transition-colors"
                                style={{ borderColor: item.checked ? '#28c840' : theme.borderColor, color: theme.textColor, background: item.checked ? '#28c840' : 'transparent' }}
                                aria-label={item.checked ? 'Mark checklist item incomplete' : 'Mark checklist item complete'}
                              >
                                <span style={{ color: item.checked ? '#111' : theme.textColor }}>{item.checked ? 'X' : ''}</span>
                              </button>
                              <input
                                type="text"
                                value={item.text}
                                onChange={(e) => updateChecklistItems(block.id, (items) => items.map((nextItem, index) => index === itemIndex ? { ...nextItem, text: e.target.value } : nextItem))}
                                aria-label={`Checklist item ${itemIndex + 1}`}
                                className="min-w-0 flex-1 p-2 bg-transparent font-mono-tech focus:outline-none"
                                style={{ borderBottom: `1px solid ${theme.borderColor}`, fontSize: '13px', color: 'inherit', textDecoration: item.checked ? 'line-through' : 'none', opacity: item.checked ? 0.6 : 1 }}
                                placeholder="Checklist item..."
                              />
                              <button
                                type="button"
                                onClick={() => updateChecklistItems(block.id, (items) => items.filter((_, index) => index !== itemIndex))}
                                className="block-action-btn cursor-pointer"
                                style={{ color: '#ff5f57', borderColor: 'rgba(255,95,87,0.3)' }}
                                aria-label="Remove checklist item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => updateChecklistItems(block.id, (items) => [...items, { checked: false, text: '' }])}
                          className="mt-3 px-3 py-2 border font-mono-tech text-[10px] uppercase cursor-pointer hover:bg-[rgba(255,255,255,0.05)] transition-colors flex items-center gap-1.5"
                          style={{ borderColor: theme.textColor, color: theme.textColor, borderRadius: '4px', background: 'transparent' }}
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Item
                        </button>
                      </div>
                    )}

                    {block.type === 'image' && (
                      <div>
                        <label className="font-mono-tech block text-[9px] uppercase opacity-45 mb-2">IMAGE</label>
                        {(block.previewUrl || block.url) && (
                          <div className="mb-3 inline-block p-2" style={{ border: `1px solid ${theme.borderColor}`, background: 'rgba(0,0,0,0.12)' }}>
                            <img src={block.previewUrl || block.url} alt="" className="max-h-36 w-auto" />
                          </div>
                        )}
                        <input
                          id={`image-upload-${block.id}`}
                          type="file"
                          accept="image/*"
                          onChange={(e) => updateBlockFile(block.id, e.target.files[0])}
                          aria-label={`Image file for block ${index + 1}`}
                          className="sr-only"
                        />
                        <div className="flex flex-wrap items-center gap-3">
                          <label
                            htmlFor={`image-upload-${block.id}`}
                            className="inline-flex h-10 items-center gap-2 px-3 border font-mono-tech text-[10px] uppercase cursor-pointer transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                            style={{ borderColor: theme.textColor, color: theme.textColor }}
                          >
                            <Upload size={14} /> Choose Image
                          </label>
                          <span className="font-mono-tech text-[10px] uppercase opacity-55">
                            {block.file?.name || (block.url ? 'Image loaded' : 'No image selected')}
                          </span>
                        </div>
                        <input
                          type="text"
                          value={block.value}
                          onChange={(e) => updateBlockValue(block.id, e.target.value)}
                          aria-label={`Image caption for block ${index + 1}`}
                          className="w-full mt-2 p-2 bg-transparent font-mono-tech focus:outline-none"
                          style={{ borderBottom: `1px solid ${theme.textColor}`, fontSize: '12px', color: 'inherit' }}
                          placeholder="Caption..."
                        />
                      </div>
                    )}

                    {block.type === 'stickers' && (
                      <div>
                        <label className="font-mono-tech block text-[9px] uppercase opacity-45 mb-2">STICKERS</label>
                        <div className="flex flex-wrap items-center gap-3">
                          <input
                            id={`sticker-upload-${block.id}`}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => addStickerFiles(block.id, e.target.files)}
                            aria-label={`Sticker files for block ${index + 1}`}
                            className="sr-only"
                          />
                          <label
                            htmlFor={`sticker-upload-${block.id}`}
                            className="inline-flex h-10 items-center gap-2 px-3 border font-mono-tech text-[10px] uppercase cursor-pointer transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                            style={{ borderColor: theme.textColor, color: theme.textColor }}
                          >
                            <Upload size={14} /> Add Stickers
                          </label>
                          <span className="font-mono-tech text-[10px] uppercase opacity-55">
                            {block.stickers?.length ? `${block.stickers.length} loaded` : 'No stickers yet'}
                          </span>
                        </div>
                        {!!block.stickers?.length && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {block.stickers.map((sticker) => (
                              <div
                                key={sticker.id}
                                className="relative h-14 w-14"
                                style={{ border: `2px solid ${sticker.id === selectedSticker?.id ? theme.textColor : theme.borderColor}` }}
                              >
                                <button
                                  type="button"
                                  onClick={() => updateBlockMeta(block.id, 'selectedStickerId', sticker.id)}
                                  className="h-full w-full overflow-hidden cursor-pointer"
                                  aria-label="Select sticker"
                                >
                                  <img src={sticker.previewUrl || sticker.url} alt="" className="h-full w-full object-cover" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteSticker(block.id, sticker.id)}
                                  className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center border cursor-pointer opacity-75 transition-opacity hover:opacity-100"
                                  style={{ borderColor: theme.borderColor, background: theme.bgColor, color: theme.textColor }}
                                  aria-label="Remove sticker"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div
                          className="relative mt-3 h-[520px] w-full overflow-y-auto text-left cursor-crosshair p-6 md:p-12 lg:p-20"
                          style={{
                            border: `1px solid ${theme.borderColor}`,
                            background: theme.bgColor,
                            color: theme.textColor,
                          }}
                        >
                          <div
                            role="button"
                            tabIndex={0}
                            onPointerDown={(e) => {
                              if (!selectedSticker) return;
                              e.currentTarget.setPointerCapture(e.pointerId);
                              placeSelectedSticker(block.id, e.currentTarget, e.clientX, e.clientY);
                            }}
                            onPointerMove={(e) => {
                              if (!selectedSticker || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
                              placeSelectedSticker(block.id, e.currentTarget, e.clientX, e.clientY);
                            }}
                            onKeyDown={(e) => {
                              if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                                if (!selectedSticker) return;
                                e.preventDefault();
                                const step = e.shiftKey ? 5 : 1;
                                const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
                                const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
                                nudgeSelectedSticker(block.id, selectedSticker, dx, dy);
                                return;
                              }
                              if (e.key !== 'Enter' && e.key !== ' ') return;
                              e.preventDefault();
                              if (selectedSticker) updateSelectedSticker(block.id, { x: 50, y: 50, placed: true });
                            }}
                            className="relative select-none"
                            style={{ minHeight: STICKER_STAGE_HEIGHT }}
                            aria-label="Place selected sticker"
                          >
                            {!selectedSticker && (
                              <div className="absolute right-6 top-6 font-mono-tech text-[10px] uppercase opacity-50">
                                Select a sticker thumbnail first
                              </div>
                            )}
                            <div className="pointer-events-none mt-12 md:mt-0 relative z-10 animate-fade-in">
                              {blocks.map((previewBlock, previewIndex) => (
                                previewBlock.type === 'stickers' ? null : renderContent(previewBlockForRender(previewBlock), previewIndex)
                              ))}
                            </div>
                            {block.stickers?.filter((sticker) => sticker.placed).map((sticker) => (
                              <img
                                key={sticker.id}
                                src={sticker.previewUrl || sticker.url}
                                alt=""
                                className="absolute z-40 pointer-events-none"
                                style={{
                                  ...stickerPlacementStyle(sticker),
                                  outline: sticker.id === selectedSticker?.id ? `1px solid ${theme.textColor}` : 'none',
                                }}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-3 mt-3 items-end">
                          {[
                            ['width', 'WIDTH', 2, 5, 100, 22],
                            ['rotation', 'ROTATE', 5, -180, 180, 0]
                          ].map(([key, label, step, min, max, fallback]) => (
                            <div key={key} className="font-mono-tech text-[9px] uppercase opacity-70">
                              {label}
                              <div
                                className="mt-1 flex h-10 items-center justify-between"
                                style={{ border: `1px solid ${theme.borderColor}`, color: 'inherit' }}
                              >
                                <span className="px-3 text-xs">{selectedSticker?.[key] ?? fallback}</span>
                                <div className="flex h-full">
                                  <button
                                    type="button"
                                    onClick={() => selectedSticker && updateSelectedSticker(block.id, { [key]: Math.max(min, Number(selectedSticker[key] ?? fallback) - step) })}
                                    className="grid w-9 place-items-center cursor-pointer"
                                    style={{ borderLeft: `1px solid ${theme.borderColor}` }}
                                    aria-label={`Decrease ${label.toLowerCase()}`}
                                  >
                                    <ChevronDown size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => selectedSticker && updateSelectedSticker(block.id, { [key]: Math.min(max, Number(selectedSticker[key] ?? fallback) + step) })}
                                    className="grid w-9 place-items-center cursor-pointer"
                                    style={{ borderLeft: `1px solid ${theme.borderColor}` }}
                                    aria-label={`Increase ${label.toLowerCase()}`}
                                  >
                                    <ChevronUp size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              updateSelectedSticker(block.id, { x: 50, y: 50, width: 22, rotation: 0, placed: true });
                            }}
                            className="grid h-10 w-10 place-items-center cursor-pointer"
                            style={{ border: `1px solid ${theme.borderColor}`, color: 'inherit' }}
                            aria-label="Reset sticker"
                          >
                            <RotateCcw size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSelectedSticker(block.id)}
                            disabled={!selectedSticker}
                            className="grid h-10 w-10 place-items-center cursor-pointer transition-opacity disabled:cursor-not-allowed"
                            style={{ border: `1px solid ${theme.borderColor}`, color: theme.textColor, opacity: selectedSticker ? 0.75 : 0.35 }}
                            aria-label="Remove selected sticker"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    )}

                    {block.type === 'demo-input' && (
                      <div className="font-mono-tech text-[10px] uppercase opacity-60 py-3">
                        INTERACTIVE INPUT DEMO
                      </div>
                    )}
                    {block.type === 'gallery' && (
                      <div className="font-mono-tech text-[10px] uppercase opacity-60 py-3">
                        INTERACTIVE FOLDER GALLERY: {(block.value || '').split('\n').filter(Boolean).length} IMAGES
                      </div>
                    )}
                    </div>
                  </div>

                  {/* Reorder and delete controls */}
                  <div className="flex items-center gap-1.5 self-center ml-2">
                    <button
                      type="button"
                      onClick={() => removeBlock(block.id)}
                      className="block-action-btn cursor-pointer"
                      style={{ color: '#ff5f57', borderColor: 'rgba(255,95,87,0.3)' }}
                      title="Delete Block"
                      aria-label={`Delete block ${index + 1}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>
              );
              })}
              </div>

              <div className="space-y-2 pt-4 border-t border-dashed" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                <button
                  type="button"
                  onClick={() => setIsImportOpen((value) => !value)}
                  className="flex w-full items-center justify-between font-mono-tech uppercase font-bold cursor-pointer"
                  style={{ fontSize: '9px', letterSpacing: '0.12em', color: 'inherit' }}
                  aria-expanded={isImportOpen}
                >
                  IMPORT_MARKDOWN
                  {isImportOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {isImportOpen && <>
                <textarea
                  value={markdownInput}
                  onChange={(e) => setMarkdownInput(e.target.value)}
                  aria-label="Import markdown"
                  className="w-full p-3 bg-transparent font-mono-tech focus:outline-none resize-y"
                  style={{ border: `1px dashed ${theme.textColor}`, fontSize: '12px', minHeight: '110px', color: 'inherit' }}
                  placeholder={"# Function Name\nPaste AI-generated Markdown here..."}
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={copyArchivoltPrompt}
                    className="px-4 py-2 border font-mono-tech text-xs cursor-pointer hover:bg-[rgba(255,255,255,0.05)] transition-colors flex items-center gap-1.5"
                    style={{ borderColor: theme.borderColor, color: theme.textColor, borderRadius: '4px', background: 'transparent' }}
                  >
                    {promptCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {promptCopied ? 'COPIED PROMPT' : 'COPY PROMPT'}
                  </button>
                  <button
                    type="button"
                    onClick={importMarkdown}
                    className="px-4 py-2 border font-mono-tech text-xs cursor-pointer hover:bg-[rgba(255,255,255,0.05)] transition-colors flex items-center gap-1.5"
                    style={{ borderColor: theme.textColor, color: theme.textColor, borderRadius: '4px', background: 'transparent' }}
                  >
                    <FileText className="w-3.5 h-3.5" /> IMPORT MARKDOWN
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMarkdownInput('');
                      notify('Markdown input cleared');
                    }}
                    className="px-4 py-2 border font-mono-tech text-xs cursor-pointer hover:bg-[rgba(255,255,255,0.05)] transition-colors"
                    style={{ borderColor: theme.borderColor, color: theme.textColor, borderRadius: '4px', background: 'transparent' }}
                  >
                    CLEAR
                  </button>
                </div>
                </>}
              </div>
            </div>

            <aside
              className={`editor-workspace__preview ${isPreviewing ? '' : 'is-hidden-mobile'}`}
              aria-label="Record preview"
              style={{ borderColor: theme.borderColor, background: 'rgba(0,0,0,0.08)' }}
            >
              <div className="editor-preview-header" style={{ borderColor: theme.borderColor }}>
                <span>RECORD PREVIEW</span>
                <span>{blocks.length} blocks</span>
              </div>
              <div className="editor-preview-body">
                {blocks.map((block, index) => renderContent(previewBlockForRender(block), index))}
              </div>
            </aside>
          </div>
        </div>

        <div className="sticky bottom-0 z-30 flex flex-col gap-3 border-t py-3 backdrop-blur md:flex-row" style={{ borderColor: theme.borderColor, background: theme.bgColor }}>
          <button
            type="button"
            onClick={undoBlocks}
            disabled={!canUndoBlocks}
            className="py-4 px-5 bg-transparent font-display font-bold uppercase flex items-center justify-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed"
            style={{ border: `1px solid ${theme.borderColor}`, fontSize: '14px', letterSpacing: '0.1em', color: theme.textColor, opacity: canUndoBlocks ? 1 : 0.35 }}
          >
            <Undo2 className="w-4 h-4" /> UNDO
          </button>
          <button type="submit"
            disabled={isSaving}
            className="flex-1 py-4 bg-transparent font-display font-bold uppercase flex items-center justify-center gap-2 transition-all cursor-pointer"
            style={{ border: `1px solid ${theme.textColor}`, fontSize: '14px', letterSpacing: '0.1em', color: theme.textColor, opacity: isSaving ? 0.6 : 1 }}>
            <Save className="w-4 h-4" /> {isSaving ? 'SAVING...' : isEditing ? 'UPDATE_RECORD' : 'COMMIT_RECORD'}
          </button>
          {isEditing && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="py-4 px-5 bg-transparent font-display font-bold uppercase flex items-center justify-center gap-2 transition-all cursor-pointer"
              style={{ border: '1px solid rgba(255,95,87,0.5)', fontSize: '12px', letterSpacing: '0.1em', color: '#ff5f57' }}
            >
              <Trash2 className="w-4 h-4" /> DELETE
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
