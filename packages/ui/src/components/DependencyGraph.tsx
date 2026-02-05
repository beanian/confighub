import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Dependency } from '../api/client';

interface GraphNode {
  id: string;
  type: 'config' | 'app';
  label: string;
  domain?: string;
  environment?: string;
  status?: 'active' | 'stale' | 'inactive';
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphEdge {
  source: string | GraphNode;
  target: string | GraphNode;
  environment: string;
}

interface DependencyGraphProps {
  dependencies: Dependency[];
}

function getStatus(lastHeartbeat: string): 'active' | 'stale' | 'inactive' {
  const heartbeatDate = new Date(lastHeartbeat);
  const now = new Date();
  const hoursSince = (now.getTime() - heartbeatDate.getTime()) / (1000 * 60 * 60);
  if (hoursSince < 24) return 'active';
  if (hoursSince < 168) return 'stale';
  return 'inactive';
}

const statusColors = {
  active: '#22c55e',
  stale: '#f59e0b',
  inactive: '#9ca3af',
};

const envColors: Record<string, string> = {
  dev: '#3b82f6',
  staging: '#f59e0b',
  prod: '#ef4444',
};

const domainColors: Record<string, string> = {
  pricing: '#8b5cf6',
  claims: '#ec4899',
  documents: '#14b8a6',
  integrations: '#f97316',
  feature_flags: '#06b6d4',
};

export function DependencyGraph({ dependencies }: DependencyGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: React.ReactNode } | null>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || dependencies.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Build nodes and edges
    const nodeMap = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];

    dependencies.forEach((dep) => {
      // App node
      const appId = `app-${dep.app_id}-${dep.environment}`;
      if (!nodeMap.has(appId)) {
        nodeMap.set(appId, {
          id: appId,
          type: 'app',
          label: dep.app_name,
          environment: dep.environment,
          status: getStatus(dep.last_heartbeat),
        });
      }

      // Config nodes and edges
      dep.config_keys.forEach((key) => {
        const configId = `config-${dep.domain}-${key}`;
        if (!nodeMap.has(configId)) {
          nodeMap.set(configId, {
            id: configId,
            type: 'config',
            label: key,
            domain: dep.domain,
          });
        }

        edges.push({
          source: appId,
          target: configId,
          environment: dep.environment,
        });
      });
    });

    const nodes = Array.from(nodeMap.values());

    // Clear previous
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Create container group for zoom
    const g = svg.append('g');

    // Setup zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Create force simulation
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphEdge>(edges)
        .id((d) => d.id)
        .distance(120))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(50));

    // Draw edges
    const link = g.append('g')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke', (d) => envColors[d.environment] || '#666')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 2);

    // Drag behavior
    const drag = d3.drag<SVGGElement, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    // Draw config nodes (hexagons)
    const configNodes = g.append('g')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(nodes.filter((n) => n.type === 'config'))
      .join('g')
      .attr('cursor', 'grab')
      .call(drag);

    // Hexagon path
    const hexRadius = 30;
    const hexPoints = (r: number) => {
      const points = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        points.push([r * Math.cos(angle), r * Math.sin(angle)]);
      }
      return points.map((p) => p.join(',')).join(' ');
    };

    configNodes.append('polygon')
      .attr('points', hexPoints(hexRadius))
      .attr('fill', (d) => domainColors[d.domain || ''] || '#60a5fa')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    configNodes.append('text')
      .text((d) => d.label.length > 10 ? d.label.slice(0, 9) + '...' : d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .attr('fill', '#fff')
      .attr('font-size', 10)
      .attr('font-weight', 500);

    // Draw app nodes (rounded rectangles)
    const appNodes = g.append('g')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(nodes.filter((n) => n.type === 'app'))
      .join('g')
      .attr('cursor', 'grab')
      .call(drag);

    appNodes.append('rect')
      .attr('width', 100)
      .attr('height', 36)
      .attr('x', -50)
      .attr('y', -18)
      .attr('rx', 8)
      .attr('fill', (d) => statusColors[d.status || 'inactive'])
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    appNodes.append('text')
      .text((d) => d.label.length > 12 ? d.label.slice(0, 11) + '...' : d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .attr('fill', '#fff')
      .attr('font-size', 11)
      .attr('font-weight', 500);

    // Hover effects
    const allNodes = svg.selectAll('g g');
    allNodes
      .on('mouseenter', function (event, d) {
        const node = d as GraphNode;
        d3.select(this).select('rect,polygon').attr('stroke-width', 4);

        // Highlight connected edges
        link.attr('stroke-opacity', (l) => {
          const src = typeof l.source === 'object' ? l.source.id : l.source;
          const tgt = typeof l.target === 'object' ? l.target.id : l.target;
          return src === node.id || tgt === node.id ? 0.9 : 0.1;
        }).attr('stroke-width', (l) => {
          const src = typeof l.source === 'object' ? l.source.id : l.source;
          const tgt = typeof l.target === 'object' ? l.target.id : l.target;
          return src === node.id || tgt === node.id ? 3 : 1;
        });

        // Show tooltip
        const rect = container.getBoundingClientRect();
        setTooltip({
          x: event.clientX - rect.left + 10,
          y: event.clientY - rect.top - 10,
          content: (
            <div>
              <div className="font-medium">{node.label}</div>
              <div className="text-xs text-gray-400">
                {node.type === 'config' ? `Domain: ${node.domain}` : `Env: ${node.environment}`}
              </div>
              {node.status && (
                <div className="text-xs" style={{ color: statusColors[node.status] }}>
                  Status: {node.status}
                </div>
              )}
            </div>
          ),
        });
      })
      .on('mouseleave', function () {
        d3.select(this).select('rect,polygon').attr('stroke-width', 2);
        link.attr('stroke-opacity', 0.4).attr('stroke-width', 2);
        setTooltip(null);
      });

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as GraphNode).x || 0)
        .attr('y1', (d) => (d.source as GraphNode).y || 0)
        .attr('x2', (d) => (d.target as GraphNode).x || 0)
        .attr('y2', (d) => (d.target as GraphNode).y || 0);

      configNodes.attr('transform', (d) => `translate(${d.x || 0},${d.y || 0})`);
      appNodes.attr('transform', (d) => `translate(${d.x || 0},${d.y || 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [dependencies]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden">
      <svg ref={svgRef} className="w-full h-full" />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg text-sm pointer-events-none z-10"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.content}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-gray-800/90 rounded-lg p-3 text-xs text-white">
        <div className="font-medium mb-2">Legend</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ background: statusColors.active }} />
            <span>Active (&lt;24h)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ background: statusColors.stale }} />
            <span>Stale (1-7d)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ background: statusColors.inactive }} />
            <span>Inactive (&gt;7d)</span>
          </div>
        </div>
        <div className="border-t border-gray-600 mt-2 pt-2">
          <div className="flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <polygon points="6,0 12,3 12,9 6,12 0,9 0,3" fill="#60a5fa" />
            </svg>
            <span>Config</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-3 h-2 rounded-sm bg-gray-400" />
            <span>Application</span>
          </div>
        </div>
      </div>

      {dependencies.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
          No dependencies to display
        </div>
      )}
    </div>
  );
}
