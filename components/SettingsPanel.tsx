import React, { useState, useEffect } from 'react';
import { 
    getRequests, approveRequest, denyRequest, 
    getUsers, toggleUserStatus, isAdmin, checkDatabaseConnection,
    getAuditLogs, AuditLogEntry, deleteUserAccount 
} from '../services/authService';
import { runConnectivityTest, getErrorLogs, clearErrorLogs, getAIUsageLogs } from '../services/geminiService';
import { exportDataToFile, loadNotes } from '../services/storageService';
import { getTrafficLogs, clearTrafficLogs, TrafficEntry } from '../services/trafficService';
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
  const [trafficLogs, setTrafficLogs] = useState<TrafficEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const userIsAdmin = isAdmin(currentUser);

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'traffic' && userIsAdmin) {
        setTrafficLogs(getTrafficLogs());
        const handleUpdate = () => setTrafficLogs(getTrafficLogs());
        window.addEventListener('weavenote_traffic_update', handleUpdate);
        return () => window.removeEventListener('weavenote_traffic_update', handleUpdate);
      }
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
    } catch (e) {} finally { setIsLoading(false); }
  };

  const loadSecurityData = async () => {
    setIsLoading(true);
    try {
      const logs = await getAuditLogs();
      setAuditLogs(logs);
    } catch (e) {} finally { setIsLoading(false); }
  };

  const loadLogsData = () => {
    setAiLogs(getAIUsageLogs());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span>⚙️</span> Control Center
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-48 border-r border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 p-4 space-y-1 overflow-y-auto">
            <button onClick={() => setActiveTab('appearance')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'appearance' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>Appearance</button>
            <button onClick={() => setActiveTab('data')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'data' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>Data Sync</button>
            
            {userIsAdmin && (
              <>
                <div className="pt-4 pb-1 px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Security</div>
                <button onClick={() => setActiveTab('traffic')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'traffic' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>Network Traffic</button>
                <button onClick={() => setActiveTab('admin')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'admin' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>Users</button>
                <button onClick={() => setActiveTab('security')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'security' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>Audit Vault</button>
                <button onClick={() => setActiveTab('logs')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'logs' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>AI Intel</button>
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
                      <button key={t} onClick={() => setTheme(t)} className={`px-2 py-2.5 rounded-lg text-[9px] font-black border transition-all uppercase tracking-tighter ${theme === t ? 'border-primary-600 bg-primary-50 text-primary-700 shadow-sm' : 'border-slate-200 text-slate-500 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'traffic' && userIsAdmin && (
              <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Live Traffic Monitor</h4>
                  <button onClick={() => { if(confirm("Clear local traffic logs?")) { clearTrafficLogs(); setTrafficLogs([]); } }} className="text-[10px] font-bold text-red-500 hover:underline">Purge History</button>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Total Signals</p>
                    <p className="text-xl font-black">{trafficLogs.length}</p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Bot Traffic</p>
                    <p className="text-xl font-black text-amber-500">{trafficLogs.filter(l => l.type === 'bot').length}</p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Anomalies</p>
                    <p className="text-xl font-black text-red-500">{trafficLogs.filter(l => l.type === 'suspicious').length}</p>
                  </div>
                </div>

                <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden font-mono text-[10px] shadow-2xl">
                  <div className="grid grid-cols-12 gap-2 p-2 border-b border-slate-800 bg-slate-900 text-slate-400 font-bold uppercase">
                    <div className="col-span-1">Status</div>
                    <div className="col-span-1">Verb</div>
                    <div className="col-span-3">Endpoint</div>
                    <div className="col-span-1">Size</div>
                    <div className="col-span-2">Origin</div>
                    <div className="col-span-2">User-Agent</div>
                    <div className="col-span-2 text-right">Assessment</div>
                  </div>
                  <div className="max-h-96 overflow-y-auto custom-scrollbar">
                    {trafficLogs.map(log => (
                      <div key={log.id} className="grid grid-cols-12 gap-2 p-2 border-b border-slate-800 last:border-0 hover:bg-slate-900/50 transition-colors">
                        <div className={`col-span-1 font-bold ${log.status < 300 ? 'text-green-500' : 'text-red-500'}`}>{log.status}</div>
                        <div className="col-span-1 text-slate-300">{log.method}</div>
                        <div className="col-span-3 text-indigo-400 truncate" title={log.endpoint}>{log.endpoint}</div>
                        <div className="col-span-1 text-slate-500">{log.size}b</div>
                        <div className="col-span-2 text-slate-300 truncate">{log.ip}</div>
                        <div className="col-span-2 text-slate-500 truncate" title={log.userAgent}>{log.userAgent}</div>
                        <div className="col-span-2 text-right">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                            log.type === 'bot' ? 'bg-amber-500/10 text-amber-500' : 
                            log.type === 'suspicious' ? 'bg-red-500/10 text-red-500 animate-pulse' : 
                            'bg-green-500/10 text-green-500'
                          }`}>
                            {log.type}
                          </span>
                        </div>
                      </div>
                    ))}
                    {trafficLogs.length === 0 && <p className="text-center py-20 text-slate-600 italic">No traffic signals detected.</p>}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'admin' && userIsAdmin && (
              <div className="space-y-6">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Pending Requests</h4>
                <div className="space-y-2">
                  {requests.map(r => (
                    <div key={r.uid} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div>
                        <p className="text-sm font-bold">{r.username}</p>
                        <p className="text-[10px] text-slate-500">{r.email}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => approveRequest(r.uid).then(loadAdminData)} className="px-3 py-1 bg-green-600 text-white text-[10px] rounded font-bold">Approve</button>
                        <button onClick={() => denyRequest(r.uid).then(loadAdminData)} className="px-3 py-1 bg-red-100 text-red-600 text-[10px] rounded font-bold">Deny</button>
                      </div>
                    </div>
                  ))}
                  {requests.length === 0 && <p className="text-xs text-slate-400 italic">No pending requests.</p>}
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