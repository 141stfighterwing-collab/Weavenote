
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { WorkflowNode, WorkflowEdge } from '../types';

interface WorkflowEditorProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  onUpdate: (nodes: WorkflowNode[], edges: WorkflowEdge[]) => void;
  readOnly?: boolean;
}

const WorkflowEditor: React.FC<WorkflowEditorProps> = ({ nodes, edges, onUpdate, readOnly }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalNodes, setInternalNodes] = useState<WorkflowNode[]>(nodes);

  // Sync internal state with props
  useEffect(() => {
      setInternalNodes(nodes);
  }, [nodes]);

  // Handle Node Click (Toggle Status)
  const handleNodeClick = (nodeId: string) => {
      if (readOnly) return;
      
      const newNodes = internalNodes.map(n => {
          if (n.id === nodeId) {
              const statuses: ('pending' | 'in_progress' | 'done')[] = ['pending', 'in_progress', 'done'];
              const idx = statuses.indexOf(n.status);
              const nextStatus = statuses[(idx + 1) % statuses.length];
              return { ...n, status: nextStatus };
          }
          return n;
      });
      
      setInternalNodes(newNodes);
      onUpdate(newNodes, edges);
  };

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || internalNodes.length === 0) return;

    const width = containerRef.current.clientWidth;
    const height = 400; // Fixed height for workflow view

    // Clear previous
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Prepare Data for D3
    // We map internalNodes to simulation nodes ensuring they have x,y props
    const simulationNodes = internalNodes.map(n => ({ ...n })); 
    const simulationLinks = edges.map(e => ({ source: e.source, target: e.target }));

    // Define Arrow Marker
    const defs = svg.append("defs");
    defs.append("marker")
        .attr("id", "arrow-head")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 32) // Distance from node center
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#94a3b8"); // slate-400

    const simulation = d3.forceSimulation(simulationNodes as any)
        .force("link", d3.forceLink(simulationLinks).id((d: any) => d.id).distance(120))
        .force("charge", d3.forceManyBody().strength(-800))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide().radius(60));

    const link = svg.append("g")
        .selectAll("line")
        .data(simulationLinks)
        .join("line")
        .attr("stroke", "#cbd5e1")
        .attr("stroke-width", 2)
        .attr("marker-end", "url(#arrow-head)");

    const nodeGroup = svg.append("g")
        .selectAll("g")
        .data(simulationNodes)
        .join("g")
        .attr("class", "node")
        .style("cursor", readOnly ? "default" : "pointer")
        .call(d3.drag<SVGGElement, any>()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    // Draw Rectangles (Cards)
    nodeGroup.append("rect")
        .attr("width", 120)
        .attr("height", 60)
        .attr("x", -60)
        .attr("y", -30)
        .attr("rx", 8)
        .attr("fill", d => {
            if (d.status === 'done') return '#dcfce7'; // green-100
            if (d.status === 'in_progress') return '#dbeafe'; // blue-100
            return '#f1f5f9'; // slate-100
        })
        .attr("stroke", d => {
            if (d.status === 'done') return '#16a34a'; // green-600
            if (d.status === 'in_progress') return '#2563eb'; // blue-600
            return '#94a3b8'; // slate-400
        })
        .attr("stroke-width", 2)
        .on("click", (e, d) => handleNodeClick(d.id));

    // Status Indicator Dot
    nodeGroup.append("circle")
        .attr("cx", 50)
        .attr("cy", -20)
        .attr("r", 4)
        .attr("fill", d => {
            if (d.status === 'done') return '#16a34a'; 
            if (d.status === 'in_progress') return '#2563eb';
            return '#cbd5e1'; 
        });

    // Label Text
    nodeGroup.append("text")
        .text(d => d.label)
        .attr("text-anchor", "middle")
        .attr("y", -5)
        .attr("font-size", "11px")
        .attr("font-weight", "bold")
        .attr("fill", "#1e293b") // slate-800
        .each(function(d) {
            // Simple text wrapping logic if needed, or truncate
            const self = d3.select(this);
            let textLength = self.node()!.getComputedTextLength();
            let text = self.text();
            while (textLength > 110 && text.length > 0) {
                text = text.slice(0, -1);
                self.text(text + "...");
                textLength = self.node()!.getComputedTextLength();
            }
        })
        .style("pointer-events", "none");

    // Rule Text
    nodeGroup.append("text")
        .text(d => d.rule ? `Rule: ${d.rule}` : '')
        .attr("text-anchor", "middle")
        .attr("y", 15)
        .attr("font-size", "9px")
        .attr("fill", "#64748b") // slate-500
        .each(function(d) {
             const self = d3.select(this);
             let textLength = self.node()!.getComputedTextLength();
             let text = self.text();
             while (textLength > 110 && text.length > 0) {
                 text = text.slice(0, -1);
                 self.text(text + "...");
                 textLength = self.node()!.getComputedTextLength();
             }
        })
        .style("pointer-events", "none");

    // Status Text (Bottom)
    nodeGroup.append("text")
        .text(d => d.status.replace('_', ' ').toUpperCase())
        .attr("text-anchor", "middle")
        .attr("y", 25)
        .attr("font-size", "8px")
        .attr("font-weight", "bold")
        .attr("fill", d => {
            if (d.status === 'done') return '#16a34a'; 
            if (d.status === 'in_progress') return '#2563eb';
            return '#94a3b8'; 
        })
        .style("pointer-events", "none");


    simulation.on("tick", () => {
        link
            .attr("x1", (d: any) => d.source.x)
            .attr("y1", (d: any) => d.source.y)
            .attr("x2", (d: any) => d.target.x)
            .attr("y2", (d: any) => d.target.y);

        nodeGroup.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any, d: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event: any, d: any) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event: any, d: any) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    return () => {
        simulation.stop();
    };
  }, [internalNodes, edges, readOnly]);

  // Calculate Progress
  const completed = internalNodes.filter(n => n.status === 'done').length;
  const progress = internalNodes.length > 0 ? (completed / internalNodes.length) * 100 : 0;

  return (
    <div ref={containerRef} className="w-full bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="bg-slate-50 dark:bg-slate-800 px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <h4 className="text-xs font-bold uppercase text-slate-500">Project Workflow</h4>
            <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-green-500 transition-all duration-500" 
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
                <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">{Math.round(progress)}%</span>
            </div>
        </div>
        <div className="relative">
            {!readOnly && <div className="absolute top-2 left-2 text-[10px] text-slate-400 bg-white/80 p-1 rounded z-10 pointer-events-none">Click nodes to update status</div>}
            <svg ref={svgRef} className="w-full h-[400px]"></svg>
        </div>
    </div>
  );
};

export default WorkflowEditor;