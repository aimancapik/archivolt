import assert from 'node:assert/strict';
import { markdownToBlocks } from './markdownToBlocks.js';

const blocks = markdownToBlocks(`# Upload Image

Uploads a file to storage.

\`\`\`js
const url = await uploadImage(file, folder)
\`\`\`

- Builds a path
- Uploads the file
1. Returns the URL`);

assert.deepEqual(
  blocks.map(({ type, value, language }) => ({ type, value, language })),
  [
    { type: 'heading', value: 'Upload Image', language: undefined },
    { type: 'text', value: 'Uploads a file to storage.', language: undefined },
    { type: 'code', value: 'const url = await uploadImage(file, folder)', language: 'js' },
    { type: 'list', value: 'Builds a path\nUploads the file\nReturns the URL', language: undefined }
  ]
);
