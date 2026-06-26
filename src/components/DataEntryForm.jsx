import React, { useEffect, useMemo, useState } from 'react';
import { X, GripVertical, Trash2, Save, Plus, Image, ChevronUp, ChevronDown, RotateCcw, Upload } from 'lucide-react';
import { cn } from '../utils/helpers';

const stickerFromContent = (sticker, index) => ({
  id: sticker.id || `${Date.now()}-sticker-${index}`,
  url: sticker.url,
  x: sticker.x > 100 ? Math.round(sticker.x / 8) : sticker.x || sticker.xPct || 0,
  y: sticker.y > 100 ? Math.round(sticker.y / 6) : sticker.y || sticker.yPct || 0,
  width: sticker.width > 100 ? Math.round(sticker.width / 8) : sticker.width || 22,
  rotation: sticker.rotation || 0,
  placed: sticker.placed ?? true
});

const blockFromContent = (block, index) => {
  const stickers = block.type === 'stickers' ? (block.items || []).map(stickerFromContent) : block.type === 'sticker' ? [stickerFromContent(block, 0)] : [];
  return {
    id: `${Date.now()}-${index}`,
    type: block.type === 'sticker' ? 'stickers' : block.type,
    value: block.type === 'list' ? (block.items || []).join('\n') : block.caption || block.value || block.defaultCode || '',
    language: block.language,
    url: block.url,
    x: block.x || 0,
    y: block.y || 0,
    width: block.width || 180,
    rotation: block.rotation || 0,
    stickers,
    selectedStickerId: stickers[0]?.id || null
  };
};

const formSignature = ({ recordType, projectName, version, pageTitle, blocks }) => JSON.stringify({
  recordType,
  projectName,
  version,
  pageTitle,
  blocks: blocks.map(({ type, value, language, url, file, x, y, width, rotation, stickers }) => ({
    type,
    value,
    language,
    url,
    fileName: file?.name || '',
    x,
    y,
    width,
    rotation,
    stickers: stickers?.map(({ url, file, x, y, width, rotation, placed }) => ({ url, fileName: file?.name || '', x, y, width, rotation, placed }))
  }))
});

