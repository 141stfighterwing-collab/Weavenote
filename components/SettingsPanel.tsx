import React, { useState, useEffect } from 'react';
import { 
    getRequests, approveRequest, denyRequest, 
    getUsers, toggleUserStatus, isAdmin, checkDatabaseConnection,
    getAuditLogs, AuditLogEntry, deleteUserAccount, updateUserPermission, updateUserRole 
} from '../services/authService';
import { runConnectivityTest, getErrorLogs, clearErrorLogs, getAIUsageLogs } from '../services/geminiService';
import { exportDataToFile, syncAllNotes, downloadAllNotesAsZip } from '../services/storageService';
import { getTrafficLogs, clearTrafficLogs, TrafficEntry } from '../services/trafficService';
import { Theme, User, AILogEntry, Note } from '../types';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  darkMode: boolean;
  toggleDarkMode: () => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  reducedMotion: boolean;
  toggleReducedMotion: () => void;
  enableImages: boolean;
  toggleEnableImages: () => void;
  showLinkPreviews: boolean;
  toggleShowLinkPreviews: () => void;
  notes: Note[];
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
    isOpen, onClose, currentUser, darkMode, toggleDarkMode, theme, setTheme,
    reducedMotion, toggleReducedMotion, enableImages, toggleEnableImages,
    showLinkPreviews, toggleShowLinkPreviews, notes
}) => {
  const [activeTab, setActiveTab] = useState('appearance');
  const [requests, setRequests] = useState<User[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [aiLogs, setAiLogs] = useState<AILogEntry[]>([]);
  const [trafficLogs, setTrafficLogs] = useState<TrafficEntry[]>([]);
  const [healthStatus, setHealthStatus] = useState<{db: string, ai: string} | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const userIsAdmin = isAdmin(currentUser);

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'traffic' && userIsAdmin) {
        setTrafficLogs(getTrafficLogs());
        const handleUpdate = () => setTrafficLogs(getTrafficLogs());
        window.addEventListener('weavenote_traffic_update', handleUpdate);
        return () => window.removeEventListener('weavenote_traffic_update', handleUpdate);
      }
      if (activeTab === 'admin' && userIsAdmin) loadAdminData();
      if (activeTab === 'security' && userIsAdmin) loadSecurityData();
      if (activeTab === 'logs' && userIsAdmin) loadLogsData();
      if (activeTab === 'health') runDiagnostics();
    }
  }, [isOpen, activeTab, userIsAdmin]);

  const loadAdminData = async () => {
    setIsLoading(true);
    try {
      const [reqs, allUsers] = await Promise.all([getRequests(), getUsers()]);
      setRequests(reqs);
      setUsers(allUsers.sort((a,b) => b.lastLogin - a.lastLogin));
    } catch (e) {} finally { setIsLoading(false); }
  };

  const loadSecurityData = async () => {
    setIsLoading(true);
    try {
      const logs = await getAuditLogs();
      setAuditLogs(logs);
    } catch (e) {} finally { setIsLoading(false); }
  };

  const loadLogsData = () => {
    setAiLogs(getAIUsageLogs());
  };

  const runDiagnostics = async () => {
    setHealthStatus(null);
    const [dbCheck, aiCheck] = await Promise.all([checkDatabaseConnection(), runConnectivityTest()]);
    setHealthStatus({
        db: dbCheck.success ? `Connected (${dbCheck.latency}ms)` : `Error: ${dbCheck.message}`,
        ai: aiCheck.success ? "Active (Gemini 3 Flash Online)" : `Error: ${aiCheck.message}`
    });
  };

  const handleSyncNow = async () => {
    if (!currentUser) return;
    setSyncMsg('Syncing all entries...');
    try {
      await syncAllNotes(notes, currentUser.uid);
      setSyncMsg('Success: All entries encrypted and stored.');
    } catch (e) {
      setSyncMsg('Sync Failed. Check console.');
    }
    setTimeout(() => setSyncMsg(''), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-7xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter flex items-center gap-2">
              <span className="p-1.5 bg-primary-600 text-white rounded-lg shadow-sm">⚙️</span>
              System Control
            </h2>
            <div className="flex gap-1.5 px-3 py-1 bg-slate-200 dark:bg-slate-700 rounded-full text-[10px] font-bold text-slate-500">
              <span className={healthStatus?.db.includes('Connected') ? 'text-green-500' : 'text-red-500'}>DB: {healthStatus?.db || '...'}</span>
              <span className="opacity-30">|</span>
              <span className={healthStatus?.ai.includes('Active') ? 'text-indigo-500' : 'text-red-500'}>AI: {healthStatus?.ai || '...'}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-500">✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-56 border-r border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 p-4 space-y-1.5 overflow-y-auto">
            <button onClick={() => setActiveTab('appearance')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'appearance' ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Visuals</button>
            <button onClick={() => setActiveTab('data')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'data' ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Data Sync</button>
            <button onClick={() => setActiveTab('health')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'health' ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>System Health</button>
            
            {userIsAdmin && (
              <>
                <div className="pt-6 pb-2 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-t border-slate-200 dark:border-slate-700 mt-2">Administrator</div>
                <button onClick={() => setActiveTab('traffic')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'traffic' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Network Traffic</button>
                <button onClick={() => setActiveTab('admin')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'admin' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>User Base</button>
                <button onClick={() => setActiveTab('security')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'security' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Audit Vault</button>
                <button onClick={() => setActiveTab('logs')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'logs' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>AI Intel</button>
              </>
            )}
          </div>

          {/* Tab Content */}
          <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-800">
            
            {activeTab === 'appearance' && (
              <div className="space-y-8 animate-[fadeIn_0.2s_ease-out]">
                <div className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <div>
                    <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-tight">Dark Mode Engine</h4>
                    <p className="text-xs text-slate-500">Toggle between high-contrast day and night palettes.</p>
                  </div>
                  <button onClick={toggleDarkMode} className={`w-14 h-7 rounded-full transition-all relative ${darkMode ? 'bg-primary-500' : 'bg-slate-300'}`}>
                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all ${darkMode ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
                <div>
                  <h4 className="font-black text-slate-800 dark:text-white mb-4 uppercase tracking-widest text-[11px] opacity-60">Neural Skin Selection</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                    {(['default', 'ocean', 'forest', 'sunset', 'rose', 'midnight', 'coffee', 'neon', 'cyberpunk', 'nord', 'dracula', 'lavender', 'earth', 'yellow', 'hyperblue'] as Theme[]).map(t => (
                      <button key={t} onClick={() => setTheme(t)} className={`px-4 py-3 rounded-xl text-[10px] font-black border transition-all uppercase tracking-tighter ${theme === t ? 'border-primary-600 bg-primary-600 text-white shadow-xl scale-[1.05]' : 'border-slate-200 text-slate-500 dark:border-slate-700 hover:border-primary-400'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'data' && (
              <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
                <div className="p-6 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-2xl">
                    <h4 className="font-black text-primary-800 dark:text-primary-300 mb-2 uppercase tracking-tight">Cloud Sync Orchestrator</h4>
                    <p className="text-xs text-primary-700 dark:text-primary-400 mb-6 leading-relaxed">Ensure your data is permanently persisted to the encrypted Firestore vault. This secures your entries against local cache clearings.</p>
                    <div className="flex flex-wrap gap-3">
                        <button onClick={handleSyncNow} className="px-6 py-2.5 bg-primary-600 text-white rounded-xl text-xs font-bold shadow-lg hover:brightness-110 active:scale-95 transition-all">Manual Sync Now</button>
                        <button onClick={() => exportDataToFile(notes)} className="px-6 py-2.5 bg-white dark:bg-slate-800 border border-primary-200 text-primary-700 dark:text-primary-300 rounded-xl text-xs font-bold shadow-sm hover:bg-primary-50">Export Backup (JSON)</button>
                        <button onClick={() => downloadAllNotesAsZip(notes)} className="px-6 py-2.5 bg-white dark:bg-slate-800 border border-primary-200 text-primary-700 dark:text-primary-300 rounded-xl text-xs font-bold shadow-sm hover:bg-primary-50">Export as Markdown (ZIP)</button>
                    </div>
                    {syncMsg && <p className="mt-4 text-xs font-black text-primary-600 animate-pulse">{syncMsg}</p>}
                </div>
              </div>
            )}

            {activeTab === 'health' && (
              <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
                <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-xs opacity-60">Diagnostic Health Checks</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-col items-center text-center">
                        <div className={`w-12 h-12 rounded-full mb-4 flex items-center justify-center ${healthStatus?.db.includes('Connected') ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M4 7V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"/><path d="M9 12l2 2 4-4"/><rect x="2" y="7" width="20" height="13" rx="2" ry="2"/></svg>
                        </div>
                        <h5 className="font-bold text-slate-800 dark:text-white mb-1">Database Connectivity</h5>
                        <p className="text-xs text-slate-500 mb-4">Real-time link to Google Firestore</p>
                        <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase ${healthStatus?.db.includes('Connected') ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                            {healthStatus?.db || 'Testing...'}
                        </span>
                    </div>
                    <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-col items-center text-center">
                        <div className={`w-12 h-12 rounded-full mb-4 flex items-center justify-center ${healthStatus?.ai.includes('Active') ? 'bg-indigo-500/10 text-indigo-500' : 'bg-red-500/10 text-red-500'}`}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="3"></circle><path d="M12 21v-6"/><path d="M12 9V3"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 14.83 4.24 4.24"/></svg>
                        </div>
                        <h5 className="font-bold text-slate-800 dark:text-white mb-1">AI Cognitive Engine</h5>
                        <p className="text-xs text-slate-500 mb-4">Status of Gemini 3 Flash model</p>
                        <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase ${healthStatus?.ai.includes('Active') ? 'bg-indigo-500 text-white' : 'bg-red-500 text-white'}`}>
                            {healthStatus?.ai || 'Testing...'}
                        </span>
                    </div>
                </div>
                <button onClick={runDiagnostics} className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-400 hover:bg-slate-50 transition-all">Re-Run Full Diagnostics</button>
              </div>
            )}

            {activeTab === 'traffic' && userIsAdmin && (
              <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="font-black text-indigo-800 dark:text-indigo-400 uppercase tracking-widest text-xs">Live Traffic Monitor</h4>
                    <button onClick={() => { if(confirm("Purge live traffic history?")) { clearTrafficLogs(); setTrafficLogs([]); } }} className="text-[10px] font-bold text-red-500 underline uppercase tracking-widest">Purge Logs</button>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Inbound Events</p>
                        <p className="text-2xl font-black">{trafficLogs.length}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Bot Filters</p>
                        <p className="text-2xl font-black text-amber-500">{trafficLogs.filter(l => l.type === 'bot').length}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Anomalies</p>
                        <p className="text-2xl font-black text-red-500">{trafficLogs.filter(l => l.type === 'suspicious').length}</p>
                    </div>
                </div>

                <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden font-mono shadow-2xl">
                   <div className="grid grid-cols-12 gap-2 p-3 bg-slate-900 text-[10px] font-black text-slate-500 border-b border-slate-800 uppercase tracking-tighter">
                       <div className="col-span-1">Status</div>
                       <div className="col-span-1">Verb</div>
                       <div className="col-span-3">Resource</div>
                       <div className="col-span-1">Size</div>
                       <div className="col-span-2">Origin IP</div>
                       <div className="col-span-2">Client</div>
                       <div className="col-span-2 text-right">Label</div>
                   </div>
                   <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                       {trafficLogs.map(log => (
                           <div key={log.id} className="grid grid-cols-12 gap-2 p-3 text-[10px] border-b border-slate-900 last:border-0 hover:bg-slate-900/40 transition-colors">
                               <div className={`col-span-1 font-bold ${log.status < 300 ? 'text-green-500' : 'text-red-500'}`}>{log.status}</div>
                               <div className="col-span-1 text-slate-400 font-bold">{log.method}</div>
                               <div className="col-span-3 text-indigo-400 truncate" title={log.endpoint}>{log.endpoint}</div>
                               <div className="col-span-1 text-slate-600">{(log.size/1024).toFixed(1)}k</div>
                               <div className="col-span-2 text-slate-300 truncate">{log.ip}</div>
                               <div className="col-span-2 text-slate-500 truncate" title={log.userAgent}>{log.userAgent.split(' ')[0]}</div>
                               <div className="col-span-2 text-right">
                                   <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                       log.type === 'bot' ? 'bg-amber-500/10 text-amber-500' :
                                       log.type === 'suspicious' ? 'bg-red-500/20 text-red-500 animate-pulse' :
                                       'bg-green-500/10 text-green-500'
                                   }`}>
                                       {log.type}
                                   </span>
                               </div>
                           </div>
                       ))}
                       {trafficLogs.length === 0 && <p className="text-center py-20 text-slate-700 italic text-xs">Awaiting inbound signals...</p>}
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'admin' && userIsAdmin && (
              <div className="space-y-8 animate-[fadeIn_0.2s_ease-out]">
                {/* Pending Table */}
                {requests.length > 0 && (
                   <div className="space-y-3">
                      <h4 className="font-black text-amber-600 uppercase tracking-widest text-xs flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                        Access Requests
                      </h4>
                      <div className="space-y-2">
                          {requests.map(r => (
                              <div key={r.uid} className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800 rounded-xl">
                                  <div>
                                      <p className="text-sm font-bold text-slate-800 dark:text-amber-200">{r.username}</p>
                                      <p className="text-[10px] text-amber-700/60 dark:text-amber-400/60">{r.email} • {r.ipAddress}</p>
                                  </div>
                                  <div className="flex gap-2">
                                      <button onClick={() => approveRequest(r.uid).then(loadAdminData)} className="px-4 py-1.5 bg-green-600 text-white text-[10px] font-black rounded-lg shadow-sm hover:brightness-110 uppercase">Approve</button>
                                      <button onClick={() => denyRequest(r.uid).then(loadAdminData)} className="px-4 py-1.5 bg-white dark:bg-slate-800 text-red-600 border border-red-100 dark:border-red-900 text-[10px] font-black rounded-lg shadow-sm uppercase">Deny</button>
                                  </div>
                              </div>
                          ))}
                      </div>
                   </div>
                )}

                {/* Users List Table */}
                <div className="space-y-4">
                    <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-xs flex items-center justify-between">
                        Registered User Base
                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-900 rounded-full text-[10px] opacity-60 font-bold tracking-normal">{users.length} Active Profiles</span>
                    </h4>
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm bg-slate-50/30 dark:bg-slate-900/20">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-100 dark:bg-slate-900 border-b dark:border-slate-700">
                                    <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500">Identity</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500">Geolocation</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500">AI Usage</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500">Status</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-500 text-right">Manage</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.uid} className="border-b dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800/40 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                                    {u.username}
                                                    {u.role === 'admin' && <span className="px-1.5 py-0.5 bg-indigo-500 text-white text-[7px] rounded uppercase">Admin</span>}
                                                </span>
                                                <span className="text-[9px] text-slate-400 font-mono truncate max-w-[120px]">{u.email}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{u.countryFlag} {u.country}</span>
                                                <span className="text-[9px] font-mono text-slate-400">{u.ipAddress}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black text-indigo-500">{u.aiUsageCount || 0}</span>
                                                <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                    <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (u.aiUsageCount || 0)/5)}%` }} />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${u.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30' : 'bg-red-100 text-red-700 dark:bg-red-900/30'}`}>
                                                {u.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button onClick={() => toggleUserStatus(u.uid, u.status).then(loadAdminData)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-indigo-500" title="Suspend/Activate">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                                                </button>
                                                <button onClick={() => { if(confirm("Delete this profile permanently?")) deleteUserAccount(u.uid).then(loadAdminData); }} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-slate-400 hover:text-red-500" title="Purge Profile">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && userIsAdmin && (
              <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
                <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-xs opacity-60">Cryptographic Audit Vault</h4>
                <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-inner">
                   <div className="max-h-[500px] overflow-y-auto custom-scrollbar p-1">
                       {auditLogs.map(log => (
                           <div key={log.id} className="p-4 border-b last:border-0 border-slate-200 dark:border-slate-800 flex items-start gap-4 hover:bg-white dark:hover:bg-slate-800/40 transition-colors">
                               <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                                   <span className="text-lg">📜</span>
                               </div>
                               <div className="flex-1 min-w-0">
                                   <div className="flex justify-between items-start mb-1">
                                       <p className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">{log.action}</p>
                                       <span className="text-[10px] font-mono text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                                   </div>
                                   <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                                       <span className="font-black text-primary-600">{log.actor}</span> performed action on <span className="font-black italic">{log.target || 'System'}</span>
                                   </p>
                                   {log.details && <p className="mt-1.5 text-[10px] bg-white dark:bg-black/20 p-2 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-500 font-mono italic">{log.details}</p>}
                               </div>
                           </div>
                       ))}
                       {auditLogs.length === 0 && <p className="text-center py-20 text-slate-500 italic text-sm">Vault is currently empty.</p>}
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'logs' && userIsAdmin && (
              <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="font-black text-indigo-800 dark:text-indigo-400 uppercase tracking-widest text-xs">AI Neural Interaction Intel</h4>
                </div>
                <div className="space-y-3">
                   {aiLogs.map(log => (
                       <div key={log.id} className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-col gap-2">
                           <div className="flex justify-between items-center">
                               <div className="flex items-center gap-2">
                                   <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                   <span className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400">{log.action}</span>
                               </div>
                               <span className="text-[10px] font-mono text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                           </div>
                           <p className="text-[11px] text-slate-600 dark:text-slate-300 font-bold tracking-tight">User Context: <span className="text-slate-400">{log.username}</span></p>
                           <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed p-3 bg-white dark:bg-black/20 rounded-xl border border-slate-100 dark:border-slate-800 font-mono line-clamp-2 italic">{log.details}</p>
                       </div>
                   ))}
                   {aiLogs.length === 0 && <p className="text-center py-20 text-slate-500 italic text-sm">No recent AI interactions logged.</p>}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;