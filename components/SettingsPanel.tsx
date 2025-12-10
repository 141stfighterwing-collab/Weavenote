

import React, { useState, useEffect } from 'react';
import { 
    User, AccountRequest, AuditLogEntry,
    getUsers, getRequests, createUser, deleteUser, updateUserPermission, 
    approveRequest, denyRequest, Permission, isAdmin, 
    toggleUserStatus, adminResetPassword, getAuditLogs, clearAuditLogs,
    getSessionTimeout, setSessionTimeout
} from '../services/authService';
import { getUserStats, UserUsageStats, loadNotes, downloadAllNotesAsZip } from '../services/storageService';
import { getAIUsageLogs, clearAIUsageLogs, getErrorLogs, clearErrorLogs, runConnectivityTest } from '../services/geminiService';
import { Theme, AILogEntry, ErrorLogEntry } from '../types';

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
    isOpen, onClose, currentUser, darkMode, toggleDarkMode, theme, setTheme, reducedMotion, toggleReducedMotion,
    enableImages, toggleEnableImages, showLinkPreviews, toggleShowLinkPreviews
}) => {
  const [activeTab, setActiveTab] = useState<'requests' | 'users' | 'security' | 'ai-logs' | 'errors' | 'appearance' | 'data'>('appearance');
  const [users, setUsers] = useState<User[]>([]);
  const [userStats, setUserStats] = useState<Record<string, UserUsageStats>>({});
  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [aiLogs, setAiLogs] = useState<AILogEntry[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLogEntry[]>([]);
  const [sessionTimeout, setSessionTimeoutState] = useState<number>(30);

  // Form States
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPermission, setNewPermission] = useState<Permission>('read');
  const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // Modal States
  const [resetPassUser, setResetPassUser] = useState<string | null>(null);
  const [resetPassValue, setResetPassValue] = useState('');
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  // Diagnostic State
  const [diagResult, setDiagResult] = useState<{ success: boolean, message: string, details?: any } | null>(null);
  const [isRunningDiag, setIsRunningDiag] = useState(false);

  const isUserAdmin = isAdmin(currentUser);

  useEffect(() => {
    if (isOpen) {
        if (!isUserAdmin) setActiveTab('appearance');
        else if (activeTab === 'appearance' || activeTab === 'data') setActiveTab('requests'); // Reset admin default if confusing, or keep current.
        loadData();
    }
  }, [isOpen, isUserAdmin]);

  const loadData = () => {
      if (isUserAdmin) {
          const loadedUsers = getUsers();
          setUsers(loadedUsers);
          setRequests(getRequests());
          setAuditLogs(getAuditLogs());
          setAiLogs(getAIUsageLogs());
          setErrorLogs(getErrorLogs());
          setSessionTimeoutState(getSessionTimeout());

          // Calculate stats for all users
          const stats: Record<string, UserUsageStats> = {};
          loadedUsers.forEach(u => {
              stats[u.username] = getUserStats(u.username);
          });
          setUserStats(stats);
      }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const result = createUser(newUsername, newPassword, newPermission, currentUser || 'admin', undefined, undefined, undefined, newEmail);
    
    if (result.success) {
        setMsg({ type: 'success', text: result.message });
        setNewUsername('');
        setNewPassword('');
        setNewEmail('');
        setNewPermission('read');
        loadData();
    } else {
        setMsg({ type: 'error', text: result.message });
    }
  };

  const handleDeleteClick = (username: string) => {
      setUserToDelete(username);
  };

  const confirmDelete = () => {
    if (userToDelete) {
        deleteUser(userToDelete);
        loadData();
        setMsg({ type: 'success', text: `User ${userToDelete} deleted.` });
        setUserToDelete(null);
    }
  };

  const handleToggleStatus = (username: string, currentStatus: string) => {
     toggleUserStatus(username);
     loadData();
  };

  const handlePasswordReset = (e: React.FormEvent) => {
      e.preventDefault();
      if(resetPassUser && resetPassValue) {
          adminResetPassword(resetPassUser, resetPassValue);
          setMsg({ type: 'success', text: `Password reset for ${resetPassUser}` });
          setResetPassUser(null);
          setResetPassValue('');
          loadData();
      }
  };

  const handleTogglePermission = (user: User) => {
    const newPerm = user.permission === 'read' ? 'edit' : 'read';
    updateUserPermission(user.username, newPerm);
    loadData();
  };

  const handleApprove = (username: string) => {
      if(approveRequest(username)) {
          loadData();
          setMsg({ type: 'success', text: `Approved ${username}` });
      }
  };

  const handleDeny = (username: string) => {
      denyRequest(username);
      loadData();
      setMsg({ type: 'success', text: `Denied request from ${username}` });
  };

  const handleTimeoutChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = parseInt(e.target.value, 10);
      setSessionTimeout(val);
      setSessionTimeoutState(val);
      loadData(); // Reload logs to see audit entry
  };
  
  const handleBulkDownload = async () => {
      const notes = loadNotes(currentUser);
      if (notes && notes.length > 0) {
          await downloadAllNotesAsZip(notes);
          setMsg({ type: 'success', text: 'Downloaded all notes as ZIP.' });
      } else {
          setMsg({ type: 'error', text: 'No notes to download.' });
      }
  };

  const handleDownloadErrorLogs = () => {
      const text = JSON.stringify(errorLogs, null, 2);
      const blob = new Blob([text], { type: 'text/plain' }); // Error.txt format
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Error_Log_${new Date().toISOString()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
  };

  const runDiagnostics = async () => {
      setIsRunningDiag(true);
      setDiagResult(null);
      const result = await runConnectivityTest();
      setDiagResult(result);
      setIsRunningDiag(false);
  };

  // Calculated Stats
  const activeUsersCount = users.filter(u => u.status === 'active').length;
  const suspendedUsersCount = users.filter(u => u.status === 'suspended').length;
  const securityEventsCount = auditLogs.length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col h-[90vh]">
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
          <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <span className="text-slate-500">⚙️</span> Settings & Admin
              </h2>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className="flex flex-grow overflow-hidden">
            {/* Sidebar / Tabs */}
            <div className="w-1/5 min-w-[220px] bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-2 overflow-y-auto">
                {isUserAdmin && (
                    <>
                        <button 
                            type="button"
                            onClick={() => setActiveTab('requests')}
                            className={`text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors flex justify-between items-center ${activeTab === 'requests' ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            <span>Requests</span>
                            {requests.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{requests.length}</span>}
                        </button>
                        <button 
                            type="button"
                            onClick={() => setActiveTab('users')}
                            className={`text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors flex justify-between items-center ${activeTab === 'users' ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            <span>User Management</span>
                            <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300" title="Active Users">
                                {activeUsersCount} Active
                            </span>
                        </button>
                        <button 
                            type="button"
                            onClick={() => setActiveTab('security')}
                            className={`text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors flex justify-between items-center ${activeTab === 'security' ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                             <span>Security & Logs</span>
                             <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300" title="Total Events">
                                {securityEventsCount}
                            </span>
                        </button>
                        <button 
                            type="button"
                            onClick={() => setActiveTab('ai-logs')}
                            className={`text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors flex justify-between items-center ${activeTab === 'ai-logs' ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            <span>AI Usage Log</span>
                        </button>
                        <button 
                            type="button"
                            onClick={() => setActiveTab('errors')}
                            className={`text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors flex justify-between items-center ${activeTab === 'errors' ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            <span>Debug / Errors</span>
                            {errorLogs.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{errorLogs.length}</span>}
                        </button>
                        <div className="h-px bg-slate-200 dark:bg-slate-700 my-2"></div>
                    </>
                )}
                <button 
                    type="button"
                    onClick={() => setActiveTab('appearance')}
                    className={`text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'appearance' ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                    Personalization
                </button>
                <button 
                    type="button"
                    onClick={() => setActiveTab('data')}
                    className={`text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'data' ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                    Data & Export
                </button>
            </div>

            {/* Content Area */}
            <div className="w-4/5 p-6 overflow-y-auto bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                
                {msg && (
                    <div className={`mb-4 px-4 py-3 rounded text-sm flex justify-between items-center ${msg.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                        <span>{msg.text}</span>
                        <button type="button" onClick={() => setMsg(null)} className="font-bold ml-2">×</button>
                    </div>
                )}

                {/* ACCOUNT REQUESTS TAB */}
                {activeTab === 'requests' && isUserAdmin && (
                    <div>
                        <h3 className="text-lg font-bold mb-4">Account Access Requests</h3>
                        {requests.length === 0 ? (
                            <div className="text-center py-10 bg-slate-50 dark:bg-slate-900 rounded border border-dashed border-slate-300 dark:border-slate-600">
                                <p className="text-slate-500 dark:text-slate-400">No pending requests.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {requests.map(req => (
                                    <div key={req.username} className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-lg">{req.username}</p>
                                                {req.countryFlag && <span title={req.country}>{req.countryFlag}</span>}
                                            </div>
                                            {req.email && <p className="text-xs text-slate-500 dark:text-slate-400">{req.email}</p>}
                                            <p className="text-xs text-slate-500 mt-1">Requested: {new Date(req.timestamp).toLocaleDateString()}</p>
                                            <p className="text-xs text-slate-400">IP: {req.ipAddress || 'Unknown'}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={() => handleDeny(req.username)} className="px-4 py-2 text-xs font-bold text-red-600 border border-red-200 bg-white rounded hover:bg-red-50">Deny</button>
                                            <button type="button" onClick={() => handleApprove(req.username)} className="px-4 py-2 text-xs font-bold text-white bg-green-600 rounded hover:bg-green-700 shadow-sm">Approve</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* USER MANAGEMENT TAB */}
                {activeTab === 'users' && isUserAdmin && (
                    <div>
                        {/* ... (Existing User Management Code) ... */}
                        <div className="flex justify-between items-end mb-4">
                             <h3 className="text-lg font-bold">Manage Users</h3>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-100 dark:border-green-800/50">
                                <p className="text-xs font-bold text-green-600 dark:text-green-400 uppercase">Active Users</p>
                                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{activeUsersCount}</p>
                            </div>
                            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-100 dark:border-red-800/50">
                                <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase">Suspended</p>
                                <p className="text-2xl font-bold text-red-700 dark:text-red-300">{suspendedUsersCount}</p>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800/50">
                                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">Total Accounts</p>
                                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{users.length}</p>
                            </div>
                        </div>
                        
                         {/* Create User Form */}
                         <div className="mb-8 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-lg border border-slate-200 dark:border-slate-700">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Add New User</h4>
                            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                                <div>
                                    <input 
                                        type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)}
                                        className="w-full px-3 py-2 text-sm border dark:border-slate-600 rounded bg-white dark:bg-slate-700 dark:text-white" placeholder="Username" required />
                                </div>
                                <div>
                                    <input 
                                        type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                                        className="w-full px-3 py-2 text-sm border dark:border-slate-600 rounded bg-white dark:bg-slate-700 dark:text-white" placeholder="Email (Optional)" />
                                </div>
                                <div>
                                    <input 
                                        type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full px-3 py-2 text-sm border dark:border-slate-600 rounded bg-white dark:bg-slate-700 dark:text-white" placeholder="Password" required />
                                </div>
                                <div>
                                    <select value={newPermission} onChange={(e) => setNewPermission(e.target.value as Permission)}
                                        className="w-full px-3 py-2 text-sm border dark:border-slate-600 rounded bg-white dark:bg-slate-700 dark:text-white">
                                        <option value="read">Read Only</option>
                                        <option value="edit">Edit Access</option>
                                    </select>
                                </div>
                                <button type="submit" className="bg-primary-600 text-white font-bold py-2 px-4 rounded text-sm hover:bg-primary-700 shadow-sm">Create</button>
                            </form>
                        </div>

                        {/* Reset Password Modal/Overlay */}
                        {resetPassUser && (
                            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-xl border border-slate-200 dark:border-slate-600 w-80">
                                    <h4 className="font-bold mb-4 text-slate-800 dark:text-white">Reset Password</h4>
                                    <p className="text-xs text-slate-500 mb-4">For user: <strong>{resetPassUser}</strong></p>
                                    <form onSubmit={handlePasswordReset}>
                                        <input 
                                            type="text" 
                                            value={resetPassValue}
                                            onChange={(e) => setResetPassValue(e.target.value)}
                                            placeholder="New Password"
                                            className="w-full px-3 py-2 border rounded mb-4 text-sm dark:bg-slate-700 dark:text-white dark:border-slate-500"
                                            autoFocus
                                            required
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button type="button" onClick={() => setResetPassUser(null)} className="px-3 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">Cancel</button>
                                            <button type="submit" className="px-3 py-1 text-xs bg-primary-600 text-white rounded font-bold">Save</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* Delete Confirmation Modal */}
                        {userToDelete && (
                            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-xl border border-red-200 dark:border-red-900 w-96">
                                    <div className="flex items-center gap-3 text-red-600 mb-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                        <h4 className="font-bold text-lg">Delete User?</h4>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
                                        Are you sure you want to permanently delete <strong>{userToDelete}</strong>? This action cannot be undone.
                                    </p>
                                    <div className="flex justify-end gap-3">
                                        <button 
                                            type="button" 
                                            onClick={() => setUserToDelete(null)} 
                                            className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 rounded-lg"
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={confirmDelete} 
                                            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 shadow-sm"
                                        >
                                            Delete User
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* User List */}
                        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                             <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-900">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium text-slate-500 uppercase text-xs">User</th>
                                        <th className="px-4 py-3 text-left font-medium text-slate-500 uppercase text-xs">Stats</th>
                                        <th className="px-4 py-3 text-left font-medium text-slate-500 uppercase text-xs">Persona</th>
                                        <th className="px-4 py-3 text-left font-medium text-slate-500 uppercase text-xs">Status</th>
                                        <th className="px-4 py-3 text-right font-medium text-slate-500 uppercase text-xs">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {users.map(user => {
                                        const stats = userStats[user.username] || { noteCount: 0, topCategory: '-', persona: 'Unknown', personaEmoji: '❓' };
                                        return (
                                        <tr key={user.username} className={`bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 ${user.status === 'suspended' ? 'opacity-70 bg-red-50 dark:bg-red-900/10' : ''}`}>
                                            <td className="px-4 py-3">
                                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                    {user.username}
                                                    {user.status === 'suspended' && <span className="text-[10px] text-red-500 font-bold uppercase border border-red-200 rounded px-1">Frozen</span>}
                                                </div>
                                                {user.email && <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>}
                                                <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                    <span>{user.countryFlag} {user.country || 'Unknown'}</span>
                                                    <span className="text-slate-300">|</span>
                                                    <span>{user.ipAddress}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-400 mt-0.5">
                                                    Login: {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded w-fit">
                                                        {stats.noteCount} Notes
                                                    </span>
                                                    <span className="text-[10px] text-slate-500">
                                                        Top: <span className="font-semibold">{stats.topCategory}</span>
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2" title={stats.persona}>
                                                    <span className="text-xl bg-slate-100 dark:bg-slate-700 w-8 h-8 flex items-center justify-center rounded-full shadow-sm">{stats.personaEmoji}</span>
                                                    <span className="text-xs font-semibold">{stats.persona}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                 <div className="flex flex-col gap-2 items-start">
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleToggleStatus(user.username, user.status)}
                                                        className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${user.status === 'active' ? 'border-green-200 text-green-700 bg-green-50' : 'border-red-200 text-red-700 bg-red-50'}`}
                                                    >
                                                        {user.status === 'active' ? 'Active' : 'Suspended'}
                                                    </button>
                                                    <button type="button" onClick={() => handleTogglePermission(user)} className="hover:opacity-80">
                                                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${user.permission === 'edit' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                                                            {user.permission}
                                                        </span>
                                                    </button>
                                                 </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-3">
                                                    <button type="button" onClick={() => { setResetPassUser(user.username); setResetPassValue(''); }} className="text-slate-500 hover:text-primary-600 p-1 hover:bg-slate-100 rounded" title="Reset Password">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                                    </button>
                                                    <button type="button" onClick={() => handleDeleteClick(user.username)} className="text-slate-500 hover:text-red-600 p-1 hover:bg-slate-100 rounded" title="Delete Account">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* SECURITY TAB */}
                {activeTab === 'security' && isUserAdmin && (
                    <div className="space-y-6">
                        {/* Security Summary Cards */}
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-100 dark:border-purple-800/50 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase">Total Security Events</p>
                                    <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{securityEventsCount}</p>
                                </div>
                                <div className="p-3 bg-purple-100 dark:bg-purple-800/50 rounded-full text-purple-600 dark:text-purple-300">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                </div>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Session Timeout Policy</p>
                                    <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{sessionTimeout}m</p>
                                </div>
                                 <div className="p-3 bg-slate-200 dark:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-bold mb-4">Session Policy</h3>
                            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Auto-Logout Timer (Inactivity)</label>
                                <div className="flex items-center gap-4">
                                    <select 
                                        value={sessionTimeout} 
                                        onChange={handleTimeoutChange}
                                        className="px-3 py-2 border rounded-md dark:bg-slate-700 dark:text-white dark:border-slate-600"
                                    >
                                        <option value={5}>5 Minutes</option>
                                        <option value={15}>15 Minutes</option>
                                        <option value={30}>30 Minutes</option>
                                        <option value={60}>1 Hour</option>
                                        <option value={1440}>Never (24h)</option>
                                    </select>
                                    <span className="text-xs text-slate-500">Users will be logged out after this period of inactivity.</span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold">Audit Logs</h3>
                                <button type="button" onClick={() => { clearAuditLogs(); loadData(); }} className="text-xs text-red-500 hover:underline">Clear Logs</button>
                            </div>
                            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden h-96 overflow-y-auto bg-slate-50 dark:bg-slate-900">
                                <table className="min-w-full text-xs">
                                    <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-medium text-slate-500">Time</th>
                                            <th className="px-4 py-2 text-left font-medium text-slate-500">Action</th>
                                            <th className="px-4 py-2 text-left font-medium text-slate-500">Actor</th>
                                            <th className="px-4 py-2 text-left font-medium text-slate-500">Target</th>
                                            <th className="px-4 py-2 text-left font-medium text-slate-500">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-mono">
                                        {auditLogs.map(log => (
                                            <tr key={log.id} className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700">
                                                <td className="px-4 py-2 whitespace-nowrap text-slate-500">
                                                    {new Date(log.timestamp).toLocaleString([], { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit'})}
                                                </td>
                                                <td className="px-4 py-2 font-bold text-slate-700 dark:text-slate-300">{log.action}</td>
                                                <td className="px-4 py-2 text-primary-600 dark:text-primary-400">{log.actor}</td>
                                                <td className="px-4 py-2">{log.target || '-'}</td>
                                                <td className="px-4 py-2 text-slate-500 truncate max-w-xs" title={log.details}>{log.details || '-'}</td>
                                            </tr>
                                        ))}
                                        {auditLogs.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">No logs found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* AI LOGS TAB */}
                {activeTab === 'ai-logs' && isUserAdmin && (
                    <div>
                         <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">AI Usage History</h3>
                            <button type="button" onClick={() => { clearAIUsageLogs(); loadData(); }} className="text-xs text-red-500 hover:underline">Clear History</button>
                        </div>
                        <div className="mb-4 text-xs text-slate-500">
                            Logs every interaction with the Gemini API to track consumption.
                        </div>
                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden h-[600px] overflow-y-auto bg-slate-50 dark:bg-slate-900">
                                <table className="min-w-full text-xs">
                                    <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-medium text-slate-500">Time</th>
                                            <th className="px-4 py-2 text-left font-medium text-slate-500">User</th>
                                            <th className="px-4 py-2 text-left font-medium text-slate-500">Action</th>
                                            <th className="px-4 py-2 text-left font-medium text-slate-500">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-mono">
                                        {aiLogs.map(log => (
                                            <tr key={log.id} className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700">
                                                <td className="px-4 py-2 whitespace-nowrap text-slate-500">
                                                    {new Date(log.timestamp).toLocaleString([], { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit'})}
                                                </td>
                                                <td className="px-4 py-2 font-bold text-primary-600 dark:text-primary-400">{log.username}</td>
                                                <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{log.action}</td>
                                                <td className="px-4 py-2 text-slate-500 truncate max-w-md" title={log.details}>{log.details || '-'}</td>
                                            </tr>
                                        ))}
                                        {aiLogs.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">No AI usage recorded yet.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                        </div>
                    </div>
                )}

                {/* DEBUG / ERROR LOGS TAB */}
                {activeTab === 'errors' && isUserAdmin && (
                    <div>
                         <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-red-600 dark:text-red-400">System Diagnostics</h3>
                            <div className="flex gap-3">
                                <button type="button" onClick={handleDownloadErrorLogs} className="text-xs bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 px-3 py-1 rounded text-slate-700 dark:text-slate-300 transition-colors">Download Error.txt</button>
                                <button type="button" onClick={() => { clearErrorLogs(); loadData(); }} className="text-xs text-red-500 hover:underline">Clear Errors</button>
                            </div>
                        </div>

                        {/* LIVE DIAGNOSTIC TOOL */}
                        <div className="mb-6 p-4 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-900">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold text-sm">Connection Tester</h4>
                                <button 
                                    onClick={runDiagnostics}
                                    disabled={isRunningDiag}
                                    className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {isRunningDiag ? 'Testing...' : 'Run Diagnostics'}
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 mb-2">Run this if you are seeing "Failed to process" or "403" errors.</p>
                            
                            {diagResult && (
                                <div className={`p-3 rounded border text-xs font-mono whitespace-pre-wrap overflow-x-auto ${diagResult.success ? 'bg-green-100 border-green-200 text-green-800' : 'bg-red-100 border-red-200 text-red-800'}`}>
                                    <strong>Status:</strong> {diagResult.status === 0 ? 'Network Error' : diagResult.status} {diagResult.success ? '✅' : '❌'}
                                    <br/>
                                    <strong>Message:</strong> {diagResult.message}
                                    {diagResult.details && (
                                        <>
                                            <br/><br/>
                                            <strong>Raw Details:</strong>
                                            <br/>
                                            {JSON.stringify(diagResult.details, null, 2)}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="mb-2 text-xs text-slate-500">
                            <strong>Local Error Logs</strong> (Captures errors that occur during usage)
                        </div>
                        <div className="border border-red-200 dark:border-red-900 rounded-lg overflow-hidden h-[400px] overflow-y-auto bg-slate-50 dark:bg-slate-900">
                                <table className="min-w-full text-xs">
                                    <thead className="bg-red-50 dark:bg-red-900/30 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-medium text-red-800 dark:text-red-200">Time</th>
                                            <th className="px-4 py-2 text-left font-medium text-red-800 dark:text-red-200">Context</th>
                                            <th className="px-4 py-2 text-left font-medium text-red-800 dark:text-red-200">Message</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-red-100 dark:divide-red-900/50 font-mono">
                                        {errorLogs.map(log => (
                                            <tr key={log.id} className="bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20">
                                                <td className="px-4 py-2 whitespace-nowrap text-slate-500 align-top w-32">
                                                    {new Date(log.timestamp).toLocaleString([], { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit'})}
                                                </td>
                                                <td className="px-4 py-2 font-bold text-slate-700 dark:text-slate-300 align-top w-40">{log.context}</td>
                                                <td className="px-4 py-2 align-top">
                                                    <div className="text-red-600 dark:text-red-400 font-semibold">{log.message}</div>
                                                    {log.stack && (
                                                        <details className="mt-1">
                                                            <summary className="text-[10px] text-slate-400 cursor-pointer hover:text-slate-600">Show Stack Trace</summary>
                                                            <pre className="mt-1 p-2 bg-slate-100 dark:bg-slate-900 rounded text-[9px] overflow-x-auto text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                                {log.stack}
                                                            </pre>
                                                        </details>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {errorLogs.length === 0 && (
                                            <tr>
                                                <td colSpan={3} className="px-4 py-8 text-center text-slate-400">No errors recorded.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                        </div>
                    </div>
                )}
                
                {/* DATA & EXPORT TAB */}
                {activeTab === 'data' && (
                    <div className="space-y-6">
                        <h3 className="text-lg font-bold mb-4">Data Management</h3>
                        
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <div>
                                <p className="font-bold">Download All Notes</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Export all notes as individual Markdown (.md) files in a ZIP archive.</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleBulkDownload}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm shadow-sm transition-colors"
                            >
                                Download .ZIP
                            </button>
                        </div>
                    </div>
                )}

                {/* PERSONALIZATION TAB */}
                {activeTab === 'appearance' && (
                    <div className="space-y-6">
                        <h3 className="text-lg font-bold mb-4">Appearance & Media</h3>
                        
                        {/* Dark Mode Toggle */}
                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${darkMode ? 'bg-primary-900 text-primary-300' : 'bg-orange-100 text-orange-600'}`}>
                                    {darkMode ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                                    )}
                                </div>
                                <div>
                                    <p className="font-bold">Dark Mode</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Switch between light and dark themes</p>
                                </div>
                            </div>
                            <button 
                                type="button"
                                onClick={toggleDarkMode}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${darkMode ? 'bg-primary-600' : 'bg-slate-300'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {/* Theme Selector */}
                        <div className="flex flex-col gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div>
                                <p className="font-bold">Color Theme</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Choose your accent color</p>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                {['default', 'ocean', 'forest', 'sunset', 'rose', 'midnight', 'coffee', 'neon'].map((t) => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setTheme(t as Theme)}
                                        className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-all border ${
                                            theme === t 
                                            ? 'bg-white dark:bg-slate-700 border-primary-500 ring-1 ring-primary-500 text-primary-600 dark:text-primary-300' 
                                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        <span className={`inline-block w-2 h-2 rounded-full mr-2 bg-${t === 'default' ? 'indigo' : t === 'ocean' ? 'sky' : t === 'forest' ? 'emerald' : t === 'sunset' ? 'orange' : t === 'midnight' ? 'indigo' : t === 'coffee' ? 'amber' : t === 'neon' ? 'green' : 'rose'}-500`}></span>
                                        {t === 'default' ? 'Indigo' : t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Animation Toggle */}
                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                             <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m7.8 16.2-2.9 2.9"/><path d="M2 12h4"/><path d="m7.8 7.8-2.9-2.9"/><circle cx="12" cy="12" r="2"/></svg>
                                </div>
                                <div>
                                    <p className="font-bold">Reduced Motion</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Minimize animations</p>
                                </div>
                            </div>
                             <button 
                                type="button"
                                onClick={toggleReducedMotion}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${reducedMotion ? 'bg-primary-600' : 'bg-slate-300'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${reducedMotion ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                         {/* Image Support Toggle */}
                         <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                             <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300">
                                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                </div>
                                <div>
                                    <p className="font-bold">Allow Images</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Enable attaching images to notes (Local Storage)</p>
                                </div>
                            </div>
                             <button 
                                type="button"
                                onClick={toggleEnableImages}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enableImages ? 'bg-primary-600' : 'bg-slate-300'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enableImages ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {/* Link Previews Toggle */}
                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                             <div className="flex items-center gap-3">
                                <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
                                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                </div>
                                <div>
                                    <p className="font-bold">Link Previews</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Show cards for web links (simulated preview)</p>
                                </div>
                            </div>
                             <button 
                                type="button"
                                onClick={toggleShowLinkPreviews}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showLinkPreviews ? 'bg-primary-600' : 'bg-slate-300'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showLinkPreviews ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
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
