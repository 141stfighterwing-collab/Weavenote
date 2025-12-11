import { auth, db, isFirebaseReady } from './firebase';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
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
    orderBy
} from 'firebase/firestore';
import { User, Permission, UserStatus } from '../types';

export interface AuditLogEntry {
    id: string;
    timestamp: number;
    action: string;
    actor: string;
    target?: string | null; // Allow null for Firestore compatibility
    details?: string | null;
}

// Local storage fallback for Guest Mode audit logs only
const LOCAL_AUDIT_KEY = 'ideaweaver_audit_logs';

const fetchClientInfo = async (): Promise<{ ip: string; country: string; flag: string }> => {
    try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        return {
            ip: data.ip || 'Unknown',
            country: data.country_name || 'Unknown',
            flag: '🌐'
        };
    } catch (e) {
        return { ip: 'Unknown', country: 'Unknown', flag: '🌐' };
    }
};

export const isAdmin = (user: User | null) => {
    return user?.role === 'admin' || user?.username === 'admin';
};

// Log security events (Uses Firestore if available, else local)
const logAudit = async (action: string, actor: string, target?: string, details?: string) => {
    // Firestore crashes on 'undefined', so we fallback to null
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
        // Fallback for local
        const logsStr = localStorage.getItem(LOCAL_AUDIT_KEY);
        const logs = logsStr ? JSON.parse(logsStr) : [];
        logs.unshift(entry);
        localStorage.setItem(LOCAL_AUDIT_KEY, JSON.stringify(logs.slice(0, 100)));
    }
};

/**
 * Subscribe to Auth Changes (Persistence)
 */
export const subscribeToAuthChanges = (callback: (user: User | null) => void) => {
    if (!auth || !db) {
        // If Firebase isn't configured, we just return a no-op unsubscribe
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
                    // Check status
                    if (userData.status === 'suspended') {
                        await signOut(auth);
                        callback(null);
                    } else {
                        // Update last login silently
                        updateDoc(userDocRef, { lastLogin: Date.now() }).catch(() => {});
                        callback(userData);
                    }
                } else {
                    // Auth exists but no DB record (orphan)
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

/**
 * DIAGNOSTIC: Check Firestore Connection & Latency
 */
export const checkDatabaseConnection = async (): Promise<{ success: boolean; latency: number; message: string }> => {
    if (!isFirebaseReady || !db) return { success: false, latency: 0, message: "Firebase not configured" };
    
    const start = Date.now();
    try {
        // Attempt a lightweight read (limit 1) just to verify connection
        await getDocs(query(collection(db, 'users'), limit(1)));
        const end = Date.now();
        return { success: true, latency: end - start, message: "Connected" };
    } catch (e: any) {
        return { success: false, latency: 0, message: e.message || "Connection Failed" };
    }
};

export const login = async (usernameOrEmail: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
    if (!isFirebaseReady || !auth || !db) {
        return { success: false, error: "Firebase not configured. Check config.ts" };
    }

    try {
        let email = usernameOrEmail;

        // --- ADMIN BOOTSTRAP LOGIC ---
        if (usernameOrEmail === 'admin' && password === 'Zaqxsw12!gobeavers') {
            email = 'admin@weavenote.com'; 
            try {
                await signInWithEmailAndPassword(auth, email, password);
            } catch (authError: any) {
                if (authError.code === 'auth/configuration-not-found' || authError.code === 'auth/operation-not-allowed') {
                    throw new Error("Enable 'Email/Password' in Firebase Console > Authentication.");
                }
                // Try to create if user not found or invalid credential (which might mean not found in some API versions)
                if (authError.code === 'auth/user-not-found' || authError.code === 'auth/invalid-credential') {
                    console.log("Bootstrapping Admin Account...");
                    try {
                        const newCred = await createUserWithEmailAndPassword(auth, email, password);
                        const clientInfo = await fetchClientInfo();
                        const adminUser: User = {
                            uid: newCred.user.uid,
                            username: 'admin',
                            email: email,
                            permission: 'edit',
                            status: 'active',
                            role: 'admin',
                            lastLogin: Date.now(),
                            ipAddress: clientInfo.ip,
                            country: clientInfo.country,
                            countryFlag: clientInfo.flag
                        };
                        await setDoc(doc(db, 'users', newCred.user.uid), adminUser);
                        return { success: true, user: adminUser };
                    } catch (createError: any) {
                         if (createError.code === 'auth/configuration-not-found' || createError.code === 'auth/operation-not-allowed') {
                            throw new Error("Enable 'Email/Password' in Firebase Console > Authentication.");
                        }
                        if (createError.code === 'auth/email-already-in-use') {
                            // If create fails because it exists, and signIn failed earlier, it implies WRONG PASSWORD.
                            throw new Error("Invalid Admin Password.");
                        }
                        throw createError;
                    }
                }
                throw authError;
            }
        }
        // -----------------------------

        if (!email.includes('@')) {
            const q = query(collection(db, 'users'), where('username', '==', usernameOrEmail));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                email = snapshot.docs[0].data().email;
            } else {
                return { success: false, error: "Username not found. Please use Email." };
            }
        }

        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const fbUser = userCredential.user;

        const userDocRef = doc(db, 'users', fbUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
            await signOut(auth);
            return { success: false, error: "User profile missing in database." };
        }

        const userData = userDoc.data() as User;

        if (userData.status === 'suspended') {
            await signOut(auth);
            await logAudit('LOGIN_BLOCK', userData.username, 'System', 'Suspended user tried to login');
            return { success: false, error: "Account Suspended." };
        }
        if (userData.status === 'pending') {
            await signOut(auth);
            return { success: false, error: "Account Pending Approval." };
        }

        // UPDATE INFO ON LOGIN: Capture IP/Location every time
        const clientInfo = await fetchClientInfo();
        await updateDoc(userDocRef, { 
            lastLogin: Date.now(),
            ipAddress: clientInfo.ip,
            country: clientInfo.country,
            countryFlag: clientInfo.flag
        });
        
        await logAudit('LOGIN_SUCCESS', userData.username);

        // Return updated user object
        return { success: true, user: { ...userData, ...clientInfo, lastLogin: Date.now() } };

    } catch (e: any) {
        console.error("Login Error", e);
        
        // Handle explicit errors thrown from admin block
        if (e.message.includes("Enable 'Email/Password'") || e.message === "Invalid Admin Password.") {
            return { success: false, error: e.message };
        }

        // Firebase Auth Errors
        if (e.code === 'auth/configuration-not-found' || e.code === 'auth/operation-not-allowed') {
             return { success: false, error: "Firebase Auth not enabled in Console." };
        }
        // Handle auth/invalid-credential here specifically
        if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential' || e.code === 'auth/user-not-found') {
             return { success: false, error: "Invalid Email or Password." };
        }
        if (e.code === 'auth/too-many-requests') {
             return { success: false, error: "Too many failed attempts. Try again later." };
        }
        if (e.code === 'auth/network-request-failed') {
             return { success: false, error: "Network error. Check your internet connection." };
        }

        return { success: false, error: e.message || "Login failed" };
    }
};

