import React, { useId, useMemo } from 'react';
import { detectBlackboardPayload, chartExtent, graphNodeStyle } from '../utils/blackboard';

const boardShellStyle = {
  border: '1px solid rgba(228,222,205,0.18)',
  background: 'linear-gradient(180deg, rgba(8,10,12,0.96) 0%, rgba(18,24,22,0.98) 100%)',
  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.03), 0 18px 40px rgba(0,0,0,0.25)'
};

const renderGraph = (payload, markerId) => {
  const nodeLookup = new Map(payload.nodes.map((node) => [node.id, node]));

  return (
    <svg viewBox="0 0 100 100" className="h-[360px] w-full" role="img" aria-label={payload.title}>
      <defs>
        <marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#e4decd" />
        </marker>
      </defs>
      {payload.edges.map((edge) => {
        const from = nodeLookup.get(edge.from);
        const to = nodeLookup.get(edge.to);
        if (!from || !to) return null;
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;

        return (
          <g key={edge.id}>
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#e4decd"
              strokeOpacity="0.65"
              strokeWidth="0.7"
              markerEnd={`url(#${markerId})`}
            />
            {edge.label ? (
              <text x={midX} y={midY - 1.5} textAnchor="middle" fill="#c9d7cf" fontSize="3">
                {edge.label}
              </text>
            ) : null}
          </g>
        );
      })}
      {payload.nodes.map((node, index) => {
        const colors = graphNodeStyle(index);
        return (
          <g key={node.id} transform={`translate(${node.x} ${node.y})`}>
            <circle r="8.5" fill={colors.fill} stroke={colors.stroke} strokeWidth="0.9" />
            <text textAnchor="middle" y="1.2" fill="#111213" fontSize="3.4" fontWeight="700">
              {node.label.slice(0, 18)}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const renderChart = (payload) => {
  const max = chartExtent(payload.values);

  if (payload.type === 'line') {
    const points = payload.values.map((value, index) => {
      const x = 12 + (index * 76) / Math.max(payload.values.length - 1, 1);
      const y = 84 - (value / max) * 62;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg viewBox="0 0 100 100" className="h-[320px] w-full" role="img" aria-label={payload.title}>
        <path d="M12 22 V84 H92" fill="none" stroke="#e4decd" strokeOpacity="0.5" strokeWidth="0.7" />
        <polyline fill="none" stroke="#9db7d9" strokeWidth="1.4" points={points} />
        {payload.values.map((value, index) => {
          const x = 12 + (index * 76) / Math.max(payload.values.length - 1, 1);
          const y = 84 - (value / max) * 62;
          return (
            <g key={`${payload.labels[index]}-${index}`}>
              <circle cx={x} cy={y} r="1.8" fill="#c9a96e" />
              <text x={x} y="92" textAnchor="middle" fill="#c9d7cf" fontSize="2.8">
                {payload.labels[index].slice(0, 8)}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  const barWidth = 76 / Math.max(payload.values.length, 1);
  return (
    <svg viewBox="0 0 100 100" className="h-[320px] w-full" role="img" aria-label={payload.title}>
      <path d="M12 22 V84 H92" fill="none" stroke="#e4decd" strokeOpacity="0.5" strokeWidth="0.7" />
      {payload.values.map((value, index) => {
        const height = (value / max) * 58;
        const x = 14 + index * barWidth;
        const y = 84 - height;

        return (
          <g key={`${payload.labels[index]}-${index}`}>
            <rect
              x={x}
              y={y}
              width={Math.max(barWidth - 3, 4)}
              height={height}
              fill={index % 2 === 0 ? '#c9a96e' : '#9db7d9'}
              stroke="#111213"
              strokeWidth="0.5"
            />
            <text x={x + Math.max(barWidth - 3, 4) / 2} y="92" textAnchor="middle" fill="#c9d7cf" fontSize="2.8">
              {payload.labels[index].slice(0, 8)}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export const BlackboardBlock = ({ value }) => {
  const markerId = useId();
  const payload = useMemo(() => detectBlackboardPayload(value), [value]);

  return (
    <section className="my-8 overflow-hidden rounded-sm" style={boardShellStyle}>
      <div className="flex items-center justify-between border-b px-4 py-3 font-mono-tech text-[10px] uppercase tracking-[0.18em]" style={{ borderColor: 'rgba(228,222,205,0.18)', color: '#c9d7cf' }}>
        <span>{payload.title}</span>
        <span>{payload.kind}</span>
      </div>
      <div className="blackboard-grid px-4 py-4 md:px-6 md:py-6" style={{ color: '#e4decd' }}>
        {payload.kind === 'graph' ? renderGraph(payload, markerId) : null}
        {payload.kind === 'chart' ? renderChart(payload) : null}
        {payload.kind === 'mermaid' ? (
          <pre className="m-0 overflow-x-auto font-mono-tech text-[12px] leading-6 whitespace-pre-wrap">
            <code>{payload.text}</code>
          </pre>
        ) : null}
        {payload.kind === 'text' || payload.kind === 'empty' ? (
          <pre className="m-0 overflow-x-auto font-mono-tech text-[12px] leading-6 whitespace-pre-wrap">{payload.text || 'Paste Mermaid, graph JSON, chart JSON, or notes.'}</pre>
        ) : null}
      </div>
      {payload.kind === 'graph' ? (
        <div className="flex flex-wrap gap-2 border-t px-4 py-3 font-mono-tech text-[10px] uppercase" style={{ borderColor: 'rgba(228,222,205,0.12)', color: '#c9d7cf' }}>
          <span>{payload.nodes.length} nodes</span>
          <span>{payload.edges.length} edges</span>
        </div>
      ) : null}
      {payload.kind === 'chart' ? (
        <div className="flex flex-wrap gap-2 border-t px-4 py-3 font-mono-tech text-[10px] uppercase" style={{ borderColor: 'rgba(228,222,205,0.12)', color: '#c9d7cf' }}>
          <span>{payload.type}</span>
          <span>{payload.labels.length} points</span>
        </div>
      ) : null}
    </section>
  );
};
