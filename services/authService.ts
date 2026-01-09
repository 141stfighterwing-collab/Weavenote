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
            console.log(`[AUTH_CHECKPOINT_FIREBASE_UID] Currently Authenticated UID: ${firebaseUser.uid}`);
            try {
                const userDocRef = doc(db!, 'users', firebaseUser.uid);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                    const userData = userDoc.data() as User;
                    if (userData.status === 'suspended') {
                        await signOut(auth!);
                        callback(null);
                    } else {
                        updateDoc(userDocRef, { lastLogin: Date.now() }).catch(() => {});
                        callback(userData);
                    }
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
                console.warn("[AUTH_CHECKPOINT_RESTORE] Firestore blocked profile sync. Using Auth fallback.");
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

export const testWriteCapability = async (): Promise<{ success: boolean; message: string }> => {
    if (!auth?.currentUser || !db) return { success: false, message: "Not Authenticated" };
    const uid = auth.currentUser.uid;
    const testDocRef = doc(db, 'users', uid, 'diagnostics', 'write_test');
    try {
        await setDoc(testDocRef, { timestamp: Date.now(), status: 'testing' });
        await deleteDoc(testDocRef);
        return { success: true, message: "Cloud Write Access Verified" };
    } catch (e: any) {
        console.error("Write Test Failure:", e.code, e.message);
        return { success: false, message: `Access Blocked: ${e.code}` };
    }
};

export const login = async (usernameOrEmail: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
    console.log("[AUTH_CHECKPOINT_1] Initializing Login Sequence...");
    if (!isFirebaseReady || !auth || !db) return { success: false, error: "Database infrastructure unreachable." };

    try {
        let email = usernameOrEmail.trim();
        
        // Admin Bootstrap Override
        if (usernameOrEmail === 'admin' && password === (process.env.ADMIN_SETUP_PASS || "Zaqxsw12gobeavers")) {
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
                // Ensure query uses correct capitalization and trims
                const q = query(collection(db, 'users'), where('username', '==', email), limit(1));
                const snapshot = await getDocs(q);
                
                if (snapshot.empty) {
                    return { success: false, error: `Identity handle "${email}" not found.` };
                }
                email = snapshot.docs[0].data().email;
            } catch (e: any) {
                console.error("Lookup error:", e);
                if (e.code === 'permission-denied') return { success: false, error: "Username lookup blocked. Update Cloud Rules." };
                return { success: false, error: "Identity resolution failed. Check connection." };
            }
        }

        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        let userData: User | null = null;
        try {
            const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
            if (userDoc.exists()) {
                userData = userDoc.data() as User;
            }
        } catch (pError: any) {
            console.warn("[AUTH_CHECKPOINT_READ_FAIL] Firestore blocked profile read.");
        }
        
        const info = await fetchClientInfo();
        
        if (!userData) {
            userData = {
                uid: userCredential.user.uid, username: email.split('@')[0], email, 
                permission: 'edit', status: 'active', role: 'user', lastLogin: Date.now(),
                aiUsageCount: 0, ...info
            };
            await setDoc(doc(db, 'users', userCredential.user.uid), userData).catch(e => {
                console.error("[AUTH_FAIL_PROFILE_CREATE] Write rejected by rules:", e.code);
            });
        } else {
            if (userData.status === 'suspended') {
                await signOut(auth);
                return { success: false, error: "Access suspended by administrator." };
            }
            updateDoc(doc(db, 'users', userCredential.user.uid), { lastLogin: Date.now(), ...info }).catch(() => {});
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

export const checkDatabaseConnection = async (): Promise<{ success: boolean; latency: number; message: string }> => {
    if (!isFirebaseReady || !db) return { success: false, latency: 0, message: "Cloud Unconfigured" };
    const start = Date.now();
    try {
        if (auth?.currentUser) {
            await getDoc(doc(db, 'users', auth.currentUser.uid));
        } else {
            await getDocs(query(collection(db, 'users'), limit(1)));
        }
        return { success: true, latency: Date.now() - start, message: "Connected" };
    } catch (e: any) {
        if (e.code === 'permission-denied') return { success: true, latency: Date.now() - start, message: "Operational (Secured)" };
        return { success: false, latency: 0, message: "Connectivity Failure" };
    }
};

export const logout = async () => { if (auth) await signOut(auth); };

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

export const getUsers = async (): Promise<User[]> => {
    if (!db) return [];
    try {
        const snapshot = await getDocs(collection(db, 'users'));
        return snapshot.docs.map(d => d.data() as User);
    } catch { return []; }
};

export const getRequests = async (): Promise<User[]> => {
    if (!db) return [];
    try {
        const q = query(collection(db, 'users'), where('status', '==', 'pending'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => d.data() as User);
    } catch { return []; }
};

export const approveRequest = async (uid: string) => {
    if (!db) return;
    await updateDoc(doc(db, 'users', uid), { status: 'active' as UserStatus });
};

export const denyRequest = async (uid: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'users', uid));
};

export const toggleUserStatus = async (uid: string, currentStatus: UserStatus) => {
    if (!db) return;
    const newStatus: UserStatus = currentStatus === 'active' ? 'suspended' : 'active';
    await updateDoc(doc(db, 'users', uid), { status: newStatus });
};

export const deleteUserAccount = async (uid: string) => {
    if (!db) return;
    await deleteDoc(doc(db, 'users', uid));
};

export const updateUserRole = async (uid: string, role: UserRole, actor: string) => {
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

export const adminTriggerReset = async (email: string, actor: string): Promise<{ success: boolean; message: string }> => {
    if (!auth) return { success: false, message: "Auth service offline." };
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true, message: `Recovery link dispatched.` };
    } catch (e: any) {
        return { success: false, message: `Failed: ${e.message}` };
    }
};

export const getAuditLogs = async (): Promise<AuditLogEntry[]> => {
    if (!db) return [];
    try {
        const snapshot = await getDocs(query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(100)));
        return snapshot.docs.map(d => d.data() as AuditLogEntry);
    } catch { return []; }
};

export const incrementUserAIUsage = async (uid: string) => {
    if (!db) return;
    try {
        const userDocRef = doc(db, 'users', uid);
        await updateDoc(userDocRef, { aiUsageCount: increment(1) });
    } catch (e) {
        console.error("AI usage count update failed", e);
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