

import React, { useState, useRef, useEffect } from 'react';
import { login, requestAccount } from '../services/authService';

interface LoginWidgetProps {
  currentUser: string | null;
  onLogin: (username: string) => void;
  onLogout: () => void;
}

const LoginWidget: React.FC<LoginWidgetProps> = ({ currentUser, onLogin, onLogout }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // State for visibility management
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<number | undefined>(undefined);

  // Clear timeout if mouse enters (keep open)
  const handleMouseEnter = () => {
    if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
    }
    setIsOpen(true);
  };

  // Set timeout to close after 2 seconds when mouse leaves
  const handleMouseLeave = () => {
    timeoutRef.current = window.setTimeout(() => {
        setIsOpen(false);
    }, 2000);
  };

  // Cleanup on unmount
  useEffect(() => {
      return () => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setIsLoading(true);

    if (isRegistering) {
      // Async request account (checks IP)
      const res = await requestAccount(username, password, email);
      if (res.success) {
        setMsg({ type: 'success', text: res.message });
        setIsRegistering(false);
        setPassword('');
        setEmail('');
        // Don't close immediately so they see the success message
      } else {
        setMsg({ type: 'error', text: res.message });
      }
    } else {
      const result = login(username, password);
      if (result.success && result.user) {
        onLogin(username);
        setUsername('');
        setPassword('');
        setEmail('');
        // Close immediately on success
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsOpen(false);
      } else {
        setMsg({ type: 'error', text: result.error || 'Invalid credentials' });
      }
    }
    setIsLoading(false);
  };

  if (currentUser) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Logged in as <span className="text-primary-600 dark:text-primary-400 font-bold">{currentUser}</span>
        </div>
        <button 
          onClick={onLogout}
          className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:underline"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <div 
        className="relative z-50"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
    >
      {/* Trigger Button */}
      <button className={`flex items-center gap-1 text-sm font-medium transition-colors ${isOpen ? 'text-primary-600 dark:text-primary-400' : 'text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400'}`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        <span>Login</span>
      </button>

      {/* Dropdown Form */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-100 dark:border-slate-700 p-4 animate-[fadeIn_0.2s_ease-out]">
            <div className="absolute -top-2 right-4 w-4 h-4 bg-white dark:bg-slate-800 border-t border-l border-slate-100 dark:border-slate-700 transform rotate-45"></div>
            
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 border-b dark:border-slate-700 pb-2">
            {isRegistering ? 'Request Access' : 'Login'}
            </h3>
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="text-sm px-2 py-1.5 border dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 outline-none dark:bg-slate-700 dark:text-white"
                required
                disabled={isLoading}
            />
            {isRegistering && (
                <input
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="text-sm px-2 py-1.5 border dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 outline-none dark:bg-slate-700 dark:text-white"
                    required
                    disabled={isLoading}
                />
            )}
            <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="text-sm px-2 py-1.5 border dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 outline-none dark:bg-slate-700 dark:text-white"
                required
                disabled={isLoading}
            />
            
            {msg && (
                <div className={`text-xs p-1 rounded ${msg.type === 'error' ? 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-300' : 'text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-300'}`}>
                {msg.text}
                </div>
            )}

            <button 
                type="submit" 
                disabled={isLoading}
                className={`mt-1 bg-primary-600 text-white text-xs font-bold py-2 rounded hover:bg-primary-700 transition flex justify-center ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
                {isLoading ? (
                     <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                    isRegistering ? 'Send Request' : 'Log In'
                )}
            </button>
            </form>

            <div className="mt-3 text-center border-t dark:border-slate-700 pt-2">
            <button 
                type="button"
                onClick={() => { setIsRegistering(!isRegistering); setMsg(null); }}
                className="text-xs text-slate-400 hover:text-primary-500 underline"
            >
                {isRegistering ? 'Back to Login' : 'Request Account'}
            </button>
            </div>
            
            <style>{`
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-5px); }
                to { opacity: 1; transform: translateY(0); }
            }
            `}</style>
        </div>
      )}
    </div>
  );
};

export default LoginWidget;