export const DataEntryForm = ({ onSave, onCancel, onDelete, onDirtyChange, activeColorTheme: theme, activeProject, initialData = null, mode = 'create' }) => {
  const isEditing = mode === 'edit';
  // Form States
  const [recordType, setRecordType] = useState(initialData?.recordType || 'document');
  const [projectName, setProjectName] = useState('');
  const [version, setVersion] = useState(initialData?.version || 'CODE_009 // TEST');
  const [pageTitle, setPageTitle] = useState(initialData?.pageTitle || 'NEW REC');
  const [isSaving, setIsSaving] = useState(false);

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
  const currentSignature = useMemo(
    () => formSignature({ recordType, projectName, version, pageTitle, blocks }),
    [recordType, projectName, version, pageTitle, blocks]
  );
  const [initialSignature] = useState(currentSignature);

  // Drag states
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragReadyBlockId, setDragReadyBlockId] = useState(null);
  const hasStickerBlock = blocks.some((block) => block.type === 'stickers');

  useEffect(() => {
    onDirtyChange?.(currentSignature !== initialSignature);
  }, [currentSignature, initialSignature, onDirtyChange]);

  // Actions
  const addBlock = (type) => {
    let defaultVal = '';
    if (type === 'playground') {
      defaultVal = "<style>\n  body { background: #111; color: #e4decd; font-family: monospace; padding: 2rem; }\n  button { background: #e4decd; color: #111; border: 1px solid #111; padding: 0.5rem 1rem; cursor: pointer; font-weight: bold; box-shadow: 2px 2px 0px #000; transition: all 0.1s ease; }\n  button:hover { background: #f0ebd9; transform: translate(-1px, -1px); box-shadow: 3px 3px 0px #000; }\n  button:active { background: #c3baa2; transform: translate(1px, 1px); box-shadow: 1px 1px 0px #000; }\n</style>\n\n<h1>>> READY</h1>\n<button onclick=\"alert('RUNNING')\">CLICK</button>";
    }
    if (type === 'list') {
      defaultVal = 'First item\nSecond item';
    }
    const newBlock = {
      id: `${Date.now()}${Math.random().toString(36).substr(2, 5)}`,
      type,
      value: defaultVal,
      language: type === 'code' ? 'javascript' : undefined,
      stickers: type === 'stickers' ? [] : undefined,
      selectedStickerId: null
    };
    setBlocks((prev) => [...prev, newBlock]);
  };

  const removeBlock = (id) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const updateBlockValue = (id, val) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, value: val } : b))
    );
  };

  const updateBlockLanguage = (id, lang) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, language: lang } : b))
    );
  };

  const updateBlockFile = (id, file) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, file, previewUrl: file ? URL.createObjectURL(file) : '' } : b))
    );
  };

  const updateBlockMeta = (id, key, value) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [key]: value } : b))
    );
  };

  const addStickerFiles = (id, files) => {
    const nextStickers = Array.from(files || []).map((file) => ({
      id: `${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      x: 0,
      y: 0,
      width: 22,
      rotation: 0,
      placed: false
    }));
    setBlocks((prev) => prev.map((b) => b.id === id ? {
      ...b,
      stickers: [...(b.stickers || []), ...nextStickers],
      selectedStickerId: b.selectedStickerId || null
    } : b));
  };

  const updateSelectedSticker = (blockId, patch) => {
    setBlocks((prev) => prev.map((b) => b.id === blockId ? {
      ...b,
      stickers: (b.stickers || []).map((sticker) => sticker.id === b.selectedStickerId ? { ...sticker, ...patch } : sticker)
    } : b));
  };

  const deleteSelectedSticker = (blockId) => {
    setBlocks((prev) => prev.map((b) => {
      if (b.id !== blockId) return b;
      const stickers = (b.stickers || []).filter((sticker) => sticker.id !== b.selectedStickerId);
      return { ...b, stickers, selectedStickerId: stickers[0]?.id || null };
    }));
  };

  const deleteSticker = (blockId, stickerId) => {
    setBlocks((prev) => prev.map((b) => {
      if (b.id !== blockId) return b;
      const stickers = (b.stickers || []).filter((sticker) => sticker.id !== stickerId);
      return { ...b, stickers, selectedStickerId: b.selectedStickerId === stickerId ? stickers[0]?.id || null : b.selectedStickerId };
    }));
  };

  // HTML5 Drag Handlers
  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setBlocks((prev) => {
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
      alert("ERROR: PAGE_TITLE IS A REQUIRED FIELD.");
      return;
    }
    if (recordType === 'project' && !projectName.trim()) {
      alert("ERROR: DIRECTORY_NAME IS A REQUIRED FIELD.");
      return;
    }
    if (blocks.length === 0) {
      alert("ERROR: AT LEAST ONE CONTENT BLOCK IS REQUIRED.");
      return;
    }

    // Validate that all blocks have content
    for (let i = 0; i < blocks.length; i++) {
      if (['image', 'sticker'].includes(blocks[i].type) && !blocks[i].file && !blocks[i].url) {
        alert(`ERROR: BLOCK #${i + 1} NEEDS AN IMAGE FILE.`);
        return;
      }
      if (blocks[i].type === 'stickers' && !blocks[i].stickers?.some((sticker) => sticker.placed)) {
        alert(`ERROR: BLOCK #${i + 1} NEEDS AT LEAST ONE PLACED STICKER.`);
        return;
      }
      if (!['image', 'sticker', 'stickers', 'demo-input'].includes(blocks[i].type) && !blocks[i].value.trim()) {
        alert(`ERROR: BLOCK #${i + 1} (${blocks[i].type.toUpperCase()}) CANNOT BE EMPTY.`);
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
      alert(`ERROR: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const renderPreviewBlock = (previewBlock, previewIndex) => {
    if (previewBlock.type === 'stickers') return null;
    if (previewBlock.type === 'heading') {
      return <h2 key={previewIndex} className="font-serif font-bold mt-10 mb-5 pb-2 inline-block uppercase" style={{ fontSize: '28px', borderBottom: '2px solid currentColor' }}>{previewBlock.value}</h2>;
    }
    if (previewBlock.type === 'text') {
      return <p key={previewIndex} className="font-mono-tech leading-relaxed mb-6 opacity-80" style={{ fontSize: '13px' }}>{previewBlock.value}</p>;
    }
    if (previewBlock.type === 'code' || previewBlock.type === 'playground') {
      return <pre key={previewIndex} className="font-mono-tech mb-6 whitespace-pre-wrap p-4 opacity-85" style={{ border: `1px solid ${theme.borderColor}`, background: 'rgba(0,0,0,0.25)', fontSize: '12px' }}>{previewBlock.value}</pre>;
    }
    if (previewBlock.type === 'list') {
      return <ul key={previewIndex} className="font-mono-tech pl-5 mb-6 space-y-2 opacity-80" style={{ listStyleType: 'square', fontSize: '13px' }}>{previewBlock.value.split('\n').filter(Boolean).map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul>;
    }
    if (previewBlock.type === 'image' && (previewBlock.previewUrl || previewBlock.url)) {
      return <img key={previewIndex} src={previewBlock.previewUrl || previewBlock.url} alt="" className="mb-6 max-h-56 w-full object-cover opacity-80" />;
    }
    return null;
  };

  return (
    <div className="animate-fade-in text-inherit">
      <div className="flex items-center justify-between mb-8 pb-4" style={{ borderBottom: `2px solid ${theme.textColor}` }}>
        <div>
          <h2 className="font-display text-2xl font-bold uppercase" style={{ letterSpacing: '-0.03em' }}>DATA ENTRY TERMINAL</h2>
          <p className="font-mono-tech mt-1" style={{ fontSize: '10px', opacity: 0.6 }}>
            {isEditing ? 'EDITING CURRENT DOCUMENT' : recordType === 'document' ? `AWAITING NEW DOCUMENT LOG FOR ${activeProject ? activeProject.name : ''}` : 'AWAITING NEW DIRECTORY INPUT...'}
          </p>
        </div>
        <button type="button" onClick={onCancel} className="p-2 transition-colors cursor-pointer" style={{ border: `1px solid ${theme.textColor}`, background: 'transparent', color: 'inherit' }}>
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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
                className="w-full p-3 bg-transparent font-mono-tech focus:outline-none uppercase opacity-60"
                style={{ border: `1px dashed ${theme.textColor}`, fontSize: '13px', cursor: 'not-allowed' }} />
            </div>
          ) : (
            <div className="space-y-2">
              <label className="font-mono-tech uppercase font-bold block" style={{ fontSize: '9px', letterSpacing: '0.12em' }}>DIRECTORY_NAME</label>
              <input type="text" required placeholder="e.g. SYSTEM_CORE" value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
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
              className="w-full p-3 bg-transparent font-mono-tech focus:outline-none uppercase"
              style={{ border: `1px solid ${theme.textColor}`, fontSize: '13px', color: 'inherit' }} />
          </div>
        </div>

        <div className="space-y-2">
          <label className="font-mono-tech uppercase font-bold block" style={{ fontSize: '9px', letterSpacing: '0.12em' }}>PAGE_TITLE</label>
          <input type="text" required value={pageTitle}
            onChange={(e) => setPageTitle(e.target.value)}
            className="w-full p-3 bg-transparent font-mono-tech focus:outline-none uppercase"
            style={{ border: `1px solid ${theme.textColor}`, fontSize: '13px', color: 'inherit' }} />
        </div>

        {/* Dynamic Blocks Section */}
        <div className="space-y-3">
          <label className="font-mono-tech uppercase font-bold block" style={{ fontSize: '9px', letterSpacing: '0.12em' }}>DOCUMENT_STRUCTURE (DRAG TO REORDER)</label>
          
          <div className="block-editor-list">
            {blocks.map((block, index) => {
              const isDragged = draggedIndex === index;
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
                    {block.type === 'heading' && (
                      <div>
                        <label className="font-mono-tech block text-[9px] uppercase opacity-45 mb-1">HEADING</label>
                        <input
                          type="text"
                          value={block.value}
                          onChange={(e) => updateBlockValue(block.id, e.target.value)}
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
                          className="w-full p-2 bg-transparent font-mono-tech focus:outline-none resize-y"
                          style={{ borderBottom: `1px solid ${theme.textColor}`, fontSize: '13px', minHeight: '60px', color: 'inherit' }}
                          placeholder="Write notes or description here..."
                          required
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
                              className="bg-transparent font-mono-tech focus:outline-none uppercase cursor-pointer"
                              style={{ color: 'inherit' }}
                            >
                              <option value="javascript" style={{ color: '#1a1b1c', background: '#e4decd' }}>JavaScript</option>
                              <option value="html" style={{ color: '#1a1b1c', background: '#e4decd' }}>HTML</option>
                              <option value="bash" style={{ color: '#1a1b1c', background: '#e4decd' }}>Bash</option>
                              <option value="css" style={{ color: '#1a1b1c', background: '#e4decd' }}>CSS</option>
                            </select>
                          </div>
                        </div>
                        <textarea
                          value={block.value}
                          onChange={(e) => updateBlockValue(block.id, e.target.value)}
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

                    {block.type === 'list' && (
                      <div>
                        <label className="font-mono-tech block text-[9px] uppercase opacity-45 mb-1">LIST ITEMS</label>
                        <textarea
                          value={block.value}
                          onChange={(e) => updateBlockValue(block.id, e.target.value)}
                          className="w-full p-2 bg-transparent font-mono-tech focus:outline-none resize-y"
                          style={{ borderBottom: `1px solid ${theme.textColor}`, fontSize: '13px', minHeight: '80px', color: 'inherit' }}
                          placeholder="One item per line..."
                          required
                        />
                      </div>
                    )}

                    {block.type === 'image' && (
                      <div>
                        <label className="font-mono-tech block text-[9px] uppercase opacity-45 mb-1">IMAGE</label>
                        {block.url && <img src={block.url} alt="" className="mb-2 max-h-32 w-auto" />}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => updateBlockFile(block.id, e.target.files[0])}
                          className="w-full p-2 bg-transparent font-mono-tech focus:outline-none"
                          style={{ borderBottom: `1px solid ${theme.textColor}`, fontSize: '12px', color: 'inherit' }}
                        />
                        <input
                          type="text"
                          value={block.value}
                          onChange={(e) => updateBlockValue(block.id, e.target.value)}
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
                                  className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center border cursor-pointer"
                                  style={{ borderColor: '#ff5f57', background: '#0a0a0b', color: '#ff5f57' }}
                                  aria-label="Delete sticker"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            if (!selectedSticker) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            updateSelectedSticker(block.id, {
                              x: Math.round(((e.clientX - rect.left) / rect.width) * 100),
                              y: Math.round(((e.clientY - rect.top + e.currentTarget.scrollTop) / e.currentTarget.scrollHeight) * 100),
                              placed: true
                            });
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter' && e.key !== ' ') return;
                            e.preventDefault();
                          }}
                          className="relative mt-3 h-[520px] w-full overflow-y-auto text-left cursor-crosshair"
                          style={{
                            border: `1px solid ${theme.borderColor}`,
                            background: theme.bgColor,
                            color: theme.textColor,
                          }}
                        >
                          <div className="relative min-h-[720px] p-8 pointer-events-none">
                            {blocks.map(renderPreviewBlock)}
                            {block.stickers?.filter((sticker) => sticker.placed).map((sticker) => (
                              <img
                                key={sticker.id}
                                src={sticker.previewUrl || sticker.url}
                                alt=""
                                className="absolute pointer-events-none"
                                style={{
                                  left: `${sticker.x > 100 ? sticker.x / 8 : sticker.x || 0}%`,
                                  top: `${sticker.y > 100 ? sticker.y / 6 : sticker.y || 0}%`,
                                  width: `${sticker.width > 100 ? sticker.width / 8 : sticker.width || 22}%`,
                                  transform: `translate(-50%, -50%) rotate(${sticker.rotation || 0}deg)`,
                                  outline: sticker.id === selectedSticker?.id ? `1px solid ${theme.textColor}` : 'none',
                                }}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-3 mt-3 items-end">
                          {[
                            ['width', 'WIDTH', 2, 5, 22],
                            ['rotation', 'ROTATE', 5, -180, 0]
                          ].map(([key, label, step, min, fallback]) => (
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
                                    onClick={() => selectedSticker && updateSelectedSticker(block.id, { [key]: Number(selectedSticker[key] ?? fallback) + step })}
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
                              updateSelectedSticker(block.id, { x: 0, y: 0, width: 22, rotation: 0 });
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
                            className="grid h-10 w-10 place-items-center cursor-pointer"
                            style={{ border: `1px solid rgba(255,95,87,0.45)`, color: '#ff5f57' }}
                            aria-label="Delete selected sticker"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    )}

                    {block.type === 'demo-input' && (
                      <div className="font-mono-tech text-[10px] uppercase opacity-60 py-3">
                        INTERACTIVE INPUT DEMO
                      </div>
                    )}
                  </div>

                  {/* Reorder and delete controls */}
                  <div className="flex items-center gap-1.5 self-center ml-2">
                    <button
                      type="button"
                      onClick={() => removeBlock(block.id)}
                      className="block-action-btn cursor-pointer"
                      style={{ color: '#ff5f57', borderColor: 'rgba(255,95,87,0.3)' }}
                      title="Delete Block"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>
              );
            })}
          </div>

          {/* Add block button group */}
          <div className="pt-4 border-t border-dashed" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <label className="font-mono-tech uppercase font-bold block mb-3" style={{ fontSize: '9px', letterSpacing: '0.12em' }}>INSERT_BLOCK</label>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => addBlock('heading')}
                className="px-4 py-2 border font-mono-tech text-xs cursor-pointer hover:bg-[rgba(255,255,255,0.05)] transition-colors flex items-center gap-1.5"
                style={{ borderColor: theme.textColor, color: theme.textColor, borderRadius: '4px', background: 'transparent' }}
              >
                <Plus className="w-3.5 h-3.5" /> HEADING
              </button>
              <button
                type="button"
                onClick={() => addBlock('text')}
                className="px-4 py-2 border font-mono-tech text-xs cursor-pointer hover:bg-[rgba(255,255,255,0.05)] transition-colors flex items-center gap-1.5"
                style={{ borderColor: theme.textColor, color: theme.textColor, borderRadius: '4px', background: 'transparent' }}
              >
                <Plus className="w-3.5 h-3.5" /> NOTE / TEXT
              </button>
              <button
                type="button"
                onClick={() => addBlock('code')}
                className="px-4 py-2 border font-mono-tech text-xs cursor-pointer hover:bg-[rgba(255,255,255,0.05)] transition-colors flex items-center gap-1.5"
                style={{ borderColor: theme.textColor, color: theme.textColor, borderRadius: '4px', background: 'transparent' }}
              >
                <Plus className="w-3.5 h-3.5" /> CODE BLOCK
              </button>
              <button
                type="button"
                onClick={() => addBlock('playground')}
                className="px-4 py-2 border font-mono-tech text-xs cursor-pointer hover:bg-[rgba(255,255,255,0.05)] transition-colors flex items-center gap-1.5"
                style={{ borderColor: theme.textColor, color: theme.textColor, borderRadius: '4px', background: 'transparent' }}
              >
                <Plus className="w-3.5 h-3.5" /> PLAYGROUND
              </button>
              <button
                type="button"
                onClick={() => addBlock('list')}
                className="px-4 py-2 border font-mono-tech text-xs cursor-pointer hover:bg-[rgba(255,255,255,0.05)] transition-colors flex items-center gap-1.5"
                style={{ borderColor: theme.textColor, color: theme.textColor, borderRadius: '4px', background: 'transparent' }}
              >
                <Plus className="w-3.5 h-3.5" /> LIST
              </button>
              <button
                type="button"
                onClick={() => addBlock('image')}
                className="px-4 py-2 border font-mono-tech text-xs cursor-pointer hover:bg-[rgba(255,255,255,0.05)] transition-colors flex items-center gap-1.5"
                style={{ borderColor: theme.textColor, color: theme.textColor, borderRadius: '4px', background: 'transparent' }}
              >
                <Image className="w-3.5 h-3.5" /> IMAGE
              </button>
              {!hasStickerBlock && (
                <button
                  type="button"
                  onClick={() => addBlock('stickers')}
                  className="px-4 py-2 border font-mono-tech text-xs cursor-pointer hover:bg-[rgba(255,255,255,0.05)] transition-colors flex items-center gap-1.5"
                  style={{ borderColor: theme.textColor, color: theme.textColor, borderRadius: '4px', background: 'transparent' }}
                >
                  <Image className="w-3.5 h-3.5" /> STICKERS
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
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
