
import { auth, db, isFirebaseReady } from './firebase';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged
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

export interface AuditLogEntry {
    id: string;
    timestamp: number;
    action: string;
    actor: string;
    target?: string | null;
    details?: string | null;
}

const LOCAL_AUDIT_KEY = 'ideaweaver_audit_logs';

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

/**
 * RBAC HELPERS
 * Decoupled from hardcoded usernames. Verified via DB claims.
 */
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
            await setDoc(doc(collection(db, 'audit_logs'), entry.id), entry);
        } catch (e) {
            console.error("Failed to log audit to DB", e);
        }
    } else {
        const logsStr = localStorage.getItem(LOCAL_AUDIT_KEY);
        const logs = logsStr ? JSON.parse(logsStr) : [];
        logs.unshift(entry);
        localStorage.setItem(LOCAL_AUDIT_KEY, JSON.stringify(logs.slice(0, 100)));
    }
};

export const subscribeToAuthChanges = (callback: (user: User | null) => void) => {
    if (!auth || !db) {
        callback(null);
        return () => {};
    }

    return onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            try {
                const userDocRef = doc(db, 'users', firebaseUser.uid);
                const userDoc = await getDoc(userDocRef);
                
                if (userDoc.exists()) {
                    const userData = userDoc.data() as User;
                    if (userData.status === 'suspended') {
                        await signOut(auth);
                        callback(null);
                    } else {
                        updateDoc(userDocRef, { lastLogin: Date.now() }).catch(() => {});
                        callback(userData);
                    }
                } else {
                    await signOut(auth);
                    callback(null);
                }
            } catch (e) {
                callback(null);
            }
        } else {
            callback(null);
        }
    });
};

export const checkDatabaseConnection = async (): Promise<{ success: boolean; latency: number; message: string }> => {
    if (!isFirebaseReady || !db) return { success: false, latency: 0, message: "Unconfigured" };
    const start = Date.now();
    try {
        await getDocs(query(collection(db, 'users'), limit(1)));
        return { success: true, latency: Date.now() - start, message: "Connected" };
    } catch (e: any) {
        return { success: false, latency: 0, message: e.message || "Failed" };
    }
};

export const login = async (usernameOrEmail: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
    if (!isFirebaseReady || !auth || !db) return { success: false, error: "System init failure." };

    try {
        let email = usernameOrEmail;
        const bootstrapPass = process.env.ADMIN_SETUP_PASS;

        // Secure System Bootstrap
        if (usernameOrEmail === 'admin' && bootstrapPass && password === bootstrapPass) {
            email = 'system-bootstrap@weavenote.com'; 
            try {
                const cred = await signInWithEmailAndPassword(auth, email, password);
                const docSnap = await getDoc(doc(db, 'users', cred.user.uid));
                if (docSnap.exists()) return { success: true, user: docSnap.data() as User };
            } catch (authError: any) {
                if (authError.code === 'auth/user-not-found' || authError.code === 'auth/invalid-credential') {
                    const newCred = await createUserWithEmailAndPassword(auth, email, password);
                    const info = await fetchClientInfo();
                    const adminUser: User = {
                        uid: newCred.user.uid, username: 'SystemAdmin', email, permission: 'edit',
                        status: 'active', role: 'super-admin', lastLogin: Date.now(),
                        ipAddress: info.ip, country: info.country, countryFlag: info.flag, aiUsageCount: 0
                    };
                    await setDoc(doc(db, 'users', newCred.user.uid), adminUser);
                    await logAudit('SYSTEM_BOOTSTRAP', 'BOOTSTRAP', adminUser.uid);
                    return { success: true, user: adminUser };
                }
                throw authError;
            }
        }

        if (!email.includes('@')) {
            const snapshot = await getDocs(query(collection(db, 'users'), where('username', '==', usernameOrEmail)));
            if (snapshot.empty) return { success: false, error: "Identity not found." };
            email = snapshot.docs[0].data().email;
        }

        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));

        if (!userDoc.exists()) {
            await signOut(auth);
            return { success: false, error: "Vault entry missing." };
        }

        const userData = userDoc.data() as User;
        if (userData.status === 'suspended') {
            await signOut(auth);
            return { success: false, error: "Access suspended." };
        }
        if (userData.status === 'pending') {
            await signOut(auth);
            return { success: false, error: "Approval pending." };
        }

        const info = await fetchClientInfo();
        await updateDoc(doc(db, 'users', userCredential.user.uid), { lastLogin: Date.now(), ...info });
        await logAudit('LOGIN_SUCCESS', userData.username);
        return { success: true, user: { ...userData, ...info, lastLogin: Date.now() } };
    } catch (e: any) {
        return { success: false, error: "Verification failed." };
    }
};

