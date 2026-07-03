const MERMAID_PREFIXES = [
  'graph ',
  'flowchart ',
  'sequenceDiagram',
  'classDiagram',
  'stateDiagram',
  'erDiagram',
  'journey',
  'gantt',
  'pie',
  'mindmap',
  'timeline',
  'gitGraph',
  'quadrantChart',
  'xychart-beta'
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toNumber = (value, fallback) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const parseMermaid = (value) => {
  const trimmed = String(value || '').trim();
  const fenced = trimmed.match(/^```mermaid\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1].trim();
  return MERMAID_PREFIXES.some((prefix) => trimmed.startsWith(prefix)) ? trimmed : '';
};

const layoutGraphNodes = (nodes) => {
  const total = Math.max(nodes.length, 1);
  return nodes.map((node, index) => {
    const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
    return {
      ...node,
      x: toNumber(node.x, 50 + Math.cos(angle) * 34),
      y: toNumber(node.y, 50 + Math.sin(angle) * 28),
    };
  });
};

const normalizeGraph = (value) => {
  const source = Array.isArray(value)
    ? { nodes: value, edges: [] }
    : value?.graph && typeof value.graph === 'object'
      ? value.graph
      : value;
  const nodes = Array.isArray(source?.nodes) ? source.nodes : [];
  const edges = Array.isArray(source?.edges) ? source.edges : [];
  if (!nodes.length) return null;

  return {
    title: source?.title || source?.label || 'Graph view',
    nodes: layoutGraphNodes(nodes.map((node, index) => ({
      id: String(node.id ?? node.name ?? node.label ?? `node-${index}`),
      label: String(node.label ?? node.name ?? node.id ?? `Node ${index + 1}`),
      x: node.x,
      y: node.y
    }))),
    edges: edges.map((edge, index) => ({
      id: String(edge.id ?? `edge-${index}`),
      from: String(edge.from ?? edge.source ?? edge.start ?? ''),
      to: String(edge.to ?? edge.target ?? edge.end ?? ''),
      label: edge.label ? String(edge.label) : ''
    })).filter((edge) => edge.from && edge.to)
  };
};

const normalizeChart = (value) => {
  const source = value?.chart && typeof value.chart === 'object' ? value.chart : value;
  const labels = Array.isArray(source?.labels) ? source.labels.map((label) => String(label)) : [];
  const values = Array.isArray(source?.values)
    ? source.values
    : Array.isArray(source?.data)
      ? source.data
      : Array.isArray(source?.series)
        ? source.series
        : [];
  if (!labels.length || !values.length || labels.length !== values.length) return null;

  return {
    title: source?.title || 'Chart view',
    type: source?.type === 'line' ? 'line' : 'bar',
    labels,
    values: values.map((item) => typeof item === 'number' ? item : Number(item?.value ?? item))
  };
};

export const detectBlackboardPayload = (value) => {
  const text = String(value || '').trim();
  if (!text) return { kind: 'empty', title: 'Blackboard', text: '' };

  const mermaid = parseMermaid(text);
  if (mermaid) return { kind: 'mermaid', title: 'Mermaid board', text: mermaid };

  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      const graph = normalizeGraph(parsed);
      if (graph) return { kind: 'graph', ...graph };

      const chart = normalizeChart(parsed);
      if (chart && chart.values.every(Number.isFinite)) return { kind: 'chart', ...chart };
    } catch {
      // ponytail: invalid JSON falls back to plain text without extra recovery logic.
    }
  }

  return { kind: 'text', title: 'Notes', text };
};

export const graphNodeStyle = (index) => ({
  fill: index % 2 === 0 ? '#c9a96e' : '#9db7d9',
  stroke: '#111213'
});

export const chartExtent = (values) => {
  const max = Math.max(...values, 0);
  return max <= 0 ? 1 : max;
};

export const percentPoint = (value) => `${clamp(value, 0, 100)}%`;
