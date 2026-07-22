import assert from 'node:assert/strict';
import { normalizeEmailOtp, syntaxHighlight } from './helpers.js';

assert.equal(normalizeEmailOtp('12 34-567'), '123456');
assert.equal(normalizeEmailOtp('abc'), '');

const html = syntaxHighlight('if (this.addForm.valid) delete payload[0].sequence; service.save(12);', 'typescript').__html;

assert.match(html, /color: #f92672/);
assert.match(html, /color: #66d9ef/);
assert.match(html, /color: #bd93f9/);
assert.match(html, /color: #8be9fd/);
assert.match(html, /color: #ae81ff/);
assert.match(html, /if/);
assert.match(html, /delete/);
