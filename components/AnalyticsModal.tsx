import React, { useMemo, useState, useEffect } from 'react';
import * as d3 from 'd3';
import { Note, NoteType } from '../types';

interface AnalyticsModalProps {
  notes: Note[];
  isOpen: boolean;
  onClose: () => void;
}

interface Persona {
  title: string;
  emoji: string;
  description: string;
  color: string;
}

const AnalyticsModal: React.FC<AnalyticsModalProps> = ({ notes, isOpen, onClose }) => {
  // --- 1. ALL HOOKS AT THE TOP (Prevents Error #310) ---
  const [acknowledgedMilestones, setAcknowledgedMilestones] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('weavenote_milestones_persistent');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const noteCount = notes.length;
  const allMilestones = [10, 20, 30, 40, 50, 75, 100, 150, 200, 300, 500, 1000];

  useEffect(() => {
    localStorage.setItem('weavenote_milestones_persistent', JSON.stringify(acknowledgedMilestones));
  }, [acknowledgedMilestones]);

  const tagStats = useMemo(() => {
    const stats: Record<string, number> = {};
    notes.forEach(note => {
      note.tags.forEach(tag => {
        stats[tag] = (stats[tag] || 0) + 1;
      });
    });
    return Object.entries(stats).sort(([, a], [, b]) => b - a).slice(0, 5);
  }, [notes]);

  const topAccessedNotes = useMemo(() => {
    return [...notes].sort((a, b) => (b.accessCount || 0) - (a.accessCount || 0)).slice(0, 5).filter(n => (n.accessCount || 0) > 0);
  }, [notes]);

  const typeCounts = useMemo(() => {
    const counts: Record<NoteType, number> = {
        quick: 0, notebook: 0, deep: 0, code: 0, project: 0, contact: 0, document: 0
    };
    notes.forEach(n => { if (counts[n.type] !== undefined) counts[n.type]++; });
    return counts;
  }, [notes]);

  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    notes.forEach(n => { const cat = n.category || 'Uncategorized'; counts[cat] = (counts[cat] || 0) + 1; });
    let data = Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    if (data.length > 6) {
        const top5 = data.slice(0, 5);
        const otherValue = data.slice(5).reduce((sum, d) => sum + d.value, 0);
        data = [...top5, { name: 'Other', value: otherValue }];
    }
    return data;
  }, [notes]);

  const trendData = useMemo(() => {
     const deepNotes = notes.filter(n => n.type === 'deep' || n.type === 'document' || n.type === 'project' || n.type === 'code').sort((a, b) => a.createdAt - b.createdAt);
     if (deepNotes.length === 0) return [];
     const dataPoints: { date: Date, value: number }[] = [];
     let cumulative = 0;
     const groupedByDate = new Map<string, number>();
     deepNotes.forEach(n => { const d = new Date(n.createdAt).toDateString(); groupedByDate.set(d, (groupedByDate.get(d) || 0) + 1); });
     Array.from(groupedByDate.entries()).forEach(([dateStr, count]) => {
         cumulative += count;
         dataPoints.push({ date: new Date(dateStr), value: cumulative });
     });
     if (dataPoints.length === 1) {
         const first = dataPoints[0];
         dataPoints.unshift({ date: new Date(first.date.getTime() - 86400000), value: 0 });
     }
     return dataPoints;
  }, [notes]);

  const pieArcs = useMemo(() => {
    const radius = 80;
    const pie = d3.pie<{name: string, value: number}>().value(d => d.value).sort(null);
    const arc = d3.arc<d3.PieArcDatum<{name: string, value: number}>>().innerRadius(40).outerRadius(radius);
    const data = pie(categoryData);
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b'];
    return data.map((d, i) => ({ path: arc(d) || undefined, centroid: arc.centroid(d), data: d.data, color: colors[i % colors.length] }));
  }, [categoryData]);

  const lineChartPath = useMemo(() => {
      if (trendData.length === 0) return null;
      const width = 300, height = 100, margin = { top: 10, right: 10, bottom: 20, left: 30 };
      const x = d3.scaleTime().domain(d3.extent(trendData, d => d.date) as [Date, Date]).range([margin.left, width - margin.right]);
      const y = d3.scaleLinear().domain([0, d3.max(trendData, d => d.value) as number]).nice().range([height - margin.bottom, margin.top]);
      const line = d3.line<{date: Date, value: number}>().x(d => x(d.date)).y(d => y(d.value)).curve(d3.curveMonotoneX);
      return { path: line(trendData) || '', x, y, width, height };
  }, [trendData]);

  const persona: Persona = useMemo(() => {
    if (notes.length === 0) return { title: "The Blank Canvas", emoji: "🎨", description: "Ready to start creating ideas.", color: "bg-slate-100 text-slate-600" };
    const allTags = notes.flatMap(n => n.tags.map(t => t.toLowerCase()));
    const personas = [
        { id: 'cyber', title: "Cybersecurity Specialist", emoji: "🛡️", description: "Securing networks and hunting threats.", color: "bg-slate-800 text-green-400 border-green-500", keywords: ['security', 'cyber', 'hack', 'firewall', 'auth', 'token', 'exploit', 'vuln', 'cve', 'pentest', 'crypto', 'phish', 'malware'] },
        { id: 'dev', title: "Code Wizard", emoji: "💻", description: "Turning coffee into code and fixing bugs.", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200", keywords: ['code', 'dev', 'git', 'api', 'bug', 'react', 'js', 'ts', 'python', 'java', 'html', 'css', 'frontend', 'backend', 'fullstack', 'deploy', 'repo'] }
    ];
    let bestMatch = null, maxScore = 0;
    personas.forEach(p => { const score = allTags.filter(t => p.keywords.some(k => t.includes(k))).length; if (score > maxScore) { maxScore = score; bestMatch = p; } });
    if (bestMatch && maxScore > 0) return { title: (bestMatch as any).title, emoji: (bestMatch as any).emoji, description: (bestMatch as any).description, color: (bestMatch as any).color };
    return { title: "The Idea Weaver", emoji: "🕸️", description: "Spinning a web of diverse thoughts.", color: "bg-primary-100 text-primary-800" };
  }, [notes]);

  const currentPendingMilestone = useMemo(() => {
    const eligible = allMilestones.filter(m => noteCount >= m && !acknowledgedMilestones.includes(m));
    return eligible.length > 0 ? Math.max(...eligible) : null;
  }, [noteCount, acknowledgedMilestones]);

  // --- 2. EARLY RETURN AFTER HOOKS ---
  if (!isOpen) return null;

  const claimMilestone = (m: number) => {
    // Acknowledge all milestones up to this point
    const toAcknowledge = allMilestones.filter(milestone => noteCount >= milestone);
    setAcknowledgedMilestones(prev => [...new Set([...prev, ...toAcknowledge])].sort((a, b) => a - b));
  };

  const getMilestoneInfo = (m: number) => {
    if (m >= 100) return { title: 'Legendary Archivist', emoji: '🏆', color: 'from-yellow-400 via-orange-400 to-yellow-600', ring: 'ring-yellow-400' };
    if (m >= 50) return { title: 'Master Scribe', emoji: '🥈', color: 'from-slate-200 via-slate-400 to-slate-500', ring: 'ring-slate-300' };
    if (m >= 30) return { title: 'Dedicated Weaver', emoji: '🥉', color: 'from-orange-300 via-orange-500 to-orange-700', ring: 'ring-orange-400' };
    return { title: 'Rising Thinker', emoji: '✨', color: 'from-blue-400 via-indigo-500 to-primary-600', ring: 'ring-primary-400' };
  };

  const maxTypeCount = Math.max(...(Object.values(typeCounts) as number[]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span className="text-primary-500">📊</span> Analytics & Awards
          </h2>
          <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
            
            {/* CLAIMABLE AWARD BANNER */}
            {currentPendingMilestone && (
              <div 
                onClick={() => claimMilestone(currentPendingMilestone)}
                className="mb-8 p-8 rounded-3xl border-4 border-primary-400 bg-gradient-to-br from-primary-600 via-indigo-700 to-purple-800 text-white flex items-center gap-8 shadow-2xl animate-[awardBounce_1.2s_infinite] cursor-pointer relative overflow-hidden group hover:brightness-110"
              >
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,rgba(255,255,255,0.3),transparent)]"></div>
                <div className="text-8xl filter drop-shadow-[0_0_20px_rgba(255,255,255,0.5)] transform group-hover:scale-110 transition-transform">{getMilestoneInfo(currentPendingMilestone).emoji}</div>
                <div className="flex-1 z-10">
                    <h3 className="text-3xl font-black uppercase tracking-tighter leading-none mb-2">New Milestone!</h3>
                    <p className="text-xl font-bold opacity-90">Unlocked: {currentPendingMilestone}+ Notes Badge</p>
                    <p className="text-sm mt-2 font-medium opacity-80 italic">Tap to claim this achievement for your permanent Hall of Fame</p>
                </div>
                <div className="bg-white text-primary-600 p-5 rounded-full shadow-lg group-hover:scale-125 transition-all">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6L9 17L4 12"/></svg>
                </div>
              </div>
            )}

            {/* HALL OF FAME ACHIEVEMENTS */}
            <div className="mb-10">
              <div className="flex items-center gap-4 mb-6">
                 <h4 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    Achievement Hall of Fame
                 </h4>
                 <div className="h-px flex-1 bg-slate-100 dark:bg-slate-700"></div>
              </div>
              <div className="flex flex-wrap gap-6 min-h-[80px] p-2">
                {acknowledgedMilestones.length === 0 ? (
                    <div className="w-full text-center py-6 border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-2xl">
                        <p className="text-sm text-slate-400 italic">Unlock shields by hitting note count milestones (10, 20, 30...).</p>
                    </div>
                ) : acknowledgedMilestones.map(m => {
                  const info = getMilestoneInfo(m);
                  return (
                    <div key={m} className="flex flex-col items-center gap-2 group animate-[badgePop_0.5s_ease-out]">
                      <div className={`relative flex items-center justify-center w-16 h-20 bg-gradient-to-br ${info.color} text-white shadow-2xl ring-2 ${info.ring} ring-offset-4 dark:ring-offset-slate-800 rounded-xl transform transition-all group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-primary-500/20`}>
                        <svg className="absolute inset-0 w-full h-full opacity-40" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M0 0 L100 0 L100 100 L0 100 Z" fill="url(#shine-grad)" />
                            <defs>
                                <linearGradient id="shine-grad" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stopColor="white" stopOpacity="0.6" />
                                    <stop offset="100%" stopColor="white" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div className="flex flex-col items-center leading-none z-10">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="mb-1 drop-shadow-sm"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
                            <span className="text-sm font-black tracking-tighter drop-shadow-sm">{m}+</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase opacity-0 group-hover:opacity-100 transition-opacity tracking-widest">Mastery</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`mb-8 p-6 rounded-2xl flex items-center gap-6 shadow-sm border ${persona.color}`}>
                <div className="text-6xl filter drop-shadow-md animate-[personaWobble_4s_infinite]">
                    {persona.emoji}
                </div>
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider opacity-70 mb-1">AI Determined Persona</h3>
                    <p className="text-2xl font-black mb-1 tracking-tight">{persona.title}</p>
                    <p className="opacity-90 font-medium text-sm leading-relaxed">{persona.description}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-6">Volume Matrix</h3>
                    <div className="flex items-end justify-between h-40 gap-2 px-2">
                        {[
                            { label: 'Quick', count: typeCounts.quick, color: 'bg-yellow-400' },
                            { label: 'NoteB', count: typeCounts.notebook, color: 'bg-slate-400' },
                            { label: 'Deep', count: typeCounts.deep, color: 'bg-blue-400' },
                            { label: 'Code', count: typeCounts.code, color: 'bg-indigo-400' },
                            { label: 'Project', count: typeCounts.project, color: 'bg-green-400' },
                            { label: 'Doc', count: typeCounts.document, color: 'bg-slate-400' },
                        ].map((item) => (
                            <div key={item.label} className="flex flex-col items-center justify-end w-full group h-full">
                                <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {item.count}
                                </div>
                                <div 
                                    className={`w-full max-w-[40px] rounded-t-lg transition-all duration-700 ${item.color} hover:brightness-110 shadow-sm`}
                                    style={{ height: maxTypeCount > 0 ? `${(item.count / maxTypeCount) * 100}%` : '4px', minHeight: '4px' }}
                                ></div>
                                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-2 uppercase tracking-tighter">{item.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                 <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">Semantic Clusters</h3>
                    {tagStats.length > 0 ? (
                        <div className="space-y-4">
                            {tagStats.map(([tag, count]) => (
                                <div key={tag} className="group">
                                    <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                                        <span>#{tag}</span>
                                        <span>{count}</span>
                                    </div>
                                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                                        <div 
                                            className="bg-primary-500 h-3 rounded-full transition-all duration-1000 ease-out group-hover:bg-primary-400 relative" 
                                            style={{ width: `${(count / (tagStats[0][1] || 1)) * 100}%` }}
                                        >
                                            <div className="absolute inset-0 bg-white/20 animate-[pulse_2s_infinite]"></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-400 italic text-sm">
                            Add tags to start neural mapping.
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col">
                     <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">Topic Distribution</h3>
                     <div className="flex items-center justify-center gap-6 flex-1 min-h-[160px]">
                        {pieArcs.length > 0 ? (
                            <>
                                <svg width="160" height="160" viewBox="-80 -80 160 160">
                                    {pieArcs.map((d, i) => (
                                        <path 
                                            key={i} 
                                            d={d.path} 
                                            fill={d.color} 
                                            stroke="white" 
                                            strokeWidth="2"
                                            className="hover:opacity-80 transition-opacity cursor-pointer"
                                        >
                                            <title>{d.data.name}: {d.data.value}</title>
                                        </path>
                                    ))}
                                    <text x="0" y="5" textAnchor="middle" className="text-xs font-black fill-slate-500 dark:fill-slate-400 pointer-events-none">
                                        {notes.length}
                                    </text>
                                </svg>
                                <div className="text-xs space-y-1">
                                    {pieArcs.map((d, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></span>
                                            <span className="font-bold text-slate-700 dark:text-slate-200 truncate max-w-[80px]">{d.data.name}</span>
                                            <span className="text-slate-400">({Math.round(d.data.value / notes.length * 100)}%)</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <p className="text-slate-400 italic text-sm">Waiting for categorization.</p>
                        )}
                     </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">Retention Curve</h3>
                    <div className="flex-1 min-h-[160px] flex items-center justify-center">
                        {lineChartPath ? (
                            <div className="w-full h-full relative px-2">
                                <svg width="100%" height="100%" viewBox={`0 0 ${lineChartPath.width} ${lineChartPath.height}`} preserveAspectRatio="none">
                                    {lineChartPath.y.ticks(3).map(tick => (
                                        <line 
                                            key={tick} 
                                            x1="30" x2={lineChartPath.width} 
                                            y1={lineChartPath.y(tick)} y2={lineChartPath.y(tick)} 
                                            stroke="#e2e8f0" 
                                            strokeDasharray="4"
                                            className="dark:stroke-slate-700"
                                        />
                                    ))}
                                    <path 
                                        d={lineChartPath.path} 
                                        fill="none" 
                                        stroke="#8b5cf6" 
                                        strokeWidth="4" 
                                        strokeLinecap="round"
                                        className="filter drop-shadow-sm"
                                    />
                                    <path 
                                        d={`${lineChartPath.path} L ${lineChartPath.width - 10} ${lineChartPath.height - 20} L 30 ${lineChartPath.height - 20} Z`} 
                                        fill="url(#retention-grad)" 
                                        opacity="0.15" 
                                    />
                                    <defs>
                                        <linearGradient id="retention-grad" x1="0" x2="0" y1="0" y2="1">
                                            <stop offset="0%" stopColor="#8b5cf6" />
                                            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                                <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] font-black text-slate-400 px-8 uppercase tracking-widest">
                                    <span>Inception</span>
                                    <span>Now</span>
                                </div>
                            </div>
                        ) : (
                             <p className="text-slate-400 italic text-sm">Start deep-noting for analytics.</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm text-center transform hover:-translate-y-1 transition-transform">
                    <p className="text-3xl font-black text-primary-600 dark:text-primary-400">{notes.length}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Entries</p>
                </div>
                 <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm text-center transform hover:-translate-y-1 transition-transform">
                    <p className="text-3xl font-black text-green-600 dark:text-green-400">{notes.reduce((sum, n) => sum + (n.accessCount || 0), 0)}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Insights</p>
                </div>
                 <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm text-center transform hover:-translate-y-1 transition-transform opacity-80">
                    <p className="text-2xl font-black text-slate-600 dark:text-slate-300">{acknowledgedMilestones.length}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Shields</p>
                </div>
                 <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm text-center transform hover:-translate-y-1 transition-transform opacity-80">
                    <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{tagStats.length}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Nodes</p>
                </div>
            </div>

            <div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-4 border-b pb-1 dark:border-slate-700 flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    High Performance Focus
                </h3>
                {topAccessedNotes.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {topAccessedNotes.map((note) => (
                            <div key={note.id} className="flex items-start justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-md transition-shadow">
                                <div className="truncate pr-2">
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{note.title}</p>
                                    <div className="flex gap-1 mt-1">
                                        <span className="text-[9px] uppercase font-bold text-slate-400 border border-slate-200 dark:border-slate-600 rounded px-1">{note.type}</span>
                                        {note.tags.slice(0,2).map(t => <span key={t} className="text-[9px] text-slate-400">#{t}</span>)}
                                    </div>
                                </div>
                                <span className="flex-shrink-0 text-xs font-mono font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-md">
                                    {note.accessCount} recall
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-slate-400 italic">No usage history detected yet.</p>
                )}
            </div>

        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes personaWobble {
            0%, 100% { transform: translateY(-5%) rotate(0deg); }
            25% { transform: translateY(0) rotate(-3deg); }
            50% { transform: translateY(-2%) rotate(3deg); }
            75% { transform: translateY(0) rotate(-1deg); }
        }
        @keyframes awardBounce {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-12px) scale(1.02); }
        }
        @keyframes badgePop {
            from { transform: scale(0) rotate(-30deg); opacity: 0; }
            to { transform: scale(1) rotate(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default AnalyticsModal;