export const logout = async () => {
    if (auth) await signOut(auth);
};

export const requestAccount = async (username: string, password: string, email: string): Promise<{ success: boolean; message: string }> => {
    if (!isFirebaseReady || !auth || !db) return { success: false, message: "DB Connection Error" };

    try {
        const q = query(collection(db, 'users'), where('username', '==', username));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            return { success: false, message: "Username already taken" };
        }

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
            lastLogin: 0
        };

        await setDoc(doc(db, 'users', uid), newUser);
        await logAudit('REGISTER_REQUEST', username, 'System', `New account request from ${clientInfo.ip}`);

        await signOut(auth);

        return { success: true, message: "Account requested. Please wait for Admin approval." };

    } catch (e: any) {
        if (e.code === 'auth/configuration-not-found' || e.code === 'auth/operation-not-allowed') {
             return { success: false, message: "Admin must enable Email/Password in Firebase Console." };
        }
        if (e.code === 'auth/email-already-in-use') {
             return { success: false, message: "Email is already registered." };
        }
        if (e.code === 'auth/weak-password') {
             return { success: false, message: "Password is too weak (min 6 chars)." };
        }
        return { success: false, message: e.message || "Registration failed" };
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
        await updateDoc(doc(db, 'users', uid), { status: 'active', permission: 'edit' });
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

export const updateUserPermission = async (uid: string, permission: Permission) => {
    if (!db) return;
    await updateDoc(doc(db, 'users', uid), { permission });
    await logAudit('UPDATE_PERM', 'Admin', uid, permission);
};

export const getAuditLogs = async (): Promise<AuditLogEntry[]> => {
    if (!db) return [];
    const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(100));
    try {
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => d.data() as AuditLogEntry);
    } catch (e) {
        // Fallback if index not created yet
        const snapshot = await getDocs(collection(db, 'audit_logs'));
        return snapshot.docs.map(d => d.data() as AuditLogEntry).sort((a,b) => b.timestamp - a.timestamp);
    }
};

export const clearAuditLogs = async () => {
    console.log("Log clearing not supported in client-side Firestore for safety.");
};

export const getSessionTimeout = (): number => {
    const val = localStorage.getItem('ideaweaver_session_timeout');
    return val ? parseInt(val, 10) : 30;
};

export const setSessionTimeout = (minutes: number) => {
    localStorage.setItem('ideaweaver_session_timeout', minutes.toString());
};
