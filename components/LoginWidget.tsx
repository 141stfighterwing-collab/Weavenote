
import React, { useState, useRef, useEffect } from 'react';
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
  const timeoutRef = useRef<number>();

  const handleMouseEnter = () => {
    clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = window.setTimeout(() => setIsOpen(false), 800);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMsg(null);

    try {
        if (isRegistering) {
            // Registration
            const res = await requestAccount(username, password, emailOrUsername);
            if (res.success) {
                setMsg({ type: 'success', text: res.message });
                setIsRegistering(false);
            } else {
                setMsg({ type: 'error', text: res.message });
            }
        } else {
            // Login
            const res = await login(emailOrUsername, password);
            if (res.success && res.user) {
                onLoginSuccess(res.user);
                setIsOpen(false);
            } else {
                setMsg({ type: 'error', text: res.error || 'Login failed' });
            }
        }
    } catch (e: any) {
        setMsg({ type: 'error', text: e.message });
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
              <button onClick={handleLogoutClick} className="text-xs text-red-500 hover:underline">Logout</button>
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
                    {isRegistering ? 'Create Account' : 'Sign In'}
                </h3>
                
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    <input 
                        type="text" 
                        placeholder={isRegistering ? "Email" : "Email or 'admin'"} 
                        value={emailOrUsername}
                        onChange={e => setEmailOrUsername(e.target.value)}
                        className="px-3 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:text-white"
                        required
                    />
                    {isRegistering && (
                        <input 
                            type="text" 
                            placeholder="Username" 
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            className="px-3 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:text-white"
                            required
                        />
                    )}
                    <input 
                        type="password" 
                        placeholder="Password" 
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="px-3 py-2 border rounded-lg text-sm dark:bg-slate-700 dark:text-white"
                        required
                    />
                    
                    {msg && (
                        <div className={`text-xs p-2 rounded ${msg.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                            {msg.text}
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="bg-primary-600 text-white font-bold py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                        {isLoading ? 'Processing...' : (isRegistering ? 'Request Access' : 'Login')}
                    </button>
                </form>

                <div className="mt-4 text-center text-xs">
                    <button onClick={() => { setIsRegistering(!isRegistering); setMsg(null); }} className="text-slate-500 hover:text-primary-600 underline">
                        {isRegistering ? 'Already have an account?' : 'Need an account?'}
                    </button>
                </div>
            </div>
        )}
    </div>
  );
};

export default LoginWidget;
