const LEGACY_WIDTH = 800;
const LEGACY_HEIGHT = 600;
export const STICKER_STAGE_HEIGHT = 720;

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round = (value) => Number(value.toFixed(2));

const numberOr = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const percentFromLegacy = (value, legacyMax, fallback) => {
  const parsed = numberOr(value, fallback);
  return round(clamp(parsed > 100 ? (parsed / legacyMax) * 100 : parsed));
};

export const normalizeSticker = (sticker = {}) => {
  const rawWidth = numberOr(sticker.width, 22);

  return {
    x: percentFromLegacy(sticker.x ?? sticker.xPct, LEGACY_WIDTH, 0),
    y: percentFromLegacy(sticker.y ?? sticker.yPct, LEGACY_HEIGHT, 0),
    width: round(clamp(rawWidth > 100 ? (rawWidth / LEGACY_WIDTH) * 100 : rawWidth, 5, 100)),
    rotation: numberOr(sticker.rotation, 0)
  };
};

export const stickerPlacementStyle = (sticker) => {
  const { x, y, width, rotation } = normalizeSticker(sticker);

  return {
    left: `${x}%`,
    top: `${round((y / 100) * STICKER_STAGE_HEIGHT)}px`,
    width: `${width}%`,
    transform: `translate(-50%, -50%) rotate(${rotation}deg)`
  };
};

export const pointerToStickerPoint = (clientX, clientY, rect) => {
  if (!rect.width || !rect.height) return { x: 0, y: 0 };
  const height = Math.min(rect.height, STICKER_STAGE_HEIGHT);

  return {
    x: round(clamp(((clientX - rect.left) / rect.width) * 100)),
    y: round(clamp(((clientY - rect.top) / height) * 100))
  };
};
