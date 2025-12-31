
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
  const [healthStatus, setHealthStatus] = useState<{db: string, ai: string, storage: string, session: string, apiKeyHint: string, dns: string} | null>(null);
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
    
    const storageSize = new Blob(Object.values(localStorage)).size / 1024;
    const rawKey = process.env.API_KEY || "";
    const keyHint = rawKey.length > 8 ? `${rawKey.substring(0, 4)}...${rawKey.substring(rawKey.length - 4)}` : "None Found";
    
    // DNS / Connectivity Check
    let dnsStatus = "Checking...";
    try {
        const start = Date.now();
        await fetch('https://generativelanguage.googleapis.com/generate_a_pixel_for_cors_test', { mode: 'no-cors' });
        dnsStatus = `Reachable (${Date.now() - start}ms)`;
    } catch {
        dnsStatus = "Blocked / Unreachable";
    }
    
    setHealthStatus({
        db: dbCheck.success ? `Connected (${dbCheck.latency}ms)` : `Critical: ${dbCheck.message}`,
        ai: aiCheck.success ? "Active / Healthy" : `Error: ${aiCheck.message}`,
        storage: `${storageSize.toFixed(1)} KB used`,
        session: `Auth: ${currentUser ? 'Authenticated' : 'Guest'}`,
        apiKeyHint: keyHint,
        dns: dnsStatus
    });
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
              <span className={healthStatus?.ai.startsWith('Active') ? 'text-indigo-500' : 'text-rose-500'}>AI: {healthStatus?.ai.split(' ')[0] || '...'}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-800 transition-colors text-slate-500">✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 border-r border-slate-700/50 bg-[#0f172a] p-4 space-y-1.5 overflow-y-auto">
            <button onClick={() => setActiveTab('appearance')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'appearance' ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>Visuals</button>
            <button onClick={() => setActiveTab('health')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'health' ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>System Health</button>
            
            {userIsAdmin && (
              <>
                <div className="pt-6 pb-2 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-t border-slate-800 mt-4">Administrator</div>
                <button onClick={() => setActiveTab('admin')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'admin' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>User Base</button>
                <button onClick={() => setActiveTab('traffic')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'traffic' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>Network Traffic</button>
                
                {userIsSuperAdmin && (
                   <button onClick={() => setActiveTab('security')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'security' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>Audit Vault</button>
                )}
                
                <button onClick={() => setActiveTab('logs')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'logs' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>AI Intel</button>
              </>
            )}
          </div>

          {/* Tab Content */}
          <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-[#1a2333]">
            
            {activeTab === 'health' && (
              <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-6 bg-black/20 border border-slate-700/50 rounded-2xl">
                       <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Database Persistence</h5>
                       <p className={`text-lg font-bold ${healthStatus?.db.includes('Connected') ? 'text-emerald-500' : 'text-rose-500'}`}>{healthStatus?.db || 'Checking...'}</p>
                    </div>
                    <div className="p-6 bg-black/20 border border-slate-700/50 rounded-2xl">
                       <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">AI Engine Status</h5>
                       <p className={`text-lg font-bold ${healthStatus?.ai.includes('Active') ? 'text-indigo-500' : 'text-rose-500'}`}>{healthStatus?.ai || 'Checking...'}</p>
                    </div>
                    <div className="p-6 bg-black/20 border border-slate-700/50 rounded-2xl">
                       <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">API Connectivity</h5>
                       <p className={`text-lg font-bold ${healthStatus?.dns.includes('Reachable') ? 'text-emerald-500' : 'text-rose-500'}`}>{healthStatus?.dns || 'Resolving...'}</p>
                    </div>
                    <div className="p-6 bg-black/20 border border-slate-700/50 rounded-2xl">
                       <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Active API Key Hint</h5>
                       <p className="text-lg font-mono font-bold text-indigo-400">{healthStatus?.apiKeyHint || 'Checking...'}</p>
                    </div>
                    <div className="p-6 bg-black/20 border border-slate-700/50 rounded-2xl">
                       <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Local Sync Cache</h5>
                       <p className="text-lg font-bold text-white">{healthStatus?.storage || 'Calculating...'}</p>
                    </div>
                    <div className="p-6 bg-black/20 border border-slate-700/50 rounded-2xl">
                       <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Session State</h5>
                       <p className="text-lg font-bold text-white">{healthStatus?.session || 'Resolving...'}</p>
                    </div>
                 </div>
                 
                 <div className="p-8 border-2 border-dashed border-slate-700 rounded-3xl bg-slate-900/40">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        <div className="flex-1">
                            <h4 className="font-black text-white uppercase tracking-tight mb-2">Detailed Infrastructure Sweep</h4>
                            <p className="text-xs text-slate-400 leading-relaxed">Runs a packet handshake with Gemini 3, verifies Firestore permission headers, and checks for common browser-level adblockers or corporate firewall interference.</p>
                        </div>
                        <button onClick={runDiagnostics} className="whitespace-nowrap px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-xl active:scale-95">Re-run Diagnostics</button>
                    </div>
                 </div>
              </div>
            )}

            {activeTab === 'admin' && userIsAdmin && (
              <div className="space-y-8 animate-[fadeIn_0.2s_ease-out]">
                {requests.length > 0 && (
                   <div className="space-y-3">
                      <h4 className="font-black text-amber-500 uppercase tracking-widest text-xs">Pending Identity Approvals</h4>
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
                <div className="overflow-x-auto rounded-2xl border border-slate-700 bg-black/20 shadow-2xl">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-800/50 border-b border-slate-700 text-[10px] uppercase font-black text-slate-500">
                                <th className="px-4 py-4">Identity Handle</th>
                                <th className="px-4 py-4">Geolocation & IP</th>
                                <th className="px-4 py-4">AI Usage</th>
                                <th className="px-4 py-4">Current Role</th>
                                <th className="px-4 py-4">State</th>
                                <th className="px-4 py-4 text-right">System Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs">
                            {users.map(u => (
                                <tr key={u.uid} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                                    <td className="px-4 py-4 font-black text-white">
                                      <div className="flex items-center gap-2">
                                        {u.username}
                                        {u.uid === currentUser?.uid && <span className="text-[8px] bg-primary-500/20 text-primary-400 px-1.5 py-0.5 rounded font-black">YOU</span>}
                                      </div>
                                      <span className="text-[9px] text-slate-500 font-normal">{u.email}</span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-slate-200 flex items-center gap-1">{u.countryFlag || '🌐'} {u.country || 'Unknown'}</span>
                                            <span className="text-[9px] font-mono text-slate-500 bg-slate-900/50 px-1.5 py-0.5 rounded w-fit">{u.ipAddress || '0.0.0.0'}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (u.aiUsageCount || 0) / 2)}%` }} />
                                            </div>
                                            <span className="font-mono text-[10px] text-slate-400 font-bold">{u.aiUsageCount || 0}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                      {/* Enhanced Role Dropdown for Admins */}
                                      {userIsAdmin && u.uid !== currentUser?.uid ? (
                                        <div className="relative inline-block group">
                                          <select 
                                            disabled={isUpdatingRole === u.uid}
                                            value={u.role} 
                                            onChange={(e) => handleRoleChange(u.uid, e.target.value)}
                                            className={`bg-slate-900 border border-slate-700 text-indigo-400 rounded-lg px-2 py-1 text-[10px] font-black uppercase outline-none focus:ring-1 focus:ring-primary-500 transition-all ${isUpdatingRole === u.uid ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:border-indigo-500 hover:text-white'}`}
                                          >
                                            <option value="user">User</option>
                                            <option value="admin">Admin</option>
                                            {/* Only Super Admins can promote to Super Admin */}
                                            {userIsSuperAdmin && <option value="super-admin">Super Admin</option>}
                                          </select>
                                          {isUpdatingRole === u.uid && (
                                            <span className="absolute -right-5 top-1.5 animate-spin text-primary-500 text-[10px]">◌</span>
                                          )}
                                        </div>
                                      ) : (
                                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase shadow-sm ${u.role === 'super-admin' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : u.role === 'admin' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-slate-800 text-slate-400'}`}>
                                          {u.role}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-4"><span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${u.status === 'active' ? 'text-emerald-500 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'}`}>{u.status}</span></td>
                                    <td className="px-4 py-4 text-right">
                                        <div className="flex justify-end gap-1.5">
                                          <button onClick={() => toggleUserStatus(u.uid, u.status).then(loadAdminData)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all shadow-sm" title="Lock/Unlock Access">
                                            {u.status === 'active' ? '🔒' : '🔓'}
                                          </button>
                                          {u.uid !== currentUser?.uid && (
                                            <button onClick={() => { if(confirm("Permanently purge this user and all associated vault data?")) deleteUserAccount(u.uid).then(loadAdminData); }} className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white transition-all shadow-sm">
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

            {activeTab === 'appearance' && (
              <div className="space-y-8 animate-[fadeIn_0.2s_ease-out]">
                <div className="flex items-center justify-between p-6 bg-[#0f172a] rounded-2xl border border-slate-700/50">
                  <div>
                    <h4 className="font-black text-white uppercase tracking-tight">System Visual Palette</h4>
                    <p className="text-xs text-slate-500">Toggle between high-contrast light and dark kernels.</p>
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

            {activeTab === 'traffic' && userIsAdmin && (
              <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
                <div className="flex justify-between items-center">
                    <h4 className="font-black text-indigo-400 uppercase tracking-widest text-xs">Infrastructure Traffic Logs</h4>
                    <button onClick={() => { if(confirm("Purge traffic cache?")) { clearTrafficLogs(); setTrafficLogs([]); } }} className="text-[10px] font-bold text-rose-500 underline uppercase tracking-widest">Purge Logs</button>
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

            {activeTab === 'security' && userIsSuperAdmin && (
              <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
                <h4 className="font-black text-rose-500 uppercase tracking-widest text-xs">Immutable Audit Vault</h4>
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
                                   {log.details && <p className="text-[9px] mt-2 p-2 bg-slate-900/80 rounded border border-slate-700 font-mono text-indigo-300">{log.details}</p>}
                               </div>
                           </div>
                       ))}
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'logs' && userIsAdmin && (
              <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
                <h4 className="font-black text-indigo-400 uppercase tracking-widest text-xs">Neural Interface Intelligence</h4>
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
