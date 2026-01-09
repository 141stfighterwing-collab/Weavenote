import React, { useState, useEffect } from 'react';
import { 
    getRequests, approveRequest, denyRequest, 
    getUsers, toggleUserStatus, isAdmin, isGlobalAdmin, checkDatabaseConnection,
    getAuditLogs, AuditLogEntry, deleteUserAccount, updateUserRole,
    updateUserPassword, adminTriggerReset
} from '../services/authService';
import { runConnectivityTest, getAIUsageLogs, DAILY_REQUEST_LIMIT } from '../services/geminiService';
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
  
  // Security Tab States
  const [newPass, setNewPass] = useState('');
  const [passMsg, setPassMsg] = useState<{type: 'success'|'error', text: string} | null>(null);
  const [isResettingUser, setIsResettingUser] = useState<string | null>(null);

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
    const rawKey = (process.env.API_KEY || "").trim();
    const keyHint = rawKey.length > 8 ? `${rawKey.substring(0, 4)}...${rawKey.substring(rawKey.length - 4)}` : "Not Set";
    
    let dnsStatus = "Checking...";
    try {
        const start = Date.now();
        await fetch('https://generativelanguage.googleapis.com/', { mode: 'no-cors' });
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

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass.length < 8) {
        setPassMsg({ type: 'error', text: "Token must be at least 8 characters." });
        return;
    }
    setIsLoading(true);
    const res = await updateUserPassword(newPass);
    if (res.success) {
        setPassMsg({ type: 'success', text: res.message });
        setNewPass('');
    } else {
        setPassMsg({ type: 'error', text: res.message });
    }
    setIsLoading(false);
  };

  const handleAdminResetTrigger = async (email: string, uid: string) => {
    if (!currentUser || isResettingUser) return;
    setIsResettingUser(uid);
    const res = await adminTriggerReset(email, currentUser.username);
    alert(res.message);
    setIsResettingUser(null);
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
          <div className="w-64 border-r border-slate-700/50 bg-[#0f172a] p-4 space-y-1.5 overflow-y-auto">
            <button onClick={() => setActiveTab('appearance')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'appearance' ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>Visuals</button>
            
            {currentUser && (
               <button onClick={() => setActiveTab('my-security')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'my-security' ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>🛡️ My Security</button>
            )}

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

          <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-[#1a2333]">
            
            {activeTab === 'my-security' && (
              <div className="max-w-md animate-[fadeIn_0.2s_ease-out]">
                 <h4 className="text-lg font-black text-white uppercase mb-6 tracking-tight">Credential Management</h4>
                 <form onSubmit={handlePasswordUpdate} className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">New Security Token</label>
                        <input 
                            type="password" 
                            value={newPass}
                            onChange={e => setNewPass(e.target.value)}
                            placeholder="At least 8 characters"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>
                    {passMsg && (
                        <div className={`p-3 rounded-lg text-xs font-bold ${passMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
                            {passMsg.text}
                        </div>
                    )}
                    <button 
                        type="submit" 
                        disabled={isLoading || !newPass}
                        className="w-full py-3 bg-primary-600 hover:bg-primary-500 disabled:bg-slate-700 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg transition-all"
                    >
                        {isLoading ? 'Updating...' : 'Change Token'}
                    </button>
                 </form>
                 <p className="mt-8 text-xs text-slate-500 leading-relaxed italic border-t border-slate-800 pt-4">
                    Note: If you haven't logged in recently, the system will prompt you to sign out and back in before allowing this update for security reasons.
                 </p>
              </div>
            )}

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
                 </div>
                 <div className="p-8 border-2 border-dashed border-slate-700 rounded-3xl bg-slate-900/40">
                    <button onClick={runDiagnostics} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all">Re-run Diagnostics</button>
                 </div>
              </div>
            )}

            {activeTab === 'admin' && userIsAdmin && (
              <div className="space-y-8 animate-[fadeIn_0.2s_ease-out]">
                <div className="overflow-x-auto rounded-2xl border border-slate-700 bg-black/20 shadow-xl">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-800/50 border-b border-slate-700 text-[10px] uppercase font-black text-slate-500">
                                <th className="px-4 py-4">Identity</th>
                                <th className="px-4 py-4">Role</th>
                                <th className="px-4 py-4">Utilization</th>
                                <th className="px-4 py-4">Status</th>
                                <th className="px-4 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs">
                            {users.map(u => (
                                <tr key={u.uid} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                                    <td className="px-4 py-4 font-black text-white">
                                      {u.username}
                                      <span className="text-[9px] text-slate-500 font-normal block">{u.email}</span>
                                    </td>
                                    <td className="px-4 py-4">
                                      {u.uid !== currentUser?.uid ? (
                                        <select 
                                          value={u.role} 
                                          onChange={(e) => handleRoleChange(u.uid, e.target.value)}
                                          className="bg-slate-900 border border-slate-700 text-indigo-400 rounded px-2 py-1 text-[10px] font-black uppercase"
                                        >
                                          <option value="user">User</option>
                                          <option value="admin">Admin</option>
                                        </select>
                                      ) : <span className="text-rose-400 font-black uppercase">{u.role}</span>}
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className="font-mono text-slate-400">{u.aiUsageCount || 0} reqs</span>
                                    </td>
                                    <td className="px-4 py-4"><span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${u.status === 'active' ? 'text-emerald-500 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'}`}>{u.status}</span></td>
                                    <td className="px-4 py-4 text-right">
                                        <div className="flex justify-end gap-1.5">
                                          <button 
                                            onClick={() => handleAdminResetTrigger(u.email, u.uid)}
                                            disabled={isResettingUser === u.uid}
                                            className="p-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500 text-indigo-400 hover:text-white transition-all shadow-sm"
                                            title="Send Password Reset Email"
                                          >
                                            {isResettingUser === u.uid ? '⌛' : '🔑'}
                                          </button>
                                          <button onClick={() => toggleUserStatus(u.uid, u.status).then(loadAdminData)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all shadow-sm">
                                            {u.status === 'active' ? '🔒' : '🔓'}
                                          </button>
                                          {u.uid !== currentUser?.uid && (
                                            <button onClick={() => { if(confirm("Purge user?")) deleteUserAccount(u.uid).then(loadAdminData); }} className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white transition-all">
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

          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;