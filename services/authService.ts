

export type Permission = 'read' | 'edit';
export type UserStatus = 'active' | 'suspended';

export interface User {
  username: string;
  email?: string;
  passwordHash: string; // Simulated hash
  permission: Permission;
  status: UserStatus;
  parentUser?: string; // If set, this user shares the parent's workspace
  ipAddress?: string;
  country?: string;
  countryFlag?: string;
  lastLogin?: number;
}

export interface AccountRequest {
  username: string;
  email?: string;
  passwordHash: string;
  timestamp: number;
  ipAddress?: string;
  country?: string;
  countryFlag?: string;
}

export interface AuditLogEntry {
    id: string;
    timestamp: number;
    action: string;
    actor: string;
    target?: string;
    details?: string;
}

const USERS_KEY = 'ideaweaver_users';
const REQUESTS_KEY = 'ideaweaver_account_requests';
const AUDIT_LOG_KEY = 'ideaweaver_audit_logs';
const SESSION_TIMEOUT_KEY = 'ideaweaver_session_timeout'; // in minutes

// Hardcoded Admin Credentials
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'Zaqxsw12!gobeavers';
const MAX_ACCOUNTS_PER_IP = 4;

export const isAdmin = (username: string | null) => username === ADMIN_USER;

// Helper to log security events
const logAudit = (action: string, actor: string, target?: string, details?: string) => {
    try {
        const logsStr = localStorage.getItem(AUDIT_LOG_KEY);
        const logs: AuditLogEntry[] = logsStr ? JSON.parse(logsStr) : [];
        
        const newEntry: AuditLogEntry = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            action,
            actor,
            target,
            details
        };

        // Keep last 100 logs
        const updatedLogs = [newEntry, ...logs].slice(0, 100);
        localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(updatedLogs));
    } catch (e) {
        console.error("Audit Log Error", e);
    }
};

export const getAuditLogs = (): AuditLogEntry[] => {
    const logsStr = localStorage.getItem(AUDIT_LOG_KEY);
    return logsStr ? JSON.parse(logsStr) : [];
};

export const clearAuditLogs = () => {
    localStorage.removeItem(AUDIT_LOG_KEY);
    logAudit('CLEAR_LOGS', ADMIN_USER, 'System', 'Audit logs cleared');
};

// Helper to fetch IP and Location
const fetchClientInfo = async (): Promise<{ ip: string; country: string; flag: string }> => {
    try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        if (data.error) throw new Error("API Error");
        return {
            ip: data.ip || 'Unknown',
            country: data.country_name || 'Unknown',
            flag: getFlagEmoji(data.country_code) || '🌐'
        };
    } catch (e) {
        return { ip: 'Unknown', country: 'Unknown', flag: '🌐' };
    }
};

