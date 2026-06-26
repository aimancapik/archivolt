import React, { useState } from 'react';
import { Plus, Minimize2, Maximize2, ArrowLeft, ArrowRight, Edit3, Trash2, Settings } from 'lucide-react';
import { cn } from '../utils/helpers';
import { DataEntryForm } from '../components/DataEntryForm';

export const CabinetLayout = ({
  projects,
  activeProjectId,
  setActiveProjectId,
  activePage,
  setActivePage,
  isAddingData,
  setIsAddingData,
  isEditingData,
  setIsEditingData,
  isExpanded,
  setIsExpanded,
  viewMode,
  setViewMode,
  contentRef,
  activeProject,
  pageKeys,
  prevPageKey,
  nextPageKey,
  activeTheme,
  getDocTheme,
  scrollToTop,
  handleSaveNewData,
  handleUpdateDocument,
  handleDeleteDocument,
  handleDeleteProject,
  currentPageData,
  renderContent
}) => {
  const [showProjectSettings, setShowProjectSettings] = useState(false);

  return (
    <div className="h-full w-full overflow-y-auto px-4 md:px-10 py-10 relative" ref={contentRef} style={{ zIndex: 10 }}>
      <div className="max-w-4xl mx-auto pb-24">
        
        {/* --- Breadcrumb and Title Header --- */}
        <div className="mb-12 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="font-mono-tech uppercase mb-2" style={{ fontSize: '9px', letterSpacing: '0.25em', color: '#888' }}>
              ARCHIVOLT // PROJECT_FILES
            </div>
            <div className="flex items-center gap-2 animate-fade-in" style={{ color: '#e4decd' }}>
              <select
                value={activeProjectId}
                onChange={(e) => {
                  setActiveProjectId(e.target.value);
                  setActivePage(Object.keys(projects[e.target.value].docs)[0]);
                  setIsAddingData(false);
                  setIsEditingData(false);
                  setIsExpanded(false);
                }}
                className="appearance-none bg-transparent font-serif font-bold uppercase focus:outline-none cursor-pointer pr-2 border-none"
                style={{
                  fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                  color: '#e4decd',
                }}
              >
                {Object.values(projects).map((p) => (
                  <option key={p.id} value={p.id} style={{ color: '#1a1b1c', background: '#e4decd' }}>{p.name}</option>
                ))}
              </select>
              <span className="text-xs" style={{ opacity: 0.5 }}>▼</span>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            {/* View toggle */}
            <div className="retro-toggle-group" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
              <button
                type="button"
                onClick={() => setViewMode('cabinet')}
                className="retro-toggle-btn cursor-pointer"
                style={viewMode === 'cabinet' ? { backgroundColor: '#e4decd', color: '#1a1b1c' } : { color: '#e4decd', opacity: 0.6 }}
              >
                CABINET
              </button>
              <button
                type="button"
                onClick={() => setViewMode('sidebar')}
                className="retro-toggle-btn cursor-pointer"
                style={viewMode === 'sidebar' ? { backgroundColor: '#e4decd', color: '#1a1b1c' } : { color: '#e4decd', opacity: 0.6 }}
              >
                SIDEBAR
              </button>
            </div>

            <span className="font-mono-tech text-xs hidden sm:inline" style={{ color: '#666' }}>
              VER_{activeProject.version}
            </span>
            <button
              onClick={() => { setIsAddingData(!isAddingData); setIsEditingData(false); }}
              className="p-2 transition-all flex items-center gap-1.5 font-mono-tech text-xs cursor-pointer"
              style={{
                border: '1px solid rgba(255,255,255,0.15)',
                background: isAddingData ? '#e4decd' : 'transparent',
                color: isAddingData ? '#1a1b1c' : '#e4decd',
              }}
              title="New Directory"
            >
              <Plus className="w-3.5 h-3.5" style={{ transition: 'transform 0.3s ease', transform: isAddingData ? 'rotate(45deg)' : 'none' }} />
              ADD_RECORD
            </button>
            <button
              type="button"
              onClick={() => { setIsEditingData(true); setIsAddingData(false); }}
              className="p-2 transition-all flex items-center gap-1.5 font-mono-tech text-xs cursor-pointer"
              style={{ border: '1px solid rgba(255,255,255,0.15)', background: isEditingData ? '#e4decd' : 'transparent', color: isEditingData ? '#1a1b1c' : '#e4decd' }}
              title="Edit Document"
            >
              <Edit3 className="w-3.5 h-3.5" /> EDIT
            </button>
            <button
              type="button"
              onClick={() => setShowProjectSettings(!showProjectSettings)}
              className="p-2 transition-all flex items-center gap-1.5 font-mono-tech text-xs cursor-pointer"
              style={{ border: '1px solid rgba(255,255,255,0.15)', background: showProjectSettings ? '#e4decd' : 'transparent', color: showProjectSettings ? '#1a1b1c' : '#e4decd' }}
              title="Project Settings"
            >
              <Settings className="w-3.5 h-3.5" /> SETTINGS
            </button>
          </div>
        </div>

        {showProjectSettings && (
          <div className="mb-8 flex justify-end">
            <button
              type="button"
              onClick={handleDeleteProject}
              className="px-4 py-2 border font-mono-tech text-xs uppercase cursor-pointer flex items-center gap-2"
              style={{ borderColor: 'rgba(255,95,87,0.45)', color: '#ff5f57', background: 'transparent' }}
            >
              <Trash2 className="w-3.5 h-3.5" /> DELETE PROJECT
            </button>
          </div>
        )}

        <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', marginBottom: '48px' }} />

        {/* --- Main Content area --- */}
        {isAddingData || isEditingData ? (
          <div className="archive-folder archive-folder-active" style={{ backgroundColor: activeTheme.bgColor, color: activeTheme.textColor, borderColor: activeTheme.borderColor }}>
            <div className="folder-tab">
              <span className="folder-tab-badge">{isEditingData ? 'EDIT' : 'ADD'}</span>
              <span className="folder-tab-title">{isEditingData ? 'EDIT RECORD' : 'NEW RECORD'}</span>
              <div className="folder-tab-meta">
                <span className="folder-tab-barcode" style={{ color: activeTheme.textColor }} />
              </div>
            </div>
            <div className="folder-body">
              <DataEntryForm
                onSave={isEditingData ? handleUpdateDocument : handleSaveNewData}
                onDelete={isEditingData ? handleDeleteDocument : undefined}
                onCancel={() => { setIsAddingData(false); setIsEditingData(false); }}
                activeColorTheme={activeTheme}
                activeProject={activeProject}
                mode={isEditingData ? 'edit' : 'create'}
                initialData={isEditingData ? {
                  recordType: 'document',
                  pageTitle: currentPageData.title,
                  version: currentPageData.subtitle,
                  blocks: currentPageData.content,
                  theme: currentPageData.theme || 'current'
                } : null}
              />
            </div>
          </div>
        ) : (
          <div className={cn("archive-cabinet", isExpanded ? "archive-cabinet-expanded" : "")}>
            {pageKeys.map((key, index) => {
              const isActive = activePage === key;
              const doc = activeProject.docs[key];
              const theme = getDocTheme(doc, index);

              return (
                <div
                  key={key}
                  onClick={isActive ? undefined : () => setActivePage(key)}
                  className={cn(
                    "archive-folder",
                    isActive ? "archive-folder-active" : "archive-folder-inactive"
                  )}
                  style={{
                    backgroundColor: theme.bgColor,
                    color: theme.textColor,
                    borderColor: theme.borderColor,
                    zIndex: index + 1,
                  }}
                >
                  {/* Folder Tab on the left/top */}
                  <div className="folder-tab">
                    <span className="folder-tab-badge">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="folder-tab-title">{doc.title}</span>
                    <div className="folder-tab-meta">
                      <span className="folder-tab-barcode" style={{ color: theme.textColor }} />
                    </div>
                  </div>

                  {/* Folder Content on the right/bottom */}
                  <div className="folder-body">
                    <div className="animate-fade-in">
                      {/* Header/Subtitle Stamp */}
                      <div className="mb-10 animate-fade-in">
                        <div className="flex items-start justify-between gap-6 mb-4">
                          <div className="min-w-0 pr-4 flex-1">
                            <div className="font-mono-tech uppercase mb-1" style={{ fontSize: '9px', letterSpacing: '0.2em', opacity: 0.5 }}>
                              {doc.subtitle}
                            </div>
                            <h2 className="font-serif font-bold break-words" style={{ fontSize: isExpanded ? 'clamp(1.8rem, 4vw, 2.8rem)' : 'clamp(1.2rem, 2.5vw, 1.8rem)', lineHeight: 1.1 }}>
                              {doc.title}
                            </h2>
                          </div>
                          <div className="hidden md:flex items-center gap-4 flex-shrink-0" style={{ opacity: 0.85 }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsExpanded(!isExpanded);
                              }}
                              className="expand-toggle-btn cursor-pointer"
                              title={isExpanded ? "Collapse Cabinet" : "Expand Cabinet"}
                              style={{ color: theme.textColor }}
                            >
                              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                            </button>
                            {isExpanded && (
                              <div className="flex flex-col items-end gap-1.5" style={{ opacity: 0.5 }}>
                                <div className="barcode" style={{ color: theme.textColor }} />
                                <div className="font-mono-tech text-right uppercase" style={{ fontSize: '7px', lineHeight: 1.5 }}>
                                  REC_{String(index + 1).padStart(3, '0')}<br />
                                  ARCHIVE_SYS<br />
                                  {doc.subtitle}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ height: 1, background: theme.textColor, opacity: 0.15 }} />
                      </div>

                      {/* Render Content Blocks */}
                      <div className="relative z-10">
                        {doc.content.map((block, blockIndex) => renderContent(block, blockIndex))}
                      </div>

                      {/* Pagination footer inside the active folder card */}
                      <div className="mt-14 pt-6 grid grid-cols-2 gap-4" style={{ borderTop: `1px solid ${theme.textColor}`, opacity: 0.8 }}>
                        {prevPageKey ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Elak trigger activation folder
                              setActivePage(prevPageKey);
                              scrollToTop();
                            }}
                            className="flex flex-col items-start p-3 text-left transition-all cursor-pointer"
                            style={{ border: `1px solid ${theme.borderColor}`, borderRadius: '4px' }}
                          >
                            <span className="font-mono-tech uppercase mb-1 flex items-center gap-1" style={{ fontSize: '8px', opacity: 0.6 }}>
                              <ArrowLeft className="w-3 h-3" /> PREV_RECORD
                            </span>
                            <span className="font-serif font-bold" style={{ fontSize: '14px' }}>{projects[activeProjectId].docs[prevPageKey].title}</span>
                          </button>
                        ) : <div />}
                        {nextPageKey ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Elak trigger activation folder
                              setActivePage(nextPageKey);
                              scrollToTop();
                            }}
                            className="flex flex-col items-end text-right p-3 transition-all cursor-pointer"
                            style={{ border: `1px solid ${theme.borderColor}`, borderRadius: '4px' }}
                          >
                            <span className="font-mono-tech uppercase mb-1 flex items-center gap-1" style={{ fontSize: '8px', opacity: 0.6 }}>
                              NEXT_RECORD <ArrowRight className="w-3 h-3" />
                            </span>
                            <span className="font-serif font-bold" style={{ fontSize: '14px' }}>{projects[activeProjectId].docs[nextPageKey].title}</span>
                          </button>
                        ) : <div />}
                      </div>

                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
      </div>
    </div>
  );
};
