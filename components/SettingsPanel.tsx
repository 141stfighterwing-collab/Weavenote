
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

/**
 * SettingsPanel component fixed with default export and complete implementation.
 */
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

  // CRITICAL: Ensure only Admins can access health and logs
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

  const runDiagnostics = async () => {
      setIsTesting(true);
      const initialSteps: DiagnosticStep[] = [
          { name: "Environment Discovery", status: 'running' },
          { name: "AI Handshake", status: 'pending' },
          { name: "Cloud Sync DB", status: 'pending' },
      ];
      setDiagnosticSteps(initialSteps);

      // 1. Env Check - Robust detection of process.env to prevent ReferenceError in production
      let apiKeyFound = false;
      try {
        if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
          apiKeyFound = true;
        } 
      } catch (e) {
        apiKeyFound = false;
      }
      
      if (!apiKeyFound) {
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
            <button onClick={() => setActiveTab('data')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'data' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>Data Management</button>
            {userIsAdmin && (
              <>
                <button onClick={() => setActiveTab('admin')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'admin' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>Users</button>
                <button onClick={() => setActiveTab('security')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'security' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>Security Logs</button>
                <button onClick={() => setActiveTab('health')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'health' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>System Health</button>
              </>
            )}
          </div>
          
          <div className="flex-1 p-6 overflow-y-auto bg-white dark:bg-slate-800">
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border dark:border-slate-700">
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-white">Dark Mode</h3>
                    <p className="text-xs text-slate-500">Enable high-contrast dark theme.</p>
                  </div>
                  <button onClick={toggleDarkMode} className={`w-12 h-6 rounded-full transition-colors relative ${darkMode ? 'bg-primary-600' : 'bg-slate-300'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${darkMode ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">UI Themes</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {(['default', 'ocean', 'forest', 'sunset', 'rose', 'midnight', 'cyberpunk', 'nord', 'dracula'] as Theme[]).map(t => (
                      <button 
                        key={t}
                        onClick={() => setTheme(t)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${theme === t ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'}`}
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'data' && (
              <div className="space-y-6">
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl">
                  <h3 className="font-bold text-indigo-800 dark:text-indigo-300 mb-1">Local Backup</h3>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-4">Export all active notes to a JSON file for safe keeping.</p>
                  <button onClick={handleExport} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-sm text-sm">Download Backup</button>
                </div>
              </div>
            )}

            {activeTab === 'health' && userIsAdmin && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">Connectivity Suite</h3>
                  <button onClick={runDiagnostics} disabled={isTesting} className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-md disabled:opacity-50">
                    {isTesting ? 'Running Handshakes...' : 'Run System Diagnostics'}
                  </button>
                </div>
                <div className="space-y-2">
                  {diagnosticSteps.map(step => (
                    <div key={step.name} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border dark:border-slate-700">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{step.name}</span>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                        step.status === 'success' ? 'bg-green-100 text-green-700' : 
                        step.status === 'error' ? 'bg-red-100 text-red-700' : 
                        'bg-slate-200 text-slate-600'
                      }`}>
                        {step.detail || step.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'admin' && userIsAdmin && (
              <div className="space-y-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">User Management ({users.length})</h3>
                <div className="space-y-2">
                  {users.map(u => (
                    <div key={u.uid} className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 border rounded-xl dark:border-slate-700">
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-white">{u.username} <span className="text-[10px] opacity-40">({u.role})</span></p>
                        <p className="text-[10px] text-slate-500">{u.email}</p>
                      </div>
                      <button 
                        onClick={() => handleToggleStatus(u.uid, u.status)}
                        className={`text-[10px] font-bold px-3 py-1 rounded-full ${u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                      >
                        {u.status.toUpperCase()}
                      </button>
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
