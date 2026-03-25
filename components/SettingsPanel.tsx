import React, { useState, useEffect, useRef } from 'react';
import { 
    getUsers, isAdmin, isGlobalAdmin, checkDatabaseConnection,
    updateUserRole, updateUserPassword, adminTriggerReset, testWriteCapability,
    getSystemLogs, SystemLogEntry, setAccountStatus
} from '../services/authService';
import { runConnectivityTest, getAIUsageLogs, DAILY_REQUEST_LIMIT, getDailyUsage, DiagnosticLog } from '../services/geminiService';
import { exportDatabase } from '../services/storageService';
import { Theme, User, Note, UserRole, UserStatus } from '../types';

interface EnvVariable {
    id: string;
    key: string;
    value: string;
    isSecret: boolean;
    category: string;
    description?: string;
    updatedAt: string;
    updatedBy?: string;
}

interface SystemVersion {
    currentVersion: string;
    appliedAt: string;
    patchNotes?: string;
    isBreaking: boolean;
    requiresRestart: boolean;
}

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

const API_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || '/api';

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
  
  // Environment Variables State
  const [envVariables, setEnvVariables] = useState<EnvVariable[]>([]);
  const [editingEnv, setEditingEnv] = useState<EnvVariable | null>(null);
  const [showEnvModal, setShowEnvModal] = useState(false);
  const [envForm, setEnvForm] = useState({
      key: '',
      value: '',
      isSecret: true,
      category: 'general' as 'api' | 'database' | 'firebase' | 'security' | 'general',
      description: ''
  });
  const [envImportContent, setEnvImportContent] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  
  // Version State
  const [systemVersion, setSystemVersion] = useState<SystemVersion | null>(null);
  const [versionHistory, setVersionHistory] = useState<any[]>([]);
  
  const [newPass, setNewPass] = useState('');
  const [passMsg, setPassMsg] = useState<{type: 'success'|'error', text: string} | null>(null);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  const userIsAdmin = isAdmin(currentUser);
  const dailyAIUsage = getDailyUsage() || 0;
  const token = localStorage.getItem('weavenote_auth_token');

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'admin-users' && userIsAdmin) loadAdminData();
      if (activeTab === 'ai-engine') setAiLogs(getAIUsageLogs());
      if (activeTab === 'admin-logs' && userIsAdmin) setSystemLogs(getSystemLogs());
      if (activeTab === 'health') runDiagnostics();
      if (activeTab === 'env-settings' && userIsAdmin) loadEnvVariables();
      if (activeTab === 'version' && userIsAdmin) loadVersionInfo();
    }
  }, [isOpen, activeTab, userIsAdmin]);

  useEffect(() => {
    if (terminalEndRef.current) {
        terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [diagnosticLogs]);

  // API Helper
  const apiRequest = async <T,>(endpoint: string, options: RequestInit = {}): Promise<T> => {
      const response = await fetch(`${API_URL}${endpoint}`, {
          ...options,
          headers: {
              'Content-Type': 'application/json',
              ...(token && { Authorization: `Bearer ${token}` }),
              ...options.headers,
          },
      });
      
      if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Request failed' }));
          throw new Error(error.error || `HTTP ${response.status}`);
      }
      
      return response.json();
  };

  // Load Environment Variables
  const loadEnvVariables = async () => {
      if (!userIsAdmin) return;
      setIsLoading(true);
      try {
          const vars = await apiRequest<EnvVariable[]>('/settings');
          setEnvVariables(vars);
      } catch (error) {
          console.error('Failed to load env variables:', error);
      } finally {
          setIsLoading(false);
      }
  };

  // Load Version Info
  const loadVersionInfo = async () => {
      if (!userIsAdmin) return;
      try {
          const version = await apiRequest<SystemVersion>('/version');
          setSystemVersion(version);
          
          const history = await apiRequest<any[]>('/version/history');
          setVersionHistory(history);
      } catch (error) {
          console.error('Failed to load version info:', error);
      }
  };

  // Save Environment Variable
  const handleSaveEnv = async () => {
      if (!envForm.key.trim()) return;
      
      try {
          await apiRequest('/settings', {
              method: 'POST',
              body: JSON.stringify(envForm),
          });
          
          await loadEnvVariables();
          setShowEnvModal(false);
          setEditingEnv(null);
          setEnvForm({ key: '', value: '', isSecret: true, category: 'general', description: '' });
      } catch (error) {
          console.error('Failed to save env variable:', error);
          alert('Failed to save environment variable');
      }
  };

  // Edit Environment Variable
  const handleEditEnv = async (env: EnvVariable) => {
      try {
          const fullEnv = await apiRequest<EnvVariable>(`/settings/${env.id}`);
          setEditingEnv(fullEnv);
          setEnvForm({
              key: fullEnv.key,
              value: fullEnv.value || '',
              isSecret: fullEnv.isSecret,
              category: fullEnv.category as any,
              description: fullEnv.description || ''
          });
          setShowEnvModal(true);
      } catch (error) {
          console.error('Failed to load env variable:', error);
      }
  };

  // Delete Environment Variable
  const handleDeleteEnv = async (id: string) => {
      if (!confirm('Are you sure you want to delete this environment variable?')) return;
      
      try {
          await apiRequest(`/settings/${id}`, { method: 'DELETE' });
          await loadEnvVariables();
      } catch (error) {
          console.error('Failed to delete env variable:', error);
          alert('Failed to delete environment variable');
      }
  };

  // Import .env file
  const handleImportEnv = async () => {
      if (!envImportContent.trim()) return;
      
      try {
          const result = await apiRequest<{ imported: number; skipped: number; errors: any[] }>('/settings/import', {
              method: 'POST',
              body: JSON.stringify({ content: envImportContent, category: 'general', isSecret: true }),
          });
          
          alert(`Imported ${result.imported} variables, skipped ${result.skipped}`);
          setShowImportModal(false);
          setEnvImportContent('');
          await loadEnvVariables();
      } catch (error) {
          console.error('Failed to import env:', error);
          alert('Failed to import environment variables');
      }
  };

  // Export .env file
  const handleExportEnv = async () => {
      try {
          const response = await fetch(`${API_URL}/settings/export`, {
              headers: { Authorization: `Bearer ${token}` },
          });
          
          const content = await response.text();
          const blob = new Blob([content], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = '.env';
          link.click();
          URL.revokeObjectURL(url);
      } catch (error) {
          console.error('Failed to export env:', error);
      }
  };

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

  const categoryColors = {
      api: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
      database: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      firebase: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      security: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      general: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };

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
            <button onClick={() => setActiveTab('appearance')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'appearance' ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>🎨 Visuals</button>
            <button onClick={() => setActiveTab('my-security')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'my-security' ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>🛡️ My Security</button>
            <button onClick={() => setActiveTab('ai-engine')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'ai-engine' ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>✨ AI Engine</button>
            <button onClick={() => setActiveTab('health')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'health' ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>🔍 Diagnostics</button>
            
            {userIsAdmin && (
              <>
                <div className="pt-6 pb-2 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-t border-slate-800 mt-4">Administrator</div>
                <button onClick={() => setActiveTab('env-settings')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'env-settings' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>🔐 ENV Settings</button>
                <button onClick={() => setActiveTab('version')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'version' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>📦 Versioning</button>
                <button onClick={() => setActiveTab('admin-users')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'admin-users' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>👥 User Base</button>
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
                    <h4 className="font-black text-white uppercase tracking-tight">Dark Mode</h4>
                    <p className="text-xs text-slate-500 mt-1">Toggle dark/light theme</p>
                  </div>
                  <button onClick={toggleDarkMode} className={`w-14 h-7 rounded-full transition-all relative ${darkMode ? 'bg-primary-500' : 'bg-slate-600'}`}>
                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all ${darkMode ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
                <div>
                    <h4 className="font-black text-white uppercase tracking-tight mb-4">Theme Selector</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                        {(['default', 'ocean', 'forest', 'sunset', 'rose', 'midnight', 'coffee', 'neon', 'cyberpunk', 'nord', 'dracula', 'lavender', 'earth', 'yellow', 'hyperblue'] as Theme[]).map(t => (
                          <button key={t} onClick={() => setTheme(t)} className={`px-4 py-3 rounded-xl text-[10px] font-black border transition-all uppercase tracking-tighter ${theme === t ? 'border-primary-600 bg-primary-600 text-white shadow-xl scale-[1.05]' : 'border-slate-700 text-slate-500 hover:border-primary-400'}`}>
                            {t}
                          </button>
                        ))}
                    </div>
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

            {activeTab === 'env-settings' && userIsAdmin && (
              <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-lg font-black text-white uppercase tracking-tight">🔐 Environment Variables</h4>
                    <p className="text-xs text-slate-500 mt-1">Manage API keys, database credentials, and system settings securely.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowImportModal(true)}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-black uppercase tracking-widest"
                    >
                      Import .env
                    </button>
                    <button
                      onClick={handleExportEnv}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black uppercase tracking-widest"
                    >
                      Export .env
                    </button>
                    <button
                      onClick={() => { setEditingEnv(null); setEnvForm({ key: '', value: '', isSecret: true, category: 'general', description: '' }); setShowEnvModal(true); }}
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-xs font-black uppercase tracking-widest"
                    >
                      + Add Variable
                    </button>
                  </div>
                </div>

                {/* Quick Add Templates */}
                <div className="p-4 bg-cyan-900/10 border border-cyan-500/20 rounded-xl">
                  <h5 className="font-black text-cyan-400 uppercase text-xs mb-3">Quick Add Common Keys</h5>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'GEMINI_API_KEY', category: 'api', description: 'Google Gemini AI API Key' },
                      { key: 'POSTGRES_PASSWORD', category: 'database', description: 'PostgreSQL Database Password' },
                      { key: 'JWT_SECRET', category: 'security', description: 'JWT Signing Secret' },
                      { key: 'VITE_FIREBASE_API_KEY', category: 'firebase', description: 'Firebase API Key' },
                      { key: 'VITE_FIREBASE_DATABASE_URL', category: 'firebase', description: 'Firebase Realtime Database URL' },
                    ].map(template => (
                      <button
                        key={template.key}
                        onClick={() => { setEnvForm({ key: template.key, value: '', isSecret: true, category: template.category as any, description: template.description }); setShowEnvModal(true); }}
                        className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg text-xs font-bold hover:bg-cyan-500/30 transition-all"
                      >
                        + {template.key}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Variables List */}
                <div className="bg-[#0f172a] rounded-2xl border border-slate-700/50 overflow-hidden">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-900/50 border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3 font-black uppercase text-slate-500 tracking-widest">Key</th>
                        <th className="px-4 py-3 font-black uppercase text-slate-500 tracking-widest">Value</th>
                        <th className="px-4 py-3 font-black uppercase text-slate-500 tracking-widest">Category</th>
                        <th className="px-4 py-3 font-black uppercase text-slate-500 tracking-widest">Updated</th>
                        <th className="px-4 py-3 font-black uppercase text-slate-500 tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {isLoading ? (
                        <tr><td colSpan={5} className="p-10 text-center text-slate-500 italic">Loading...</td></tr>
                      ) : envVariables.length > 0 ? envVariables.map(env => (
                        <tr key={env.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">{env.key}</span>
                              {env.isSecret && <span className="text-[8px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded font-black">SECRET</span>}
                            </div>
                            {env.description && <p className="text-[9px] text-slate-500 mt-0.5">{env.description}</p>}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-400">{env.value}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${categoryColors[env.category as keyof typeof categoryColors]}`}>
                              {env.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-500">{new Date(env.updatedAt).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => handleEditEnv(env)} className="px-2 py-1 bg-indigo-600/20 text-indigo-400 rounded font-bold text-[9px] uppercase">Edit</button>
                              <button onClick={() => handleDeleteEnv(env.id)} className="px-2 py-1 bg-rose-600/20 text-rose-400 rounded font-bold text-[9px] uppercase">Delete</button>
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={5} className="p-10 text-center text-slate-500 italic">No environment variables configured. Click "Add Variable" to add one.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Warning */}
                <div className="p-4 bg-amber-900/20 border border-amber-500/30 rounded-xl">
                  <p className="text-amber-400 text-xs font-bold flex items-center gap-2">
                    <span>⚠️</span>
                    Environment variables are stored encrypted in the database and exported .env files are gitignored. Never commit sensitive keys to version control.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'version' && userIsAdmin && (
              <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-lg font-black text-white uppercase tracking-tight">📦 System Versioning</h4>
                    <p className="text-xs text-slate-500 mt-1">Track patches, updates, and system changes.</p>
                  </div>
                </div>

                {/* Current Version Card */}
                <div className="p-6 bg-purple-900/10 border border-purple-500/20 rounded-2xl">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-500/20 rounded-xl">
                      <span className="text-2xl">📦</span>
                    </div>
                    <div>
                      <p className="text-xs text-purple-400 font-black uppercase tracking-widest">Current Version</p>
                      <p className="text-3xl font-black text-white">{systemVersion?.currentVersion || 'Loading...'}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-xs text-slate-500">Applied</p>
                      <p className="text-sm text-white font-bold">{systemVersion?.appliedAt ? new Date(systemVersion.appliedAt).toLocaleDateString() : '-'}</p>
                    </div>
                  </div>
                  {systemVersion?.patchNotes && (
                    <div className="mt-4 pt-4 border-t border-purple-500/20">
                      <p className="text-xs text-slate-400">{systemVersion.patchNotes}</p>
                    </div>
                  )}
                </div>

                {/* Version History */}
                <div>
                  <h5 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Version History</h5>
                  <div className="space-y-2">
                    {versionHistory.length > 0 ? versionHistory.map((v, i) => (
                      <div key={v.id} className="p-4 bg-[#0f172a] border border-slate-700/50 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className={`px-2 py-1 rounded-lg text-xs font-black ${i === 0 ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-700 text-slate-400'}`}>
                            v{v.version}
                          </span>
                          {v.patchNotes && <span className="text-xs text-slate-500">{v.patchNotes.substring(0, 50)}...</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          {v.isBreaking && <span className="text-[8px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded font-black">BREAKING</span>}
                          <span className="text-xs text-slate-500">{new Date(v.appliedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    )) : <p className="text-sm text-slate-500 italic">No version history available.</p>}
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

                <div className="mt-8 p-5 bg-slate-900/40 border border-slate-700/60 rounded-xl">
                  <h5 className="text-xs font-black text-white uppercase tracking-widest mb-2">Database Export</h5>
                  <p className="text-[11px] text-slate-400 mb-4">Download a full notes database backup in multiple file types.</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => exportDatabase(notes, 'json', currentUser?.uid)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest"
                    >
                      Download JSON
                    </button>
                    <button
                      onClick={() => exportDatabase(notes, 'sql', currentUser?.uid)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest"
                    >
                      Download SQL
                    </button>
                    <button
                      onClick={() => exportDatabase(notes, 'csv', currentUser?.uid)}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest"
                    >
                      Download CSV
                    </button>
                  </div>
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
                    <div className="flex justify-between items-center px-1">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Detailed Diagnostic Terminal</h4>
                        <button 
                            onClick={() => { navigator.clipboard.writeText(window.location.origin + '/*'); alert("Wildcard origin copied!"); }}
                            className="text-[9px] font-black uppercase text-indigo-400 hover:text-indigo-300 border border-indigo-400/20 px-2 py-1 rounded-lg"
                        >
                            Copy Origin for Whitelist
                        </button>
                    </div>
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

      {/* Environment Variable Modal */}
      {showEnvModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80">
          <div className="bg-[#1a2333] border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-black text-white uppercase">{editingEnv ? 'Edit Variable' : 'Add Variable'}</h3>
            
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Key</label>
              <input
                type="text"
                value={envForm.key}
                onChange={(e) => setEnvForm({ ...envForm, key: e.target.value })}
                placeholder="e.g., GEMINI_API_KEY"
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none"
                disabled={!!editingEnv}
              />
            </div>
            
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Value</label>
              <textarea
                value={envForm.value}
                onChange={(e) => setEnvForm({ ...envForm, value: e.target.value })}
                placeholder="Enter the value..."
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none h-24 resize-none font-mono"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Category</label>
                <select
                  value={envForm.category}
                  onChange={(e) => setEnvForm({ ...envForm, category: e.target.value as any })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none"
                >
                  <option value="api">API</option>
                  <option value="database">Database</option>
                  <option value="firebase">Firebase</option>
                  <option value="security">Security</option>
                  <option value="general">General</option>
                </select>
              </div>
              
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={envForm.isSecret}
                    onChange={(e) => setEnvForm({ ...envForm, isSecret: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-xs text-slate-400">Secret (encrypt)</span>
                </label>
              </div>
            </div>
            
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Description (optional)</label>
              <input
                type="text"
                value={envForm.description}
                onChange={(e) => setEnvForm({ ...envForm, description: e.target.value })}
                placeholder="What is this key for?"
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none"
              />
            </div>
            
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => { setShowEnvModal(false); setEditingEnv(null); }}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg text-xs font-black uppercase"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEnv}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-xs font-black uppercase"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80">
          <div className="bg-[#1a2333] border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-lg font-black text-white uppercase">Import .env File</h3>
            <p className="text-xs text-slate-500">Paste the contents of your .env file below. Format: KEY=value</p>
            
            <textarea
              value={envImportContent}
              onChange={(e) => setEnvImportContent(e.target.value)}
              placeholder={`GEMINI_API_KEY=your_key_here\nPOSTGRES_PASSWORD=your_password\nJWT_SECRET=your_secret`}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm outline-none h-48 resize-none font-mono"
            />
            
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => { setShowImportModal(false); setEnvImportContent(''); }}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg text-xs font-black uppercase"
              >
                Cancel
              </button>
              <button
                onClick={handleImportEnv}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-black uppercase"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPanel;
