import React, { useState } from 'react';

export const InteractiveInputDemo = () => {
  const [inputValue, setInputValue] = useState("");

  return (
    <div className="my-8 p-6 relative animate-fade-in" style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)' }}>
      <div className="absolute top-2 right-3 font-mono-tech" style={{ fontSize: '9px', opacity: 0.4 }}>INPUT_REQ</div>
      <h3 className="font-serif text-xl mb-4 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.15)' }}>Transmission</h3>
      <div className="flex flex-col sm:flex-row" style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
        <input
          type="text" 
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="ENTER OVERRIDE CODE..."
          className="flex-1 px-4 py-3 bg-transparent font-mono-tech focus:outline-none"
          style={{ fontSize: '13px', color: 'inherit' }}
        />
        <button className="px-6 py-3 font-display font-bold transition-opacity cursor-pointer" style={{ background: 'currentColor', color: 'white', mixBlendMode: 'difference', borderLeft: '1px solid rgba(255,255,255,0.15)', fontSize: '12px' }}>
          SEND
        </button>
      </div>
      <div className="mt-5 pt-3 font-mono-tech flex justify-between" style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', fontSize: '12px' }}>
        <span style={{ opacity: 0.5 }}>STATE.VALUE:</span>
        <span className="font-bold">{inputValue ? `[ ${inputValue} ]` : "[ EMPTY ]"}</span>
      </div>
    </div>
  );
};
