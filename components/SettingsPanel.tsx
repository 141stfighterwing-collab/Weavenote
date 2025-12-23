import React, { useState, useEffect } from 'react';
import { 
    getRequests, approveRequest, denyRequest, 
    getUsers, toggleUserStatus, isAdmin, isGlobalAdmin, checkDatabaseConnection,
    getAuditLogs, AuditLogEntry, deleteUserAccount 
} from '../services/authService';
import { runConnectivityTest, getErrorLogs, clearErrorLogs, getAIUsageLogs } from '../services/geminiService';
import { exportDataToFile, loadNotes } from '../services/storageService';
import { Theme, User, AILogEntry } from '../types';

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
}

interface DiagnosticStep {
    name: string;
    status: 'pending' | 'running' | 'success' | 'error';
    detail?: string;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
    isOpen, onClose, currentUser, darkMode, toggleDarkMode, theme, setTheme,
    reducedMotion, toggleReducedMotion, enableImages, toggleEnableImages,
    showLinkPreviews, toggleShowLinkPreviews
}) => {
  const [activeTab, setActiveTab] = useState('appearance');
  const [requests, setRequests] = useState<User[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [aiLogs, setAiLogs] = useState<AILogEntry[]>([]);
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [diagnosticSteps, setDiagnosticSteps] = useState<DiagnosticStep[]>([]);

  const userIsAdmin = isAdmin(currentUser);

  useEffect(() => {
      if (isOpen) {
          if (activeTab === 'admin' && userIsAdmin) loadAdminData();
          if (activeTab === 'security' && userIsAdmin) loadSecurityData();
          if (activeTab === 'logs' && userIsAdmin) loadLogsData();
      }
  }, [isOpen, activeTab, userIsAdmin]);

  const loadAdminData = async () => {
      setIsLoading(true);
      try {
        const reqs = await getRequests();
        const allUsers = await getUsers();
        setRequests(reqs);
        setUsers(allUsers);
      } catch (e) {
        console.error("Admin data load error", e);
      } finally {
        setIsLoading(false);
      }
  };

  const loadSecurityData = async () => {
      setIsLoading(true);
      try {
        const logs = await getAuditLogs();
        setAuditLogs(logs);
      } catch (e) {
        console.error("Security data load error", e);
      } finally {
        setIsLoading(false);
      }
  };

  const loadLogsData = () => {
      try {
        setAiLogs(getAIUsageLogs());
        setErrorLogs(getErrorLogs());
      } catch (e) {
        console.error("Logs data load error", e);
      }
  };

  const handleApprove = async (uid: string) => {
      await approveRequest(uid);
      loadAdminData();
  };

  const handleDeny = async (uid: string) => {
      if (window.confirm("Permanently deny this request?")) {
        await denyRequest(uid);
        loadAdminData();
      }
  };

  const handleToggleStatus = async (uid: string, currentStatus: any) => {
      await toggleUserStatus(uid, currentStatus);
      loadAdminData();
  };

  const handleDeleteUser = async (uid: string) => {
    if (window.confirm("Permanently delete this user profile? They will be locked out immediately.")) {
        await deleteUserAccount(uid);
        loadAdminData();
    }
  };

  const handleExport = async () => {
      const notes = await loadNotes(currentUser?.uid || null);
      exportDataToFile(notes);
  };

  const isEnvConfigured = () => {
    const key = process.env.API_KEY;
    return !!key && key !== 'undefined' && key.length > 5;
  };

  const runDiagnostics = async () => {
      setIsTesting(true);
      const initialSteps: DiagnosticStep[] = [
          { name: "Environment Discovery", status: 'running' },
          { name: "AI Handshake", status: 'pending' },
          { name: "Cloud Sync DB", status: 'pending' },
      ];
      setDiagnosticSteps(initialSteps);

      if (!isEnvConfigured()) {
          setDiagnosticSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'error', detail: 'KEY MISSING' } : s));
          setIsTesting(false);
          return;
      }
      setDiagnosticSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'success', detail: 'KEY DETECTED' } : i === 1 ? { ...s, status: 'running' } : s));

      try {
        const aiResult = await runConnectivityTest();
        if (!aiResult.success) {
            setDiagnosticSteps(prev => prev.map((s, i) => i === 1 ? { ...s, status: 'error', detail: aiResult.message || 'API ERROR' } : s));
            setIsTesting(false);
            return;
        }
        setDiagnosticSteps(prev => prev.map((s, i) => i === 1 ? { ...s, status: 'success', detail: 'CONNECTED' } : i === 2 ? { ...s, status: 'running' } : s));
      } catch (e: any) {
        setDiagnosticSteps(prev => prev.map((s, i) => i === 1 ? { ...s, status: 'error', detail: e.message } : s));
        setIsTesting(false);
        return;
      }

      try {
        const dbResult = await checkDatabaseConnection();
        if (!dbResult.success) {
            setDiagnosticSteps(prev => prev.map((s, i) => i === 2 ? { ...s, status: 'error', detail: dbResult.message } : s));
        } else {
            setDiagnosticSteps(prev => prev.map((s, i) => i === 2 ? { ...s, status: 'success', detail: `${dbResult.latency}ms` } : s));
        }
      } catch (e: any) {
          setDiagnosticSteps(prev => prev.map((s, i) => i === 2 ? { ...s, status: 'error', detail: 'DB CRASH' } : s));
      }

      setIsTesting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span>⚙️</span> Control Center
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            ✕
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-48 border-r border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 p-4 space-y-1">
            <button onClick={() => setActiveTab('appearance')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'appearance' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>Appearance</button>
            <button onClick={() => setActiveTab('data')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'data' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>Data Sync</button>
            
            {userIsAdmin && (
              <>
                <div className="pt-4 pb-1 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Administration</div>
                <button onClick={() => setActiveTab('admin')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'admin' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>Users & Security</button>
                <button onClick={() => setActiveTab('security')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'security' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>Audit Vault</button>
                <button onClick={() => setActiveTab('logs')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'logs' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>AI Intelligence</button>
                <button onClick={() => setActiveTab('status')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'status' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>System Health</button>
              </>
            )}
          </div>

          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-white">Dark Mode</h4>
                    <p className="text-xs text-slate-500">Enable high-contrast night theme.</p>
                  </div>
                  <button onClick={toggleDarkMode} className={`w-12 h-6 rounded-full transition-colors relative ${darkMode ? 'bg-primary-600' : 'bg-slate-300'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${darkMode ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white mb-3 text-sm">Theme Selection</h4>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {(['default', 'ocean', 'forest', 'sunset', 'rose', 'midnight', 'coffee', 'neon', 'cyberpunk', 'nord', 'dracula', 'lavender', 'earth', 'yellow', 'hyperblue'] as Theme[]).map(t => (
                      <button 
                        key={t} 
                        onClick={() => setTheme(t)} 
                        className={`px-2 py-2.5 rounded-lg text-[9px] font-black border transition-all uppercase tracking-tighter ${theme === t ? 'border-primary-600 bg-primary-50 text-primary-700 shadow-sm' : 'border-slate-200 text-slate-500 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'admin' && userIsAdmin && (
              <div className="space-y-10 animate-[fadeIn_0.2s_ease-out]">
                {/* 1. Pending Access Requests */}
                <section>
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                        <span className="p-1 bg-amber-100 text-amber-600 rounded">⏳</span> 
                        Pending Access ({requests.length})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {requests.map(r => (
                        <div key={r.uid} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-900/50 shadow-sm">
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{r.username}</p>
                                <p className="text-[10px] text-slate-500 font-mono">{r.email}</p>
                            </div>
                            <div className="flex gap-2 shrink-0 ml-4">
                                <button onClick={() => handleApprove(r.uid)} className="px-3 py-1.5 bg-green-600 text-white text-[10px] rounded-lg font-bold hover:bg-green-700 shadow-sm">Approve</button>
                                <button onClick={() => handleDeny(r.uid)} className="px-3 py-1.5 bg-red-100 text-red-600 text-[10px] rounded-lg font-bold hover:bg-red-200">Deny</button>
                            </div>
                        </div>
                        ))}
                        {requests.length === 0 && <p className="col-span-2 text-xs text-slate-400 text-center py-6 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">No pending access requests.</p>}
                    </div>
                </section>

                {/* 2. All Registered Users */}
                <section>
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <span className="p-1 bg-blue-100 text-blue-600 rounded">👤</span> 
                            Global User Registry ({users.length})
                        </h4>
                        <button onClick={loadAdminData} className="text-[10px] font-bold text-primary-600 hover:underline">Refresh List</button>
                    </div>
                    
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
                                <thead className="bg-slate-50 dark:bg-slate-950">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase">Identity</th>
                                        <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase">Contact/Location</th>
                                        <th className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase">AI Usage</th>
                                        <th className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase">Status</th>
                                        <th className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {users.map(u => (
                                        <tr key={u.uid} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors ${u.status === 'suspended' ? 'opacity-60 bg-red-50/20 dark:bg-red-950/10' : ''}`}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center font-bold text-primary-600">
                                                        {u.username[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1">
                                                            {u.username}
                                                            {u.role === 'admin' && <span className="text-[8px] bg-indigo-100 text-indigo-600 px-1 rounded">ADMIN</span>}
                                                        </p>
                                                        <p className="text-[9px] text-slate-400">ID: {u.uid.substring(0, 8)}...</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-xs text-slate-600 dark:text-slate-300 font-mono">{u.email}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                                        {u.countryFlag || '🌐'} {u.ipAddress || 'No IP'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`text-xs font-black font-mono px-2 py-0.5 rounded-full ${u.aiUsageCount && u.aiUsageCount > 100 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                    {u.aiUsageCount || 0}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {u.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-1.5">
                                                    <button 
                                                        onClick={() => handleToggleStatus(u.uid, u.status)}
                                                        className={`p-1.5 rounded-lg border transition-all ${u.status === 'active' ? 'text-amber-600 hover:bg-amber-50 border-amber-100' : 'text-green-600 hover:bg-green-50 border-green-100'}`}
                                                        title={u.status === 'active' ? "Suspend User" : "Unsuspend User"}
                                                    >
                                                        {u.status === 'active' ? '🚫' : '✅'}
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteUser(u.uid)}
                                                        className="p-1.5 rounded-lg border border-red-100 text-red-600 hover:bg-red-50 transition-all"
                                                        title="Delete Account Data"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                        <p className="text-[10px] text-slate-500 leading-relaxed italic">
                            <b>Admin Note:</b> Suspending a user immediately revokes their session capability. Deleting a user removes their Firestore identity profile. AI usage is tracked per-request to monitor potential API abuse.
                        </p>
                    </div>
                </section>
              </div>
            )}

            {activeTab === 'status' && userIsAdmin && (
              <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
                <div className="flex justify-between items-center">
                    <h4 className="font-bold text-slate-800 dark:text-white">System Diagnostics</h4>
                    <button 
                        onClick={runDiagnostics} 
                        disabled={isTesting}
                        className="px-4 py-1.5 bg-primary-600 text-white text-xs font-bold rounded-full hover:bg-primary-700 shadow-md transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isTesting ? 'Analyzing...' : 'Refresh Health'}
                    </button>
                </div>

                <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono shadow-inner min-h-[140px]">
                    <p className="text-[10px] text-primary-400 mb-2 opacity-60 uppercase tracking-widest">
                        &gt;&gt; Root Diagnostic Protocol
                    </p>
                    {diagnosticSteps.map((step, i) => (
                        <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-white/5 last:border-0">
                            <div className="flex items-center gap-3">
                                {step.status === 'running' && <span className="text-blue-400 animate-pulse">●</span>}
                                {step.status === 'success' && <span className="text-green-500 font-bold">✓</span>}
                                {step.status === 'error' && <span className="text-red-500 font-bold">✕</span>}
                                {step.status === 'pending' && <span className="text-slate-600">○</span>}
                                <span className={step.status === 'error' ? 'text-red-400' : 'text-slate-300'}>{step.name}</span>
                            </div>
                            <span className={`font-bold uppercase ${step.status === 'error' ? 'text-red-500' : 'text-slate-500'}`}>{step.detail || step.status}</span>
                        </div>
                    ))}
                    {diagnosticSteps.length === 0 && (
                      <p className="text-xs text-slate-500 italic py-4">Click "Refresh Health" to initiate scan.</p>
                    )}
                </div>

                {!isEnvConfigured() && (
                    <div className="p-5 bg-red-50 dark:bg-red-900/20 rounded-xl border-2 border-red-200 dark:border-red-900/40">
                        <h5 className="text-sm font-black text-red-600 dark:text-red-400 uppercase mb-3 flex items-center gap-2">
                           <span>⚠️</span> Deployment Sync Required
                        </h5>
                        <div className="space-y-3">
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                              Environment variables like <strong>API_KEY</strong> must be injected into the code during the <strong>Build Phase</strong>. Simply adding them to the dashboard is not enough.
                          </p>
                          <div className="bg-white/50 dark:bg-black/20 p-3 rounded-lg border border-red-100 dark:border-red-900/20">
                            <p className="text-[11px] font-bold text-slate-800 dark:text-white mb-2">To fix this on Vercel:</p>
                            <ol className="list-decimal ml-5 text-[11px] text-slate-600 dark:text-slate-400 space-y-1.5">
                                <li>Open your project in the <strong>Vercel Dashboard</strong>.</li>
                                <li>Navigate to the <strong>Deployments</strong> tab.</li>
                                <li>Click the <strong>(...) icon</strong> on your latest deployment.</li>
                                <li>Select <strong>Redeploy</strong> (ensure "Use existing cache" is OFF).</li>
                            </ol>
                          </div>
                        </div>
                    </div>
                )}
              </div>
            )}

            {activeTab === 'logs' && userIsAdmin && (
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white mb-2 text-sm">Real-time AI Intelligence Logs</h4>
                  <div className="space-y-1.5 max-h-96 overflow-y-auto custom-scrollbar bg-slate-950 p-4 rounded-xl font-mono text-[10px]">
                    {aiLogs.length > 0 ? aiLogs.map(log => (
                      <div key={log.id} className="py-1 border-b border-white/5 last:border-0 flex gap-4">
                         <span className="text-slate-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                         <span className="font-bold text-primary-400 w-32 uppercase shrink-0">[{log.action}]</span> 
                         <span className="text-slate-300 flex-1">{log.username}: {log.details}</span>
                      </div>
                    )) : <p className="text-xs text-slate-400 italic">Listening for neural activity...</p>}
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'security' && userIsAdmin && (
              <div className="space-y-3 animate-[fadeIn_0.2s_ease-out]">
                <h4 className="font-bold text-slate-800 dark:text-white text-sm">System Audit Vault</h4>
                <div className="space-y-1.5 max-h-96 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner">
                  {auditLogs.map(log => (
                    <div key={log.id} className="text-[10px] font-mono p-3 border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">[{new Date(log.timestamp).toLocaleString()}]</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-black uppercase">{log.actor}</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300"><span className="font-bold">{log.action}:</span> {log.details}</p>
                      {log.target && <p className="text-[9px] text-slate-400 mt-1">Target Object: {log.target}</p>}
                    </div>
                  ))}
                  {auditLogs.length === 0 && <p className="text-xs text-slate-400 italic text-center py-20">Audit vault is currently empty.</p>}
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