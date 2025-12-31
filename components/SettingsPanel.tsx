
import React, { useState, useEffect } from 'react';
import { 
    getRequests, approveRequest, denyRequest, 
    getUsers, toggleUserStatus, isAdmin, isGlobalAdmin, checkDatabaseConnection,
    getAuditLogs, AuditLogEntry, deleteUserAccount, updateUserRole 
} from '../services/authService';
import { runConnectivityTest, getAIUsageLogs } from '../services/geminiService';
import { exportDataToFile, syncAllNotes } from '../services/storageService';
import { getTrafficLogs, clearTrafficLogs, TrafficEntry } from '../services/trafficService';
import { Theme, User, Note } from '../types';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  darkMode: boolean;
  toggleDarkMode: () => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  notes: Note[];
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
    isOpen, onClose, currentUser, darkMode, toggleDarkMode, theme, setTheme, notes
}) => {
  const [activeTab, setActiveTab] = useState('appearance');
  const [requests, setRequests] = useState<User[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [aiLogs, setAiLogs] = useState<any[]>([]);
  const [trafficLogs, setTrafficLogs] = useState<TrafficEntry[]>([]);
  const [healthStatus, setHealthStatus] = useState<{db: string, ai: string, storage: string, session: string} | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState('');

  const userIsAdmin = isAdmin(currentUser);
  const userIsSuperAdmin = isGlobalAdmin(currentUser);

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'traffic' && userIsAdmin) {
        setTrafficLogs(getTrafficLogs());
        const handleUpdate = () => setTrafficLogs(getTrafficLogs());
        window.addEventListener('weavenote_traffic_update', handleUpdate);
        return () => window.removeEventListener('weavenote_traffic_update', handleUpdate);
      }
      if (activeTab === 'admin' && userIsAdmin) loadAdminData();
      if (activeTab === 'security' && userIsSuperAdmin) loadSecurityData();
      if (activeTab === 'logs' && userIsAdmin) setAiLogs(getAIUsageLogs());
      if (activeTab === 'health') runDiagnostics();
    }
  }, [isOpen, activeTab, userIsAdmin, userIsSuperAdmin]);

  const loadAdminData = async () => {
    setIsLoading(true);
    try {
      const [reqs, allUsers] = await Promise.all([getRequests(), getUsers()]);
      setRequests(reqs);
      setUsers(allUsers.sort((a,b) => b.lastLogin - a.lastLogin));
    } finally { setIsLoading(false); }
  };

  const loadSecurityData = async () => {
    setIsLoading(true);
    try { setAuditLogs(await getAuditLogs()); } finally { setIsLoading(false); }
  };

  const runDiagnostics = async () => {
    setHealthStatus(null);
    const [dbCheck, aiCheck] = await Promise.all([checkDatabaseConnection(), runConnectivityTest()]);
    
    // Calculate storage usage
    const storageSize = new Blob(Object.values(localStorage)).size / 1024;
    
    setHealthStatus({
        db: dbCheck.success ? `Connected (${dbCheck.latency}ms)` : `Critical: ${dbCheck.message}`,
        ai: aiCheck.success ? "Active" : `Failure: ${aiCheck.message}`,
        storage: `${storageSize.toFixed(1)} KB used`,
        session: `Auth: ${currentUser ? 'Authenticated' : 'Guest'}`
    });
  };

  const handleSyncNow = async () => {
    if (!currentUser) return;
    setSyncMsg('Syncing vault...');
    try {
      await syncAllNotes(notes, currentUser.uid);
      setSyncMsg('Success: Secure sync complete.');
    } catch { setSyncMsg('Sync Failed.'); }
    setTimeout(() => setSyncMsg(''), 3000);
  };

  const handleRoleChange = async (uid: string, newRole: any) => {
    if (!currentUser) return;
    setIsUpdatingRole(uid);
    try {
      await updateUserRole(uid, newRole, currentUser.username);
      await loadAdminData();
    } catch (e) {
      console.error("Role update failed", e);
    } finally {
      setIsUpdatingRole(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-[#1a2333] border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-7xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-700/50 flex justify-between items-center bg-[#0f172a]">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
              <span className="p-1.5 bg-primary-600 text-white rounded-lg shadow-sm">⚙️</span>
              System Control
            </h2>
            <div className="flex gap-1.5 px-3 py-1 bg-slate-800 rounded-full text-[10px] font-bold text-slate-500">
              <span className={healthStatus?.db.startsWith('Connected') ? 'text-emerald-500' : 'text-rose-500'}>DB: {healthStatus?.db.split(' ')[0] || '...'}</span>
              <span className="opacity-30">|</span>
              <span className={healthStatus?.ai === 'Active' ? 'text-indigo-500' : 'text-rose-500'}>AI: {healthStatus?.ai || '...'}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-800 transition-colors text-slate-500">✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 border-r border-slate-700/50 bg-[#0f172a] p-4 space-y-1.5 overflow-y-auto">
            <button onClick={() => setActiveTab('appearance')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'appearance' ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>Visuals</button>
            <button onClick={() => setActiveTab('data')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'data' ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>Data Sync</button>
            <button onClick={() => setActiveTab('health')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'health' ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>System Health</button>
            
            {userIsAdmin && (
              <>
                <div className="pt-6 pb-2 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-t border-slate-800 mt-4">Administrator</div>
                <button onClick={() => setActiveTab('traffic')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'traffic' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>Network Traffic</button>
                <button onClick={() => setActiveTab('admin')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'admin' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>User Base</button>
                
                {userIsSuperAdmin && (
                   <button onClick={() => setActiveTab('security')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'security' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>Audit Vault</button>
                )}
                
                <button onClick={() => setActiveTab('logs')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'logs' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>AI Intel</button>
              </>
            )}
          </div>

          {/* Tab Content */}
          <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-[#1a2333]">
            
            {activeTab === 'appearance' && (
              <div className="space-y-8 animate-[fadeIn_0.2s_ease-out]">
                <div className="flex items-center justify-between p-6 bg-[#0f172a] rounded-2xl border border-slate-700/50">
                  <div>
                    <h4 className="font-black text-white uppercase tracking-tight">Dark Mode Engine</h4>
                    <p className="text-xs text-slate-500">Toggle between high-contrast day and night palettes.</p>
                  </div>
                  <button onClick={toggleDarkMode} className={`w-14 h-7 rounded-full transition-all relative ${darkMode ? 'bg-primary-500' : 'bg-slate-600'}`}>
                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all ${darkMode ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                    {(['default', 'ocean', 'forest', 'sunset', 'rose', 'midnight', 'coffee', 'neon', 'cyberpunk', 'nord', 'dracula', 'lavender', 'earth', 'yellow', 'hyperblue'] as Theme[]).map(t => (
                      <button key={t} onClick={() => setTheme(t)} className={`px-4 py-3 rounded-xl text-[10px] font-black border transition-all uppercase tracking-tighter ${theme === t ? 'border-primary-600 bg-primary-600 text-white shadow-xl scale-[1.05]' : 'border-slate-700 text-slate-500 hover:border-primary-400'}`}>
                        {t}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {activeTab === 'health' && (
              <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-6 bg-black/20 border border-slate-700/50 rounded-2xl">
                       <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Database Persistence</h5>
                       <p className={`text-lg font-bold ${healthStatus?.db.includes('Connected') ? 'text-emerald-500' : 'text-rose-500'}`}>{healthStatus?.db || 'Checking...'}</p>
                    </div>
                    <div className="p-6 bg-black/20 border border-slate-700/50 rounded-2xl">
                       <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">AI Engine Status</h5>
                       <p className={`text-lg font-bold ${healthStatus?.ai === 'Active' ? 'text-indigo-500' : 'text-rose-500'}`}>{healthStatus?.ai || 'Checking...'}</p>
                    </div>
                    <div className="p-6 bg-black/20 border border-slate-700/50 rounded-2xl">
                       <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Local Storage Bloat</h5>
                       <p className="text-lg font-bold text-white">{healthStatus?.storage || 'Calculating...'}</p>
                    </div>
                    <div className="p-6 bg-black/20 border border-slate-700/50 rounded-2xl">
                       <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Active Session</h5>
                       <p className="text-lg font-bold text-white">{healthStatus?.session || 'Resolving...'}</p>
                    </div>
                 </div>
                 <div className="p-8 border-2 border-dashed border-slate-700 rounded-3xl text-center">
                    <h4 className="font-black text-white uppercase tracking-tight mb-2">Deep Infrastructure Sweep</h4>
                    <p className="text-xs text-slate-500 mb-6 max-w-md mx-auto">This performs a comprehensive stress test on Gemini API tokens, Firestore write latency, and cross-origin resource sharing (CORS) accessibility.</p>
                    <button onClick={runDiagnostics} className="px-8 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all border border-slate-700 shadow-xl active:scale-95">Re-run System Diagnostics</button>
                 </div>
              </div>
            )}

            {activeTab === 'traffic' && userIsAdmin && (
              <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
                <div className="flex justify-between items-center">
                    <h4 className="font-black text-indigo-400 uppercase tracking-widest text-xs">Live Traffic Monitor</h4>
                    <button onClick={() => { if(confirm("Purge?")) { clearTrafficLogs(); setTrafficLogs([]); } }} className="text-[10px] font-bold text-rose-500 underline uppercase tracking-widest">Purge Logs</button>
                </div>
                <div className="bg-black/40 rounded-2xl border border-slate-800 overflow-hidden font-mono shadow-inner">
                   <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                       {trafficLogs.map(log => (
                           <div key={log.id} className="grid grid-cols-12 gap-2 p-3 text-[10px] border-b border-slate-800 hover:bg-slate-800/40">
                               <div className={`col-span-1 font-bold ${log.status < 300 ? 'text-emerald-500' : 'text-rose-500'}`}>{log.status}</div>
                               <div className="col-span-1 text-slate-500">{log.method}</div>
                               <div className="col-span-4 text-indigo-400 truncate">{log.endpoint}</div>
                               <div className="col-span-2 text-slate-400">{log.ip}</div>
                               <div className="col-span-4 text-right">
                                   <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${log.type === 'suspicious' ? 'bg-rose-500/20 text-rose-500 animate-pulse' : 'bg-slate-700 text-slate-400'}`}>
                                       {log.type}
                                   </span>
                               </div>
                           </div>
                       ))}
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'admin' && userIsAdmin && (
              <div className="space-y-8 animate-[fadeIn_0.2s_ease-out]">
                {requests.length > 0 && (
                   <div className="space-y-3">
                      <h4 className="font-black text-amber-500 uppercase tracking-widest text-xs">Pending Approvals</h4>
                      {requests.map(r => (
                        <div key={r.uid} className="flex items-center justify-between p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                            <span className="text-sm font-bold text-amber-200">{r.username} ({r.email})</span>
                            <div className="flex gap-2">
                                <button onClick={() => approveRequest(r.uid).then(loadAdminData)} className="px-4 py-1 bg-emerald-600 text-white text-[10px] font-black rounded-lg">Approve</button>
                                <button onClick={() => denyRequest(r.uid).then(loadAdminData)} className="px-4 py-1 bg-rose-600 text-white text-[10px] font-black rounded-lg">Deny</button>
                            </div>
                        </div>
                      ))}
                   </div>
                )}
                <div className="overflow-x-auto rounded-2xl border border-slate-700 bg-black/20">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-800/50 border-b border-slate-700 text-[10px] uppercase font-black text-slate-500">
                                <th className="px-4 py-3">Identity</th>
                                <th className="px-4 py-3">Geo / IP</th>
                                <th className="px-4 py-3">AI Usage</th>
                                <th className="px-4 py-3">Role</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-right">Manage</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs">
                            {users.map(u => (
                                <tr key={u.uid} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                                    <td className="px-4 py-3 font-black text-white">
                                      <div className="flex items-center gap-2">
                                        {u.username}
                                        {u.uid === currentUser?.uid && <span className="text-[8px] bg-primary-500/20 text-primary-400 px-1 rounded">YOU</span>}
                                      </div>
                                      <span className="text-[9px] text-slate-500 font-normal">{u.email}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col">
                                            <span className="text-white">{u.countryFlag} {u.country || 'Unknown'}</span>
                                            <span className="text-[10px] font-mono text-slate-500">{u.ipAddress || '0.0.0.0'}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (u.aiUsageCount || 0) / 2)}%` }} />
                                            </div>
                                            <span className="font-mono text-[10px] text-slate-400">{u.aiUsageCount || 0}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      {userIsSuperAdmin && u.uid !== currentUser?.uid ? (
                                        <div className="relative inline-block">
                                          <select 
                                            disabled={isUpdatingRole === u.uid}
                                            value={u.role} 
                                            onChange={(e) => handleRoleChange(u.uid, e.target.value)}
                                            className={`bg-slate-800 border border-slate-700 text-white rounded p-1 text-[10px] outline-none focus:ring-1 focus:ring-primary-500 transition-all ${isUpdatingRole === u.uid ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:border-slate-500'}`}
                                          >
                                            <option value="user">User</option>
                                            <option value="admin">Admin</option>
                                            <option value="super-admin">Super Admin</option>
                                          </select>
                                          {isUpdatingRole === u.uid && (
                                            <span className="absolute -right-5 top-1 animate-spin text-primary-500">◌</span>
                                          )}
                                        </div>
                                      ) : (
                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${u.role === 'super-admin' ? 'bg-rose-500/20 text-rose-400' : u.role === 'admin' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-700 text-slate-400'}`}>
                                          {u.role}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${u.status === 'active' ? 'text-emerald-500 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'}`}>{u.status}</span></td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-1">
                                          <button onClick={() => toggleUserStatus(u.uid, u.status).then(loadAdminData)} className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all" title="Toggle Access">
                                            {u.status === 'active' ? '🔒' : '🔓'}
                                          </button>
                                          {u.uid !== currentUser?.uid && (
                                            <button onClick={() => { if(confirm("Purge User permanently?")) deleteUserAccount(u.uid).then(loadAdminData); }} className="p-1.5 rounded bg-rose-500/10 hover:bg-rose-50 text-rose-500 transition-all">
                                              🗑️
                                            </button>
                                          )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
              </div>
            )}

            {activeTab === 'security' && userIsSuperAdmin && (
              <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
                <h4 className="font-black text-rose-500 uppercase tracking-widest text-xs">Cryptographic Audit Vault</h4>
                <div className="bg-black/40 rounded-2xl border border-slate-800 overflow-hidden shadow-inner">
                   <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                       {auditLogs.map(log => (
                           <div key={log.id} className="p-4 border-b border-slate-800 flex items-start gap-4 hover:bg-slate-800/20">
                               <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 text-lg">📜</div>
                               <div className="flex-1">
                                   <div className="flex justify-between items-center mb-1">
                                       <p className="text-xs font-black text-white uppercase">{log.action}</p>
                                       <span className="text-[10px] font-mono text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
                                   </div>
                                   <p className="text-[11px] text-slate-400">Actor: <span className="text-primary-400 font-bold">{log.actor}</span> | Target: {log.target || 'System'}</p>
                                   {log.details && <p className="text-[9px] mt-1 p-2 bg-black/20 rounded font-mono text-slate-500">{log.details}</p>}
                               </div>
                           </div>
                       ))}
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'logs' && userIsAdmin && (
              <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
                <h4 className="font-black text-indigo-400 uppercase tracking-widest text-xs">AI Neural Interaction Intel</h4>
                <div className="space-y-3">
                   {aiLogs.map(log => (
                       <div key={log.id} className="p-4 bg-[#0f172a] rounded-2xl border border-slate-700/50 flex flex-col gap-2">
                           <div className="flex justify-between items-center">
                               <span className="text-xs font-black uppercase text-indigo-400">{log.action}</span>
                               <span className="text-[10px] font-mono text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                           </div>
                           <p className="text-[10px] text-slate-400 font-mono italic p-3 bg-black/20 rounded-xl border border-slate-800 leading-relaxed">{log.details}</p>
                       </div>
                   ))}
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
