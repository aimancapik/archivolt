import assert from 'node:assert/strict';
import { checklistItemsFromText } from './checklist.js';

assert.deepEqual(checklistItemsFromText('[ ] Run build\n[x] Push code\nReview UI'), [
  { checked: false, text: 'Run build' },
  { checked: true, text: 'Push code' },
  { checked: false, text: 'Review UI' }
]);

assert.deepEqual(checklistItemsFromText('[ ] ', { keepEmpty: true }), [
  { checked: false, text: '' }
]);

assert.deepEqual(checklistItemsFromText('[ ] hello ', { keepEmpty: true, preserveWhitespace: true }), [
  { checked: false, text: 'hello ' }
]);