export const logout = async () => { if (auth) await signOut(auth); };

export const requestAccount = async (username: string, password: string, email: string): Promise<{ success: boolean; message: string }> => {
    if (!isFirebaseReady || !auth || !db) return { success: false, message: "Sync Error" };
    try {
        const snap = await getDocs(query(collection(db, 'users'), where('username', '==', username)));
        if (!snap.empty) return { success: false, message: "Handle taken." };

        const info = await fetchClientInfo();
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const newUser: User = {
            uid: cred.user.uid, username, email, permission: 'read', status: 'pending', role: 'user',
            ipAddress: info.ip, country: info.country, countryFlag: info.flag, lastLogin: 0, aiUsageCount: 0
        };
        await setDoc(doc(db, 'users', cred.user.uid), newUser);
        await logAudit('REGISTER_REQUEST', username, 'System');
        await signOut(auth);
        return { success: true, message: "Account requested for review." };
    } catch (e: any) {
        return { success: false, message: e.message || "Request failed." };
    }
};

export const getRequests = async (): Promise<User[]> => {
    if (!db) return [];
    const snapshot = await getDocs(query(collection(db, 'users'), where('status', '==', 'pending')));
    return snapshot.docs.map(d => d.data() as User);
};

export const approveRequest = async (uid: string): Promise<boolean> => {
    if (!db) return false;
    await updateDoc(doc(db, 'users', uid), { status: 'active', permission: 'edit' });
    await logAudit('APPROVE_USER', 'Admin', uid);
    return true;
};

export const denyRequest = async (uid: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'users', uid));
    await logAudit('DENY_USER', 'Admin', uid);
};

export const getUsers = async (): Promise<User[]> => {
    if (!db) return [];
    const snapshot = await getDocs(collection(db, 'users'));
    return snapshot.docs.map(d => d.data() as User);
};

export const toggleUserStatus = async (uid: string, currentStatus: UserStatus) => {
    if (!db) return;
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    await updateDoc(doc(db, 'users', uid), { status: newStatus });
    await logAudit('TOGGLE_STATUS', 'Admin', uid, newStatus);
};

export const deleteUserAccount = async (uid: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'users', uid));
    await logAudit('DELETE_USER', 'Admin', uid);
};

/**
 * Super Admin privilege: Update roles
 * Elevating to Admin/Super-Admin automatically grants 'edit' permissions
 */
export const updateUserRole = async (uid: string, role: UserRole, actorUsername: string) => {
    if (!db) return;
    const updates: Partial<User> = { role };
    
    // Ensure admins have write permissions
    if (role === 'admin' || role === 'super-admin') {
        updates.permission = 'edit';
        updates.status = 'active'; // Also ensure they are not suspended
    }
    
    await updateDoc(doc(db, 'users', uid), updates);
    await logAudit('UPDATE_ROLE', actorUsername, uid, `Changed to ${role}`);
};

export const incrementUserAIUsage = async (uid: string) => {
    if (!db) return;
    await updateDoc(doc(db, 'users', uid), { aiUsageCount: increment(1) });
};

export const getAuditLogs = async (): Promise<AuditLogEntry[]> => {
    if (!db) return [];
    try {
        const snapshot = await getDocs(query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(100)));
        return snapshot.docs.map(d => d.data() as AuditLogEntry);
    } catch {
        return [];
    }
};
