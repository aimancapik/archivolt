import assert from 'node:assert/strict';
import { recordSlug, shouldSeedArchive, uniqueRecordKey } from './archiveIdentity.js';

assert.equal(recordSlug('My Page'), 'my_page');
assert.equal(uniqueRecordKey({ my_page: {} }, 'My Page'), 'my_page_2');
assert.equal(uniqueRecordKey({ 'my-project': {} }, 'My Project', '-', 'project'), 'my-project-2');
assert.equal(shouldSeedArchive(null, null), true);
assert.equal(shouldSeedArchive({}, null), false);
assert.equal(shouldSeedArchive(null, {}), false);
