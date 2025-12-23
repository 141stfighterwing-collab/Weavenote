
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

  const handleToggleStatus = async (uid: string, currentStatus: any) => {
      await toggleUserStatus(uid, currentStatus);
      loadAdminData();
  };

  const handleExport = async () => {
      const notes = await loadNotes(currentUser?.uid || null);
      exportDataToFile(notes);
  };

  const runDiagnostics = async () => {
      setIsTesting(true);
      const initialSteps: DiagnosticStep[] = [
          { name: "Environment Discovery", status: 'running' },
          { name: "Gemini SDK Handshake", status: 'pending' },
          { name: "Database Connectivity", status: 'pending' },
      ];
      setDiagnosticSteps(initialSteps);

      // 1. Env Check
      const keyExists = !!process.env.API_KEY;
      if (!keyExists) {
          setDiagnosticSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'error', detail: 'Missing Key' } : s));
          setIsTesting(false);
          return;
      }
      setDiagnosticSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'success', detail: 'Found Key' } : i === 1 ? { ...s, status: 'running' } : s));

      // 2. AI Handshake
      const aiResult = await runConnectivityTest();
      if (!aiResult.success) {
          setDiagnosticSteps(prev => prev.map((s, i) => i === 1 ? { ...s, status: 'error', detail: aiResult.message } : s));
          setIsTesting(false);
          return;
      }
      setDiagnosticSteps(prev => prev.map((s, i) => i === 1 ? { ...s, status: 'success', detail: aiResult.steps.find(x => x.name.includes("Handshake"))?.detail || 'Connected' } : i === 2 ? { ...s, status: 'running' } : s));

      // 3. Database
      const dbResult = await checkDatabaseConnection();
      if (!dbResult.success) {
          setDiagnosticSteps(prev => prev.map((s, i) => i === 2 ? { ...s, status: 'error', detail: dbResult.message } : s));
      } else {
          setDiagnosticSteps(prev => prev.map((s, i) => i === 2 ? { ...s, status: 'success', detail: `${dbResult.latency}ms` } : s));
      }

      setIsTesting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span>⚙️</span> Settings & Control
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            ✕
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-48 border-r border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 p-4 space-y-1">
            <button onClick={() => setActiveTab('appearance')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'appearance' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>Appearance</button>
            <button onClick={() => setActiveTab('data')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'data' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>Data Management</button>
            {userIsAdmin && (
              <>
                <button onClick={() => setActiveTab('admin')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'admin' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>User Admin</button>
                <button onClick={() => setActiveTab('security')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'security' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>Security Logs</button>
                <button onClick={() => setActiveTab('logs')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'logs' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>AI & System</button>
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
                  <h4 className="font-bold text-slate-800 dark:text-white mb-3">Color Theme</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {(['default', 'ocean', 'forest', 'sunset', 'rose', 'midnight', 'coffee', 'neon', 'yellow', 'hyperblue'] as Theme[]).map(t => (
                      <button key={t} onClick={() => setTheme(t)} className={`px-2 py-2 rounded-lg text-[10px] font-bold border transition-all ${theme === t ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-500 dark:border-slate-700'}`}>
                        {t === 'hyperblue' ? 'HYPER BLUE' : t.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'data' && (
              <div className="space-y-6">
                <button onClick={handleExport} className="w-full py-3 bg-slate-100 dark:bg-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors">
                  📤 Export All Notes (.json)
                </button>
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30 rounded-xl text-xs text-yellow-700 dark:text-yellow-500">
                  Notes are stored locally or in the cloud. We recommend periodic exports.
                </div>
              </div>
            )}

            {activeTab === 'status' && userIsAdmin && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h4 className="font-bold text-slate-800 dark:text-white">Health Diagnostics</h4>
                    <button 
                        onClick={runDiagnostics} 
                        disabled={isTesting}
                        className="px-4 py-1.5 bg-primary-600 text-white text-xs font-bold rounded-full hover:bg-primary-700 disabled:opacity-50 transition-all"
                    >
                        {isTesting ? 'Running...' : 'Start Check'}
                    </button>
                </div>

                <div className="space-y-3">
                    {diagnosticSteps.map((step, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border dark:border-slate-700">
                            <div className="flex items-center gap-3">
                                {step.status === 'running' && <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>}
                                {step.status === 'success' && <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-white text-[10px]">✓</div>}
                                {step.status === 'error' && <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px]">✕</div>}
                                {step.status === 'pending' && <div className="w-4 h-4 bg-slate-200 dark:bg-slate-700 rounded-full"></div>}
                                <span className={`text-sm font-bold ${step.status === 'error' ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'}`}>{step.name}</span>
                            </div>
                            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">{step.detail || step.status}</span>
                        </div>
                    ))}
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
                    <p className="text-[10px] uppercase font-black text-blue-600 dark:text-blue-400 mb-2 tracking-widest">Environment Info</p>
                    <div className="grid grid-cols-2 gap-4 text-xs font-medium">
                        <div className="flex justify-between"><span className="text-slate-500">API Key Configured:</span> <span className={process.env.API_KEY ? "text-green-600" : "text-red-600"}>{process.env.API_KEY ? "Yes" : "No"}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Target Model:</span> <span className="text-indigo-600">gemini-3-flash-preview</span></div>
                    </div>
                </div>
              </div>
            )}

            {activeTab === 'admin' && (
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white mb-3">Pending Requests ({requests.length})</h4>
                  <div className="space-y-2">
                    {requests.map(r => (
                      <div key={r.uid} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                        <div>
                          <p className="text-sm font-bold">{r.username}</p>
                          <p className="text-[10px] text-slate-500">{r.email}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleApprove(r.uid)} className="px-3 py-1 bg-green-600 text-white text-xs rounded-full font-bold">Approve</button>
                          <button onClick={() => handleDeny(r.uid)} className="px-3 py-1 bg-red-600 text-white text-xs rounded-full font-bold">Deny</button>
                        </div>
                      </div>
                    ))}
                    {requests.length === 0 && <p className="text-xs text-slate-400">No pending requests.</p>}
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white mb-3">Manage Users</h4>
                  <div className="space-y-2">
                    {users.slice(0, 10).map(u => (
                      <div key={u.uid} className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-700 rounded-lg">
                        <span className="text-sm">{u.username} ({u.role})</span>
                        <button onClick={() => handleToggleStatus(u.uid, u.status)} className={`px-2 py-1 text-[10px] font-bold rounded ${u.status === 'active' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                          {u.status === 'active' ? 'Suspend' : 'Unsuspend'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'security' && (
              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 dark:text-white">Recent Audit Logs</h4>
                <div className="space-y-1.5 h-96 overflow-y-auto custom-scrollbar">
                  {auditLogs.map(log => (
                    <div key={log.id} className="text-[10px] font-mono p-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-700">
                      <span className="text-slate-400">[{new Date(log.timestamp).toLocaleTimeString()}]</span> <span className="text-indigo-600 font-bold">{log.actor}</span>: <span className="text-slate-700 dark:text-slate-300">{log.action}</span> - {log.details}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white mb-2">AI Processing History</h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                    {aiLogs.map(log => (
                      <div key={log.id} className="text-[10px] font-mono p-2 bg-slate-50 dark:bg-slate-900 rounded">
                         <span className="font-bold text-primary-600">{log.action}</span> | {log.details}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-slate-800 dark:text-white">Error Logs</h4>
                    <button onClick={() => { clearErrorLogs(); loadLogsData(); }} className="text-[10px] text-red-500 font-bold uppercase">Clear</button>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                    {errorLogs.map(log => (
                      <div key={log.id} className="text-[10px] font-mono p-2 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 rounded border border-red-100 dark:border-red-900/30">
                         {log.context}: {log.message}
                      </div>
                    ))}
                  </div>
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
