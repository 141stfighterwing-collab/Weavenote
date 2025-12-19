import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Note } from '../types';

interface MindMapProps {
  notes: Note[];
  onNoteClick: (noteId: string) => void;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  type: 'note' | 'tag';
  name: string;
  group?: string; 
  val: number; 
  degree: number; // Number of links
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  connectionType: 'tag' | 'strong' | 'weak';
}

const STOP_WORDS = new Set(['the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'in', 'it', 'to', 'for', 'of', 'with', 'as', 'by', 'from', 'that', 'but', 'or', 'not', 'are', 'be', 'this', 'will', 'can', 'if']);

const getWords = (text: string) => {
    return text.toLowerCase()
        .replace(/[^\w\s]/g, '') 
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOP_WORDS.has(w));
};

const MindMap: React.FC<MindMapProps> = ({ notes, onNoteClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
      if (!containerRef.current) return;
      if (!document.fullscreenElement) {
          containerRef.current.requestFullscreen().catch(e => console.error(e));
      } else {
          document.exitFullscreen();
      }
  };

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    if (notes.length === 0) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const centerX = width / 2;
    const centerY = height / 2;

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const tagMap = new Map<string, string>();

    // A. Notes
    notes.forEach(note => {
      nodes.push({
        id: note.id,
        type: 'note',
        name: note.title,
        group: note.color,
        val: 12, // Reduced from 25
        degree: 0,
        x: centerX + (Math.random() - 0.5) * 100,
        y: centerY + (Math.random() - 0.5) * 100
      });
    });

    // B. Tags
    notes.forEach(note => {
      note.tags.forEach(tag => {
        const tagId = `tag-${tag.toLowerCase()}`;
        if (!tagMap.has(tag)) {
          tagMap.set(tag, tagId);
          nodes.push({
            id: tagId,
            type: 'tag',
            name: `#${tag}`,
            val: 6, // Reduced from 12
            degree: 0,
            x: centerX + (Math.random() - 0.5) * 100,
            y: centerY + (Math.random() - 0.5) * 100
          });
        }
        links.push({ source: note.id, target: tagId, connectionType: 'tag' });
      });
    });

    // C. Similarity
    for (let i = 0; i < notes.length; i++) {
        const noteA = notes[i];
        const wordsA = new Set([...getWords(noteA.title), ...getWords(noteA.category), ...getWords(noteA.rawContent || '')]);
        for (let j = i + 1; j < notes.length; j++) {
            const noteB = notes[j];
            const wordsB = new Set([...getWords(noteB.title), ...getWords(noteB.category), ...getWords(noteB.rawContent || '')]);
            let matches = 0;
            wordsA.forEach(w => { if (wordsB.has(w)) matches++; });
            if (matches >= 3) links.push({ source: noteA.id, target: noteB.id, connectionType: 'strong' });
            else if (matches >= 1) links.push({ source: noteA.id, target: noteB.id, connectionType: 'weak' });
        }
    }

    // Calculate Degrees for layout spacing
    const degreeMap = new Map<string, number>();
    links.forEach(l => {
        const sId = typeof l.source === 'string' ? l.source : l.source.id;
        const tId = typeof l.target === 'string' ? l.target : l.target.id;
        degreeMap.set(sId, (degreeMap.get(sId) || 0) + 1);
        degreeMap.set(tId, (degreeMap.get(tId) || 0) + 1);
    });
    nodes.forEach(n => n.degree = degreeMap.get(n.id) || 0);

    svg.attr("viewBox", [0, 0, width, height]).attr("class", "w-full h-full cursor-move");
    const defs = svg.append("defs");
    defs.append("style").text(`
      .link-tag { stroke: #cbd5e1; stroke-width: 1px; opacity: 0.2; }
      .link-strong { stroke: #3b82f6; stroke-width: 2px; opacity: 0.5; }
      .link-weak { stroke: #94a3b8; stroke-width: 1px; opacity: 0.15; }
      .node-hover circle { stroke: #3b82f6; stroke-width: 2px; }
      .node-group text { pointer-events: none; transition: opacity 0.2s; }
    `);

    const g = svg.append("g");
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 8]).on("zoom", (e) => g.attr("transform", e.transform));
    svg.call(zoom).call(zoom.transform, d3.zoomIdentity.translate(width/2, height/2).scale(1).translate(-width/2, -height/2));

    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(links)
        .id(d => d.id)
        .distance(d => {
            // Push hubs (nodes with many connections) much further apart
            const sDeg = (d.source as GraphNode).degree || 1;
            const tDeg = (d.target as GraphNode).degree || 1;
            const multiplier = Math.sqrt(sDeg + tDeg) * 15;
            if (d.connectionType === 'strong') return 80 + multiplier;
            if (d.connectionType === 'weak') return 250 + multiplier;
            return 120 + multiplier;
        })
        .strength(d => d.connectionType === 'strong' ? 0.4 : 0.05)
      )
      .force("charge", d3.forceManyBody().strength(d => -100 - ((d as GraphNode).degree * 150))) // Repel hubs more
      .force("center", d3.forceCenter(width / 2, height / 2).strength(0.05))
      .force("collide", d3.forceCollide().radius(d => d.val + 10 + (d.degree * 2)));

    const link = g.append("g").selectAll("line").data(links).join("line").attr("class", d => `link-${d.connectionType}`);

    const nodeGroup = g.append("g").selectAll("g").data(nodes).join("g")
      .attr("class", "node-group")
      .call(d3.drag<SVGGElement, GraphNode>().on("start", dragstarted).on("drag", dragged).on("end", dragended));

    nodeGroup.append("circle")
      .attr("r", d => d.val)
      .attr("fill", d => {
        if (d.type === 'note' && d.group) {
          const colors: Record<string, string> = { yellow: '#fef08a', blue: '#bfdbfe', green: '#bbf7d0', pink: '#fbcfe8', purple: '#e9d5ff', orange: '#fed7aa', teal: '#99f6e4', rose: '#fecdd3', slate: '#cbd5e1', lime: '#d9f99d', sky: '#bae6fd', fuchsia: '#f5d0fe', red: '#fecaca', cyan: '#a5f3fc', violet: '#ddd6fe' };
          return colors[d.group] || '#f1f5f9';
        }
        return '#f8fafc';
      })
      .attr("stroke", d => d.type === 'tag' ? '#94a3b8' : '#fff')
      .attr("stroke-width", 1)
      .on("click", (event, d) => { if (d.type === 'note') { event.stopPropagation(); onNoteClick(d.id); } });

    nodeGroup.append("text")
      .text(d => d.name)
      .attr("x", d => d.val + 4)
      .attr("y", 3)
      .attr("font-size", d => d.type === 'tag' ? "8px" : "10px")
      .attr("font-weight", d => d.type === 'tag' ? "400" : "600")
      .attr("class", "fill-slate-700 dark:fill-slate-300");

    simulation.on("tick", () => {
      link.attr("x1", d => (d.source as GraphNode).x!).attr("y1", d => (d.source as GraphNode).y!)
          .attr("x2", d => (d.target as GraphNode).x!).attr("y2", d => (d.target as GraphNode).y!);
      nodeGroup.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x; d.fy = d.y;
    }
    function dragged(event: any, d: GraphNode) { d.fx = event.x; d.fy = event.y; }
    function dragended(event: any, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null; d.fy = null;
    }

    return () => { simulation.stop(); };
  }, [notes, onNoteClick]);

  return (
    <div ref={containerRef} className={`w-full h-full relative overflow-hidden ${isFullscreen ? 'fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700'}`}>
      <div className="absolute top-4 left-4 z-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm px-2 py-1.5 rounded text-[10px] text-slate-500 shadow-sm pointer-events-none">
        <p className="font-bold mb-0.5">Mind Map (Optimized)</p>
        <p>• Nodes spaced by connection count</p>
        <p>• Drag to arrange | Scroll to zoom</p>
      </div>
      <button onClick={toggleFullscreen} className="absolute top-4 right-4 z-10 p-1.5 bg-white/80 dark:bg-slate-800/80 rounded border shadow-sm hover:bg-white transition-colors">
         {isFullscreen ? "Exit" : "Full"}
      </button>
      <svg ref={svgRef} className="w-full h-full"></svg>
    </div>
  );
};

export default MindMap;