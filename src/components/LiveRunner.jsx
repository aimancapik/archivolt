import React, { useState, useRef } from 'react';
import { Play } from 'lucide-react';
import { syntaxHighlight, formatCode } from '../utils/helpers';

export const LiveRunner = ({ defaultCode }) => {
  const [code, setCode] = useState(defaultCode);
  const [output, setOutput] = useState(defaultCode);
  const preRef = useRef(null);

  const handleScroll = (e) => {
    if (preRef.current) {
      preRef.current.scrollTop = e.target.scrollTop;
      preRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  const handleFormat = () => {
    const formatted = formatCode(code);
    setCode(formatted);
  };

  const handleKeyDown = (e) => {
    if (e.shiftKey && e.altKey && (e.key === 'F' || e.key === 'f')) {
      e.preventDefault();
      handleFormat();
    }
  };

  return (
    <div className="my-8 flex flex-col xl:flex-row overflow-hidden animate-fade-in" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
      <div className="flex-1 flex flex-col" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', background: '#0d0d0e', color: '#e4decd' }}>
        <div className="flex items-center justify-between px-4 py-2" style={{ background: '#161618', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="font-mono-tech uppercase" style={{ fontSize: '9px', letterSpacing: '0.15em', color: '#555' }}>INPUT_BUFFER</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleFormat}
              className="runner-execute-btn cursor-pointer"
              style={{ background: 'transparent', color: '#e4decd', borderColor: 'rgba(255,255,255,0.15)', boxShadow: 'none' }}
              title="Format Code (Shift + Alt + F)"
            >
              FORMAT
            </button>
            <button
              onClick={() => setOutput(code)}
              className="runner-execute-btn cursor-pointer"
            >
              <Play className="w-3 h-3" fill="currentColor" /> EXECUTE
            </button>
          </div>
        </div>
        <div className="relative flex-1 w-full" style={{ minHeight: '250px' }}>
          <pre
            ref={preRef}
            className="absolute inset-0 p-4 m-0 font-mono-tech whitespace-pre overflow-auto pointer-events-none"
            style={{ fontSize: '13px', lineHeight: '1.65', color: '#e4decd' }}
            dangerouslySetInnerHTML={syntaxHighlight(code, 'playground')}
          />
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            className="absolute inset-0 w-full h-full p-4 font-mono-tech bg-transparent resize-none focus:outline-none overflow-auto whitespace-pre"
            style={{ fontSize: '13px', lineHeight: '1.65', color: 'transparent', caretColor: 'white' }}
            spellCheck="false"
          />
        </div>
      </div>
      <div className="flex-1 flex flex-col" style={{ background: '#fff', color: '#111' }}>
        <div className="px-4 py-2 font-mono-tech font-bold uppercase" style={{ fontSize: '9px', letterSpacing: '0.15em', background: '#e4decd', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
          OUTPUT_RENDER
        </div>
        <div className="flex-1 relative" style={{ minHeight: '250px' }}>
          <iframe title="Preview" srcDoc={output} className="absolute inset-0 w-full h-full border-none" sandbox="allow-scripts allow-modals" />
        </div>
      </div>
    </div>
  );
};

