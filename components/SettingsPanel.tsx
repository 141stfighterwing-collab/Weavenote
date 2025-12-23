
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
      const initialSteps: DiagnosticStep[] = [
          { name: "Environment Check", status: 'running' },
          { name: "Gemini SDK Handshake", status: 'pending' },
          { name: "Database Connectivity", status: 'pending' },
      ];
      setDiagnosticSteps(initialSteps);

      // Step 1: API Key Check
      const apiKey = typeof process !== 'undefined' ? process.env.API_KEY : undefined;
      if (!apiKey) {
          setDiagnosticSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'error', detail: 'Missing Key' } : s));
          setIsTesting(false);
          return;
      }
      setDiagnosticSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'success', detail: 'Found Key' } : i === 1 ? { ...s, status: 'running' } : s));

      // Step 2: AI Handshake
      const aiResult = await runConnectivityTest();
      if (!aiResult.success) {
          setDiagnosticSteps(prev => prev.map((s, i) => i === 1 ? { ...s, status: 'error', detail: aiResult.message } : s));
          setIsTesting(false);
          return;
      }
      setDiagnosticSteps(prev => [
          ...aiResult.steps.map(step => ({ name: step.name, status: step.status as any, detail: step.detail })),
          { name: "Database Connectivity", status: 'running' } as const
      ]);

      // Step 3: Database
      const dbResult = await checkDatabaseConnection();
      if (!dbResult.success) {
          setDiagnosticSteps(prev => prev.map((s, i) => i === prev.length - 1 ? { ...s, status: 'error', detail: dbResult.message } : s));
      } else {
          setDiagnosticSteps(prev => prev.map((s, i) => i === prev.length - 1 ? { ...s, status: 'success', detail: `${dbResult.latency}ms` } : s));
      }

      setIsTesting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-slate-800 w-full max-w-6xl h-[85vh] rounded-2xl shadow-2xl flex overflow-hidden text-slate-900 dark:text-slate-100">
            <div className="w-64 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-2">
                <h2 className="font-bold text-lg px-2 mb-4">Settings</h2>
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

            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                <div className="flex justify-between mb-6">
                    <h3 className="text-xl font-bold capitalize">{activeTab.replace('_', ' ')}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">✕</button>
                </div>

                {activeTab === 'appearance' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center p-4 border rounded-xl dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
                            <div>
                                <p className="font-bold">Dark Mode</p>
                                <p className="text-xs text-slate-500">Enable high-contrast dark interface</p>
                            </div>
                            <button onClick={toggleDarkMode} className={`w-12 h-6 rounded-full transition-colors ${darkMode ? 'bg-primary-600' : 'bg-slate-300'} relative`}>
                                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${darkMode ? 'left-7' : 'left-1'}`}></div>
                            </button>
                        </div>
                        
                        <div>
                             <p className="font-bold mb-3">Color Themes</p>
                             <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {['default', 'ocean', 'forest', 'sunset', 'rose', 'midnight', 'coffee', 'neon', 'cyberpunk', 'nord', 'dracula', 'lavender', 'earth', 'yellow', 'hyperblue'].map((t) => (
                                    <button 
                                        key={t}
                                        onClick={() => setTheme(t as Theme)}
                                        className={`p-3 rounded-xl border-2 text-xs capitalize font-bold transition-all ${theme === t ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-primary-300'}`}
                                    >
                                        {t === 'hyperblue' ? 'Hyper Blue' : t}
                                    </button>
                                ))}
                             </div>
                        </div>
                    </div>
                )}

                {activeTab === 'status' && userIsGlobalAdmin && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h4 className="font-bold text-slate-700 dark:text-slate-300">Detailed Diagnostics</h4>
                            <button 
                                onClick={runDiagnostics} 
                                disabled={isTesting}
                                className="px-6 py-2 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-all shadow-md active:scale-95"
                            >
                                {isTesting ? 'Testing...' : 'Run Diagnostics'}
                            </button>
                        </div>

                        <div className="space-y-3">
                            {diagnosticSteps.map((step, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border dark:border-slate-700">
                                    <div className="flex items-center gap-3">
                                        {step.status === 'running' && (
                                            <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                                        )}
                                        {step.status === 'success' && (
                                            <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-[10px]">✓</div>
                                        )}
                                        {step.status === 'error' && (
                                            <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px]">✕</div>
                                        )}
                                        {step.status === 'pending' && (
                                            <div className="w-5 h-5 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                                        )}
                                        <span className={`font-bold ${step.status === 'error' ? 'text-red-500' : ''}`}>
                                            {step.name}
                                        </span>
                                    </div>
                                    <span className="text-xs font-mono font-bold text-slate-500 uppercase">
                                        {step.detail || step.status}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
                            <p className="text-[10px] uppercase font-black text-blue-600 dark:text-blue-400 mb-2 tracking-widest">Environment Info</p>
                            <div className="grid grid-cols-2 gap-4 text-xs font-medium">
                                <div className="flex justify-between"><span className="text-slate-500">API Key Configured:</span> <span className={(typeof process !== 'undefined' && process.env?.API_KEY) ? "text-green-600" : "text-red-600"}>{(typeof process !== 'undefined' && process.env?.API_KEY) ? "Yes" : "No"}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Target Model:</span> <span className="text-indigo-600">gemini-3-flash-preview</span></div>
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
