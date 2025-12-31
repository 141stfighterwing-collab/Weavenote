
import React, { useState, useRef } from 'react';
import { login, requestAccount, logout } from '../services/authService';
import { User } from '../types';

interface LoginWidgetProps {
  currentUser: string | null;
  onLoginSuccess: (user: User) => void;
  onLogout: () => void;
}

const LoginWidget: React.FC<LoginWidgetProps> = ({ currentUser, onLoginSuccess, onLogout }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<number | undefined>(undefined);

  const handleMouseEnter = () => {
    clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = window.setTimeout(() => setIsOpen(false), 800);
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setMsg(null);
    setEmailOrUsername('');
    setUsername('');
    setPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMsg(null);

    try {
        if (isRegistering) {
            if (!emailOrUsername.includes('@')) {
                setMsg({ type: 'error', text: "Invalid email format." });
                setIsLoading(false);
                return;
            }
            const res = await requestAccount(username, password, emailOrUsername);
            if (res.success) {
                setMsg({ type: 'success', text: res.message });
                setEmailOrUsername('');
                setUsername('');
                setPassword('');
            } else {
                setMsg({ type: 'error', text: res.message });
            }
        } else {
            const res = await login(emailOrUsername, password);
            if (res.success && res.user) {
                onLoginSuccess(res.user);
                setIsOpen(false);
            } else {
                setMsg({ type: 'error', text: res.error || 'Identity verification failed.' });
            }
        }
    } catch (e: any) {
        setMsg({ type: 'error', text: "System error during authentication." });
    } finally {
        setIsLoading(false);
    }
  };

  const handleLogoutClick = async () => {
      await logout();
      onLogout();
  };

  if (currentUser) {
      return (
          <div className="flex flex-col items-end">
              <span className="text-xs text-slate-500 font-bold">{currentUser}</span>
              <button onClick={handleLogoutClick} className="text-xs text-rose-500 hover:underline">Sign Out</button>
          </div>
      );
  }

  return (
    <div className="relative z-50" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        <button className="text-sm font-bold text-slate-600 hover:text-primary-600 flex items-center gap-1">
            <span>🔐 Login</span>
        </button>

        {isOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 p-5">
                <h3 className="font-bold text-slate-800 dark:text-white mb-4 border-b pb-2">
                    {isRegistering ? 'Identity Setup' : 'Verify Identity'}
                </h3>
                
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    <input 
                        type={isRegistering ? "email" : "text"} 
                        placeholder={isRegistering ? "Email Address" : "Email or Handle"} 
                        value={emailOrUsername}
                        onChange={e => setEmailOrUsername(e.target.value)}
                        className="px-3 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                        required
                    />
                    {isRegistering && (
                        <input 
                            type="text" 
                            placeholder="Public Handle" 
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            className="px-3 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                            required
                        />
                    )}
                    <input 
                        type="password" 
                        placeholder="Security Token" 
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="px-3 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                        required
                    />
                    
                    {msg && (
                        <div className={`text-[10px] p-2 rounded leading-tight font-bold ${msg.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                            {msg.text}
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="bg-primary-600 text-white font-bold py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-sm text-xs uppercase tracking-widest"
                    >
                        {isLoading ? 'Verifying...' : (isRegistering ? 'Submit Request' : 'Proceed')}
                    </button>
                </form>

                <div className="mt-4 text-center">
                    <button onClick={toggleMode} className="text-[10px] text-slate-500 hover:text-primary-600 underline uppercase tracking-tighter">
                        {isRegistering ? 'Existing Identity? Sign In' : 'New User? Request Credentials'}
                    </button>
                </div>
            </div>
        )}
    </div>
  );
};

export default LoginWidget;