// Convert Country Code to Emoji
const getFlagEmoji = (countryCode: string) => {
  if(!countryCode) return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char =>  127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

/**
 * Returns the login result object
 */
export const login = (username: string, password: string): { success: boolean; user?: User; error?: string } => {
  // 1. Check Admin
  if (username === ADMIN_USER) {
      if (password === ADMIN_PASS) {
        logAudit('LOGIN_SUCCESS', ADMIN_USER, ADMIN_USER, 'Admin login');
        return { 
            success: true, 
            user: { 
                username: ADMIN_USER, 
                email: 'admin@weavenote.ai',
                passwordHash: ADMIN_PASS, 
                permission: 'edit',
                status: 'active',
                lastLogin: Date.now()
            } 
        };
      } else {
          logAudit('LOGIN_FAIL', 'Unknown', ADMIN_USER, 'Invalid admin password attempt');
          return { success: false, error: 'Invalid credentials' };
      }
  }

  // 2. Check Local Users
  try {
    const usersStr = localStorage.getItem(USERS_KEY);
    let users: User[] = usersStr ? JSON.parse(usersStr) : [];
    const userIndex = users.findIndex(u => u.username === username);
    const user = users[userIndex];

    if (!user) {
        return { success: false, error: 'User not found' };
    }

    if (user.passwordHash !== password) {
        logAudit('LOGIN_FAIL', 'Unknown', username, 'Invalid password');
        return { success: false, error: 'Invalid credentials' };
    }

    if (user.status === 'suspended') {
        logAudit('LOGIN_BLOCK', username, username, 'Suspended user attempted login');
        return { success: false, error: 'Account Suspended. Contact Admin.' };
    }

    // Update lastLogin
    users[userIndex] = { ...user, lastLogin: Date.now() };
    localStorage.setItem(USERS_KEY, JSON.stringify(users));

    logAudit('LOGIN_SUCCESS', username, username, 'User login');
    return { success: true, user: users[userIndex] };

  } catch (e) {
    return { success: false, error: 'System error' };
  }
};

/**
 * Submit a request for a new account.
 * Async because it checks IP info.
 */
export const requestAccount = async (username: string, password: string, email: string): Promise<{ success: boolean; message: string }> => {
  if (!username || !password) return { success: false, message: 'Missing fields' };
  if (username === ADMIN_USER) return { success: false, message: 'Username taken' };

  try {
    // Check existing users
    const usersStr = localStorage.getItem(USERS_KEY);
    const users: User[] = usersStr ? JSON.parse(usersStr) : [];
    if (users.find(u => u.username === username)) {
      return { success: false, message: 'Username already exists' };
    }

    // Check existing requests
    const reqStr = localStorage.getItem(REQUESTS_KEY);
    const requests: AccountRequest[] = reqStr ? JSON.parse(reqStr) : [];
    if (requests.find(r => r.username === username)) {
        return { success: false, message: 'A request for this username is already pending.' };
    }

    // IP Check
    const clientInfo = await fetchClientInfo();
    
    // Count accounts from this IP (Active + Pending)
    const activeCount = users.filter(u => u.ipAddress === clientInfo.ip).length;
    const pendingCount = requests.filter(r => r.ipAddress === clientInfo.ip).length;
    const totalCount = activeCount + pendingCount;

    if (totalCount >= MAX_ACCOUNTS_PER_IP && clientInfo.ip !== 'Unknown') {
        logAudit('REGISTRATION_BLOCK', 'System', username, `Blocked IP ${clientInfo.ip} (Count: ${totalCount})`);
        return { success: false, message: `Registration blocked. Too many accounts from IP: ${clientInfo.ip}` };
    }

    const newRequest: AccountRequest = {
        username,
        email,
        passwordHash: password,
        timestamp: Date.now(),
        ipAddress: clientInfo.ip,
        country: clientInfo.country,
        countryFlag: clientInfo.flag
    };

    requests.push(newRequest);
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
    
    return { success: true, message: 'Request sent to Admin for approval.' };
  } catch (e) {
    console.error(e);
    return { success: false, message: 'Storage error' };
  }
};

/**
 * Admin function to create a user (Directly, or approves a request)
 */
export const createUser = (
    username: string, 
    password: string, 
    permission: Permission, 
    parentUser?: string,
    ipAddress?: string,
    country?: string,
    countryFlag?: string,
    email?: string
): { success: boolean; message: string } => {
  if (!username || !password) return { success: false, message: 'Missing fields' };
  
  try {
    const usersStr = localStorage.getItem(USERS_KEY);
    const users: User[] = usersStr ? JSON.parse(usersStr) : [];

    if (users.find(u => u.username === username)) {
      return { success: false, message: 'Username already exists' };
    }

    const newUser: User = { 
        username, 
        email,
        passwordHash: password,
        permission,
        status: 'active',
        parentUser,
        ipAddress,
        country,
        countryFlag
    };
    
    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    logAudit('USER_CREATED', parentUser || ADMIN_USER, username, `Role: ${permission}`);
    
    return { success: true, message: 'User created successfully' };
  } catch (e) {
    return { success: false, message: 'Storage error' };
  }
};

export const getRequests = (): AccountRequest[] => {
    try {
        const reqStr = localStorage.getItem(REQUESTS_KEY);
        return reqStr ? JSON.parse(reqStr) : [];
    } catch (e) {
        return [];
    }
};

export const approveRequest = (username: string): boolean => {
    const requests = getRequests();
    const req = requests.find(r => r.username === username);
    if (!req) return false;

    // Pass IP info and Email to the created user
    const result = createUser(
        req.username, 
        req.passwordHash, 
        'edit', 
        undefined, 
        req.ipAddress, 
        req.country,
        req.countryFlag,
        req.email
    );

    if (result.success) {
        const newRequests = requests.filter(r => r.username !== username);
        localStorage.setItem(REQUESTS_KEY, JSON.stringify(newRequests));
        logAudit('REQUEST_APPROVED', ADMIN_USER, username);
        return true;
    }
    return false;
};

export const denyRequest = (username: string) => {
    const requests = getRequests();
    const newRequests = requests.filter(r => r.username !== username);
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(newRequests));
    logAudit('REQUEST_DENIED', ADMIN_USER, username);
};

