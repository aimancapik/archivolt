import assert from 'node:assert/strict';
import { detectBlackboardPayload } from './blackboard.js';

const graph = detectBlackboardPayload(JSON.stringify({
  title: 'Flow',
  nodes: [
    { id: 'a', label: 'Input' },
    { id: 'b', label: 'Model' }
  ],
  edges: [
    { from: 'a', to: 'b', label: 'prompt' }
  ]
}));

assert.equal(graph.kind, 'graph');
assert.equal(graph.nodes.length, 2);
assert.equal(graph.edges.length, 1);

const chart = detectBlackboardPayload(JSON.stringify({
  type: 'bar',
  labels: ['Q1', 'Q2'],
  values: [12, 18]
}));

assert.equal(chart.kind, 'chart');
assert.equal(chart.type, 'bar');

const mermaid = detectBlackboardPayload('```mermaid\ngraph TD\nA-->B\n```');
assert.equal(mermaid.kind, 'mermaid');
assert.equal(mermaid.text, 'graph TD\nA-->B');

const notes = detectBlackboardPayload('plain notes');
assert.equal(notes.kind, 'text');
assert.equal(notes.text, 'plain notes');
