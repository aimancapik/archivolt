import assert from 'node:assert/strict';
import { documentHeadings, headingDomId, slugify } from './documentStructure.js';

assert.equal(slugify('DATA_STRUCT // API'), 'data-struct-api');
assert.equal(headingDomId('getting_started', 2, 'System Boot'), 'heading-getting-started-2-system-boot');
assert.deepEqual(documentHeadings([{ type: 'text', value: 'x' }, { type: 'heading', value: 'Boot' }], 'doc'), [
  { id: 'heading-doc-1-boot', index: 1, title: 'Boot' }
]);
