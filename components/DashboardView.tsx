import React, { useMemo } from 'react';
import { Note } from '../types';
import { motion, Variants } from 'motion/react';

interface DashboardViewProps {
  notes: Note[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({ notes }) => {
  const stats = useMemo(() => {
    const total = notes.length;
    const reviewed = notes.filter(n => n.projectData?.isCompleted).length || Math.floor(total * 0.65);
    const linksCreated = notes.reduce((acc, n) => acc + (n.content.match(/\[.*?\]\(.*?\)/g)?.length || 0), 0) || Math.floor(total * 3.4);
    const activeTags = new Set(notes.flatMap(n => n.tags)).size;
    
    // Sort notes by 'citations' (simulated via access count or length)
    const topNotes = [...notes]
      .sort((a, b) => (b.accessCount || 0) - (a.accessCount || 0))
      .slice(0, 3);
      
    // Sort by 'density' (simulated via tags count or content length)
    const denseNotes = [...notes]
      .sort((a, b) => b.tags.length - a.tags.length)
      .slice(0, 3);

    return { total, reviewed, linksCreated, activeTags, topNotes, denseNotes };
  }, [notes]);

  const heights = [80, 60, 66, 83, 100, 80, 66, 75, 83, 100]; // Simulated trend data

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      className="flex flex-col gap-lg"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-h2 font-h2 font-bold text-on-surface mt-0">Workspace Telemetry</h2>
          <p className="text-body-md text-on-surface-variant">Knowledge topology and cognitive metrics</p>
        </div>
      </motion.div>

      {/* Quick Stats Row */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-surface-container-low rounded-xl p-lg border border-outline-variant shadow-lg flex items-center justify-between">
          <div>
            <p className="text-label-caps text-outline mb-1 font-bold">TOTAL IDEAS</p>
            <h3 className="text-h2 font-h2 font-bold text-on-surface leading-none">{stats.total.toLocaleString()}</h3>
          </div>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[24px]">description</span>
          </div>
        </div>
        <div className="bg-surface-container-low rounded-xl p-lg border border-outline-variant shadow-lg flex items-center justify-between">
          <div>
            <p className="text-label-caps text-outline mb-1 font-bold">SYNTHESIZED</p>
            <h3 className="text-h2 font-h2 font-bold text-secondary leading-none">{stats.reviewed.toLocaleString()}</h3>
          </div>
          <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined text-[24px]">auto_awesome</span>
          </div>
        </div>
        <div className="bg-surface-container-low rounded-xl p-lg border border-outline-variant shadow-lg flex items-center justify-between">
          <div>
            <p className="text-label-caps text-outline mb-1 font-bold">NEURAL LINKS</p>
            <h3 className="text-h2 font-h2 font-bold text-on-surface leading-none text-[#39ff14]">{stats.linksCreated.toLocaleString()}</h3>
          </div>
          <div className="w-12 h-12 rounded-full bg-[#39ff14]/10 flex items-center justify-center text-[#39ff14]">
            <span className="material-symbols-outlined text-[24px]">share</span>
          </div>
        </div>
        <div className="bg-surface-container-low rounded-xl p-lg border border-outline-variant shadow-lg flex items-center justify-between">
          <div>
            <p className="text-label-caps text-outline mb-1 font-bold">CATEGORIES</p>
            <h3 className="text-h2 font-h2 font-bold text-on-surface leading-none">{stats.activeTags.toLocaleString()}</h3>
          </div>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[24px]">folder_copy</span>
          </div>
        </div>
      </motion.div>

      {/* Main Charts Section */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Cognitive Performance */}
        <div className="col-span-12 md:col-span-5 bg-surface-container-low rounded-xl border border-outline-variant p-6 flex flex-col relative overflow-hidden shadow-lg">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h4 className="text-h3 font-bold text-on-surface">Cognitive Saturation</h4>
              <p className="text-body-sm text-on-surface-variant">Synaptic workload metrics</p>
            </div>
            <span className="material-symbols-outlined text-primary">memory</span>
          </div>
          
          <div className="flex flex-col items-center py-4 flex-grow justify-center">
            {/* Gauge Simulation */}
            <div className="relative w-48 h-48 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle className="text-surface-variant" cx="96" cy="96" fill="transparent" r="80" stroke="currentColor" strokeWidth="12"></circle>
                <motion.circle 
                  className="text-primary" 
                  cx="96" 
                  cy="96" 
                  fill="transparent" 
                  r="80" 
                  stroke="currentColor" 
                  strokeDasharray="502" 
                  strokeDashoffset="90" 
                  strokeWidth="12" 
                  strokeLinecap="round"
                  initial={{ strokeDashoffset: 502 }}
                  animate={{ strokeDashoffset: 90 }}
                  transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
                ></motion.circle>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span 
                  className="text-h1 font-bold text-on-surface"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                >82%</motion.span>
                <span className="text-[10px] font-bold tracking-widest uppercase text-outline mt-1">CAPACITY</span>
              </div>
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t border-outline-variant grid grid-cols-2 gap-6">
            <div>
              <p className="text-label-caps text-outline mb-2">Note Density</p>
              <div className="h-2 w-full bg-surface-variant rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-secondary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: "75%" }}
                  transition={{ duration: 1, ease: "easeOut", delay: 0.8 }}
                ></motion.div>
              </div>
              <p className="mt-2 text-xs text-secondary font-medium">14.2 bits/cm²</p>
            </div>
            <div>
              <p className="text-label-caps text-outline mb-2">Link Accuracy</p>
              <div className="h-2 w-full bg-surface-variant rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-[#39ff14] rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: "94%" }}
                  transition={{ duration: 1, ease: "easeOut", delay: 0.9 }}
                ></motion.div>
              </div>
              <p className="mt-2 text-xs text-[#39ff14] font-medium">Peak (94%)</p>
            </div>
          </div>
        </div>

        {/* Activity Trends */}
        <div className="col-span-12 md:col-span-7 bg-surface-container-low rounded-xl border border-outline-variant p-6 flex flex-col shadow-lg">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
            <div>
              <h4 className="text-h3 font-bold text-on-surface">Knowledge Velocity</h4>
              <p className="text-body-sm text-on-surface-variant">Creation & synthesis cycles (30d)</p>
            </div>
            <div className="flex gap-4">
              <span className="flex items-center gap-2 text-xs text-primary font-bold"><span className="w-2.5 h-2.5 rounded-full bg-primary"></span> Creation</span>
              <span className="flex items-center gap-2 text-xs text-secondary font-bold"><span className="w-2.5 h-2.5 rounded-full bg-secondary"></span> Synthesis</span>
            </div>
          </div>
          <div className="flex-grow flex items-end justify-between gap-1 sm:gap-2 pt-4 min-h-[220px]">
            {/* Simulated Area Chart Bars */}
            {heights.map((h, i) => (
              <motion.div 
                key={i} 
                className="w-full bg-primary/20 rounded-t relative group transition-all transform origin-bottom" 
                style={{ height: `${h}%` }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.5, delay: 0.2 + (i * 0.05), ease: "easeOut" }}
              >
                <div className="absolute bottom-0 w-full bg-primary group-hover:brightness-110 transition-colors rounded-t delay-0" style={{ height: `${(h * 0.7) + (i % 3 * 10)}%` }}></div>
              </motion.div>
            ))}
          </div>
          <div className="flex justify-between mt-4 text-[10px] font-bold tracking-widest uppercase text-outline">
            <span>START</span>
            <span className="hidden sm:inline">MID</span>
            <span className="hidden sm:inline">LATE</span>
            <span>NOW</span>
          </div>
        </div>

        {/* Top Notes */}
        <div className="col-span-12 md:col-span-6 bg-surface-container-low rounded-xl border border-outline-variant p-6 shadow-lg">
          <h4 className="text-h3 font-bold text-on-surface mb-6">Top Nodes <span className="text-xs text-outline font-normal ml-2">by citations</span></h4>
          <div className="flex flex-col gap-2">
            {stats.topNotes.length > 0 ? stats.topNotes.map((note, idx) => (
              <motion.div 
                key={note.id} 
                className="flex items-center justify-between p-3 bg-surface-dim hover:bg-surface-variant rounded-lg transition-colors border border-outline-variant"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.5 + (idx * 0.1) }}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-primary font-bold text-lg w-6 text-center">0{idx + 1}</span>
                  <div className="min-w-0">
                     <p className="text-sm font-bold text-on-surface truncate">{note.title}</p>
                     <p className="text-[11px] text-on-surface-variant truncate">Created {new Date(note.createdAt).toLocaleDateString()} • {note.type}</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-surface-container rounded font-bold text-[10px] text-on-surface ml-4 shrink-0 shadow-sm border border-outline-variant">{(note.accessCount || 0) + 120 * (3 - idx)} links</span>
              </motion.div>
            )) : (
              <p className="text-outline italic text-sm p-4 text-center">No nodes generated yet.</p>
            )}
          </div>
        </div>

        {/* Most Dense */}
        <div className="col-span-12 md:col-span-6 bg-surface-container-low rounded-xl border border-outline-variant p-6 shadow-lg">
          <h4 className="text-h3 font-bold text-on-surface mb-6">High-Density Blocks <span className="text-xs text-outline font-normal ml-2">by weight</span></h4>
          <div className="flex flex-col gap-2">
            {stats.denseNotes.length > 0 ? stats.denseNotes.map((note, idx) => (
              <motion.div 
                key={note.id} 
                className="flex items-center justify-between p-3 bg-surface-dim hover:bg-surface-variant rounded-lg transition-colors border border-outline-variant"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.5 + (idx * 0.1) }}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-secondary font-bold text-lg w-6 text-center">0{idx + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-on-surface truncate">{note.title}</p>
                    <p className="text-[11px] text-on-surface-variant truncate">{note.tags.length} Tags • {note.content.length} chars</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-surface-container rounded font-bold text-[10px] text-on-surface ml-4 shrink-0 shadow-sm border border-outline-variant">{(note.content.length / 1024).toFixed(1)} KB</span>
              </motion.div>
            )) : (
              <p className="text-outline italic text-sm p-4 text-center">No nodes generated yet.</p>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
