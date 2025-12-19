import React, { useState, useEffect } from 'react';
import { 
    getRequests, approveRequest, denyRequest, 
    getUsers, toggleUserStatus, updateUserPermission, updateUserRole, isAdmin, isGlobalAdmin, checkDatabaseConnection,
    getAuditLogs, AuditLogEntry 
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
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  const userIsGlobalAdmin = isGlobalAdmin(currentUser);
  const userIsAdmin = isAdmin(currentUser);

  useEffect(() => {
      if (isOpen) {
          if (activeTab === 'admin') loadAdminData();
          if (activeTab === 'security') loadSecurityData();
          if (activeTab === 'logs') loadLogsData();
      }
  }, [isOpen, activeTab]);

  const loadAdminData = async () => {
      setIsLoading(true);
      const reqs = await getRequests();
      const allUsers = await getUsers();
      setRequests(reqs);
      setUsers(allUsers);
      setIsLoading(false);
  };

  const loadSecurityData = async () => {
      setIsLoading(true);
      const logs = await getAuditLogs();
      setAuditLogs(logs);
      setIsLoading(false);
  };

  const loadLogsData = () => {
      setAiLogs(getAIUsageLogs());
      setErrorLogs(getErrorLogs());
  };

  const handleApprove = async (uid: string) => {
      await approveRequest(uid);
      loadAdminData();
  };

  const handleDeny = async (uid: string) => {
      await denyRequest(uid);
      loadAdminData();
  };

  const handleRoleToggle = async (user: User) => {
      if (!userIsGlobalAdmin) return;
      const newRole = user.role === 'admin' ? 'user' : 'admin';
      await updateUserRole(user.uid, newRole);
      loadAdminData();
  };

  const handleExport = async () => {
      const notes = await loadNotes(currentUser?.uid || null);
      exportDataToFile(notes);
  };

  const runDiagnostics = async () => {
      setIsTesting(true);
      const aiResult = await runConnectivityTest();
      const dbResult = await checkDatabaseConnection();
      setSystemStatus({
          ai: aiResult,
          db: dbResult,
          timestamp: new Date().toLocaleTimeString()
      });
      setIsTesting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-slate-800 w-full max-w-6xl h-[85vh] rounded-2xl shadow-2xl flex overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-2">
                <h2 className="font-bold text-lg px-2 mb-4 text-slate-800 dark:text-white">Settings</h2>
                <button onClick={() => setActiveTab('appearance')} className={`text-left px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'appearance' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Appearance</button>
                <button onClick={() => setActiveTab('data')} className={`text-left px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'data' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Data & Storage</button>
                
                {userIsAdmin && (
                    <>
                        <div className="my-2 border-t border-slate-200 dark:border-slate-700"></div>
                        <p className="px-4 text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-widest">Management</p>
                        <button onClick={() => setActiveTab('admin')} className={`text-left px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'admin' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Users & Roles</button>
                        <button onClick={() => setActiveTab('security')} className={`text-left px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'security' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Security Logs</button>
                        <button onClick={() => setActiveTab('logs')} className={`text-left px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'logs' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>AI Audit</button>
                        {userIsGlobalAdmin && (
                            <button onClick={() => setActiveTab('status')} className={`text-left px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'status' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>System Health</button>
                        )}
                    </>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                <div className="flex justify-between mb-6">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white capitalize">{activeTab.replace('_', ' ')}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">✕</button>
                </div>

                {activeTab === 'appearance' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center p-4 border rounded-xl dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
                            <div>
                                <p className="font-bold text-slate-800 dark:text-white">Dark Mode</p>
                                <p className="text-xs text-slate-500">Enable high-contrast dark interface</p>
                            </div>
                            <button onClick={toggleDarkMode} className={`w-12 h-6 rounded-full transition-colors ${darkMode ? 'bg-primary-600' : 'bg-slate-300'} relative`}>
                                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${darkMode ? 'left-7' : 'left-1'}`}></div>
                            </button>
                        </div>
                        
                        <div>
                             <p className="font-bold text-slate-800 dark:text-white mb-3">Color Themes</p>
                             <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {['default', 'ocean', 'forest', 'sunset', 'rose', 'midnight', 'coffee', 'neon', 'cyberpunk', 'nord', 'dracula', 'lavender', 'earth'].map((t) => (
                                    <button 
                                        key={t}
                                        onClick={() => setTheme(t as Theme)}
                                        className={`p-3 rounded-xl border-2 text-xs capitalize font-bold transition-all ${theme === t ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-primary-300'}`}
                                    >
                                        {t}
                                    </button>
                                ))}
                             </div>
                        </div>

                        <div className="flex justify-between items-center p-4 border rounded-xl dark:border-slate-700">
                            <div>
                                <p className="font-bold text-slate-800 dark:text-white">Reduced Motion</p>
                                <p className="text-xs text-slate-500">Minimize heavy animations</p>
                            </div>
                            <button onClick={toggleReducedMotion} className={`w-12 h-6 rounded-full transition-colors ${reducedMotion ? 'bg-primary-600' : 'bg-slate-300'} relative`}>
                                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${reducedMotion ? 'left-7' : 'left-1'}`}></div>
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'data' && (
                    <div className="space-y-6">
                        <div className="p-6 border rounded-2xl bg-slate-50 dark:bg-slate-900/50 dark:border-slate-700">
                            <h4 className="font-bold text-slate-800 dark:text-white mb-2">Export Workspace</h4>
                            <p className="text-sm text-slate-500 mb-4">Download all your notes and folders in a standard JSON format for backup or migration.</p>
                            <button onClick={handleExport} className="px-6 py-2 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 shadow-sm transition-all">Download Backup (.json)</button>
                        </div>

                        <div className="p-6 border rounded-2xl bg-slate-50 dark:bg-slate-900/50 dark:border-slate-700">
                            <h4 className="font-bold text-slate-800 dark:text-white mb-2">Workspace Reset</h4>
                            <p className="text-sm text-slate-500 mb-4">Permanently clear all local session data. This will not affect cloud-synced notes if you are logged in.</p>
                            <button onClick={() => { if(confirm("Clear local cache?")) sessionStorage.clear(); window.location.reload(); }} className="px-6 py-2 border border-red-200 text-red-600 font-bold rounded-lg hover:bg-red-50 transition-all">Clear Local Cache</button>
                        </div>
                    </div>
                )}

                {activeTab === 'admin' && userIsAdmin && (
                    <div className="space-y-8">
                        <div>
                            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                                🆕 Pending Account Requests
                                {requests.length > 0 && <span className="bg-primary-600 text-white text-[10px] px-2 py-0.5 rounded-full">{requests.length}</span>}
                            </h4>
                            {isLoading ? <p className="text-sm">Retrieving requests...</p> : requests.length === 0 ? <p className="text-slate-400 italic text-sm">Clear sky! No pending requests.</p> : (
                                <div className="space-y-3">
                                    {requests.map(req => (
                                        <div key={req.uid} className="flex justify-between items-center p-4 border rounded-xl bg-yellow-50/30 border-yellow-100 dark:bg-yellow-900/10 dark:border-yellow-900/30">
                                            <div>
                                                <p className="font-bold text-sm text-slate-900 dark:text-white">{req.username}</p>
                                                <p className="text-[10px] text-slate-500 font-mono">{req.email} • IP: {req.ipAddress}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleApprove(req.uid)} className="text-xs bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 shadow-sm">Approve</button>
                                                <button onClick={() => handleDeny(req.uid)} className="text-xs bg-white dark:bg-slate-800 text-red-600 border border-red-200 dark:border-red-900/50 px-4 py-2 rounded-lg font-bold hover:bg-red-50 transition-colors">Deny</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-4">User Registry</h4>
                            <div className="border rounded-2xl overflow-hidden dark:border-slate-700 shadow-sm bg-white dark:bg-slate-900">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 border-b dark:border-slate-700">
                                        <tr>
                                            <th className="p-4">Identity</th>
                                            <th className="p-4">Permission Role</th>
                                            <th className="p-4">Status</th>
                                            <th className="p-4 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-slate-700">
                                        {users.map(u => {
                                            const isUserGlobal = isGlobalAdmin(u);
                                            const isUserStandardAdmin = u.role === 'admin' && !isUserGlobal;
                                            
                                            return (
                                                <tr key={u.uid} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                                    <td className="p-4">
                                                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                            {u.username}
                                                            {isUserGlobal && <span className="text-[9px] bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full font-black uppercase">GLOBAL ADMIN</span>}
                                                            {isUserStandardAdmin && <span className="text-[9px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold uppercase">ADMIN</span>}
                                                            {!isAdmin(u) && <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase">USER</span>}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 font-mono">{u.email}</div>
                                                    </td>
                                                    <td className="p-4">
                                                        <button 
                                                            disabled={!userIsGlobalAdmin || isUserGlobal}
                                                            onClick={() => handleRoleToggle(u)}
                                                            className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase transition-all shadow-sm ${
                                                                isAdmin(u) 
                                                                ? 'bg-indigo-600 text-white' 
                                                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                                                            } ${userIsGlobalAdmin && !isUserGlobal ? 'hover:scale-105 cursor-pointer' : 'cursor-default opacity-80'}`}
                                                        >
                                                            {u.role || 'user'}
                                                        </button>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`text-[10px] px-2 py-1 rounded-md font-black uppercase ${u.status === 'active' ? 'text-green-600 bg-green-50 dark:bg-green-900/10' : 'text-red-500 bg-red-50 dark:bg-red-900/10'}`}>
                                                            {u.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <button 
                                                            disabled={isUserGlobal || (isUserStandardAdmin && !userIsGlobalAdmin)}
                                                            onClick={() => toggleUserStatus(u.uid, u.status)}
                                                            className="text-[10px] font-black uppercase text-primary-600 hover:underline disabled:opacity-30 disabled:cursor-not-allowed"
                                                        >
                                                            {u.status === 'active' ? 'Suspend' : 'Activate'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'security' && userIsAdmin && (
                    <div className="animate-[fadeIn_0.2s_ease-out]">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-slate-700 dark:text-slate-300">Vault Audit Trail</h4>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last 100 System Events</span>
                        </div>
                        <div className="border-2 rounded-2xl overflow-hidden dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900 h-[60vh] overflow-y-auto shadow-inner">
                            {isLoading ? <div className="p-10 text-center text-sm">Unlocking logs...</div> : auditLogs.length === 0 ? <div className="p-10 text-center text-slate-400 italic">No security events recorded.</div> : (
                                <table className="w-full text-[11px] text-left">
                                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 sticky top-0 border-b dark:border-slate-700 font-bold uppercase tracking-tighter">
                                        <tr>
                                            <th className="p-3">Time (UTC)</th>
                                            <th className="p-3">Operation</th>
                                            <th className="p-3">Agent</th>
                                            <th className="p-3">Metadata</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {auditLogs.map(log => (
                                            <tr key={log.id} className="hover:bg-white dark:hover:bg-slate-800 transition-colors">
                                                <td className="p-3 whitespace-nowrap text-slate-400 font-mono">
                                                    {new Date(log.timestamp).toISOString().replace('T', ' ').slice(0, 19)}
                                                </td>
                                                <td className="p-3">
                                                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 rounded border border-indigo-100 dark:border-indigo-900/50">
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <span className="font-bold text-slate-800 dark:text-slate-200">{log.actor}</span>
                                                </td>
                                                <td className="p-3 text-slate-500 truncate max-w-sm italic">
                                                    {log.details || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'logs' && userIsAdmin && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h4 className="font-bold text-slate-700 dark:text-slate-300">AI Processing Logs</h4>
                            <button onClick={loadLogsData} className="text-xs text-primary-600 font-bold hover:underline">Refresh Logs</button>
                        </div>
                        <div className="border rounded-2xl overflow-hidden dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 border-b dark:border-slate-700 font-bold">
                                    <tr>
                                        <th className="p-4">Time</th>
                                        <th className="p-4">User</th>
                                        <th className="p-4">Action</th>
                                        <th className="p-4">Summary</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-slate-700">
                                    {aiLogs.length === 0 ? (
                                        <tr><td colSpan={4} className="p-8 text-center text-slate-400 italic">No AI activity recorded.</td></tr>
                                    ) : aiLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                            <td className="p-4 text-slate-400 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</td>
                                            <td className="p-4 font-bold">{log.username}</td>
                                            <td className="p-4 text-indigo-600 font-bold">{log.action}</td>
                                            <td className="p-4 text-slate-500 truncate max-w-xs">{log.details}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {errorLogs.length > 0 && (
                            <div className="mt-8">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-bold text-red-600">Recent Errors</h4>
                                    <button onClick={() => { clearErrorLogs(); loadLogsData(); }} className="text-xs text-red-600 hover:underline">Clear Errors</button>
                                </div>
                                <div className="space-y-2">
                                    {errorLogs.map(err => (
                                        <div key={err.id} className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg text-xs font-mono">
                                            <span className="text-red-600 font-bold">[{err.context}]</span> {err.message}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'status' && userIsGlobalAdmin && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h4 className="font-bold text-slate-700 dark:text-slate-300">System Diagnostics</h4>
                            <button 
                                onClick={runDiagnostics} 
                                disabled={isTesting}
                                className="px-4 py-2 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 disabled:opacity-50"
                            >
                                {isTesting ? 'Running Diagnostics...' : 'Run New Test'}
                            </button>
                        </div>

                        {systemStatus && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className={`p-6 rounded-2xl border ${systemStatus.ai.success ? 'bg-green-50 border-green-100 dark:bg-green-900/10' : 'bg-red-50 border-red-100 dark:bg-red-900/10'}`}>
                                    <h5 className="font-bold mb-1">Gemini AI Engine</h5>
                                    <p className="text-xs mb-3 opacity-70">Model: gemini-3-flash-preview</p>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${systemStatus.ai.success ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                        <span className="text-sm font-bold">{systemStatus.ai.message}</span>
                                    </div>
                                </div>
                                <div className={`p-6 rounded-2xl border ${systemStatus.db.success ? 'bg-green-50 border-green-100 dark:bg-green-900/10' : 'bg-red-50 border-red-100 dark:bg-red-900/10'}`}>
                                    <h5 className="font-bold mb-1">Firebase Persistence</h5>
                                    <p className="text-xs mb-3 opacity-70">Latency: {systemStatus.db.latency}ms</p>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${systemStatus.db.success ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                        <span className="text-sm font-bold">{systemStatus.db.message}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border dark:border-slate-700">
                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">Environment Health</p>
                            <div className="space-y-1 text-xs">
                                <div className="flex justify-between"><span className="text-slate-500">API Key Configured:</span> <span className="text-green-600 font-bold">Yes</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Storage Backend:</span> <span className="text-indigo-600 font-bold">Firestore v10.12</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">UI Framework:</span> <span className="text-indigo-600 font-bold">React 19 + Tailwind</span></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default SettingsPanel;
