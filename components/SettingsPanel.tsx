import React, { useState, useEffect } from 'react';
import { 
    getRequests, approveRequest, denyRequest, 
    getUsers, toggleUserStatus, isAdmin, isGlobalAdmin, checkDatabaseConnection,
    getAuditLogs, AuditLogEntry, deleteUserAccount, updateUserRole,
    updateUserPassword, adminTriggerReset, testWriteCapability
} from '../services/authService';
import { runConnectivityTest, getAIUsageLogs, DAILY_REQUEST_LIMIT } from '../services/geminiService';
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
  const [healthStatus, setHealthStatus] = useState<{db: string, ai: string, dns: string} | null>(null);
  const [isTestingPerms, setIsTestingPerms] = useState(false);
  const [permTestResult, setPermTestResult] = useState<{success: boolean, message: string} | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState<string | null>(null);
  
  const [newPass, setNewPass] = useState('');
  const [passMsg, setPassMsg] = useState<{type: 'success'|'error', text: string} | null>(null);
  const [isResettingUser, setIsResettingUser] = useState<string | null>(null);

  const userIsAdmin = isAdmin(currentUser);
  const userIsSuperAdmin = isGlobalAdmin(currentUser);

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'admin' && userIsAdmin) loadAdminData();
      if (activeTab === 'security' && userIsSuperAdmin) loadSecurityData();
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
        dns: dnsStatus
    });
  };

  const handleTestPermissions = async () => {
    setIsTestingPerms(true);
    setPermTestResult(null);
    const res = await testWriteCapability();
    setPermTestResult(res);
    setIsTestingPerms(false);
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

  const firestoreRulesText = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      // Required for Username login lookup
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
            <button onClick={() => setActiveTab('health')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'health' ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>System Health</button>
            
            <div className="pt-6 pb-2 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-t border-slate-800 mt-4">Database Fix</div>
            <button onClick={() => setActiveTab('cloud-config')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'cloud-config' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>☁️ Cloud Setup</button>

            {currentUser && (
               <button onClick={() => setActiveTab('my-security')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'my-security' ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>🛡️ My Security</button>
            )}

            {userIsAdmin && (
              <>
                <div className="pt-6 pb-2 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-t border-slate-800 mt-4">Administrator</div>
                <button onClick={() => setActiveTab('admin')} className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'admin' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>User Base</button>
              </>
            )}
          </div>

          <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-[#1a2333]">
            
            {activeTab === 'cloud-config' && (
              <div className="max-w-3xl animate-[fadeIn_0.2s_ease-out]">
                <h4 className="text-lg font-black text-white uppercase mb-4 tracking-tight">Full Cloud Permission Fix</h4>
                <div className="bg-amber-900/20 border border-amber-500/30 p-4 rounded-xl mb-6">
                  <p className="text-amber-400 text-xs font-bold leading-relaxed mb-4">
                    To support <strong>Username Login</strong>, you must include the <code>allow list: if true;</code> rule under the <code>/users/</code> match block.
                  </p>
                  <button 
                    onClick={handleTestPermissions}
                    disabled={isTestingPerms || !currentUser}
                    className="px-6 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-xs font-black uppercase tracking-widest transition-all"
                  >
                    {isTestingPerms ? '⌛ Testing Write Access...' : '⚡ Run Write Tester'}
                  </button>
                  {permTestResult && (
                    <div className={`mt-3 p-3 rounded-lg text-xs font-bold ${permTestResult.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {permTestResult.success ? '✓' : '✗'} {permTestResult.message}
                    </div>
                  )}
                </div>
                
                <div className="mb-6">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Current Authenticated UID</label>
                  <code className="block p-3 bg-slate-900 border border-slate-700 rounded-lg text-emerald-400 font-mono text-sm select-all">
                    {currentUser?.uid || 'Not Authenticated'}
                  </code>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Copy & Paste these into Firebase Rules</label>
                  <pre className="p-4 bg-slate-950 border border-slate-700 rounded-xl text-indigo-300 font-mono text-xs overflow-x-auto selection:bg-indigo-500/30">
                    {firestoreRulesText}
                  </pre>
                  <button 
                    onClick={() => { navigator.clipboard.writeText(firestoreRulesText); alert("Rules copied to clipboard."); }}
                    className="mt-4 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-black uppercase tracking-widest transition-all"
                  >
                    Copy Rules to Clipboard
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-8 animate-[fadeIn_0.2s_ease-out]">
                <div className="flex items-center justify-between p-6 bg-[#0f172a] rounded-2xl border border-slate-700/50">
                  <div>
                    <h4 className="font-black text-white uppercase tracking-tight">Theme Selector</h4>
                    <p className="text-xs text-slate-500">Customize your visual workspace.</p>
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

            {activeTab === 'health' && (
              <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                 <button onClick={runDiagnostics} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all">Re-run Diagnostics</button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;