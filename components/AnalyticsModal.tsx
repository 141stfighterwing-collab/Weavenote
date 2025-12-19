
import React, { useMemo } from 'react';
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
  if (!isOpen) return null;

  // 1. Tag Analytics
  const tagStats = useMemo(() => {
    const stats: Record<string, number> = {};
    notes.forEach(note => {
      note.tags.forEach(tag => {
        stats[tag] = (stats[tag] || 0) + 1;
      });
    });
    return Object.entries(stats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5); // Top 5
  }, [notes]);

  // 2. Most Accessed Notes
  const topAccessedNotes = useMemo(() => {
    return [...notes]
      .sort((a, b) => (b.accessCount || 0) - (a.accessCount || 0))
      .slice(0, 5)
      .filter(n => (n.accessCount || 0) > 0);
  }, [notes]);

  // 3. Type Counts & Distribution
  const typeCounts = useMemo(() => {
    // FIX: Added missing 'code' property to match NoteType record
    const counts: Record<NoteType, number> = {
        quick: 0,
        deep: 0,
        code: 0,
        project: 0,
        contact: 0,
        document: 0
    };
    notes.forEach(n => {
        if (counts[n.type] !== undefined) {
            counts[n.type]++;
        }
    });
    return counts;
  }, [notes]);

  // 4. Category Stats for Pie Chart
  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    notes.forEach(n => {
        const cat = n.category || 'Uncategorized';
        counts[cat] = (counts[cat] || 0) + 1;
    });
    
    // Convert to array and sort
    let data = Object.entries(counts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    // Group smaller categories into "Other" if too many
    if (data.length > 6) {
        const top5 = data.slice(0, 5);
        const otherValue = data.slice(5).reduce((sum, d) => sum + d.value, 0);
        data = [...top5, { name: 'Other', value: otherValue }];
    }
    return data;
  }, [notes]);

  // 5. Deep Note Trend for Line Chart (Dense Information)
  const trendData = useMemo(() => {
     // Filter only Deep notes
     const deepNotes = notes
        .filter(n => n.type === 'deep' || n.type === 'document' || n.type === 'project' || n.type === 'code')
        .sort((a, b) => a.createdAt - b.createdAt);
     
     if (deepNotes.length === 0) return [];

     const dataPoints: { date: Date, value: number }[] = [];
     let cumulative = 0;
     
     // Group by date to smooth the line
     const groupedByDate = new Map<string, number>();
     deepNotes.forEach(n => {
         const d = new Date(n.createdAt).toLocaleDateString();
         groupedByDate.set(d, (groupedByDate.get(d) || 0) + 1);
     });

     // Create cumulative data points
     Array.from(groupedByDate.entries()).forEach(([dateStr, count], index) => {
         cumulative += count;
         dataPoints.push({
             date: new Date(dateStr),
             value: cumulative
         });
     });

     // Ensure we have a start point if only one point
     if (dataPoints.length === 1) {
         const first = dataPoints[0];
         dataPoints.unshift({ date: new Date(first.date.getTime() - 86400000), value: 0 });
     }

     return dataPoints;
  }, [notes]);

  // Milestone Checker
  const milestone = useMemo(() => {
      const count = notes.length;
      if (count >= 100) return { title: 'Golden Archivist', emoji: '🏆', desc: '100+ Notes! Amazing dedication.', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
      if (count >= 50) return { title: 'Silver Scribe', emoji: '🥈', desc: '50+ Notes! You are building a knowledge base.', color: 'bg-slate-200 text-slate-800 border-slate-300' };
      if (count >= 10) return { title: 'Bronze Note Taker', emoji: '🥉', desc: '10+ Notes! A great start.', color: 'bg-orange-100 text-orange-800 border-orange-300' };
      return null;
  }, [notes.length]);

  // --- D3 Chart Generators ---

  // Pie Chart Generation
  const pieArcs = useMemo(() => {
    const radius = 80;
    const pie = d3.pie<{name: string, value: number}>().value(d => d.value).sort(null);
    const arc = d3.arc<d3.PieArcDatum<{name: string, value: number}>>().innerRadius(40).outerRadius(radius);
    const data = pie(categoryData);
    // Color scale
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b'];
    return data.map((d, i) => ({
        path: arc(d) || undefined,
        centroid: arc.centroid(d),
        data: d.data,
        color: colors[i % colors.length]
    }));
  }, [categoryData]);

  // Line Chart Generation
  const lineChartPath = useMemo(() => {
      if (trendData.length === 0) return '';
      const width = 300;
      const height = 100;
      const margin = { top: 10, right: 10, bottom: 20, left: 30 };

      const x = d3.scaleTime()
        .domain(d3.extent(trendData, d => d.date) as [Date, Date])
        .range([margin.left, width - margin.right]);

      const y = d3.scaleLinear()
        .domain([0, d3.max(trendData, d => d.value) as number])
        .nice()
        .range([height - margin.bottom, margin.top]);

      const line = d3.line<{date: Date, value: number}>()
        .x(d => x(d.date))
        .y(d => y(d.value))
        .curve(d3.curveMonotoneX);

      return { path: line(trendData) || '', x, y, width, height };
  }, [trendData]);


  // 6. Determine Persona (Character)
  const persona: Persona = useMemo(() => {
    if (notes.length === 0) {
        return { title: "The Blank Canvas", emoji: "🎨", description: "Ready to start creating ideas.", color: "bg-slate-100 text-slate-600" };
    }

    const allTags = notes.flatMap(n => n.tags.map(t => t.toLowerCase()));
    
    const personas = [
        {
            id: 'cyber',
            title: "Cybersecurity Specialist",
            emoji: "🛡️",
            description: "Securing networks, patching vulns, and hunting threats.",
            color: "bg-slate-800 text-green-400 border-green-500",
            keywords: ['security', 'cyber', 'hack', 'firewall', 'auth', 'token', 'exploit', 'vuln', 'cve', 'pentest', 'crypto', 'phish', 'malware']
        },
        {
            id: 'network',
            title: "Network Architect",
            emoji: "🌐",
            description: "Connecting the world via IPs, routers, and the cloud.",
            color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
            keywords: ['network', 'ip', 'router', 'switch', 'wifi', 'dns', 'server', 'cloud', 'tcp', 'udp', 'latency', 'bandwidth', 'topology', 'cisco', 'aws', 'azure']
        },
        {
            id: 'nurse',
            title: "Compassionate Caregiver",
            emoji: "🩺",
            description: "Dedicated to patient health, vitals, and care.",
            color: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
            keywords: ['patient', 'meds', 'health', 'clinic', 'doctor', 'nurse', 'vitals', 'symptom', 'hospital', 'care', 'triage', 'shift', 'medical', 'rx']
        },
        {
            id: 'lawyer',
            title: "The Legal Eagle",
            emoji: "⚖️",
            description: "Navigating contracts, cases, and the letter of the law.",
            color: "bg-stone-200 text-stone-800 dark:bg-stone-700 dark:text-stone-200",
            keywords: ['law', 'legal', 'court', 'contract', 'case', 'sue', 'compliance', 'judge', 'jury', 'statute', 'regulation', 'agreement', 'litigation']
        },
        {
            id: 'dev',
            title: "Code Wizard",
            emoji: "💻",
            description: "Turning coffee into code and fixing bugs.",
            color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
            keywords: ['code', 'dev', 'git', 'api', 'bug', 'react', 'js', 'ts', 'python', 'java', 'html', 'css', 'frontend', 'backend', 'fullstack', 'deploy', 'repo']
        },
        {
            id: 'creative',
            title: "Creative Visionary",
            emoji: "🎨",
            description: "Dreaming in color, design, and user experience.",
            color: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-200",
            keywords: ['design', 'art', 'ui', 'ux', 'color', 'draw', 'paint', 'sketch', 'write', 'blog', 'creative', 'inspiration', 'palette', 'adobe', 'figma']
        },
        {
            id: 'finance',
            title: "Financial Guru",
            emoji: "📈",
            description: "Tracking markets, budgets, and investments.",
            color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
            keywords: ['money', 'budget', 'stock', 'crypto', 'invest', 'tax', 'price', 'finance', 'revenue', 'profit', 'cost', 'trade', 'bitcoin', 'wallet']
        },
        {
            id: 'fitness',
            title: "Fitness Enthusiast",
            emoji: "🏋️",
            description: "Chasing gains, PRs, and a healthy lifestyle.",
            color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
            keywords: ['gym', 'workout', 'run', 'diet', 'fitness', 'health', 'lift', 'cardio', 'protein', 'yoga', 'stretch', 'training', 'marathon']
        },
        {
            id: 'chef',
            title: "Master Chef",
            emoji: "🍳",
            description: "Concocting delicious recipes and culinary delights.",
            color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
            keywords: ['recipe', 'cook', 'bake', 'food', 'dinner', 'lunch', 'breakfast', 'ingredients', 'kitchen', 'meal', 'dish', 'flavor']
        },
        {
            id: 'travel',
            title: "The Globetrotter",
            emoji: "✈️",
            description: "Planning the next adventure and exploring the world.",
            color: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
            keywords: ['trip', 'flight', 'hotel', 'travel', 'vacation', 'passport', 'visiting', 'tour', 'beach', 'mountain', 'explore']
        },
        {
            id: 'student',
            title: "Dedicated Student",
            emoji: "🎒",
            description: "Focused on learning, exams, and certifications.",
            color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
            keywords: ['study', 'test', 'exam', 'certification', 'class', 'school', 'learn', 'homework', 'assignment', 'grade', 'college', 'uni']
        },
        {
            id: 'parent',
            title: "The Busy Parent",
            emoji: "🏠",
            description: "Juggling groceries, kids, chores, and family life.",
            color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
            keywords: ['grocery', 'food', 'kids', 'home', 'chore', 'mom', 'dad', 'family', 'school', 'clean', 'house', 'parent']
        }
    ];

    let bestMatch = null;
    let maxScore = 0;

    personas.forEach(p => {
        const score = allTags.filter(t => p.keywords.some(k => t.includes(k))).length;
        if (score > maxScore) {
            maxScore = score;
            bestMatch = p;
        }
    });

    if (bestMatch && maxScore > 0) {
        return {
            title: bestMatch.title,
            emoji: bestMatch.emoji,
            description: bestMatch.description,
            color: bestMatch.color
        };
    }

    let maxType: NoteType = 'quick';
    let maxCount = -1;
    for (const [type, countVal] of Object.entries(typeCounts)) {
        const count = countVal as number;
        if (count > maxCount) {
            maxCount = count;
            maxType = type as NoteType;
        }
    }

    // FIX: Added 'code' persona logic based on NoteType
    if (maxType === 'code') {
        return { 
            title: "The Code Sorcerer", 
            emoji: "💻", 
            description: "Solving problems and architecting systems with precision.",
            color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200"
        };
    }
    if (maxType === 'deep') {
        return { 
            title: "The Professor", 
            emoji: "👨‍🏫", 
            description: "Deep diving into research and complex topics.",
            color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200"
        };
    }
    if (maxType === 'project') {
        return { 
            title: "The Executive", 
            emoji: "💼", 
            description: "Managing timelines, milestones, and deliverables.",
            color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
        };
    }
    if (maxType === 'contact') {
        return { 
            title: "The Networker", 
            emoji: "🤝", 
            description: "Building connections and managing relationships.",
            color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
        };
    }
    if (maxType === 'document') {
        return { 
            title: "The Archivist", 
            emoji: "📚", 
            description: "Organizing knowledge, files, and documentation.",
            color: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200"
        };
    }
    if (maxType === 'quick') {
        return { 
            title: "The Day-to-Day Organizer", 
            emoji: "⚡", 
            description: "Keeping track of fast-moving tasks and ideas.",
            color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
        };
    }

    return { title: "The Idea Weaver", emoji: "🕸️", description: "Spinning a web of diverse thoughts.", color: "bg-primary-100 text-primary-800" };

  }, [notes, typeCounts]);

  const maxTypeCount = Math.max(...(Object.values(typeCounts) as number[]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span className="text-primary-500">📊</span> Analytics & Persona
          </h2>
          <button 
            onClick={onClose} 
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
            
            {/* MILESTONE BANNER (If achieved) */}
            {milestone && (
                <div className={`mb-6 p-4 rounded-xl border flex items-center gap-4 shadow-sm animate-pulse ${milestone.color}`}>
                    <div className="text-4xl">{milestone.emoji}</div>
                    <div>
                        <h3 className="text-lg font-bold uppercase tracking-wider">Congrats! {milestone.title}</h3>
                        <p className="text-sm font-medium opacity-90">{milestone.desc}</p>
                    </div>
                </div>
            )}

            {/* PERSONA CARD */}
            <div className={`mb-8 p-6 rounded-2xl flex items-center gap-6 shadow-sm border border-black/5 ${persona.color}`}>
                <div className="text-6xl filter drop-shadow-md animate-[bounce_2s_infinite]">
                    {persona.emoji}
                </div>
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider opacity-70 mb-1">Your Note Persona</h3>
                    <p className="text-2xl font-bold mb-1">{persona.title}</p>
                    <p className="opacity-90 font-medium">{persona.description}</p>
                </div>
            </div>

            {/* CHARTS GRID 1: Bars & Tags */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* GRAPH ANALYTICS: TYPE DISTRIBUTION */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-6">Note Distribution</h3>
                    <div className="flex items-end justify-between h-40 gap-2 px-2">
                        {[
                            { label: 'Quick', count: typeCounts.quick, color: 'bg-yellow-400' },
                            { label: 'Deep', count: typeCounts.deep, color: 'bg-blue-400' },
                            { label: 'Code', count: typeCounts.code, color: 'bg-indigo-400' },
                            { label: 'Project', count: typeCounts.project, color: 'bg-green-400' },
                            { label: 'Contact', count: typeCounts.contact, color: 'bg-orange-400' },
                            { label: 'Doc', count: typeCounts.document, color: 'bg-slate-400' },
                        ].map((item) => (
                            <div key={item.label} className="flex flex-col items-center justify-end w-full group">
                                <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {item.count}
                                </div>
                                <div 
                                    className={`w-full max-w-[40px] rounded-t-lg transition-all duration-700 ${item.color} hover:brightness-110`}
                                    style={{ height: maxTypeCount > 0 ? `${(item.count / maxTypeCount) * 100}%` : '4px', minHeight: '4px' }}
                                ></div>
                                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-2 uppercase">{item.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                 {/* TOP TAGS GRAPH */}
                 <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">Top Tags</h3>
                    {tagStats.length > 0 ? (
                        <div className="space-y-4">
                            {tagStats.map(([tag, count], index) => (
                                <div key={tag} className="group">
                                    <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                                        <span>#{tag}</span>
                                        <span>{count}</span>
                                    </div>
                                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                                        <div 
                                            className="bg-primary-500 h-3 rounded-full transition-all duration-1000 ease-out group-hover:bg-primary-400 relative" 
                                            style={{ width: `${(count / tagStats[0][1]) * 100}%` }}
                                        >
                                            <div className="absolute inset-0 bg-white/20 animate-[pulse_2s_infinite]"></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-400 italic text-sm">
                            Add tags to see analytics.
                        </div>
                    )}
                </div>
            </div>

            {/* CHARTS GRID 2: Pie & Line */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* CATEGORY DONUT CHART */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col">
                     <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">Category Breakdown</h3>
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
                                    <text x="0" y="5" textAnchor="middle" className="text-xs font-bold fill-slate-500 dark:fill-slate-400 pointer-events-none">
                                        Total: {notes.length}
                                    </text>
                                </svg>
                                <div className="text-xs space-y-1">
                                    {pieArcs.map((d, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></span>
                                            <span className="font-medium text-slate-700 dark:text-slate-200">{d.data.name}</span>
                                            <span className="text-slate-400">({Math.round(d.data.value / notes.length * 100)}%)</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <p className="text-slate-400 italic text-sm">No categorized notes.</p>
                        )}
                     </div>
                </div>

                {/* DENSE INFO LINE GRAPH */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">Dense Info Growth (Deep/Docs)</h3>
                    <div className="flex-1 min-h-[160px] flex items-center justify-center">
                        {lineChartPath ? (
                            <div className="w-full h-full relative">
                                <svg width="100%" height="100%" viewBox={`0 0 ${lineChartPath.width} ${lineChartPath.height}`} preserveAspectRatio="none">
                                    {/* Grid Lines */}
                                    {lineChartPath.y.ticks(5).map(tick => (
                                        <line 
                                            key={tick} 
                                            x1="30" x2={lineChartPath.width} 
                                            y1={lineChartPath.y(tick)} y2={lineChartPath.y(tick)} 
                                            stroke="#e2e8f0" 
                                            strokeDasharray="4"
                                            className="dark:stroke-slate-700"
                                        />
                                    ))}
                                    {/* The Line */}
                                    <path 
                                        d={lineChartPath.path} 
                                        fill="none" 
                                        stroke="#8b5cf6" 
                                        strokeWidth="3" 
                                        strokeLinecap="round"
                                        className="filter drop-shadow-sm"
                                    />
                                    {/* Area Fill */}
                                    <path 
                                        d={`${lineChartPath.path} L ${lineChartPath.width - 10} ${lineChartPath.height - 20} L 30 ${lineChartPath.height - 20} Z`} 
                                        fill="url(#gradient-area)" 
                                        opacity="0.2" 
                                    />
                                    <defs>
                                        <linearGradient id="gradient-area" x1="0" x2="0" y1="0" y2="1">
                                            <stop offset="0%" stopColor="#8b5cf6" />
                                            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                                <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] text-slate-400 px-8">
                                    <span>Start</span>
                                    <span>Today</span>
                                </div>
                            </div>
                        ) : (
                             <p className="text-slate-400 italic text-sm">No deep study notes yet.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* General Stats Cards */}
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm text-center">
                    <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{notes.length}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Total Notes</p>
                </div>
                 <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm text-center">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{notes.reduce((sum, n) => sum + (n.accessCount || 0), 0)}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Total Views</p>
                </div>
                {/* Breakout by type small cards */}
                 <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm text-center opacity-70">
                    <p className="text-lg font-bold text-slate-600 dark:text-slate-300">{typeCounts.quick}</p>
                    <p className="text-[9px] text-slate-400 uppercase font-bold">Quick</p>
                </div>
                 <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm text-center opacity-70">
                    <p className="text-lg font-bold text-slate-600 dark:text-slate-300">{typeCounts.deep}</p>
                    <p className="text-[9px] text-slate-400 uppercase font-bold">Deep</p>
                </div>
                 <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm text-center opacity-70">
                    <p className="text-lg font-bold text-slate-600 dark:text-slate-300">{typeCounts.code}</p>
                    <p className="text-[9px] text-slate-400 uppercase font-bold">Code</p>
                </div>
                 <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm text-center opacity-70">
                    <p className="text-lg font-bold text-slate-600 dark:text-slate-300">{typeCounts.project}</p>
                    <p className="text-[9px] text-slate-400 uppercase font-bold">Project</p>
                </div>
                 <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm text-center opacity-70">
                    <p className="text-lg font-bold text-slate-600 dark:text-slate-300">{typeCounts.contact + typeCounts.document}</p>
                    <p className="text-[9px] text-slate-400 uppercase font-bold">Misc</p>
                </div>
            </div>

            {/* Most Accessed Notes */}
            <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 border-b pb-1 dark:border-slate-700">Most Accessed</h3>
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
                                    {note.accessCount} views
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-slate-400 italic">No views yet.</p>
                )}
            </div>

        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes bounce {
            0%, 100% { transform: translateY(-5%); }
            50% { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default AnalyticsModal;
