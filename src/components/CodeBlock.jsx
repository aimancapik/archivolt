import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { syntaxHighlight } from '../utils/helpers';

export const CodeBlock = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const lines = code.split('\n');

  return (
    <div className="my-5 overflow-hidden animate-fade-in" style={{ background: '#0d0d0e', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between px-4 py-2" style={{ background: '#161618', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: '#ff5f57' }}></span>
            <span className="w-2 h-2 rounded-full" style={{ background: '#febc2e' }}></span>
            <span className="w-2 h-2 rounded-full" style={{ background: '#28c840' }}></span>
          </div>
          <span className="font-mono-tech uppercase" style={{ fontSize: '9px', letterSpacing: '0.15em', color: '#555' }}>{language}</span>
        </div>
        <button onClick={handleCopy} className="p-1 transition-colors cursor-pointer" style={{ color: '#555' }}>
          {copied ? <Check className="w-3.5 h-3.5" style={{ color: '#28c840' }} /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <div className="flex overflow-x-auto">
        <div className="flex-shrink-0 py-4 pl-3 pr-2 select-none" style={{ borderRight: '1px solid rgba(255,255,255,0.04)' }}>
          {lines.map((_, i) => (
            <div key={i} className="font-mono-tech text-right" style={{ fontSize: '10px', color: '#333', lineHeight: '1.65', minWidth: '18px' }}>{i + 1}</div>
          ))}
        </div>
        <pre
          className="py-4 px-4 m-0 font-mono-tech flex-1"
          style={{ fontSize: '12px', lineHeight: '1.65', color: '#e4decd' }}
          dangerouslySetInnerHTML={syntaxHighlight(code, language)}
        />
      </div>
    </div>
  );
};
