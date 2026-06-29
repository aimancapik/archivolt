import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, ArrowLeft, ArrowRight, ChevronDown, Edit3, Trash2, Settings, Pin, Search, Share2 } from 'lucide-react';
import { BGPattern } from '../components/ui/bg-pattern';
import { BeamsBackground } from '../components/ui/beams-background';
import { DitheringShader } from '../components/ui/dithering-shader';
import { CommandPalette } from '../components/CommandPalette';
import { DataEntryForm } from '../components/DataEntryForm';
import { documentHeadings } from '../utils/documentStructure';
import { STICKER_STAGE_HEIGHT } from '../utils/stickerPlacement';

const BG_PATTERN_VARIANTS = ['grid', 'dots', 'horizontal-lines', 'vertical-lines', 'checkerboard'];
const BG_SHADER_VARIANTS = ['wave', 'ripple', 'warp'];
const BG_CSS_VARIANTS = ['beams'];
const BG_OPTIONS = [...BG_PATTERN_VARIANTS, ...BG_SHADER_VARIANTS, ...BG_CSS_VARIANTS];

const BACKGROUND_LABELS = {
  grid: 'Grid',
  dots: 'Dots',
  'horizontal-lines': 'Rows',
  'vertical-lines': 'Columns',
  checkerboard: 'Checks',
  wave: 'Wave',
  ripple: 'Ripple',
  warp: 'Warp',
  beams: 'Beams',
};

const BACKGROUND_OPTIONS = BG_OPTIONS.map((value) => ({ value, label: BACKGROUND_LABELS[value] }));

const blockPreviewText = (block) => {
  if (block.value || block.caption || block.defaultCode) return block.value || block.caption || block.defaultCode;
  if (block.type === 'stickers') return `${block.items?.length || 0} sticker${block.items?.length === 1 ? '' : 's'}`;
  if (Array.isArray(block.items)) {
    return block.items.map((item) => typeof item === 'string' ? item : item.text || item.value || item.label || '').filter(Boolean).join(' ');
  }
  return block.type;
};

