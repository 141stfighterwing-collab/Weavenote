import React, { useState, useEffect } from 'react';
import { 
    getRequests, approveRequest, denyRequest, 
    getUsers, toggleUserStatus, isAdmin, isGlobalAdmin, checkDatabaseConnection,
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

  const handleExport = async () => {
      const notes = await loadNotes(currentUser?.uid || null);
      exportDataToFile(notes);
  };

  const isEnvConfigured = () => {
    // IMPORTANT: Vite replaces 'process.env.API_KEY' at build time.
    // In the browser, 'process' doesn't exist, but the string sequence 'process.env.API_KEY' 
    // will be replaced with the actual key or an empty string from the define block.
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

      // 1. Env Check
      if (!isEnvConfigured()) {
          setDiagnosticSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'error', detail: 'KEY MISSING' } : s));
          setIsTesting(false);
          return;
      }
      setDiagnosticSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'success', detail: 'KEY DETECTED' } : i === 1 ? { ...s, status: 'running' } : s));

      // 2. AI Handshake
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

      // 3. Database
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
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh]">
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
                <button onClick={() => setActiveTab('admin')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'admin' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>Users</button>
                <button onClick={() => setActiveTab('security')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'security' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>Audits</button>
                <button onClick={() => setActiveTab('logs')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'logs' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>AI Logs</button>
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
                  <div className="grid grid-cols-4 gap-2">
                    {(['default', 'ocean', 'forest', 'sunset', 'rose', 'midnight', 'coffee', 'neon', 'yellow', 'hyperblue'] as Theme[]).map(t => (
                      <button key={t} onClick={() => setTheme(t)} className={`px-2 py-2 rounded-lg text-[10px] font-bold border transition-all ${theme === t ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-slate-200 text-slate-500 dark:border-slate-700'}`}>
                        {t.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
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

                {diagnosticSteps.some(s => s.status === 'error' && s.name.includes("Discovery")) && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border-2 border-red-200 dark:border-red-900/30">
                        <h5 className="text-xs font-black text-red-600 uppercase mb-2 flex items-center gap-2">
                           <span>⚠️</span> Critical: Missing Credentials
                        </h5>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                            The application is currently unable to communicate with AI services. Please ensure:
                        </p>
                        <ul className="list-disc ml-5 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                            <li>The variable name is exactly <code>API_KEY</code> in your environment.</li>
                            <li>If using Vite, ensure the key is correctly defined in your hosting platform (Vercel).</li>
                            <li><strong>IMPORTANT:</strong> You must trigger a new deployment in Vercel after adding the key so it is injected into the build.</li>
                        </ul>
                    </div>
                )}

                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] uppercase font-black text-slate-500 mb-2 tracking-widest">Runtime Environment</p>
                    <div className="grid grid-cols-1 gap-2 text-xs font-medium">
                        <div className="flex justify-between items-center py-1">
                            <span className="text-slate-500">API Key Access:</span> 
                            <span className={isEnvConfigured() ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                                {isEnvConfigured() ? "DETECTED ✓" : "MISSING ✕"}
                            </span>
                        </div>
                    </div>
                </div>
              </div>
            )}

            {activeTab === 'logs' && userIsAdmin && (
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white mb-2 text-sm">AI Usage History</h4>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
                    {aiLogs.length > 0 ? aiLogs.map(log => (
                      <div key={log.id} className="text-[10px] font-mono p-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-700">
                         <span className="font-bold text-primary-600">[{log.action}]</span> {log.username}: {log.details}
                      </div>
                    )) : <p className="text-xs text-slate-400 italic">No logs yet.</p>}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'admin' && userIsAdmin && (
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white mb-3 text-sm">User Requests ({requests.length})</h4>
                  <div className="space-y-2">
                    {requests.map(r => (
                      <div key={r.uid} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div>
                          <p className="text-sm font-bold text-slate-800 dark:text-white">{r.username}</p>
                          <p className="text-[10px] text-slate-500">{r.email}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleApprove(r.uid)} className="px-3 py-1 bg-green-600 text-white text-[10px] rounded-full font-bold hover:bg-green-700 transition-colors">Approve</button>
                          <button onClick={() => handleDeny(r.uid)} className="px-3 py-1 bg-red-600 text-white text-[10px] rounded-full font-bold hover:bg-red-700 transition-colors">Deny</button>
                        </div>
                      </div>
                    ))}
                    {requests.length === 0 && <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200">No pending access requests.</p>}
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'security' && userIsAdmin && (
              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 dark:text-white text-sm">Recent Audit Logs</h4>
                <div className="space-y-1.5 max-h-96 overflow-y-auto custom-scrollbar">
                  {auditLogs.map(log => (
                    <div key={log.id} className="text-[10px] font-mono p-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-700">
                      <span className="text-slate-400">[{new Date(log.timestamp).toLocaleTimeString()}]</span> <span className="text-indigo-600 font-bold">{log.actor}</span>: <span className="text-slate-700 dark:text-slate-300">{log.action}</span> - {log.details}
                    </div>
                  ))}
                  {auditLogs.length === 0 && <p className="text-xs text-slate-400 italic text-center py-10">No security logs recorded.</p>}
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