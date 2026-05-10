import { auth, db, isFirebaseReady } from './firebase';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    sendPasswordResetEmail,
    updatePassword,
    User as FirebaseUser
} from 'firebase/auth';
import { 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    collection, 
    query, 
    where, 
    getDocs,
    deleteDoc,
    limit,
    orderBy,
    increment
} from 'firebase/firestore';
import { User, Permission, UserStatus, UserRole } from '../types';
import { DiagnosticLog } from './geminiService';

export interface AuditLogEntry {
    id: string;
    timestamp: number;
    action: string;
    actor: string;
    target?: string | null;
    details?: string | null;
}

export interface SystemLogEntry {
    id: string;
    timestamp: number;
    message: string;
    level: 'info' | 'warn' | 'error' | 'security';
}

const LOCAL_AUDIT_KEY = 'ideaweaver_audit_logs';
const SYSTEM_LOG_KEY = 'ideaweaver_system_checkpoints';

export const logSystemCheckpoint = (message: string, level: SystemLogEntry['level'] = 'info') => {
    try {
        const logsStr = localStorage.getItem(SYSTEM_LOG_KEY);
        const logs: SystemLogEntry[] = logsStr ? JSON.parse(logsStr) : [];
        logs.unshift({ id: crypto.randomUUID(), timestamp: Date.now(), message, level });
        localStorage.setItem(SYSTEM_LOG_KEY, JSON.stringify(logs.slice(0, 100)));
        window.dispatchEvent(new CustomEvent('weavenote_system_log', { detail: message }));
    } catch (e) {}
};

export const getSystemLogs = (): SystemLogEntry[] => {
    try {
        return JSON.parse(localStorage.getItem(SYSTEM_LOG_KEY) || '[]');
    } catch { return []; }
};

const fetchClientInfo = async (): Promise<{ ip: string; country: string; flag: string }> => {
    try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        const info = {
            ip: data.ip || 'Unknown',
            country: data.country_name || 'Unknown',
            flag: data.country_code ? `https://flagcdn.com/16x12/${data.country_code.toLowerCase()}.png` : '🌐'
        };
        localStorage.setItem('weavenote_last_ip', info.ip);
        return info;
    } catch (e) {
        return { ip: 'Unknown', country: 'Unknown', flag: '🌐' };
    }
};

export const isGlobalAdmin = (user: User | null): boolean => user?.role === 'super-admin';
export const isAdmin = (user: User | null): boolean => user?.role === 'admin' || user?.role === 'super-admin';

export const logAudit = async (action: string, actor: string, target?: string, details?: string) => {
    const entry: AuditLogEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        action,
        actor,
        target: target || null,
        details: details || null
    };

    if (db) {
        try {
            setDoc(doc(collection(db, 'audit_logs'), entry.id), entry).catch(() => {});
        } catch (e) {}
    }
    
    try {
        const logsStr = localStorage.getItem(LOCAL_AUDIT_KEY);
        const logs = logsStr ? JSON.parse(logsStr) : [];
        logs.unshift(entry);
        localStorage.setItem(LOCAL_AUDIT_KEY, JSON.stringify(logs.slice(0, 100)));
    } catch (err) {}
};

export const subscribeToAuthChanges = (callback: (user: User | null) => void) => {
    if (!auth || !db) {
        setTimeout(() => callback(null), 0);
        return () => {};
    }
    return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
            logSystemCheckpoint(`[AUTH_CHECKPOINT_FIREBASE_UID] Currently Authenticated UID: ${firebaseUser.uid}`, 'security');
            try {
                const userDocRef = doc(db!, 'users', firebaseUser.uid);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                    const userData = userDoc.data() as User;
                    const now = Date.now();

                    // Check for permanent ban
                    if (userData.status === 'banned') {
                        await signOut(auth!);
                        callback(null);
                        return;
                    }

                    // Check for timed suspension
                    if (userData.status === 'suspended' && userData.statusUntil && now < userData.statusUntil) {
                        await signOut(auth!);
                        callback(null);
                        return;
                    } else if (userData.status === 'suspended' && userData.statusUntil && now >= userData.statusUntil) {
                        // Auto-reactivate if suspension expired
                        await updateDoc(userDocRef, { status: 'active', statusUntil: null });
                        userData.status = 'active';
                        userData.statusUntil = undefined;
                    }

                    updateDoc(userDocRef, { lastLogin: now }).catch(() => {});
                    callback(userData);
                } else {
                    callback({
                        uid: firebaseUser.uid,
                        username: firebaseUser.email?.split('@')[0] || 'Unknown',
                        email: firebaseUser.email || '',
                        permission: 'edit',
                        status: 'active',
                        role: firebaseUser.email === 'system-bootstrap@weavenote.com' ? 'super-admin' : 'user',
                        lastLogin: Date.now(),
                        aiUsageCount: 0
                    });
                }
            } catch (e) {
                logSystemCheckpoint("[AUTH_CHECKPOINT_RESTORE] Firestore blocked profile sync. Using Auth fallback.", "warn");
                callback({
                    uid: firebaseUser.uid,
                    username: firebaseUser.email?.split('@')[0] || 'Unknown',
                    email: firebaseUser.email || '',
                    permission: 'edit',
                    status: 'active',
                    role: 'user',
                    lastLogin: Date.now(),
                    aiUsageCount: 0
                });
            }
        } else {
            callback(null);
        }
    });
};