export const SidebarLayout = ({
  projects,
  activeProjectId,
  setActiveProjectId,
  activePage,
  setActivePage,
  isAddingData,
  setIsAddingData,
  isEditingData,
  setIsEditingData,
  activeProject,
  pageKeys,
  prevPageKey,
  nextPageKey,
  activeTheme,
  PALETTE,
  currentPageData,
  backgroundPattern,
  setBackgroundPattern,
  setBackgroundColor,
  confirmAction,
  handleSaveNewData,
  handleUpdateDocument,
  handleDeleteDocument,
  handleDeleteProject,
  handleTogglePinDocument,
  notify,
  orderedPageKeys,
  renderContent,
  isSharedView = false,
  createShareLink
}) => {
  const [commandOpen, setCommandOpen] = useState(false);
  const [activeMapIndex, setActiveMapIndex] = useState(0);
  const [isMapPreviewSuppressed, setIsMapPreviewSuppressed] = useState(false);
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [hasDirtyEdit, setHasDirtyEdit] = useState(false);
  const contentRef = useRef(null);
  const scrollToTop = () => contentRef.current?.scrollTo(0, 0);
  const selectedBackgroundPattern = BG_OPTIONS.includes(backgroundPattern) ? backgroundPattern : 'dots';
  const activeBackgroundPattern = selectedBackgroundPattern;

  const confirmDiscardEdit = async () => {
    if (!isEditingData || !hasDirtyEdit) return true;
    return confirmAction({
      title: 'Discard edits',
      message: 'Leave the editor and discard unsaved changes?',
      confirmText: 'Discard',
      tone: 'danger'
    });
  };

  const leaveEditor = () => {
    setIsAddingData(false);
    setIsEditingData(false);
    setHasDirtyEdit(false);
  };

  const copyShareLink = async () => {
    try {
      const shareUrl = await createShareLink?.();
      if (!shareUrl) {
        notify('Could not create share link', 'danger');
        return;
      }

      navigator.clipboard.writeText(shareUrl)
        .then(() => notify('Share link copied', 'success'))
        .catch(() => notify('Could not copy share link', 'danger'));
    } catch {
      notify('Could not create share link', 'danger');
    }
  };

  const goToProjectPage = async (projectId, key, headingId = null) => {
    if (projectId === activeProjectId && key === activePage && !headingId) return;
    if (!await confirmDiscardEdit()) return;
    if (projectId !== activeProjectId) setActiveProjectId(projectId);
    setActivePage(key);
    leaveEditor();
    setShowProjectSettings(false);
    scrollToTop();
    if (headingId) setTimeout(() => document.getElementById(headingId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  const goToPage = (key) => {
    goToProjectPage(activeProjectId, key);
  };

  const startNewRecord = async () => {
    if (!await confirmDiscardEdit()) return;
    setIsAddingData(true);
    setIsEditingData(false);
    setHasDirtyEdit(false);
    setShowProjectSettings(false);
  };

  const startEditRecord = async () => {
    if (isEditingData) {
      if (!await confirmDiscardEdit()) return;
      leaveEditor();
      return;
    }
    setIsEditingData(true);
    setIsAddingData(false);
    setHasDirtyEdit(false);
    setShowProjectSettings(false);
  };

  const mapMarks = useMemo(() => (currentPageData?.content || []).flatMap((block, index) => {
    if (block.type === 'sticker' || block.type === 'stickers') return [];
    const rawText = blockPreviewText(block);
    const title = block.type === 'heading' ? rawText : currentPageData?.title || block.type;
    const summary = String(rawText || '').replace(/\s+/g, ' ').trim();
    return [{
      id: `record-map-${activePage}-${index}`,
      summary: summary || block.type,
      title,
      type: block.type
    }];
  }), [activePage, currentPageData?.content, currentPageData?.title]);

  const commands = (() => {
    const items = [
      { id: 'new-record', label: 'New record', meta: 'Create document or project', type: 'ACTION', keywords: 'create add commit', run: startNewRecord },
      { id: 'edit-record', label: isEditingData ? 'View current record' : 'Edit current record', meta: currentPageData?.title || 'Current document', type: 'ACTION', keywords: 'edit view document', run: startEditRecord },
      { id: 'pin-record', label: currentPageData?.pinned ? 'Unpin current record' : 'Pin current record', meta: currentPageData?.title || 'Current document', type: 'ACTION', keywords: 'pin favorite order', run: handleTogglePinDocument }
    ];

    Object.entries(projects).forEach(([projectId, project]) => {
      orderedPageKeys(project.docs).forEach((pageKey) => {
        const doc = project.docs[pageKey];
        items.push({
          id: `open-${projectId}-${pageKey}`,
          label: doc.title,
          meta: `${project.name} / ${doc.subtitle}`,
          type: 'RECORD',
          keywords: `${project.name} ${pageKey} ${doc.subtitle} ${(doc.content || []).map((block) => block.value || '').join(' ')}`,
          run: () => goToProjectPage(projectId, pageKey)
        });
        documentHeadings(doc.content, pageKey).forEach((heading) => {
          items.push({
            id: `heading-${projectId}-${pageKey}-${heading.id}`,
            label: heading.title,
            meta: `${doc.title} / ${project.name}`,
            type: 'SECTION',
            keywords: `${project.name} ${doc.title} ${doc.subtitle}`,
            run: () => goToProjectPage(projectId, pageKey, heading.id)
          });
        });
      });
    });

    return items;
  })();

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (isAddingData || isEditingData || !mapMarks.length) {
      setActiveMapIndex(0);
      return;
    }

    const scrollRoot = contentRef.current;
    if (!scrollRoot) return;

    const syncActiveMap = () => {
      const rootRect = scrollRoot.getBoundingClientRect();
      const targetTop = rootRect.top + rootRect.height / 2;
      let nextIndex = 0;

      mapMarks.forEach((mark, index) => {
        const markerTarget = document.getElementById(mark.id);
        if (markerTarget && markerTarget.getBoundingClientRect().top <= targetTop) {
          nextIndex = index;
        }
      });

      setActiveMapIndex((currentIndex) => currentIndex === nextIndex ? currentIndex : nextIndex);
    };

    syncActiveMap();
    scrollRoot.addEventListener('scroll', syncActiveMap, { passive: true });
    window.addEventListener('resize', syncActiveMap);

    return () => {
      scrollRoot.removeEventListener('scroll', syncActiveMap);
      window.removeEventListener('resize', syncActiveMap);
    };
  }, [isAddingData, isEditingData, mapMarks]);

  return (
    <div className="h-full w-full flex justify-center items-center px-2 md:px-6 lg:px-10 animate-fade-in" style={{ zIndex: 10 }}>
      <div 
        className="archive-shell w-full max-w-[1400px] h-[90vh] flex shadow-2xl relative"
        style={{
          background: 'rgba(0, 0, 0, 0.15)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          overflow: 'hidden'
        }}
      >
        {/* LEFT SIDE: Vertical Staggered Tabs */}
        {!isSharedView && <div className="archive-tab-rail flex flex-col z-10 w-24 md:w-32 shrink-0 -mr-[2px] overflow-y-auto scrollbar-none" style={{ maxHeight: '100%' }}>
          {pageKeys.map((key, index) => {
            const isActive = activePage === key;
            const doc = activeProject.docs[key];
            const theme = PALETTE[index % PALETTE.length];
            
            return (
              <button
                key={key}
                onClick={() => goToPage(key)}
                className={`
                  archive-tab
                  flex-none flex flex-col justify-center items-center py-5 px-3 border-2 overflow-hidden
                  transition-all duration-300 ease-in-out relative origin-left cursor-pointer
                  ${isActive ? 'w-full z-20 border-r-0' : 'w-[88%] hover:w-[96%] z-10 ml-auto opacity-70 hover:opacity-100'}
                  ${index !== 0 ? '-mt-[2px]' : ''} 
                  rounded-tl-lg rounded-bl-lg
                `}
                style={{
                  backgroundColor: theme.bgColor,
                  color: theme.textColor,
                  borderColor: theme.borderColor || 'black',
                  minHeight: '168px',
                }}
              >
                <span className="writing-vertical font-display text-xs md:text-sm font-bold tracking-widest whitespace-normal text-center leading-tight max-h-[136px] [overflow-wrap:anywhere]">
                  {doc.title}
                </span>
                {doc.pinned && (
                  <Pin className="absolute bottom-3 left-3 h-3.5 w-3.5 opacity-60" />
                )}
                
                {isActive && (
                  <div className="archive-tab-code absolute top-4 right-2 writing-vertical text-[8px] font-mono-tech opacity-50">
                    {doc.subtitle}
                  </div>
                )}
              </button>
            );
          })}
        </div>}

        {/* RIGHT SIDE: Active Folder Content */}
        <div
          ref={contentRef}
          className="archive-content-panel isolate flex-1 border-2 relative overflow-x-hidden overflow-y-auto transition-colors duration-500 rounded-tr-lg rounded-br-lg"
          style={{
            backgroundColor: activeTheme.bgColor,
            color: activeTheme.textColor,
            borderColor: activeTheme.borderColor || 'black',
          }}
        >
          {/* Top Bar / Project Switcher */}
          <div 
            className="archive-topbar sticky top-0 z-30 border-b-2 px-6 py-3 flex items-center justify-between bg-inherit backdrop-blur-md"
            style={{ borderColor: activeTheme.borderColor }}
          >
            <div className="flex items-center gap-4">
              <div className="relative inline-flex items-center">
                {isSharedView ? (
                  <h2 className="font-serif font-bold text-xl md:text-3xl tracking-tighter uppercase" style={{ color: activeTheme.textColor }}>
                    {activeProject.name}
                  </h2>
                ) : (
                <select 
                  value={activeProjectId}
                  aria-label="Active project"
                  onChange={async (e) => {
                    const nextProjectId = e.target.value;
                    if (!await confirmDiscardEdit()) return;
                    setActiveProjectId(nextProjectId);
                    setActivePage(orderedPageKeys(projects[nextProjectId].docs)[0]);
                    leaveEditor();
                    setShowProjectSettings(false);
                  }}
                  className="appearance-none bg-transparent font-serif font-bold text-xl md:text-3xl tracking-tighter uppercase focus:outline-none cursor-pointer border-none pr-8"
                  style={{ color: activeTheme.textColor }}
                >
                  {Object.values(projects).map((p) => (
                    <option key={p.id} value={p.id} style={{ color: '#1a1b1c', background: '#e4decd' }}>{p.name}</option>
                  ))}
                </select>
                )}
                {!isSharedView && <ChevronDown className="pointer-events-none absolute right-0 h-4 w-4 opacity-60" />}
              </div>
              <span className="font-mono-tech text-xs opacity-50 hidden md:block">_{activeProject.version}</span>
            </div>

            {!isSharedView && <div className="flex items-center gap-4">
              <button
                onClick={() => setCommandOpen(true)}
                className="p-2 border-2 transition-colors cursor-pointer"
                style={{ borderColor: activeTheme.textColor, color: activeTheme.textColor }}
                title="Command Palette"
                aria-label="Open command palette"
              >
                <Search className="w-5 h-5" />
              </button>
              <button 
                onClick={startNewRecord}
                className="p-2 border-2 transition-colors cursor-pointer" 
                style={{
                  borderColor: activeTheme.textColor,
                  backgroundColor: isAddingData ? activeTheme.textColor : 'transparent',
                  color: isAddingData ? activeTheme.bgColor : activeTheme.textColor,
                }}
                title="New Directory"
              >
                <Plus className="w-5 h-5 transition-transform" style={{ transform: isAddingData ? 'rotate(45deg)' : 'none' }} />
              </button>
              {!isAddingData && (
                <>
                  <button
                    onClick={copyShareLink}
                    className="p-2 border-2 transition-colors cursor-pointer"
                    style={{
                      borderColor: activeTheme.textColor,
                      color: activeTheme.textColor,
                    }}
                    title="Copy Share Link"
                    aria-label="Copy share link"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleTogglePinDocument}
                    className="p-2 border-2 transition-colors cursor-pointer"
                    style={{
                      borderColor: activeTheme.textColor,
                      backgroundColor: currentPageData?.pinned ? activeTheme.textColor : 'transparent',
                      color: currentPageData?.pinned ? activeTheme.bgColor : activeTheme.textColor,
                    }}
                    title={currentPageData?.pinned ? 'Unpin Document' : 'Pin Document'}
                    aria-pressed={Boolean(currentPageData?.pinned)}
                  >
                    <Pin className="w-5 h-5" />
                  </button>
                  <button
                    onClick={startEditRecord}
                    className="p-2 border-2 transition-colors cursor-pointer"
                    style={{
                      borderColor: activeTheme.textColor,
                      backgroundColor: isEditingData ? activeTheme.textColor : 'transparent',
                      color: isEditingData ? activeTheme.bgColor : activeTheme.textColor,
                    }}
                    title={isEditingData ? 'View Document' : 'Edit Document'}
                    aria-pressed={isEditingData}
                  >
                    <Edit3 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setShowProjectSettings(!showProjectSettings)}
                    className="p-2 border-2 transition-colors cursor-pointer"
                    style={{
                      borderColor: activeTheme.textColor,
                      backgroundColor: showProjectSettings ? activeTheme.textColor : 'transparent',
                      color: showProjectSettings ? activeTheme.bgColor : activeTheme.textColor,
                    }}
                    title="Project Settings"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>}
          </div>

          {!isSharedView && showProjectSettings && (
            <div className="sticky top-[66px] z-20 px-6 py-3 flex flex-wrap items-center justify-between gap-3 bg-inherit border-b" style={{ borderColor: activeTheme.borderColor }}>
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="background-pattern" className="font-mono-tech text-[10px] uppercase opacity-60">
                  BG
                </label>
                <div className="relative inline-flex items-center">
                  <select
                    id="background-pattern"
                    value={selectedBackgroundPattern}
                    onChange={(event) => setBackgroundPattern(event.target.value)}
                    className="appearance-none border-2 bg-transparent py-2 pl-3 pr-8 font-mono-tech text-[10px] uppercase cursor-pointer"
                    style={{ borderColor: activeTheme.textColor, color: activeTheme.textColor }}
                  >
                    {BACKGROUND_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value} style={{ color: '#1a1b1c', background: '#e4decd' }}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 opacity-60" />
                </div>
                <div className="flex items-center gap-1.5" aria-label="Background color">
                  {PALETTE.map((theme) => {
                    const selected = theme.bgColor === activeTheme.bgColor;
                    return (
                      <button
                        key={theme.bgColor}
                        type="button"
                        onClick={() => setBackgroundColor(theme.bgColor)}
                        className="h-7 w-7 border-2 cursor-pointer"
                        style={{
                          backgroundColor: theme.bgColor,
                          borderColor: selected ? activeTheme.textColor : activeTheme.borderColor,
                          boxShadow: selected ? `0 0 0 2px ${activeTheme.bgColor}, 0 0 0 4px ${activeTheme.textColor}` : 'none'
                        }}
                        title={`Use ${theme.bgColor}`}
                        aria-label={`Use background color ${theme.bgColor}`}
                        aria-pressed={selected}
                      />
                    );
                  })}
                </div>
              </div>
              <button
                onClick={handleDeleteProject}
                className="px-3 py-2 border-2 font-mono-tech text-[10px] uppercase transition-colors cursor-pointer flex items-center gap-2"
                style={{ borderColor: '#ff5f57', backgroundColor: 'transparent', color: '#ff5f57' }}
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Project
              </button>
            </div>
          )}

          {/* Inner Content Area */}
          <div className="archive-inner p-6 md:p-12 lg:p-20 max-w-4xl mx-auto relative min-h-full">
            {activeBackgroundPattern === 'beams' ? (
              <BeamsBackground
                aria-hidden="true"
                className="pointer-events-none inset-y-0 left-1/2 z-0 w-[100vw] -translate-x-1/2 opacity-90"
                backgroundColor={activeTheme.bgColor}
                color={activeTheme.accentColor}
                intensity={0.9}
              />
            ) : BG_SHADER_VARIANTS.includes(activeBackgroundPattern) ? (
              <DitheringShader
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-1/2 z-0 h-full w-[100vw] -translate-x-1/2"
                color={activeTheme.textColor}
                shape={activeBackgroundPattern}
              />
            ) : (
              <BGPattern
                aria-hidden="true"
                className="left-1/2 w-[100vw] -translate-x-1/2"
                variant={activeBackgroundPattern}
                mask="fade-edges"
                size={activeBackgroundPattern === 'dots' ? 18 : 30}
                fill={activeTheme.textColor}
                style={{ opacity: 0.13 }}
              />
            )}
            
            {!isSharedView && (isAddingData || isEditingData) ? (
              // --- RENDER THE NEW DATA ENTRY FORM ---
              <DataEntryForm 
                key={`${isEditingData ? 'edit' : 'create'}-${activeProjectId}-${activePage}`}
                onSave={isEditingData ? handleUpdateDocument : handleSaveNewData}
                onDelete={isEditingData ? handleDeleteDocument : undefined}
                onDirtyChange={isEditingData ? setHasDirtyEdit : undefined}
                onCancel={async () => {
                  if (!await confirmDiscardEdit()) return;
                  leaveEditor();
                }}
                activeColorTheme={activeTheme}
                activeProject={activeProject}
                confirmAction={confirmAction}
                mode={isEditingData ? 'edit' : 'create'}
                notify={notify}
                renderContent={renderContent}
                initialData={isEditingData ? {
                  recordType: 'document',
                  pageTitle: currentPageData.title,
                  version: currentPageData.subtitle,
                  blocks: currentPageData.content
                } : null}
              />
            ) : (
              // --- RENDER STANDARD DOCUMENTATION ---
              <>
                {/* Decorative Archive Stamps */}
                <div className="absolute top-6 right-6 md:top-12 md:right-12 flex flex-col items-end gap-2 opacity-60">
                  <div className="barcode" style={{ color: activeTheme.textColor }}></div>
                  <div className="font-mono-tech text-[10px] text-right uppercase">
                    LOG_1:00:47<br/>
                    025_RED<br/>
                    {currentPageData?.subtitle}
                  </div>
                </div>

                <h1 className="font-display mb-6 max-w-[70%] text-3xl font-bold uppercase leading-tight md:text-5xl" style={{ letterSpacing: '-0.03em' }}>
                  {currentPageData?.title}
                </h1>

                {!!mapMarks.length && (
                  <nav
                    className={`section-map-rail ${isMapPreviewSuppressed ? 'is-preview-suppressed' : ''}`}
                    onPointerLeave={() => setIsMapPreviewSuppressed(false)}
                    onPointerMove={() => isMapPreviewSuppressed && setIsMapPreviewSuppressed(false)}
                    aria-label="Record map"
                  >
                    {mapMarks.map((mark, markIndex) => (
                      <div key={mark.id} className="section-map-rail__item">
                        <button
                          type="button"
                          onPointerDown={() => setIsMapPreviewSuppressed(true)}
                          onClick={(event) => {
                            setIsMapPreviewSuppressed(true);
                            event.currentTarget.blur();
                            setActiveMapIndex(markIndex);
                            document.getElementById(mark.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }}
                          className={`section-map-rail__mark ${mark.type === 'heading' ? 'is-heading' : ''} ${markIndex === activeMapIndex ? 'is-current' : ''}`}
                          aria-label={`Jump to ${mark.title}`}
                        />
                        <div className="section-map-preview" role="tooltip">
                          <div className="section-map-preview__title">{mark.title}</div>
                          <div className="section-map-preview__summary">{mark.summary}</div>
                          <div className="section-map-preview__meta">
                            <span>{mark.type}</span>
                            <span>{markIndex + 1}/{mapMarks.length}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </nav>
                )}

                {/* Page Content */}
                <div className="mt-12 md:mt-0 relative z-10 animate-fade-in" style={{ minHeight: STICKER_STAGE_HEIGHT }}>
                  {currentPageData?.content.map((block, index) => (
                    <div id={`record-map-${activePage}-${index}`} key={index} className="scroll-mt-28">
                      {renderContent(block, index, { interactive: !isSharedView })}
                    </div>
                  ))}
                </div>

                {/* Brutalist Pagination Footer */}
                {!isSharedView && <div 
                  className="archive-footer mt-24 pt-8 border-t-4 grid grid-cols-2 gap-4 pb-12"
                  style={{ borderColor: activeTheme.textColor }}
                >
                  {prevPageKey ? (
                    <button 
                      onClick={() => goToPage(prevPageKey)} 
                      className="flex flex-col items-start p-4 border-2 transition-all cursor-pointer"
                      style={{ borderColor: activeTheme.textColor }}
                    >
                      <span className="text-[10px] font-mono-tech uppercase mb-2 flex items-center gap-1"><ArrowLeft className="w-3 h-3"/> PREV_RECORD</span>
                      <span className="font-serif font-bold">{projects[activeProjectId].docs[prevPageKey].title}</span>
                    </button>
                  ) : <div />}
                  {nextPageKey ? (
                    <button 
                      onClick={() => goToPage(nextPageKey)} 
                      className="flex flex-col items-end text-right p-4 border-2 transition-all cursor-pointer"
                      style={{ borderColor: activeTheme.textColor }}
                    >
                      <span className="text-[10px] font-mono-tech uppercase mb-2 flex items-center gap-1">NEXT_RECORD <ArrowRight className="w-3 h-3"/></span>
                      <span className="font-serif font-bold">{projects[activeProjectId].docs[nextPageKey].title}</span>
                    </button>
                  ) : <div />}
                </div>}
              </>
            )}

          </div>
        </div>

      </div>
      {!isSharedView && <CommandPalette commands={commands} onClose={() => setCommandOpen(false)} open={commandOpen} theme={activeTheme} />}
    </div>
  );
};
