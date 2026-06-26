import React, { useRef, useState } from 'react';
import { Plus, ArrowLeft, ArrowRight, ChevronDown, Edit3, Trash2, Settings } from 'lucide-react';
import { DataEntryForm } from '../components/DataEntryForm';

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
  handleSaveNewData,
  handleUpdateDocument,
  handleDeleteDocument,
  handleDeleteProject,
  renderContent
}) => {
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [hasDirtyEdit, setHasDirtyEdit] = useState(false);
  const contentRef = useRef(null);
  const scrollToTop = () => contentRef.current?.scrollTo(0, 0);

  const confirmDiscardEdit = () => {
    if (!isEditingData || !hasDirtyEdit) return true;
    return confirm('Discard unsaved changes?');
  };

  const leaveEditor = () => {
    setIsAddingData(false);
    setIsEditingData(false);
    setHasDirtyEdit(false);
  };

  const goToPage = (key) => {
    if (key === activePage) return;
    if (!confirmDiscardEdit()) return;
    setActivePage(key);
    leaveEditor();
    scrollToTop();
  };

  return (
    <div className="h-full w-full flex justify-center items-center px-2 md:px-6 lg:px-10 animate-fade-in" style={{ zIndex: 10 }}>
      <div 
        className="w-full max-w-[1400px] h-[90vh] flex shadow-2xl relative"
        style={{
          background: 'rgba(0, 0, 0, 0.15)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          overflow: 'hidden'
        }}
      >
        {/* LEFT SIDE: Vertical Staggered Tabs */}
        <div className="flex flex-col z-10 w-24 md:w-32 shrink-0 -mr-[2px] overflow-y-auto scrollbar-none" style={{ maxHeight: '100%' }}>
          {pageKeys.map((key, index) => {
            const isActive = activePage === key;
            const doc = activeProject.docs[key];
            const theme = PALETTE[index % PALETTE.length];
            
            return (
              <button
                key={key}
                onClick={() => goToPage(key)}
                className={`
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
                
                {isActive && (
                  <div className="absolute top-4 right-2 writing-vertical text-[8px] font-mono-tech opacity-50">
                    {doc.subtitle}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* RIGHT SIDE: Active Folder Content */}
        <div
          ref={contentRef}
          className="flex-1 border-2 relative overflow-y-auto transition-colors duration-500 rounded-tr-lg rounded-br-lg"
          style={{
            backgroundColor: activeTheme.bgColor,
            color: activeTheme.textColor,
            borderColor: activeTheme.borderColor || 'black',
          }}
        >
          
          {/* Top Bar / Project Switcher */}
          <div 
            className="sticky top-0 z-30 border-b-2 px-6 py-3 flex items-center justify-between bg-inherit backdrop-blur-md"
            style={{ borderColor: activeTheme.borderColor }}
          >
            <div className="flex items-center gap-4">
              <div className="relative inline-flex items-center">
                <select 
                  value={activeProjectId}
                  onChange={(e) => {
                    if (!confirmDiscardEdit()) return;
                    setActiveProjectId(e.target.value);
                    setActivePage(Object.keys(projects[e.target.value].docs)[0]);
                    leaveEditor();
                  }}
                  className="appearance-none bg-transparent font-serif font-bold text-xl md:text-3xl tracking-tighter uppercase focus:outline-none cursor-pointer border-none pr-8"
                  style={{ color: activeTheme.textColor }}
                >
                  {Object.values(projects).map((p) => (
                    <option key={p.id} value={p.id} style={{ color: '#1a1b1c', background: '#e4decd' }}>{p.name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 h-4 w-4 opacity-60" />
              </div>
              <span className="font-mono-tech text-xs opacity-50 hidden md:block">_{activeProject.version}</span>
            </div>

            <div className="flex items-center gap-4">
              <button 
                onClick={() => {
                  if (!confirmDiscardEdit()) return;
                  setIsAddingData(!isAddingData);
                  setIsEditingData(false);
                  setHasDirtyEdit(false);
                  setShowProjectSettings(false);
                }}
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
                    onClick={() => { setIsEditingData(true); setIsAddingData(false); setHasDirtyEdit(false); }}
                    className="p-2 border-2 transition-colors cursor-pointer"
                    style={{
                      borderColor: activeTheme.textColor,
                      backgroundColor: isEditingData ? activeTheme.textColor : 'transparent',
                      color: isEditingData ? activeTheme.bgColor : activeTheme.textColor,
                    }}
                    title="Edit Document"
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
            </div>
          </div>

          {showProjectSettings && (
            <div className="sticky top-[66px] z-20 px-6 py-3 flex justify-end bg-inherit border-b" style={{ borderColor: activeTheme.borderColor }}>
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
          <div className="p-6 md:p-12 lg:p-20 max-w-4xl mx-auto relative min-h-full">
            
            {isAddingData || isEditingData ? (
              // --- RENDER THE NEW DATA ENTRY FORM ---
              <DataEntryForm 
                key={`${isEditingData ? 'edit' : 'create'}-${activeProjectId}-${activePage}`}
                onSave={isEditingData ? handleUpdateDocument : handleSaveNewData}
                onDelete={isEditingData ? handleDeleteDocument : undefined}
                onDirtyChange={isEditingData ? setHasDirtyEdit : undefined}
                onCancel={() => {
                  if (!confirmDiscardEdit()) return;
                  leaveEditor();
                }}
                activeColorTheme={activeTheme}
                activeProject={activeProject}
                mode={isEditingData ? 'edit' : 'create'}
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

                {/* Page Content */}
                <div className="mt-12 md:mt-0 relative z-10 animate-fade-in">
                  {currentPageData?.content.map((block, index) => renderContent(block, index))}
                </div>

                {/* Brutalist Pagination Footer */}
                <div 
                  className="mt-24 pt-8 border-t-4 grid grid-cols-2 gap-4 pb-12"
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
                </div>
              </>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};