export const login = async (usernameOrEmail: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
    logSystemCheckpoint("[AUTH_CHECKPOINT_1] Initializing Login Sequence...", "security");
    if (!isFirebaseReady || !auth || !db) return { success: false, error: "Database infrastructure unreachable." };

    try {
        let email = usernameOrEmail.trim();
        
        // Admin Bootstrap Override
        if (usernameOrEmail === 'admin' && process.env.ADMIN_SETUP_PASS && password === process.env.ADMIN_SETUP_PASS) {
            email = 'system-bootstrap@weavenote.com';
            try {
                const cred = await signInWithEmailAndPassword(auth, email, password);
                const docSnap = await getDoc(doc(db, 'users', cred.user.uid)).catch(() => null);
                const info = await fetchClientInfo();
                const userData: User = (docSnap && docSnap.exists()) ? (docSnap.data() as User) : {
                    uid: cred.user.uid, username: 'SystemAdmin', email, permission: 'edit',
                    status: 'active', role: 'super-admin', lastLogin: Date.now(),
                    ipAddress: info.ip, country: info.country, countryFlag: info.flag, aiUsageCount: 0
                };
                if (!docSnap || !docSnap.exists()) await setDoc(doc(db, 'users', cred.user.uid), userData).catch(console.warn);
                return { success: true, user: userData };
            } catch (authError: any) {
                if (authError.code === 'auth/user-not-found' || authError.code === 'auth/invalid-credential') {
                    const newCred = await createUserWithEmailAndPassword(auth, email, password);
                    const info = await fetchClientInfo();
                    const adminUser: User = {
                        uid: newCred.user.uid, username: 'SystemAdmin', email, permission: 'edit',
                        status: 'active', role: 'super-admin', lastLogin: Date.now(),
                        ipAddress: info.ip, country: info.country, countryFlag: info.flag, aiUsageCount: 0
                    };
                    await setDoc(doc(db, 'users', newCred.user.uid), adminUser).catch(console.warn);
                    return { success: true, user: adminUser };
                }
                throw authError;
            }
        }

        // Username to Email lookup
        if (!email.includes('@')) {
            try {
                const q = query(collection(db, 'users'), where('username', '==', email), limit(1));
                const snapshot = await getDocs(q);
                if (snapshot.empty) return { success: false, error: `Identity handle "${email}" not found.` };
                email = snapshot.docs[0].data().email;
            } catch (e: any) {
                if (e.code === 'permission-denied') return { success: false, error: "Username lookup blocked. Update Cloud Rules." };
                return { success: false, error: "Identity resolution failed." };
            }
        }

        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        let userData: User | null = null;
        try {
            const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
            if (userDoc.exists()) userData = userDoc.data() as User;
        } catch (pError: any) {
            logSystemCheckpoint("[AUTH_CHECKPOINT_READ_FAIL] Firestore blocked profile read.", "error");
        }
        
        const info = await fetchClientInfo();
        if (!userData) {
            userData = {
                uid: userCredential.user.uid, username: email.split('@')[0], email, 
                permission: 'edit', status: 'active', role: 'user', lastLogin: Date.now(),
                aiUsageCount: 0, ...info
            };
            await setDoc(doc(db, 'users', userCredential.user.uid), userData);
        } else {
            const now = Date.now();
            if (userData.status === 'banned') {
                await signOut(auth);
                return { success: false, error: "Access revoked by system administrator." };
            }
            if (userData.status === 'suspended' && userData.statusUntil && now < userData.statusUntil) {
                await signOut(auth);
                const hoursLeft = Math.ceil((userData.statusUntil - now) / 3600000);
                return { success: false, error: `Account suspended. Access returns in approx ${hoursLeft}h.` };
            }
            updateDoc(doc(db, 'users', userCredential.user.uid), { lastLogin: now, ...info }).catch(() => {});
        }

        logAudit('LOGIN_SUCCESS', userData.username).catch(() => {});
        return { success: true, user: { ...userData, ...info, lastLogin: Date.now() } };
    } catch (e: any) {
        if (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found') {
            return { success: false, error: "Invalid security token or unknown account." };
        }
        return { success: false, error: "Identity verification failed." };
    }
};

