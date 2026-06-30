import React, { useState } from 'react';
import { motion } from 'framer-motion';

const defaultPhotos = [
  { id: 1, image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop' },
  { id: 2, image: 'https://images.unsplash.com/photo-1604871000636-074fa5117945?q=80&w=800&auto=format&fit=crop' },
  { id: 3, image: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=800&auto=format&fit=crop' },
  { id: 4, image: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?q=80&w=800&auto=format&fit=crop' },
  { id: 5, image: 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?q=80&w=800&auto=format&fit=crop' },
];

export function InteractiveFolderGallery({
  photos = defaultPhotos,
  folderName = 'ARCHIVE.gallery',
  dragHintText = 'Drag any photo down to close',
  className = ''
}) {
  const [isFolderOpen, setIsFolderOpen] = useState(false);
  const [hoverFolder, setHoverFolder] = useState(false);

  return (
    <div className={`relative w-full py-20 ${className}`}>
      <div className="relative flex min-h-[500px] w-full flex-col items-center justify-center overflow-hidden">
        <div className="pointer-events-none relative z-0 flex h-[500px] w-full max-w-[720px] justify-center">
          <motion.div
            className="absolute bottom-6 h-56 w-80 drop-shadow-2xl"
            animate={{ opacity: isFolderOpen ? 0 : 1, scale: isFolderOpen ? 0.9 : 1 }}
          >
            <div className="absolute left-0 top-0 h-10 w-32 rounded-t-xl border-l border-r border-t border-white/10 bg-linear-to-t from-[#1e1e1e] to-[#2a2a2a]" />
            <div className="absolute bottom-0 left-0 right-0 top-8 rounded-b-xl rounded-tr-xl border border-white/10 bg-linear-to-b from-[#1e1e1e] to-[#0a0a0a] shadow-[inset_0_0_40px_rgba(0,0,0,0.8)]" />
            <div className="pointer-events-none absolute bottom-2 left-2 right-2 top-10 rounded-lg bg-black shadow-inner" />
          </motion.div>

          <div className="absolute bottom-10 z-10 flex justify-center">
            {photos.map((photo, i) => {
              const offset = i - Math.floor(photos.length / 2);
              const stackY = hoverFolder ? offset * -10 - 40 : offset * -5;
              const stackX = hoverFolder ? offset * 30 : offset * 3;
              const stackRotate = hoverFolder ? offset * 8 : offset * 3;
              const stackScale = 1 - Math.abs(offset) * 0.03;
              const openScale = 1.05;

              return (
                <motion.div
                  key={photo.id}
                  drag={isFolderOpen}
                  dragSnapToOrigin
                  onDragEnd={(_, info) => {
                    if (info.offset.y > 100 && isFolderOpen) {
                      setIsFolderOpen(false);
                      setHoverFolder(false);
                    }
                  }}
                  className={`absolute bottom-0 h-72 w-56 origin-bottom overflow-hidden rounded-xl border border-white/20 shadow-[0_20px_40px_rgba(0,0,0,0.5)] ${isFolderOpen ? 'pointer-events-auto cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
                  animate={!isFolderOpen ? {
                    y: stackY,
                    x: stackX,
                    rotate: stackRotate,
                    scale: stackScale,
                    zIndex: i + 10
                  } : {
                    y: -130,
                    x: offset * 130,
                    rotate: 0,
                    scale: openScale,
                    zIndex: 50
                  }}
                  whileHover={isFolderOpen ? { scale: openScale + 0.05, zIndex: 100 } : {}}
                  whileDrag={isFolderOpen ? { scale: openScale + 0.1, rotate: 5, zIndex: 150 } : {}}
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                >
                  <img src={photo.image} alt="" className="pointer-events-none h-full w-full object-cover" />
                </motion.div>
              );
            })}
          </div>

          <motion.button
            type="button"
            className="pointer-events-auto absolute bottom-0 z-20 h-44 w-[340px] cursor-pointer drop-shadow-[0_-20px_40px_rgba(0,0,0,0.8)]"
            style={{ transformOrigin: 'bottom' }}
            animate={{
              opacity: isFolderOpen ? 0 : 1,
              rotateX: hoverFolder ? -25 : 0,
              y: hoverFolder ? 10 : 0,
              pointerEvents: isFolderOpen ? 'none' : 'auto'
            }}
            onMouseEnter={() => setHoverFolder(true)}
            onMouseLeave={() => setHoverFolder(false)}
            onClick={() => setIsFolderOpen(true)}
            aria-label="Open gallery folder"
          >
            <span className="relative flex h-full w-full items-end justify-center overflow-hidden rounded-2xl border border-white/20 bg-linear-to-b from-[#2a2a2a] to-[#111] pb-8 shadow-[inset_0_2px_10px_rgba(255,255,255,0.1)]">
              <span className="absolute left-0 right-0 top-0 h-px bg-linear-to-r from-transparent via-white/40 to-transparent" />
              <span className="flex items-center justify-center rounded-lg border border-black/80 bg-black px-5 py-2.5 shadow-inner backdrop-blur-md">
                <span className="text-sm font-medium tracking-wide text-white/90">{folderName}</span>
              </span>
            </span>
          </motion.button>
        </div>

        <motion.div
          animate={{ opacity: isFolderOpen ? 1 : 0, y: isFolderOpen ? 0 : 50 }}
          className="pointer-events-none absolute bottom-10 rounded-full border border-white/10 bg-white/5 px-6 py-3 font-mono-tech text-sm font-medium uppercase tracking-widest text-white/50 backdrop-blur-md"
        >
          {dragHintText}
        </motion.div>
      </div>
    </div>
  );
}

export { InteractiveFolderGallery as Component };
