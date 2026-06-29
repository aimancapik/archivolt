import assert from 'node:assert/strict';
import { normalizeSticker, pointerToStickerPoint, stickerPlacementStyle } from './stickerPlacement.js';

assert.deepEqual(normalizeSticker({ x: 400, y: 300, width: 160, rotation: '15' }), {
  x: 50,
  y: 50,
  width: 20,
  rotation: 15
});

assert.deepEqual(pointerToStickerPoint(30, 60, { left: 10, top: 20, width: 80, height: 160 }), {
  x: 25,
  y: 25
});

assert.equal(stickerPlacementStyle({ x: 25, y: 75, width: 12 }).left, '25%');
assert.equal(stickerPlacementStyle({ x: 25, y: 75, width: 12 }).top, '75%');
assert.equal(stickerPlacementStyle({ y: 100 }).top, '100%');
