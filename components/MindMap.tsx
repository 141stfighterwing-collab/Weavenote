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
  weight: number;
}

const STOP_WORDS = new Set(['the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'in', 'it', 'to', 'for', 'of', 'with', 'as', 'by', 'from', 'that', 'but', 'or', 'not', 'are', 'be', 'this', 'will', 'can', 'if', 'has', 'have', 'had', 'was', 'were', 'been']);

const getWords = (text: string) => {
    return text.toLowerCase()
        .replace(/[^\w\s]/g, '') 
        .split(/\s+/)
        .filter(w => w.length > 3 && !STOP_WORDS.has(w)); 
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
    let rawLinks: GraphLink[] = [];
    const tagMap = new Map<string, string>();

    // A. Notes
    notes.forEach(note => {
      nodes.push({
        id: note.id,
        type: 'note',
        name: note.title,
        group: note.color,
        val: 10, 
        degree: 0,
        x: centerX + (Math.random() - 0.5) * 150,
        y: centerY + (Math.random() - 0.5) * 150
      });
    });

    // B. Tags (Explicit connections)
    notes.forEach(note => {
      note.tags.forEach(tag => {
        const tagId = `tag-${tag.toLowerCase()}`;
        if (!tagMap.has(tag)) {
          tagMap.set(tag, tagId);
          nodes.push({
            id: tagId,
            type: 'tag',
            name: `#${tag}`,
            val: 5,
            degree: 0,
            x: centerX + (Math.random() - 0.5) * 150,
            y: centerY + (Math.random() - 0.5) * 150
          });
        }
        rawLinks.push({ source: note.id, target: tagId, connectionType: 'tag', weight: 10 });
      });
    });

    // C. Similarity (Implicit connections)
    for (let i = 0; i < notes.length; i++) {
        const noteA = notes[i];
        const wordsA = new Set([...getWords(noteA.title), ...getWords(noteA.category)]); 
        for (let j = i + 1; j < notes.length; j++) {
            const noteB = notes[j];
            const wordsB = new Set([...getWords(noteB.title), ...getWords(noteB.category)]);
            
            let matches = 0;
            wordsA.forEach(w => { if (wordsB.has(w)) matches++; });
            
            if (matches >= 4) {
              rawLinks.push({ source: noteA.id, target: noteB.id, connectionType: 'strong', weight: matches });
            } else if (matches >= 2) {
              rawLinks.push({ source: noteA.id, target: noteB.id, connectionType: 'weak', weight: matches });
            }
        }
    }

    // PRUNING: Ensure no node has more than 4 connections max
    const linksMap = new Map<string, GraphLink[]>();
    rawLinks.forEach(link => {
      const sId = typeof link.source === 'string' ? link.source : (link.source as any).id;
      const tId = typeof link.target === 'string' ? link.target : (link.target as any).id;
      
      if (!linksMap.has(sId)) linksMap.set(sId, []);
      if (!linksMap.has(tId)) linksMap.set(tId, []);
      linksMap.get(sId)!.push(link);
      linksMap.get(tId)!.push(link);
    });

    const links: GraphLink[] = [];
    const usedLinksSet = new Set<string>();

    nodes.forEach(node => {
      const nodeLinks = linksMap.get(node.id) || [];
      // Sort by weight (stronger matches first)
      nodeLinks.sort((a, b) => b.weight - a.weight);
      
      // Keep only top 4
      nodeLinks.slice(0, 4).forEach(link => {
        const sId = typeof link.source === 'string' ? link.source : (link.source as any).id;
        const tId = typeof link.target === 'string' ? link.target : (link.target as any).id;
        const key = [sId, tId].sort().join('-');
        if (!usedLinksSet.has(key)) {
          usedLinksSet.add(key);
          links.push(link);
        }
      });
    });

    // Recalculate Degrees
    const degreeMap = new Map<string, number>();
    links.forEach(l => {
        const sId = typeof l.source === 'string' ? l.source : (l.source as any).id;
        const tId = typeof l.target === 'string' ? l.target : (l.target as any).id;
        degreeMap.set(sId, (degreeMap.get(sId) || 0) + 1);
        degreeMap.set(tId, (degreeMap.get(tId) || 0) + 1);
    });
    nodes.forEach(n => n.degree = degreeMap.get(n.id) || 0);

    svg.attr("viewBox", [0, 0, width, height]).attr("class", "w-full h-full cursor-move");
    const defs = svg.append("defs");
    defs.append("style").text(`
      .link-tag { stroke: #cbd5e1; stroke-width: 1px; opacity: 0.2; }
      .link-strong { stroke: #6366f1; stroke-width: 2px; opacity: 0.4; }
      .link-weak { stroke: #94a3b8; stroke-width: 0.8px; opacity: 0.1; }
      .node-group text { pointer-events: none; transition: opacity 0.2s; }
    `);

    const g = svg.append("g");
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.2, 5]).on("zoom", (e) => g.attr("transform", e.transform));
    svg.call(zoom).call(zoom.transform, d3.zoomIdentity.translate(width/2, height/2).scale(1.2).translate(-width/2, -height/2));

    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(links)
        .id(d => d.id)
        .distance(d => {
            if (d.connectionType === 'strong') return 70; // Closer
            if (d.connectionType === 'weak') return 180; // Closer
            return 100; // Closer
        })
        .strength(d => {
            if (d.connectionType === 'strong') return 0.5; // Tighter pull
            if (d.connectionType === 'tag') return 0.3;
            return 0.1;
        })
      )
      .force("charge", d3.forceManyBody().strength(d => -100 - ((d as GraphNode).degree * 50))) 
      .force("center", d3.forceCenter(width / 2, height / 2).strength(0.05))
      .force("collide", d3.forceCollide().radius(d => d.val + 15)) 
      .alphaDecay(0.04);

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
      .attr("stroke-width", 1.5)
      .attr("class", "transition-all hover:scale-125 hover:brightness-105 shadow-sm cursor-pointer")
      .on("click", (event, d) => { if (d.type === 'note') { event.stopPropagation(); onNoteClick(d.id); } });

    nodeGroup.append("text")
      .text(d => d.name)
      .attr("x", d => d.val + 8)
      .attr("y", 3)
      .attr("font-size", d => d.type === 'tag' ? "8px" : "10px")
      .attr("font-weight", "600")
      .attr("class", "fill-slate-700 dark:fill-slate-300 pointer-events-none drop-shadow-sm");

    simulation.on("tick", () => {
      link.attr("x1", d => (d.source as GraphNode).x!).attr("y1", d => (d.source as GraphNode).y!)
          .attr("x2", d => (d.target as GraphNode).x!).attr("y2", d => (d.target as GraphNode).y!);
      nodeGroup.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0.2).restart();
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
      <div className="absolute top-4 left-4 z-10 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md px-3 py-2 rounded-lg text-[11px] text-slate-600 dark:text-slate-300 shadow-md border border-slate-100 dark:border-slate-700 pointer-events-none">
        <p className="font-bold mb-1 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-500"></span> Neural Map</p>
        <p className="opacity-70">• Connections pruned (Max 4)</p>
        <p className="opacity-70">• Tighter clustering</p>
      </div>
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button onClick={toggleFullscreen} className="p-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-white dark:hover:bg-slate-700 transition-all font-bold text-xs">
           {isFullscreen ? "Exit Fullscreen" : "Fullscreen View"}
        </button>
      </div>
      <svg ref={svgRef} className="w-full h-full"></svg>
    </div>
  );
};

export default MindMap;