export const checkDatabaseConnection = async (): Promise<{ success: boolean; latency: number; message: string; logs: DiagnosticLog[] }> => {
    const logs: DiagnosticLog[] = [];
    const addLog = (message: string, type: DiagnosticLog['type'] = 'info') => logs.push({ timestamp: Date.now(), message, type });

    addLog("Initializing Firestore Handshake...");
    if (!isFirebaseReady || !db) {
        addLog("CRITICAL: Firebase App is NOT initialized. Check config.ts.", "error");
        return { success: false, latency: 0, message: "Cloud Unconfigured", logs };
    }

    const start = Date.now();
    try {
        addLog(`Targeting Firestore DB Project...`);
        if (auth?.currentUser) {
            addLog(`Authenticated Context Found (UID: ${auth.currentUser.uid.substring(0, 5)}...)`);
            await getDoc(doc(db, 'users', auth.currentUser.uid));
        } else {
            addLog(`Anonymous Context. Testing public read...`);
            await getDocs(query(collection(db, 'users'), limit(1)));
        }
        const latency = Date.now() - start;
        addLog(`Handshake Successful (${latency}ms)`, "success");
        return { success: true, latency, message: "Connected", logs };
    } catch (e: any) {
        const latency = Date.now() - start;
        if (e.code === 'permission-denied') {
            addLog("PERMISSION DENIED: Firebase Rules blocked the read request.", "warn");
            return { success: true, latency, message: "Operational (Secured)", logs };
        }
        addLog(`CRITICAL ERROR: ${e.code || 'UNKNOWN'} - ${e.message}`, "error");
        return { success: false, latency: 0, message: "Connectivity Failure", logs };
    }
};

export const logout = async () => { if (auth) await signOut(auth); };

export const getUsers = async (): Promise<User[]> => {
    if (!db) return [];
    try {
        const snapshot = await getDocs(collection(db, 'users'));
        return snapshot.docs.map(d => d.data() as User);
    } catch { return []; }
};

export const setAccountStatus = async (uid: string, status: UserStatus, durationHours: number = 0) => {
    if (!db) return;
    const update: any = { status };
    if (status === 'suspended' && durationHours > 0) {
        update.statusUntil = Date.now() + (durationHours * 60 * 60 * 1000);
    } else {
        update.statusUntil = null;
    }
    await updateDoc(doc(db, 'users', uid), update);
};

export const updateUserRole = async (uid: string, role: UserRole) => {
    if (!db) return;
    await updateDoc(doc(db, 'users', uid), { role });
};

export const updateUserPassword = async (newPassword: string): Promise<{ success: boolean; message: string }> => {
    if (!auth?.currentUser) return { success: false, message: "User session expired." };
    try {
        await updatePassword(auth.currentUser, newPassword);
        return { success: true, message: "Security token updated successfully." };
    } catch (e: any) {
        if (e.code === 'auth/requires-recent-login') return { success: false, message: "Critical: Re-login required." };
        return { success: false, message: `Update failed: ${e.message}` };
    }
};

export const adminTriggerReset = async (email: string): Promise<{ success: boolean; message: string }> => {
    if (!auth) return { success: false, message: "Auth service offline." };
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true, message: `Recovery link dispatched.` };
    } catch (e: any) {
        return { success: false, message: `Failed: ${e.message}` };
    }
};

export const testWriteCapability = async (): Promise<{ success: boolean; message: string }> => {
    if (!db || !auth?.currentUser) return { success: false, message: "Cloud Unconfigured or Not Authenticated" };
    try {
        const testDoc = doc(db, 'system_test', auth.currentUser.uid);
        await setDoc(testDoc, { timestamp: Date.now(), uid: auth.currentUser.uid, test: "Security Rule Validation" });
        return { success: true, message: "Write operation successful. Permissions verified." };
    } catch (e: any) {
        return { success: false, message: `Write operation failed: ${e.message}` };
    }
};

export const requestAccount = async (username: string, password: string, email: string): Promise<{ success: boolean; message: string }> => {
    if (!isFirebaseReady || !auth || !db) return { success: false, message: "Service offline." };
    try {
        const info = await fetchClientInfo();
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const newUser: User = {
            uid: cred.user.uid, username, email, permission: 'edit', status: 'active', role: 'user',
            ipAddress: info.ip, country: info.country, countryFlag: info.flag, lastLogin: Date.now(), aiUsageCount: 0
        };
        await setDoc(doc(db, 'users', cred.user.uid), newUser);
        return { success: true, message: "Identity created." };
    } catch (e: any) {
        return { success: false, message: `Setup failed: ${e.message}` };
    }
};

export const sendResetLink = async (email: string): Promise<{ success: boolean; message: string }> => {
    if (!isFirebaseReady || !auth) return { success: false, message: "System initializing." };
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true, message: "Recovery link dispatched. Check your inbox." };
    } catch (e: any) {
        return { success: false, message: "Reset failed. Verify your email format." };
    }
};

export const incrementUserAIUsage = async (uid: string) => {
    if (!db) return;
    try {
        const userDocRef = doc(db, 'users', uid);
        await updateDoc(userDocRef, { aiUsageCount: increment(1) });
    } catch (e) {}
};