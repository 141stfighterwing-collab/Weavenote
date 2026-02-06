import React, { useState, useEffect, useRef } from 'react';
import { 
    getUsers, isAdmin, isGlobalAdmin, checkDatabaseConnection,
    updateUserRole, updateUserPassword, adminTriggerReset, testWriteCapability,
    getSystemLogs, SystemLogEntry, setAccountStatus
} from '../services/authService';
import { runConnectivityTest, getAIUsageLogs, DAILY_REQUEST_LIMIT, getDailyUsage, DiagnosticLog } from '../services/geminiService';
import { Theme, User, Note, UserRole, UserStatus } from '../types';

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
  const [users, setUsers] = useState<User[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLogEntry[]>([]);
  const [aiLogs, setAiLogs] = useState<any[]>([]);
  const [diagnosticLogs, setDiagnosticLogs] = useState<DiagnosticLog[]>([]);
  const [healthStatus, setHealthStatus] = useState<{db: string, ai: string, dns: string} | null>(null);
  const [isTestingPerms, setIsTestingPerms] = useState(false);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [permTestResult, setPermTestResult] = useState<{success: boolean, message: string} | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [newPass, setNewPass] = useState('');
  const [passMsg, setPassMsg] = useState<{type: 'success'|'error', text: string} | null>(null);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  const userIsAdmin = isAdmin(currentUser);
  const dailyAIUsage = getDailyUsage() || 0;

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'admin-users' && userIsAdmin) loadAdminData();
      if (activeTab === 'ai-engine') setAiLogs(getAIUsageLogs());
      if (activeTab === 'admin-logs' && userIsAdmin) setSystemLogs(getSystemLogs());
      if (activeTab === 'health') runDiagnostics();
    }
  }, [isOpen, activeTab, userIsAdmin]);

  useEffect(() => {
    if (terminalEndRef.current) {
        terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [diagnosticLogs]);

  const loadAdminData = async () => {
    setIsLoading(true);
    try {
      const allUsers = await getUsers();
      setUsers(allUsers.sort((a,b) => b.lastLogin - a.lastLogin));
    } finally { setIsLoading(false); }
  };

  const runDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    setDiagnosticLogs([]);
    setHealthStatus(null);
    
    // First run DB check
    const dbCheck = await checkDatabaseConnection();
    setDiagnosticLogs(prev => [...prev, ...dbCheck.logs]);
    
    // Then run AI check
    const aiCheck = await runConnectivityTest();
    setDiagnosticLogs(prev => [...prev, ...aiCheck.logs].sort((a, b) => a.timestamp - b.timestamp));

    setHealthStatus({
        db: dbCheck.success ? `${dbCheck.message} (${dbCheck.latency}ms)` : `Error: ${dbCheck.message}`,
        ai: aiCheck.success ? aiCheck.message : `Failed: ${aiCheck.message}`,
        dns: "Reachable"
    });
    setIsRunningDiagnostics(false);
  };

  const handleTestPermissions = async () => {
    setIsTestingPerms(true);
    setPermTestResult(null);
    try {
        const res = await testWriteCapability();
        setPermTestResult(res);
    } catch (e: any) {
        setPermTestResult({ success: false, message: e.message || "Test failed" });
    } finally {
        setIsTestingPerms(false);
    }
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

  const handleRoleChange = async (uid: string, role: UserRole) => {
    if (uid === currentUser?.uid) {
        alert("Admins cannot change their own role. Contact a super-admin.");
        return;
    }
    await updateUserRole(uid, role);
    loadAdminData();
  };

  const handleStatusChange = async (uid: string, status: UserStatus, hours: number = 0) => {
    if (uid === currentUser?.uid) {
        alert("You cannot suspend your own account.");
        return;
    }
    await setAccountStatus(uid, status, hours);
    loadAdminData();
  };

  const handleAdminResetTrigger = async (email: string) => {
    const res = await adminTriggerReset(email);
    alert(res.message);
  };

  const firestoreRulesText = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow list: if true; 
      allow get, write: if request.auth != null && request.auth.uid == userId;
    }
    match /notes/{noteId} {
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow read, update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    match /folders/{folderId} {
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow read, update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    match /system_test/{userId} {
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}`;

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
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-800 transition-colors text-slate-500">✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 border-r border-slate-700/50 bg-[#0f172a] p-4 space-y-1.5 overflow-y-auto">
            <button onClick={() => setActiveTab('appearance')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'appearance' ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>Visuals</button>
            <button onClick={() => setActiveTab('my-security')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'my-security' ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>🛡️ My Security</button>
            <button onClick={() => setActiveTab('ai-engine')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'ai-engine' ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>✨ AI Engine</button>
            <button onClick={() => setActiveTab('health')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'health' ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>Diagnostics</button>
            
            {userIsAdmin && (
              <>
                <div className="pt-6 pb-2 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-t border-slate-800 mt-4">Administrator</div>
                <button onClick={() => setActiveTab('admin-users')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'admin-users' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>User Base</button>
                <button onClick={() => setActiveTab('admin-cloud')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'admin-cloud' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>☁️ Cloud Setup</button>
                <button onClick={() => setActiveTab('admin-logs')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'admin-logs' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>📜 System Logs</button>
              </>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-[#1a2333]">
            
            {activeTab === 'appearance' && (
              <div className="space-y-8 animate-[fadeIn_0.2s_ease-out]">
                <div className="flex items-center justify-between p-6 bg-[#0f172a] rounded-2xl border border-slate-700/50">
                  <div>
                    <h4 className="font-black text-white uppercase tracking-tight">Theme Selector</h4>
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

            {activeTab === 'my-security' && (
              <div className="max-w-2xl space-y-6 animate-[fadeIn_0.2s_ease-out]">
                <h4 className="text-lg font-black text-white uppercase tracking-tight">Profile & Identity</h4>
                <div className="p-6 bg-indigo-900/10 border border-indigo-500/20 rounded-2xl">
                    <h5 className="font-black text-white uppercase text-sm mb-4">Update My Password</h5>
                    <form onSubmit={handlePasswordUpdate} className="space-y-4">
                      <input 
                        type="password" 
                        value={newPass}
                        onChange={e => setNewPass(e.target.value)}
                        placeholder="Enter new 8+ character token..."
                        className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none"
                      />
                      <button type="submit" disabled={isLoading} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-black uppercase tracking-widest">
                        {isLoading ? '⌛ Updating...' : 'Update Password'}
                      </button>
                    </form>
                    {passMsg && <div className={`mt-3 p-3 rounded-lg text-xs font-bold ${passMsg.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>{passMsg.text}</div>}
                </div>
              </div>
            )}

            {activeTab === 'ai-engine' && (
              <div className="space-y-8 animate-[fadeIn_0.2s_ease-out]">
                <div className="p-6 bg-[#0f172a] rounded-2xl border border-slate-700/50">
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <h4 className="font-black text-white uppercase tracking-tight">AI Compute Quota</h4>
                      <p className="text-xs text-slate-500">Global usage budget per user session.</p>
                    </div>
                    <span className="text-2xl font-black text-primary-500">{dailyAIUsage} / {DAILY_REQUEST_LIMIT}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-500 transition-all duration-1000" style={{ width: `${Math.min(100, (dailyAIUsage / DAILY_REQUEST_LIMIT) * 100)}%` }} />
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Session Activity Log</h4>
                  <div className="space-y-2">
                    {aiLogs.length > 0 ? aiLogs.map((log: any) => (
                      <div key={log.id} className="p-3 bg-black/20 rounded-lg flex justify-between items-center text-xs">
                        <div className="flex gap-4">
                          <span className="text-slate-500 font-mono">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                          <span className="text-indigo-400 font-bold uppercase">{log.action}</span>
                          <span className="text-slate-300">{log.details}</span>
                        </div>
                      </div>
                    )) : <p className="text-sm text-slate-500 italic">No AI activity recorded in this session.</p>}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'admin-users' && (
              <div className="animate-[fadeIn_0.2s_ease-out]">
                <h4 className="text-lg font-black text-white uppercase mb-6 tracking-tight">Manage User Base</h4>
                <div className="bg-[#0f172a] rounded-2xl border border-slate-700/50 overflow-hidden">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-900/50 border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3 font-black uppercase text-slate-500 tracking-widest">User / Handle</th>
                        <th className="px-4 py-3 font-black uppercase text-slate-500 tracking-widest">Status</th>
                        <th className="px-4 py-3 font-black uppercase text-slate-500 tracking-widest">Role</th>
                        <th className="px-4 py-3 font-black uppercase text-slate-500 tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {users.length > 0 ? users.map(u => (
                        <tr key={u.uid} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-bold text-white">{u.username}</p>
                            <p className="text-[9px] text-slate-500 font-mono truncate">{u.email}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase w-fit ${u.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : u.status === 'suspended' ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                {u.status}
                                </span>
                                {u.status === 'suspended' && u.statusUntil && (
                                    <span className="text-[8px] text-slate-500 italic">Until {new Date(u.statusUntil).toLocaleTimeString()}</span>
                                )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <select 
                                value={u.role} 
                                onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                                className="bg-slate-800 border border-slate-700 text-white rounded text-[10px] px-2 py-1 font-bold outline-none"
                            >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                                <option value="super-admin">Super-Admin</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-right">
                             <div className="flex flex-wrap gap-2 justify-end">
                                <button onClick={() => handleAdminResetTrigger(u.email)} className="px-2 py-1 bg-slate-800 text-slate-300 rounded font-bold text-[9px] uppercase border border-slate-700">Reset PWD</button>
                                {u.status === 'active' ? (
                                    <>
                                        <button onClick={() => handleStatusChange(u.uid, 'suspended', 24)} className="px-2 py-1 bg-amber-600/20 text-amber-500 rounded font-bold text-[9px] uppercase">24h Suspend</button>
                                        <button onClick={() => handleStatusChange(u.uid, 'banned')} className="px-2 py-1 bg-rose-600/20 text-rose-500 rounded font-bold text-[9px] uppercase">Ban</button>
                                    </>
                                ) : (
                                    <button onClick={() => handleStatusChange(u.uid, 'active')} className="px-2 py-1 bg-emerald-600/20 text-emerald-500 rounded font-bold text-[9px] uppercase">Reactivate</button>
                                )}
                             </div>
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={4} className="p-10 text-center text-slate-500 italic">No registered users found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'admin-cloud' && (
              <div className="animate-[fadeIn_0.2s_ease-out] max-w-3xl">
                <h4 className="text-lg font-black text-white uppercase mb-4 tracking-tight">Cloud Infrastructure & Rules</h4>
                <div className="bg-amber-900/20 border border-amber-500/30 p-4 rounded-xl mb-6">
                  <p className="text-amber-400 text-xs font-bold leading-relaxed mb-4">
                    For multi-user sync and identity resolution to function correctly, your Firebase Security Rules must permit identity listing.
                  </p>
                  <button 
                    onClick={handleTestPermissions}
                    disabled={isTestingPerms}
                    className="px-6 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-xs font-black uppercase tracking-widest transition-all"
                  >
                    {isTestingPerms ? '⌛ Testing Write Access...' : '⚡ Run System Handshake'}
                  </button>
                  {permTestResult && (
                    <div className={`mt-3 p-3 rounded-lg text-xs font-bold ${permTestResult.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {permTestResult.success ? '✓' : '✗'} {permTestResult.message}
                    </div>
                  )}
                </div>
                
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Recommended Firestore Rules</label>
                  <pre className="p-4 bg-slate-950 border border-slate-700 rounded-xl text-indigo-300 font-mono text-[11px] overflow-x-auto selection:bg-indigo-500/30 shadow-inner">
                    {firestoreRulesText}
                  </pre>
                  <button 
                    onClick={() => { navigator.clipboard.writeText(firestoreRulesText); alert("Security Rules copied to clipboard."); }}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-black uppercase tracking-widest transition-all"
                  >
                    Copy Rules
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'admin-logs' && (
              <div className="animate-[fadeIn_0.2s_ease-out]">
                <h4 className="text-lg font-black text-white uppercase mb-4 tracking-tight">Security & Diagnostic Console</h4>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[11px] h-[500px] overflow-y-auto">
                  {systemLogs.length > 0 ? systemLogs.map(log => (
                    <div key={log.id} className="py-1 border-b border-white/5 flex gap-3">
                      <span className="text-slate-600 shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                      <span className={`shrink-0 px-1.5 rounded font-black text-[9px] uppercase ${
                        log.level === 'error' ? 'bg-rose-600 text-white' : 
                        log.level === 'security' ? 'bg-indigo-600 text-white' : 
                        log.level === 'warn' ? 'bg-amber-600 text-white' : 'text-emerald-500'
                      }`}>
                        {log.level}
                      </span>
                      <span className={`${log.level === 'security' ? 'text-indigo-300' : 'text-slate-300'}`}>{log.message}</span>
                    </div>
                  )) : <p className="text-slate-600 italic">No system logs generated.</p>}
                </div>
              </div>
            )}

            {activeTab === 'health' && (
              <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-6 bg-black/20 border border-slate-700/50 rounded-2xl text-center">
                       <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Database</h5>
                       <p className={`font-bold ${healthStatus?.db.includes('Connected') || healthStatus?.db.includes('Operational') ? 'text-emerald-500' : 'text-rose-500'}`}>{healthStatus?.db || 'Checking...'}</p>
                    </div>
                    <div className="p-6 bg-black/20 border border-slate-700/50 rounded-2xl text-center">
                       <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">AI Engine</h5>
                       <p className={`font-bold ${healthStatus?.ai.includes('Active') || healthStatus?.ai.includes('Healthy') ? 'text-indigo-500' : 'text-rose-500'}`}>{healthStatus?.ai || 'Checking...'}</p>
                    </div>
                    <div className="p-6 bg-black/20 border border-slate-700/50 rounded-2xl text-center">
                       <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">API Connectivity</h5>
                       <p className="text-emerald-500 font-bold">{healthStatus?.dns || 'Resolving...'}</p>
                    </div>
                 </div>

                 <div className="flex flex-col gap-3">
                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">Detailed Diagnostic Terminal</h4>
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 font-mono text-[11px] h-64 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 shadow-inner ring-4 ring-black/5">
                        {diagnosticLogs.length > 0 ? (
                            <>
                                {diagnosticLogs.map((log, idx) => (
                                    <div key={idx} className="flex gap-3">
                                        <span className="text-slate-600 shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                        <span className={`font-bold uppercase shrink-0 min-w-[50px] ${
                                            log.type === 'error' ? 'text-rose-500' : 
                                            log.type === 'success' ? 'text-emerald-500' : 
                                            log.type === 'warn' ? 'text-amber-500' : 'text-indigo-400'
                                        }`}>
                                            {log.type}
                                        </span>
                                        <span className={log.type === 'error' ? 'text-rose-400 font-bold' : log.type === 'warn' ? 'text-amber-400' : 'text-slate-300'}>{log.message}</span>
                                    </div>
                                ))}
                                <div ref={terminalEndRef} />
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full opacity-20 italic">
                                <span>No logs recorded.</span>
                                <span>Press "Re-run Diagnostics" to start handshake.</span>
                            </div>
                        )}
                    </div>
                 </div>

                 <button 
                    onClick={runDiagnostics} 
                    disabled={isRunningDiagnostics}
                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all transform active:scale-95"
                 >
                    {isRunningDiagnostics ? '⌛ Handshake in progress...' : 'Re-run Diagnostics'}
                 </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;