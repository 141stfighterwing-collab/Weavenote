
import { auth, db, isFirebaseReady } from './firebase';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
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
    limit
} from 'firebase/firestore';
import { User, Permission, UserStatus } from '../types';

export interface AuditLogEntry {
    id: string;
    timestamp: number;
    action: string;
    actor: string;
    target?: string;
    details?: string;
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
    const entry: AuditLogEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        action,
        actor,
        target,
        details
    };

    if (db) {
        try {
            await setDoc(doc(collection(db, 'audit_logs')), entry);
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
        // If user enters legacy admin credentials, we auto-create/login the admin in Firebase
        if (usernameOrEmail === 'admin' && password === 'Zaqxsw12!gobeavers') {
            email = 'admin@weavenote.com'; // Reserved admin email
            try {
                // Try logging in regularly first
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                // If successful, proceed to normal flow below
            } catch (authError: any) {
                // If user doesn't exist, Create it on the fly
                if (authError.code === 'auth/user-not-found' || authError.code === 'auth/invalid-credential') {
                    console.log("Bootstrapping Admin Account...");
                    const newCred = await createUserWithEmailAndPassword(auth, email, password);
                    const adminUser: User = {
                        uid: newCred.user.uid,
                        username: 'admin',
                        email: email,
                        permission: 'edit',
                        status: 'active',
                        role: 'admin',
                        lastLogin: Date.now()
                    };
                    await setDoc(doc(db, 'users', newCred.user.uid), adminUser);
                    return { success: true, user: adminUser };
                }
                throw authError;
            }
        }
        // -----------------------------

        if (!email.includes('@')) {
            // Attempt to resolve username to email via Firestore (Reverse lookup)
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

        // 2. Fetch User Profile from Firestore
        const userDocRef = doc(db, 'users', fbUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
            // Edge case: Auth user exists but Firestore doc missing. Re-create or fail.
            // For now, fail to be safe.
            await signOut(auth);
            return { success: false, error: "User profile missing in database." };
        }

        const userData = userDoc.data() as User;

        // 3. Check Status
        if (userData.status === 'suspended') {
            await signOut(auth);
            await logAudit('LOGIN_BLOCK', userData.username, 'System', 'Suspended user tried to login');
            return { success: false, error: "Account Suspended." };
        }
        if (userData.status === 'pending') {
            await signOut(auth);
            return { success: false, error: "Account Pending Approval." };
        }

        // 4. Update Last Login
        await updateDoc(userDocRef, { lastLogin: Date.now() });
        await logAudit('LOGIN_SUCCESS', userData.username);

        return { success: true, user: userData };

    } catch (e: any) {
        console.error("Login Error", e);
        return { success: false, error: e.message || "Login failed" };
    }
};

export const logout = async () => {
    if (auth) await signOut(auth);
};

export const requestAccount = async (username: string, password: string, email: string): Promise<{ success: boolean; message: string }> => {
    if (!isFirebaseReady || !auth || !db) return { success: false, message: "DB Connection Error" };

    try {
        // 1. Check if username taken
        const q = query(collection(db, 'users'), where('username', '==', username));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            return { success: false, message: "Username already taken" };
        }

        // 2. IP Check
        const clientInfo = await fetchClientInfo();
        // (Simplified IP check for Firestore: querying by IP is costly without an index, skipping for this demo)

        // 3. Create Auth User
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        // 4. Create Firestore Document (Pending)
        const newUser: User = {
            uid,
            username,
            email,
            permission: 'read', // Default
            status: 'pending', // Requires Approval
            role: 'user',
            ipAddress: clientInfo.ip,
            country: clientInfo.country,
            countryFlag: clientInfo.flag,
            lastLogin: 0
        };

        await setDoc(doc(db, 'users', uid), newUser);
        await logAudit('REGISTER_REQUEST', username, 'System', 'New account request');

        // Sign out immediately so they can't use the app until approved
        await signOut(auth);

        return { success: true, message: "Account requested. Please wait for Admin approval." };

    } catch (e: any) {
        return { success: false, message: e.message || "Registration failed" };
    }
};

// --- ADMIN FUNCTIONS (Async) ---

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
        // For denial, we delete the Firestore doc. 
        // Note: The Auth user still exists in Firebase. 
        // A real app would use a Cloud Function to delete the Auth user too.
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
    // Ideally use orderBy('timestamp', 'desc') but requires index
    const snapshot = await getDocs(collection(db, 'audit_logs'));
    const logs = snapshot.docs.map(d => d.data() as AuditLogEntry);
    return logs.sort((a,b) => b.timestamp - a.timestamp);
};

export const clearAuditLogs = async () => {
    // In Firestore, deleting collection is hard from client. 
    // We'll just ignore this for now or implement batch delete.
    console.log("Log clearing not supported in client-side Firestore for safety.");
};

export const getSessionTimeout = (): number => {
    const val = localStorage.getItem('ideaweaver_session_timeout');
    return val ? parseInt(val, 10) : 30;
};

export const setSessionTimeout = (minutes: number) => {
    localStorage.setItem('ideaweaver_session_timeout', minutes.toString());
};
