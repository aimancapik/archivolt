import assert from 'node:assert/strict';
import { orderedPageKeys } from './pageOrder.js';

assert.deepEqual(orderedPageKeys({
  first: { title: 'First' },
  pinned: { title: 'Pinned', pinned: true },
  last: { title: 'Last' }
}), ['pinned', 'first', 'last']);
