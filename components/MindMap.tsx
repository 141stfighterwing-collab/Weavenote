

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
  group?: string; // category or color ref
  val: number; // size
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
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOP_WORDS.has(w));
};

const MindMap: React.FC<MindMapProps> = ({ notes, onNoteClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
      if (!containerRef.current) return;

      if (!document.fullscreenElement) {
          containerRef.current.requestFullscreen().catch(err => {
              console.error(`Error attempting to enable fullscreen: ${err.message}`);
          });
      } else {
          document.exitFullscreen();
      }
  };

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    // 1. Clear previous SVG
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    if (notes.length === 0) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    
    const centerX = width / 2;
    const centerY = height / 2;

    // 2. Data Preparation
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const tagMap = new Map<string, string>();
    const nodeMap = new Map<string, boolean>();

    // A. Create Note Nodes
    notes.forEach(note => {
      nodes.push({
        id: note.id,
        type: 'note',
        name: note.title,
        group: note.color,
        val: 25,
        x: centerX + (Math.random() - 0.5) * 50,
        y: centerY + (Math.random() - 0.5) * 50
      });
      nodeMap.set(note.id, true);
    });

    // B. Create Tag Nodes and Links (Standard Structure)
    notes.forEach(note => {
      note.tags.forEach(tag => {
        const tagId = `tag-${tag.toLowerCase()}`;
        if (!tagMap.has(tag)) {
          tagMap.set(tag, tagId);
          nodes.push({
            id: tagId,
            type: 'tag',
            name: `#${tag}`,
            val: 12,
            x: centerX + (Math.random() - 0.5) * 50,
            y: centerY + (Math.random() - 0.5) * 50
          });
        }
        links.push({
          source: note.id,
          target: tagId,
          connectionType: 'tag'
        });
      });
    });

    // C. Calculate Content Similarity for "Surge" Links
    // O(n^2) comparison - fine for personal note counts (< 1000)
    for (let i = 0; i < notes.length; i++) {
        const noteA = notes[i];
        const wordsA = new Set([
            ...getWords(noteA.title), 
            ...getWords(noteA.category),
            ...getWords(noteA.rawContent || '')
        ]);

        for (let j = i + 1; j < notes.length; j++) {
            const noteB = notes[j];
            const wordsB = new Set([
                ...getWords(noteB.title), 
                ...getWords(noteB.category),
                ...getWords(noteB.rawContent || '')
            ]);

            // Calculate Intersection
            let matchCount = 0;
            wordsA.forEach(w => {
                if (wordsB.has(w)) matchCount++;
            });

            // Logic for Connection Strength
            if (matchCount >= 3) {
                // Strong Connection (Multiple words match)
                links.push({
                    source: noteA.id,
                    target: noteB.id,
                    connectionType: 'strong'
                });
            } else if (matchCount >= 1 && matchCount < 3) {
                // Weak Connection (Some relation)
                links.push({
                    source: noteA.id,
                    target: noteB.id,
                    connectionType: 'weak'
                });
            }
        }
    }

    // 3. Setup SVG & Zoom
    svg.attr("viewBox", [0, 0, width, height])
       .attr("class", "w-full h-full cursor-move");

    // Add styles and Filters
    const defs = svg.append("defs");
    
    // Glow Filter for Strong Surge
    const filter = defs.append("filter")
        .attr("id", "glow")
        .attr("x", "-50%")
        .attr("y", "-50%")
        .attr("width", "200%")
        .attr("height", "200%");
    filter.append("feGaussianBlur")
        .attr("stdDeviation", "2.0")
        .attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    defs.append("style").text(`
      @keyframes dashflow {
        to { stroke-dashoffset: -20; }
      }
      /* Strong Surge: Moving packets/bullets */
      @keyframes surgeStrong {
        0% { stroke-dashoffset: 0; }
        100% { stroke-dashoffset: -40; } /* Matches dasharray sum (10+30) for loop */
      }
      /* Weak Surge: Slow moving particles */
      @keyframes surgeWeak {
        0% { stroke-dashoffset: 0; }
        100% { stroke-dashoffset: -24; }
      }
      
      .link-tag {
        stroke: #94a3b8;
        stroke-width: 1px;
        stroke-dasharray: 3, 5;
        opacity: 0.3;
      }

      .link-strong {
        stroke: #3b82f6; /* Blue-500 */
        stroke-width: 4px; /* Thick */
        stroke-dasharray: 10, 30; /* 10px bullet, 30px gap */
        stroke-linecap: round; /* Round bullets */
        animation: surgeStrong 3s linear infinite; /* Slowed down */
        opacity: 0.8;
        filter: url(#glow);
      }

      .link-weak {
        stroke: #94a3b8; /* Slate-400 */
        stroke-width: 1.5px; 
        stroke-dasharray: 4, 20; /* Small dash, long gap */
        stroke-linecap: round; 
        animation: surgeWeak 4s linear infinite; /* Faster */
        opacity: 0.4;
      }

      /* Hover Effects */
      .node-hover circle {
        stroke: #3b82f6;
        stroke-width: 3px;
        filter: url(#glow);
      }
      
      .node-hover text {
        paint-order: stroke;
        stroke: rgba(255, 255, 255, 0.9);
        stroke-width: 4px;
        font-weight: 800;
        z-index: 10;
        text-shadow: 0 1px 4px rgba(0,0,0,0.3);
      }
    `);

    const g = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });

    svg.call(zoom)
       .call(zoom.transform, d3.zoomIdentity.translate(width/2, height/2).scale(0.8).translate(-width/2, -height/2));

    // 4. Force Simulation
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(links)
        .id(d => d.id)
        .distance(d => {
            // Strong links pull closer, but spread slightly more than before
            if (d.connectionType === 'strong') return 80; 
            if (d.connectionType === 'weak') return 250; 
            return 110; // tag links
        })
        .strength(d => {
            if (d.connectionType === 'strong') return 0.5;
            if (d.connectionType === 'weak') return 0.03; // weak links barely pull
            return 0.3;
        })
      )
      // Increased repulsion slightly to space things out
      .force("charge", d3.forceManyBody().strength(-400).distanceMax(600))
      .force("center", d3.forceCenter(width / 2, height / 2).strength(0.05))
      .force("x", d3.forceX(width / 2).strength(0.04))
      .force("y", d3.forceY(height / 2).strength(0.04))
      .force("collide", d3.forceCollide().radius(d => d.val + 8).iterations(2));

    // 5. Draw Elements
    
    // Draw Links
    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("class", d => `link-${d.connectionType}`);

    const nodeGroup = g.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", "node-group")
      .style("cursor", "pointer")
      .call(d3.drag<SVGGElement, GraphNode>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Draw Circles
    nodeGroup.append("circle")
      .attr("r", d => d.val)
      .attr("fill", d => {
        if (d.type === 'note' && d.group) {
          if (d.group.includes('yellow')) return '#fef08a';
          if (d.group.includes('blue')) return '#bfdbfe';
          if (d.group.includes('green')) return '#bbf7d0';
          if (d.group.includes('pink')) return '#fbcfe8';
          if (d.group.includes('purple')) return '#e9d5ff';
          if (d.group.includes('orange')) return '#fed7aa';
          if (d.group.includes('teal')) return '#99f6e4';
          if (d.group.includes('rose')) return '#fecdd3';
          if (d.group.includes('slate')) return '#cbd5e1';
          if (d.group.includes('lime')) return '#d9f99d';
          if (d.group.includes('sky')) return '#bae6fd';
          if (d.group.includes('fuchsia')) return '#f5d0fe';
          if (d.group.includes('red')) return '#fecaca';
          if (d.group.includes('cyan')) return '#a5f3fc';
          if (d.group.includes('violet')) return '#ddd6fe';
        }
        return '#f1f5f9';
      })
      .attr("stroke", d => d.type === 'tag' ? '#94a3b8' : '#fff')
      .attr("stroke-width", d => d.type === 'tag' ? 1 : 2)
      .on("click", (event, d) => {
        if (d.type === 'note') {
            event.stopPropagation();
            onNoteClick(d.id);
        }
      });

    // Add Labels
    nodeGroup.append("text")
      .text(d => d.name)
      .attr("x", d => d.val + 6)
      .attr("y", 4)
      .attr("font-size", d => d.type === 'tag' ? "11px" : "13px")
      .attr("font-weight", d => d.type === 'tag' ? "500" : "700")
      .attr("fill", "#1e293b") 
      .attr("class", "fill-slate-800 dark:fill-slate-200 pointer-events-none")
      .style("transition", "all 0.2s ease"); // Smooth transition for text stroke

    // Hover Interaction
    nodeGroup
        .on("mouseover", function(event, d) {
            const group = d3.select(this);
            
            // Bring to front
            group.raise();
            
            // Add Hover Class
            group.classed("node-hover", true);

            // Animate Size (Scale up)
            group.select("circle")
                .transition()
                .duration(200)
                .attr("r", d.val * 1.3);
        })
        .on("mouseout", function(event, d) {
            const group = d3.select(this);
            
            // Remove Hover Class
            group.classed("node-hover", false);

            // Animate Size (Restore)
            group.select("circle")
                .transition()
                .duration(200)
                .attr("r", d.val);
        });

    // 6. Tick Function
    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as GraphNode).x!)
        .attr("y1", d => (d.source as GraphNode).y!)
        .attr("x2", d => (d.target as GraphNode).x!)
        .attr("y2", d => (d.target as GraphNode).y!);

      nodeGroup
        .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // Drag Functions
    function dragstarted(event: d3.D3DragEvent<SVGGElement, GraphNode, unknown>, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, GraphNode, unknown>, d: GraphNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, GraphNode, unknown>, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [notes, onNoteClick, isFullscreen]);

  return (
    <div 
        ref={containerRef} 
        className={`w-full h-full relative overflow-hidden transition-colors duration-300 ${
            isFullscreen 
            ? 'fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-900' 
            : 'bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner'
        }`}
    >
      <div className="absolute top-4 left-4 z-10 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-3 py-2 rounded-lg text-xs text-slate-600 dark:text-slate-300 shadow-sm border border-slate-100 dark:border-slate-700 pointer-events-none">
        <p className="font-semibold mb-1">Neural Mind Map</p>
        <p className="flex items-center gap-1"><span className="w-2 h-0.5 bg-blue-500 inline-block"></span> Strong Surge (High Content Match)</p>
        <p className="flex items-center gap-1"><span className="w-2 h-0.5 bg-slate-400 inline-block"></span> Weak Flow (Low Content Match)</p>
        <p className="mt-1 opacity-70">• Scroll to Zoom & Pan</p>
      </div>

      <button
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 z-10 p-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg text-slate-600 dark:text-slate-300 shadow-sm border border-slate-100 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 transition-colors"
        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
      >
        {isFullscreen ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
        ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
        )}
      </button>

      <svg ref={svgRef} className="w-full h-full"></svg>
    </div>
  );
};

export default MindMap;
