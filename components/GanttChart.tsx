
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { ProjectData } from '../types';

interface GanttChartProps {
  data: ProjectData;
  width?: number;
}

const GanttChart: React.FC<GanttChartProps> = ({ data, width = 600 }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.timeline || data.timeline.length === 0) return;

    // Clear previous
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Setup Dimensions
    const margin = { top: 20, right: 30, bottom: 30, left: 100 };
    const chartHeight = Math.max(150, data.timeline.length * 40 + 50);
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = chartHeight - margin.top - margin.bottom;

    // Parse Dates
    const parseTime = d3.timeParse("%Y-%m-%d");
    const timelineData = data.timeline.map(d => ({
        ...d,
        start: parseTime(d.startDate) || new Date(),
        end: parseTime(d.endDate) || new Date()
    }));

    // Scales
    const x = d3.scaleTime()
        .domain([
            d3.min(timelineData, d => d.start) || new Date(),
            d3.max(timelineData, d => d.end) || new Date()
        ])
        .range([0, innerWidth])
        .nice();

    const y = d3.scaleBand()
        .domain(timelineData.map(d => d.name))
        .range([0, innerHeight])
        .padding(0.4);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Axes
    g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat("%b %d") as any))
        .attr("color", "#94a3b8"); // Slate-400

    g.append("g")
        .call(d3.axisLeft(y))
        .attr("color", "#64748b") // Slate-500
        .style("font-size", "11px");

    // Bars
    g.selectAll(".bar")
        .data(timelineData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.start))
        .attr("y", d => y(d.name) || 0)
        .attr("width", d => Math.max(2, x(d.end) - x(d.start)))
        .attr("height", y.bandwidth())
        .attr("fill", "#10b981") // Emerald-500
        .attr("rx", 4);

    // Milestones (Red Diamonds on timeline)
    if (data.milestones) {
        const milestoneData = data.milestones
            .map(m => ({ ...m, dateObj: parseTime(m.date) }))
            .filter(m => m.dateObj !== null);

        g.selectAll(".milestone")
            .data(milestoneData)
            .enter()
            .append("path")
            .attr("d", d3.symbol().type(d3.symbolDiamond).size(80))
            .attr("transform", d => `translate(${x(d.dateObj!)}, ${innerHeight})`)
            .attr("fill", "#ef4444") // Red-500
            .attr("stroke", "white")
            .attr("stroke-width", 1)
            .append("title")
            .text(d => `${d.label} (${d.date})`);
    }

    // Grid lines
    g.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(5).tickSize(-innerHeight).tickFormat(() => ""))
        .attr("opacity", 0.1);

  }, [data, width]);

  if (!data.timeline || data.timeline.length === 0) {
      return (
          <div className="text-center p-6 border border-dashed border-slate-300 rounded-lg text-slate-400 text-xs">
              No timeline data available.
          </div>
      );
  }

  return (
    <svg ref={svgRef} width={width} height={Math.max(150, (data.timeline?.length || 0) * 40 + 50)} className="w-full"></svg>
  );
};

export default GanttChart;