export const getUsers = (): User[] => {
    try {
        const usersStr = localStorage.getItem(USERS_KEY);
        // Migration support: ensure all users have a status
        const users: User[] = usersStr ? JSON.parse(usersStr) : [];
        return users.map(u => ({ ...u, status: u.status || 'active' }));
    } catch (e) {
        return [];
    }
};

export const deleteUser = (username: string) => {
    try {
        const usersStr = localStorage.getItem(USERS_KEY);
        if (!usersStr) return;
        let users: User[] = JSON.parse(usersStr);
        users = users.filter(u => u.username !== username);
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        logAudit('USER_DELETED', ADMIN_USER, username);
    } catch (e) {
        console.error(e);
    }
};

export const updateUserPermission = (username: string, permission: Permission) => {
    try {
        const usersStr = localStorage.getItem(USERS_KEY);
        if (!usersStr) return;
        let users: User[] = JSON.parse(usersStr);
        users = users.map(u => u.username === username ? { ...u, permission } : u);
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        logAudit('PERM_UPDATED', ADMIN_USER, username, `New perm: ${permission}`);
    } catch (e) {
        console.error(e);
    }
};

export const toggleUserStatus = (username: string) => {
    try {
        const usersStr = localStorage.getItem(USERS_KEY);
        if (!usersStr) return;
        let users: User[] = JSON.parse(usersStr);
        
        const targetUser = users.find(u => u.username === username);
        if (!targetUser) return;
        
        const newStatus: UserStatus = targetUser.status === 'active' ? 'suspended' : 'active';
        
        users = users.map(u => u.username === username ? { ...u, status: newStatus } : u);
        
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        logAudit(newStatus === 'suspended' ? 'USER_SUSPENDED' : 'USER_ACTIVATED', ADMIN_USER, username);
    } catch (e) {
        console.error(e);
    }
};

export const adminResetPassword = (username: string, newPass: string) => {
    try {
        const usersStr = localStorage.getItem(USERS_KEY);
        if (!usersStr) return;
        let users: User[] = JSON.parse(usersStr);
        users = users.map(u => u.username === username ? { ...u, passwordHash: newPass } : u);
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        logAudit('PASSWORD_RESET', ADMIN_USER, username);
    } catch (e) {
        console.error(e);
    }
};

export const getSessionTimeout = (): number => {
    const val = localStorage.getItem(SESSION_TIMEOUT_KEY);
    return val ? parseInt(val, 10) : 30; // Default 30 mins
};

export const setSessionTimeout = (minutes: number) => {
    localStorage.setItem(SESSION_TIMEOUT_KEY, minutes.toString());
    logAudit('POLICY_CHANGE', ADMIN_USER, 'System', `Session timeout set to ${minutes}m`);
};