
import React, { useState, useEffect } from 'react';
import { 
    getRequests, approveRequest, denyRequest, 
    getUsers, toggleUserStatus, updateUserPermission, isAdmin, checkDatabaseConnection,
    getAuditLogs, AuditLogEntry 
} from '../services/authService';
import { runConnectivityTest, getErrorLogs, clearErrorLogs, getAIUsageLogs } from '../services/geminiService';
import { exportDataToFile, loadNotes } from '../services/storageService';
import { Theme, User, AILogEntry } from '../types';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: string | null;
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
        <div className="bg-white dark:bg-slate-800 w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl flex overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-2">
                <h2 className="font-bold text-lg px-2 mb-4 text-slate-800 dark:text-white">Settings</h2>
                <button onClick={() => setActiveTab('appearance')} className={`text-left px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'appearance' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Appearance</button>
                <button onClick={() => setActiveTab('data')} className={`text-left px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'data' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Data & Storage</button>
                
                {currentUser && (
                    <>
                        <div className="my-2 border-t border-slate-200 dark:border-slate-700"></div>
                        <p className="px-4 text-xs font-bold text-slate-400 uppercase mb-1">Admin</p>
                        <button onClick={() => setActiveTab('admin')} className={`text-left px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'admin' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>User Management</button>
                        <button onClick={() => setActiveTab('security')} className={`text-left px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'security' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Security Logs</button>
                        <button onClick={() => setActiveTab('logs')} className={`text-left px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'logs' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>AI & Error Logs</button>
                        <button onClick={() => setActiveTab('status')} className={`text-left px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'status' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>System Status</button>
                    </>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 p-8 overflow-y-auto">
                <div className="flex justify-between mb-6">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white capitalize">{activeTab.replace('_', ' ')}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">✕</button>
                </div>

                {activeTab === 'appearance' && (
                    <div className="space-y-6">
                        {/* Appearance settings content ... */}
                        <div className="flex justify-between items-center p-4 border rounded-xl dark:border-slate-700">
                            <div>
                                <p className="font-bold text-slate-800 dark:text-white">Dark Mode</p>
                                <p className="text-xs text-slate-500">Easier on the eyes</p>
                            </div>
                            <button onClick={toggleDarkMode} className={`w-12 h-6 rounded-full transition-colors ${darkMode ? 'bg-primary-600' : 'bg-slate-300'} relative`}>
                                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${darkMode ? 'left-7' : 'left-1'}`}></div>
                            </button>
                        </div>
                        
                        <div>
                             <p className="font-bold text-slate-800 dark:text-white mb-3">Color Theme</p>
                             <div className="grid grid-cols-4 gap-2">
                                {['default', 'ocean', 'forest', 'sunset', 'rose', 'midnight', 'coffee', 'neon'].map((t) => (
                                    <button 
                                        key={t}
                                        onClick={() => setTheme(t as Theme)}
                                        className={`p-2 rounded-lg border text-xs capitalize font-bold ${theme === t ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}
                                    >
                                        {t}
                                    </button>
                                ))}
                             </div>
                        </div>

                        <div className="flex justify-between items-center p-4 border rounded-xl dark:border-slate-700">
                            <div>
                                <p className="font-bold text-slate-800 dark:text-white">Reduced Motion</p>
                                <p className="text-xs text-slate-500">Stop animations</p>
                            </div>
                            <button onClick={toggleReducedMotion} className={`w-12 h-6 rounded-full transition-colors ${reducedMotion ? 'bg-primary-600' : 'bg-slate-300'} relative`}>
                                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${reducedMotion ? 'left-7' : 'left-1'}`}></div>
                            </button>
                        </div>

                        <div className="flex justify-between items-center p-4 border rounded-xl dark:border-slate-700">
                            <div>
                                <p className="font-bold text-slate-800 dark:text-white">Enable Images</p>
                                <p className="text-xs text-slate-500">Allow image uploads</p>
                            </div>
                            <button onClick={toggleEnableImages} className={`w-12 h-6 rounded-full transition-colors ${enableImages ? 'bg-primary-600' : 'bg-slate-300'} relative`}>
                                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${enableImages ? 'left-7' : 'left-1'}`}></div>
                            </button>
                        </div>

                        <div className="flex justify-between items-center p-4 border rounded-xl dark:border-slate-700">
                            <div>
                                <p className="font-bold text-slate-800 dark:text-white">Link Previews</p>
                                <p className="text-xs text-slate-500">Show visual cards</p>
                            </div>
                            <button onClick={toggleShowLinkPreviews} className={`w-12 h-6 rounded-full transition-colors ${showLinkPreviews ? 'bg-primary-600' : 'bg-slate-300'} relative`}>
                                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${showLinkPreviews ? 'left-7' : 'left-1'}`}></div>
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'data' && (
                    <div className="space-y-4">
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/50">
                            <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2">Export Data</h4>
                            <p className="text-sm text-blue-600 dark:text-blue-400 mb-4">Download a JSON backup.</p>
                            <button 
                                onClick={async () => {
                                    const notes = await loadNotes(currentUser || null);
                                    exportDataToFile(notes);
                                }} 
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm transition-colors"
                            >
                                Download Backup JSON
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'status' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h4 className="font-bold text-slate-700 dark:text-slate-300">Backend Diagnostics</h4>
                            <button 
                                onClick={runDiagnostics}
                                disabled={isTesting}
                                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
                            >
                                {isTesting ? 'Running Tests...' : 'Run Diagnostics'}
                            </button>
                        </div>

                        {systemStatus && (
                            <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
                                <div className="text-xs text-slate-400 text-right">Last checked: {systemStatus.timestamp}</div>
                                <div className={`p-4 rounded-xl border ${systemStatus.ai.success ? 'bg-green-50 border-green-200 dark:bg-green-900/20' : 'bg-red-50 border-red-200 dark:bg-red-900/20'}`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-slate-800 dark:text-white">Gemini AI API</span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${systemStatus.ai.success ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>{systemStatus.ai.success ? 'Online' : 'Error'}</span>
                                    </div>
                                    <p className="text-sm opacity-80">{systemStatus.ai.message}</p>
                                </div>
                                <div className={`p-4 rounded-xl border ${systemStatus.db.success ? 'bg-green-50 border-green-200 dark:bg-green-900/20' : 'bg-red-50 border-red-200 dark:bg-red-900/20'}`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-slate-800 dark:text-white">Firebase Database</span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${systemStatus.db.success ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>{systemStatus.db.success ? 'Connected' : 'Disconnected'}</span>
                                    </div>
                                    <p className="text-sm opacity-80">{systemStatus.db.message} {systemStatus.db.success && `(${systemStatus.db.latency}ms)`}</p>
                                </div>
                            </div>
                        )}
                        {!systemStatus && !isTesting && (
                            <div className="p-8 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                                Click "Run Diagnostics" to check system health.
                            </div>
                        )}
                    </div>
                )}

                {/* ADMIN: USER MANAGEMENT */}
                {activeTab === 'admin' && (
                    <div className="space-y-8">
                        <div>
                            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-4">Pending Requests</h4>
                            {isLoading ? <p>Loading...</p> : requests.length === 0 ? <p className="text-slate-400 italic">No pending requests.</p> : (
                                <div className="space-y-2">
                                    {requests.map(req => (
                                        <div key={req.uid} className="flex justify-between items-center p-3 border rounded-lg bg-yellow-50 border-yellow-100 dark:bg-yellow-900/10 dark:border-yellow-900/30">
                                            <div>
                                                <p className="font-bold text-sm">{req.username}</p>
                                                <p className="text-xs text-slate-500">{req.email} • {req.ipAddress}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleApprove(req.uid)} className="text-xs bg-green-600 text-white px-3 py-1 rounded font-bold hover:bg-green-700">Approve</button>
                                                <button onClick={() => handleDeny(req.uid)} className="text-xs bg-red-600 text-white px-3 py-1 rounded font-bold hover:bg-red-700">Deny</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-4">All Users</h4>
                            <div className="border rounded-lg overflow-hidden dark:border-slate-700">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500">
                                        <tr>
                                            <th className="p-3">User</th>
                                            <th className="p-3">Location/IP</th>
                                            <th className="p-3">Last Login</th>
                                            <th className="p-3">Status</th>
                                            <th className="p-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map(u => (
                                            <tr key={u.uid} className="border-t dark:border-slate-700">
                                                <td className="p-3">
                                                    <div className="font-bold">{u.username}</div>
                                                    <div className="text-xs text-slate-500">{u.email}</div>
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-1">
                                                        <span>{u.countryFlag}</span>
                                                        <span className="text-xs">{u.country}</span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 font-mono">{u.ipAddress}</div>
                                                </td>
                                                <td className="p-3 text-xs text-slate-500">
                                                    {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}
                                                </td>
                                                <td className="p-3">
                                                    <span className={`text-xs px-2 py-1 rounded-full font-bold uppercase ${u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {u.status}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right">
                                                    <button 
                                                        onClick={() => toggleUserStatus(u.uid, u.status)}
                                                        className="text-xs text-blue-600 hover:underline"
                                                    >
                                                        {u.status === 'active' ? 'Suspend' : 'Activate'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ADMIN: SECURITY LOGS */}
                {activeTab === 'security' && (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-slate-700 dark:text-slate-300">Audit Trail</h4>
                            <span className="text-xs text-slate-400">Records last 100 events</span>
                        </div>
                        <div className="border rounded-lg overflow-hidden dark:border-slate-700 bg-slate-50 dark:bg-slate-900 h-[60vh] overflow-y-auto">
                            {isLoading ? <div className="p-4">Loading logs...</div> : auditLogs.length === 0 ? <div className="p-4 text-slate-400 italic">No logs found.</div> : (
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 sticky top-0">
                                        <tr>
                                            <th className="p-2">Time</th>
                                            <th className="p-2">Action</th>
                                            <th className="p-2">Actor</th>
                                            <th className="p-2">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {auditLogs.map(log => (
                                            <tr key={log.id} className="hover:bg-slate-100 dark:hover:bg-slate-800">
                                                <td className="p-2 whitespace-nowrap text-slate-400">
                                                    {new Date(log.timestamp).toLocaleString()}
                                                </td>
                                                <td className="p-2 font-mono font-bold text-slate-700 dark:text-slate-300">
                                                    {log.action}
                                                </td>
                                                <td className="p-2">{log.actor}</td>
                                                <td className="p-2 text-slate-500 truncate max-w-xs" title={log.details}>
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

                {/* ADMIN: LOGS */}
                {activeTab === 'logs' && (
                    <div className="space-y-8">
                        <div>
                            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2">AI Usage Logs</h4>
                            <div className="border rounded-lg overflow-hidden h-48 overflow-y-auto bg-slate-50 dark:bg-slate-900 p-2 text-xs font-mono">
                                {aiLogs.map(l => (
                                    <div key={l.id} className="border-b border-slate-200 dark:border-slate-700 py-1">
                                        <span className="text-slate-400">[{new Date(l.timestamp).toLocaleTimeString()}]</span> <span className="text-blue-500 font-bold">{l.username}</span>: {l.action} ({l.details})
                                    </div>
                                ))}
                                {aiLogs.length === 0 && <p className="text-slate-400 italic">No AI activity recorded locally.</p>}
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-red-700 dark:text-red-400 mb-2">Error Logs</h4>
                            <div className="border rounded-lg overflow-hidden h-48 overflow-y-auto bg-red-50 dark:bg-red-900/10 p-2 text-xs font-mono">
                                {errorLogs.map(l => (
                                    <div key={l.id} className="border-b border-red-100 dark:border-red-900/30 py-1">
                                        <span className="text-red-400">[{new Date(l.timestamp).toLocaleTimeString()}]</span> <span className="font-bold">{l.context}</span>: {l.message}
                                    </div>
                                ))}
                                {errorLogs.length === 0 && <p className="text-slate-400 italic">No errors recorded.</p>}
                            </div>
                            <button onClick={clearErrorLogs} className="mt-2 text-xs text-red-500 hover:underline">Clear Error Logs</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default SettingsPanel;
