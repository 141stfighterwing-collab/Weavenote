
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
 * AUTHORIZATION HELPERS (NIST PR.AC-3)
 * Decoupled from hardcoded usernames. Relies on DB roles.
 */
export const isGlobalAdmin = (user: User | null): boolean => {
    return user?.role === 'super-admin';
};

export const isAdmin = (user: User | null): boolean => {
    return user?.role === 'admin' || user?.role === 'super-admin';
};

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
                console.error("Auth state sync error", e);
                callback(null);
            }
        } else {
            callback(null);
        }
    });
};

export const checkDatabaseConnection = async (): Promise<{ success: boolean; latency: number; message: string }> => {
    if (!isFirebaseReady || !db) return { success: false, latency: 0, message: "Firebase not configured" };
    
    const start = Date.now();
    try {
        await getDocs(query(collection(db, 'users'), limit(1)));
        const end = Date.now();
        return { success: true, latency: end - start, message: "Connected" };
    } catch (e: any) {
        return { success: false, latency: 0, message: e.message || "Connection Failed" };
    }
};

/**
 * SECURE LOGIN (NIST/SOC2)
 * All hardcoded plaintext passwords removed.
 */
export const login = async (usernameOrEmail: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
    if (!isFirebaseReady || !auth || !db) {
        return { success: false, error: "System initialization failure." };
    }

    try {
        let email = usernameOrEmail;

        // Secure Bootstrap: Handle initial super-admin setup via Environment Variable only
        const adminSetupPass = process.env.ADMIN_SETUP_PASS;
        if (usernameOrEmail === 'admin' && adminSetupPass && password === adminSetupPass) {
            email = 'system-bootstrap@weavenote.com'; 
            try {
                const cred = await signInWithEmailAndPassword(auth, email, password);
                const docSnap = await getDoc(doc(db, 'users', cred.user.uid));
                if (docSnap.exists()) return { success: true, user: docSnap.data() as User };
            } catch (authError: any) {
                if (authError.code === 'auth/user-not-found' || authError.code === 'auth/invalid-credential') {
                    // Create primary super-admin on first successful env-pass attempt
                    const newCred = await createUserWithEmailAndPassword(auth, email, password);
                    const clientInfo = await fetchClientInfo();
                    const adminUser: User = {
                        uid: newCred.user.uid,
                        username: 'SystemAdmin',
                        email: email,
                        permission: 'edit',
                        status: 'active',
                        role: 'super-admin',
                        lastLogin: Date.now(),
                        ipAddress: clientInfo.ip,
                        country: clientInfo.country,
                        countryFlag: clientInfo.flag,
                        aiUsageCount: 0
                    };
                    await setDoc(doc(db, 'users', newCred.user.uid), adminUser);
                    await logAudit('SYSTEM_BOOTSTRAP', 'BOOTSTRAP', adminUser.uid, 'First Super-Admin created');
                    return { success: true, user: adminUser };
                }
                throw authError;
            }
        }

        // Standard user lookup
        if (!email.includes('@')) {
            const q = query(collection(db, 'users'), where('username', '==', usernameOrEmail));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                email = snapshot.docs[0].data().email;
            } else {
                return { success: false, error: "Identity not recognized." };
            }
        }

        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const fbUser = userCredential.user;
        const userDoc = await getDoc(doc(db, 'users', fbUser.uid));

        if (!userDoc.exists()) {
            await signOut(auth);
            return { success: false, error: "Profile missing in vault." };
        }

        const userData = userDoc.data() as User;

        if (userData.status === 'suspended') {
            await signOut(auth);
            await logAudit('LOGIN_BLOCK', userData.username, 'System', 'Suspended identity attempt');
            return { success: false, error: "Access suspended by moderation." };
        }
        if (userData.status === 'pending') {
            await signOut(auth);
            return { success: false, error: "Awaiting administrative approval." };
        }

        const clientInfo = await fetchClientInfo();
        await updateDoc(doc(db, 'users', fbUser.uid), { 
            lastLogin: Date.now(),
            ...clientInfo
        });
        
        await logAudit('LOGIN_SUCCESS', userData.username);

        return { success: true, user: { ...userData, ...clientInfo, lastLogin: Date.now() } };

    } catch (e: any) {
        return { success: false, error: "Invalid credentials provided." };
    }
};

export const logout = async () => {
    if (auth) await signOut(auth);
};

export const requestAccount = async (username: string, password: string, email: string): Promise<{ success: boolean; message: string }> => {
    if (!isFirebaseReady || !auth || !db) return { success: false, message: "Connection Error" };

    try {
        const q = query(collection(db, 'users'), where('username', '==', username));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) return { success: false, message: "Handle already taken." };

        const clientInfo = await fetchClientInfo();
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        const newUser: User = {
            uid,
            username,
            email,
            permission: 'read', 
            status: 'pending', 
            role: 'user', 
            ipAddress: clientInfo.ip,
            country: clientInfo.country,
            countryFlag: clientInfo.flag,
            lastLogin: 0,
            aiUsageCount: 0
        };

        await setDoc(doc(db, 'users', uid), newUser);
        await logAudit('REGISTER_REQUEST', username, 'System', `New join request from ${clientInfo.ip}`);
        await signOut(auth);
        return { success: true, message: "Request received. An administrator will review your account." };

    } catch (e: any) {
        return { success: false, message: e.message || "Request failed." };
    }
};

export const getRequests = async (): Promise<User[]> => {
    if (!db) return [];
    const q = query(collection(db, 'users'), where('status', '==', 'pending'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as User);
};

export const approveRequest = async (uid: string): Promise<boolean> => {
    if (!db) return false;
    try {
        await updateDoc(doc(db, 'users', uid), { status: 'active', permission: 'edit', role: 'user' });
        await logAudit('APPROVE_USER', 'Admin', uid);
        return true;
    } catch (e) {
        return false;
    }
};

export const denyRequest = async (uid: string) => {
    if (!db) return;
    try {
        await deleteDoc(doc(db, 'users', uid));
        await logAudit('DENY_USER', 'Admin', uid);
    } catch (e) { console.error(e) }
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
    try {
        await deleteDoc(doc(db, 'users', uid));
        await logAudit('DELETE_USER', 'Admin', uid);
    } catch (e) { console.error(e) }
};

export const updateUserPermission = async (uid: string, permission: Permission) => {
    if (!db) return;
    await updateDoc(doc(db, 'users', uid), { permission });
    await logAudit('UPDATE_PERM', 'Admin', uid, permission);
};

export const updateUserRole = async (uid: string, role: UserRole) => {
    if (!db) return;
    await updateDoc(doc(db, 'users', uid), { role });
    await logAudit('UPDATE_ROLE', 'Admin', uid, role);
};

export const incrementUserAIUsage = async (uid: string) => {
    if (!db) return;
    await updateDoc(doc(db, 'users', uid), { aiUsageCount: increment(1) });
};

export const getAuditLogs = async (): Promise<AuditLogEntry[]> => {
    if (!db) return [];
    const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(100));
    try {
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => d.data() as AuditLogEntry);
    } catch (e) {
        const snapshot = await getDocs(collection(db, 'audit_logs'));
        return snapshot.docs.map(d => d.data() as AuditLogEntry).sort((a,b) => b.timestamp - a.timestamp);
    }
};

export const clearAuditLogs = async () => {
    console.log("Log deletion is prohibited for compliance.");
};
