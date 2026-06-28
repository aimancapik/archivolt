const LEGACY_WIDTH = 800;
const LEGACY_HEIGHT = 600;
export const STICKER_STAGE_HEIGHT = 720;

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const clampMin = (value, min = 0) => Math.max(min, value);
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
  const rawY = numberOr(sticker.y ?? sticker.yPct, 0);
  const legacySized = numberOr(sticker.x ?? sticker.xPct, 0) > 100 || rawWidth > 100;

  return {
    x: percentFromLegacy(sticker.x ?? sticker.xPct, LEGACY_WIDTH, 0),
    y: round(clampMin(rawY > 100 && legacySized ? (rawY / LEGACY_HEIGHT) * 100 : rawY)),
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
  const stageHeight = Math.min(rect.height, STICKER_STAGE_HEIGHT);
  const maxY = (rect.height / stageHeight) * 100;

  return {
    x: round(clamp(((clientX - rect.left) / rect.width) * 100)),
    y: round(clamp(((clientY - rect.top) / stageHeight) * 100, 0, maxY))
  };
};
