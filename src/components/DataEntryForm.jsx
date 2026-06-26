import React, { useState } from 'react';
import { X, GripVertical, Trash2, Save, Plus, Image } from 'lucide-react';
import { cn } from '../utils/helpers';

const blockFromContent = (block, index) => ({
  id: `${Date.now()}-${index}`,
  type: block.type,
  value: block.type === 'list' ? (block.items || []).join('\n') : block.caption || block.value || block.defaultCode || '',
  language: block.language,
  url: block.url
});

export const DataEntryForm = ({ onSave, onCancel, activeColorTheme: theme, activeProject, initialData = null, mode = 'create' }) => {
  const isEditing = mode === 'edit';
  // Form States
  const [recordType, setRecordType] = useState(initialData?.recordType || 'document');
  const [projectName, setProjectName] = useState('');
  const [version, setVersion] = useState(initialData?.version || 'CODE_009 // TEST');
  const [pageTitle, setPageTitle] = useState(initialData?.pageTitle || 'NEW REC');
  const [selectedTheme, setSelectedTheme] = useState(initialData?.theme || 'current');
  const [isSaving, setIsSaving] = useState(false);

  // Blocks list state - initialized with a Heading block and a Text block
  const [blocks, setBlocks] = useState(initialData?.blocks?.map(blockFromContent) || [
    { id: '1', type: 'heading', value: 'NEW SECTION' },
    { id: '2', type: 'text', value: 'Enter description or notes here...' }
  ]);

  // Drag states
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragReadyBlockId, setDragReadyBlockId] = useState(null);

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
      language: type === 'code' ? 'javascript' : undefined
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
      prev.map((b) => (b.id === id ? { ...b, file } : b))
    );
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
      if (blocks[i].type === 'image' && !blocks[i].file && !blocks[i].url) {
        alert(`ERROR: BLOCK #${i + 1} NEEDS AN IMAGE FILE.`);
        return;
      }
      if (!['image', 'demo-input'].includes(blocks[i].type) && !blocks[i].value.trim()) {
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
        theme: selectedTheme,
        blocks
      });
    } catch (error) {
      alert(`ERROR: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
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
          <label className="font-mono-tech uppercase font-bold block" style={{ fontSize: '9px', letterSpacing: '0.12em' }}>THEME_STYLE</label>
          <select
            value={selectedTheme}
            onChange={(e) => setSelectedTheme(e.target.value)}
            className="w-full p-3 bg-transparent font-mono-tech focus:outline-none uppercase"
            style={{ border: `1px solid ${theme.textColor}`, fontSize: '13px', color: 'inherit' }}
          >
            <option value="current" style={{ color: '#1a1b1c', background: '#e4decd' }}>Current</option>
            <option value="retro-computer" style={{ color: '#1a1b1c', background: '#e4decd' }}>Retro Computer</option>
          </select>
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
            </div>
          </div>
        </div>

        <button type="submit"
          disabled={isSaving}
          className="w-full py-4 bg-transparent font-display font-bold uppercase flex items-center justify-center gap-2 transition-all cursor-pointer"
          style={{ border: `1px solid ${theme.textColor}`, fontSize: '14px', letterSpacing: '0.1em', color: theme.textColor, opacity: isSaving ? 0.6 : 1 }}>
          <Save className="w-4 h-4" /> {isSaving ? 'SAVING...' : isEditing ? 'UPDATE_RECORD' : 'COMMIT_RECORD'}
        </button>
      </form>
    </div>
  );
};
