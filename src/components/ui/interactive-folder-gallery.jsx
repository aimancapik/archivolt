import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Folder, Image as ImageIcon, X } from 'lucide-react';

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
  const photoCount = photos.length;

  return (
    <div className={`relative w-full ${className}`}>
      <div className="relative flex min-h-[430px] w-full flex-col items-center justify-center overflow-hidden rounded-lg border border-[#e4e1d8] bg-[#f7f6f3] px-4 py-8 text-[#37352f] shadow-[0_16px_40px_rgba(15,15,15,0.08)]">
        <div className="absolute inset-x-0 top-0 flex items-center justify-between border-b border-[#e4e1d8] bg-[#fbfaf8]/90 px-4 py-3 text-xs text-[#78746c]">
          <div className="flex min-w-0 items-center gap-2">
            <Folder className="h-4 w-4 shrink-0 text-[#a1824a]" aria-hidden="true" />
            <span className="truncate font-mono-tech">{folderName}</span>
          </div>
          <span className="font-mono-tech">{photoCount} assets</span>
        </div>

        <div className="pointer-events-none relative z-0 mt-10 flex h-[340px] w-full max-w-[740px] justify-center">
          <motion.div
            className="absolute bottom-8 h-52 w-[320px]"
            animate={{ opacity: isFolderOpen ? 0 : 1, scale: isFolderOpen ? 0.9 : 1 }}
          >
            <div className="absolute left-5 top-0 h-10 w-32 rounded-t-md border border-b-0 border-[#d7d2c6] bg-[#ece7dc]" />
            <div className="absolute inset-x-0 bottom-0 top-8 rounded-md border border-[#d7d2c6] bg-[#f0ece2] shadow-[0_22px_50px_rgba(55,53,47,0.12)]" />
            <div className="absolute inset-x-4 bottom-4 top-16 rounded border border-[#ded9ce] bg-[#fbfaf8]" />
          </motion.div>

          <div className="absolute bottom-14 z-10 flex justify-center">
            {photos.map((photo, i) => {
              const offset = i - Math.floor(photos.length / 2);
              const stackY = hoverFolder ? offset * -8 - 34 : offset * -4;
              const stackX = hoverFolder ? offset * 24 : offset * 3;
              const stackRotate = hoverFolder ? offset * 5 : offset * 2;
              const stackScale = 1 - Math.abs(offset) * 0.03;
              const openScale = 1;

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
                  className={`absolute bottom-0 h-60 w-44 origin-bottom overflow-hidden rounded-md border border-[#dfdbd1] bg-white p-1.5 shadow-[0_16px_34px_rgba(55,53,47,0.16)] ${isFolderOpen ? 'pointer-events-auto cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
                  animate={!isFolderOpen ? {
                    y: stackY,
                    x: stackX,
                    rotate: stackRotate,
                    scale: stackScale,
                    zIndex: i + 10
                  } : {
                    y: -88,
                    x: offset * 116,
                    rotate: 0,
                    scale: openScale,
                    zIndex: 50
                  }}
                  whileHover={isFolderOpen ? { scale: openScale + 0.05, zIndex: 100 } : {}}
                  whileDrag={isFolderOpen ? { scale: openScale + 0.1, rotate: 5, zIndex: 150 } : {}}
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                >
                  <img src={photo.image} alt="" className="pointer-events-none h-full w-full rounded object-cover" />
                </motion.div>
              );
            })}
          </div>

          <motion.button
            type="button"
            className="pointer-events-auto absolute bottom-0 z-20 h-40 w-[340px] cursor-pointer"
            style={{ transformOrigin: 'bottom' }}
            animate={{
              opacity: isFolderOpen ? 0 : 1,
              rotateX: hoverFolder ? -14 : 0,
              y: hoverFolder ? 8 : 0,
              pointerEvents: isFolderOpen ? 'none' : 'auto'
            }}
            onMouseEnter={() => setHoverFolder(true)}
            onMouseLeave={() => setHoverFolder(false)}
            onClick={() => setIsFolderOpen(true)}
            aria-label="Open gallery folder"
          >
            <span className="relative flex h-full w-full items-end justify-center overflow-hidden rounded-md border border-[#d7d2c6] bg-[#eee9df] pb-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_24px_46px_rgba(55,53,47,0.14)]">
              <span className="absolute inset-x-5 top-5 h-px bg-[#d8d2c6]" />
              <span className="flex max-w-[280px] items-center gap-2 rounded border border-[#ded9ce] bg-[#fbfaf8] px-4 py-2 text-left shadow-sm">
                <ImageIcon className="h-4 w-4 shrink-0 text-[#78746c]" aria-hidden="true" />
                <span className="truncate text-sm font-medium text-[#37352f]">{folderName}</span>
              </span>
            </span>
          </motion.button>

          {isFolderOpen && (
            <button
              type="button"
              onClick={() => {
                setIsFolderOpen(false);
                setHoverFolder(false);
              }}
              className="pointer-events-auto absolute right-2 top-2 z-[160] flex h-9 w-9 items-center justify-center rounded border border-[#ded9ce] bg-[#fbfaf8] text-[#78746c] shadow-sm transition hover:bg-white hover:text-[#37352f]"
              aria-label="Close gallery"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <motion.div
          animate={{ opacity: isFolderOpen ? 1 : 0, y: isFolderOpen ? 0 : 18 }}
          className="pointer-events-none absolute bottom-5 rounded border border-[#ded9ce] bg-[#fbfaf8] px-4 py-2 font-mono-tech text-[11px] text-[#78746c] shadow-sm"
        >
          {dragHintText}
        </motion.div>
      </div>
    </div>
  );
}

export { InteractiveFolderGallery as Component };
