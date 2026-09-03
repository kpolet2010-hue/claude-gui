import { useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n.jsx';

const WIDTH = 700;
const HEIGHT = 440;

function layoutGraph(nodes, edges) {
  const positions = new Map();
  nodes.forEach((n, i) => {
    const angle = (i / Math.max(nodes.length, 1)) * Math.PI * 2;
    positions.set(n.id, {
      x: WIDTH / 2 + Math.cos(angle) * (WIDTH / 3.2),
      y: HEIGHT / 2 + Math.sin(angle) * (HEIGHT / 3.2),
      vx: 0,
      vy: 0,
    });
  });

  for (let iter = 0; iter < 220; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const p1 = positions.get(nodes[i].id);
        const p2 = positions.get(nodes[j].id);
        let dx = p1.x - p2.x;
        let dy = p1.y - p2.y;
        const distSq = dx * dx + dy * dy || 0.01;
        const dist = Math.sqrt(distSq);
        const force = 2200 / distSq;
        dx /= dist;
        dy /= dist;
        p1.vx += dx * force;
        p1.vy += dy * force;
        p2.vx -= dx * force;
        p2.vy -= dy * force;
      }
    }
    edges.forEach(({ source, target }) => {
      const p1 = positions.get(source);
      const p2 = positions.get(target);
      if (!p1 || !p2) return;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      p1.vx += dx * 0.02;
      p1.vy += dy * 0.02;
      p2.vx -= dx * 0.02;
      p2.vy -= dy * 0.02;
    });
    positions.forEach((p) => {
      p.vx += (WIDTH / 2 - p.x) * 0.002;
      p.vy += (HEIGHT / 2 - p.y) * 0.002;
      p.vx *= 0.85;
      p.vy *= 0.85;
      p.x = Math.max(30, Math.min(WIDTH - 30, p.x + p.vx));
      p.y = Math.max(30, Math.min(HEIGHT - 30, p.y + p.vy));
    });
  }

  return positions;
}

export default function WikiGraph({ active, vaultVersion, onOpenNode }) {
  const t = useT();
  const [graph, setGraph] = useState({ nodes: [], edges: [] });

  useEffect(() => {
    if (!active) return;
    (async () => setGraph(await window.claudeAPI.getWikiGraph()))();
  }, [active, vaultVersion]);

  const positions = useMemo(() => layoutGraph(graph.nodes, graph.edges), [graph]);

  if (!graph.nodes.length) {
    return <div className="vault-empty">{t('vault.noWikiGraph')}</div>;
  }

  return (
    <svg className="wiki-graph" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
      {graph.edges.map((e, i) => {
        const p1 = positions.get(e.source);
        const p2 = positions.get(e.target);
        if (!p1 || !p2) return null;
        return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} className="wiki-graph-edge" />;
      })}
      {graph.nodes.map((n) => {
        const p = positions.get(n.id);
        return (
          <g key={n.id} className="wiki-graph-node" onClick={() => onOpenNode(n.id)}>
            <circle cx={p.x} cy={p.y} r="7" />
            <text x={p.x} y={p.y - 12} textAnchor="middle">{n.id}</text>
          </g>
        );
      })}
    </svg>
  );
}
