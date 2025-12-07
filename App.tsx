
import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Plus, ChevronLeft, ChevronRight, Search, LayoutList, Kanban, Loader2, Wifi, WifiOff, RefreshCw, Menu, RotateCw, AlertTriangle, X } from 'lucide-react';
import Sidebar from './components/Sidebar';
import UserProfileModal from './components/UserProfileModal';
import LoginPage from './components/LoginPage';
import ReloadPrompt from './components/ReloadPrompt';
import { Project, ProjectStatus, User, Client, Employee, CompanyAdministrativeData } from './types';

// --- LAZY LOAD COMPONENTS ---
const Dashboard = lazy(() => import('./components/Dashboard'));
const ProjectDetail = lazy(() => import('./components/ProjectDetail'));
const AddProjectModal = lazy(() => import('./components/AddProjectModal'));
const ClientsPage = lazy(() => import('./components/ClientsPage'));
const PartnersPage = lazy(() => import('./components/PartnersPage'));
const SettingsPage = lazy(() => import('./components/SettingsPage'));
const AgendaPage = lazy(() => import('./components/AgendaPage'));
const KanbanBoard = lazy(() => import('./components/KanbanBoard'));
const ProjectList = lazy(() => import('./components/ProjectList'));
const TasksPage = lazy(() => import('./components/TasksPage'));
const EmployeesPage = lazy(() => import('./components/EmployeesPage'));
const AdminPage = lazy(() => import('./components/AdminPage'));

// --- FIREBASE IMPORTS ---
import { saveDocument, deleteDocument, subscribeToAuth, subscribeToCollection, where } from './services/firebaseService';

// --- DATA SANITIZATION & STORAGE UTILITIES ---
const sanitizeStorageData = (data: any, seen = new WeakSet(), depth = 0): any => {
    // 0. Depth limit to prevent stack overflow
    if (depth > 10) return undefined;

    // 1. Primitive checks
    if (data === null || typeof data !== 'object') return data;
    if (data instanceof Date) return data.toISOString();

    // 2. Cycle detection
    if (seen.has(data)) return undefined;
    seen.add(data);

    // 3. Duck typing for Firebase types (works even if minified)
    if (typeof data.toDate === 'function') {
        try { return data.toDate().toISOString(); } catch (e) { }
    }
    // Handle Firestore References
    if (data.firestore && data.path) {
        return { refPath: data.path };
    }

    // 4. Filter dangerous objects
    if (
        data instanceof Element ||
        data instanceof Event ||
        (typeof window !== 'undefined' && (data === window || data === document)) ||
        (data && data.nodeType && data.nodeName) || // Generic DOM Node check
        data.$$typeof // React Element
    ) return undefined;

    // 5. Array recursion
    if (Array.isArray(data)) {
        return data.map(item => sanitizeStorageData(item, seen, depth + 1));
    }

    // 6. Object recursion
    const newObj: any = {};
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            // Block generic dangerous keys
            if (
                key.startsWith('__') ||
                key.startsWith('_react') ||
                key === 'src' || // 'src' often causes cycles in DOM-like objects
                key === 'source' ||
                key === 'view' ||
                key === 'ownerDocument' ||
                key === 'delegate' ||
                key === 'firestore' ||
                typeof data[key] === 'function'
            ) continue;

            const val = sanitizeStorageData(data[key], seen, depth + 1);
            if (val !== undefined) newObj[key] = val;
        }
    }
    return newObj;
};

// 2. Safe JSON Stringify (Uses Sanitizer First)
const safeJsonStringify = (data: any) => {
    try {
        const cleanData = sanitizeStorageData(data);
        return JSON.stringify(cleanData);
    } catch (e) {
        console.warn("JSON Stringify failed, fallback to empty object", e);
        return "{}";
    }
};

const safeSessionStorageSet = (key: string, value: any) => {
    try {
        sessionStorage.setItem(key, safeJsonStringify(value));
    } catch (e) {
        console.warn('Session Storage full or error', e);
    }
}

// OPTIMIZATION: Use requestIdleCallback to avoid blocking main thread during save
const saveTimeouts: { [key: string]: number } = {};

const safeLocalStorageSet = (key: string, value: any) => {
    if (saveTimeouts[key]) {
        // @ts-ignore
        if (window.cancelIdleCallback) window.cancelIdleCallback(saveTimeouts[key]);
        else clearTimeout(saveTimeouts[key]);
    }

    const saveTask = () => {
        try {
            // Double sanitization to be absolutely sure no cycles persist
            localStorage.setItem(key, safeJsonStringify(value));
        } catch (e) {
            console.warn('Local Storage error', e);
        }
        delete saveTimeouts[key];
    };

    // @ts-ignore
    if (typeof window !== 'undefined' && window.requestIdleCallback) {
        // @ts-ignore
        saveTimeouts[key] = window.requestIdleCallback(saveTask, { timeout: 1000 });
    } else {
        saveTimeouts[key] = window.setTimeout(saveTask, 500);
    }
}

// SKELETON FOR INSTANT VISUAL FEEDBACK
const DashboardSkeleton = () => (
    <div className="space-y-8 p-4 md:p-8 animate-pulse">
        <div className="flex justify-between items-center mb-6">
            <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
            <div className="h-10 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
        </div>
        <div className="h-48 w-full md:w-72 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 h-40 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
            <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
        </div>
    </div>
);

// Define Shared Note Interface locally or imported
export interface SharedNote {
    id: string;
    content: string;
    authorName: string;
    authorId: string;
    createdAt: number;
}

const App: React.FC = () => {
    // OPTIMIZATION: Initialize synchronously to determine Login vs App state immediately
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        if (typeof window === 'undefined') return null;
        try {
            const savedUser = sessionStorage.getItem('currentUser');
            return savedUser ? JSON.parse(savedUser) : null;
        } catch (e) { return null; }
    });

    const [theme, setTheme] = useState<'light' | 'dark'>('dark');
    const [projects, setProjects] = useState<Project[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);

    // ADMIN DATA STATE
    const [adminData, setAdminData] = useState<CompanyAdministrativeData>({
        id: 'administrative',
        documents: [],
        vehicles: []
    });

    // Alert State
    const [docAlerts, setDocAlerts] = useState<{ count: number, type: 'expired' | 'warning' } | null>(null);

    // PWA UPDATE LOGIC - AUTO UPDATE
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('SW Registered: ' + r);
        },
        onRegisterError(error) {
            console.log('SW registration error', error);
        },
    });

    // Automatically update when a new version is available (User preference)
    useEffect(() => {
        if (needRefresh) {
            console.log("Auto-updating application...");
            updateServiceWorker(true);
        }
    }, [needRefresh, updateServiceWorker]);

    // Cleanup update state
    const closeUpdate = () => {
        setOfflineReady(false);
        setNeedRefresh(false);
    };

    // RESTORED: Shared Notes State (Array instead of string)
    const [globalNotes, setGlobalNotes] = useState<SharedNote[]>([]);

    const [isHydrated, setIsHydrated] = useState(false);

    // --- NETWORK STATUS STATE ---
    const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
    const [showSyncNotification, setShowSyncNotification] = useState(false);

    // Resume active tab from storage to avoid jarring switch on reload
    const [activeTab, setActiveTab] = useState(() => {
        if (typeof window !== 'undefined') return sessionStorage.getItem('lastActiveTab') || 'dashboard';
        return 'dashboard';
    });

    // MOBILE HISTORY SYNC (SWIPE TO BACK)
    const isPopping = useRef(false);

    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            if (event.state?.tab) {
                isPopping.current = true;
                setActiveTab(event.state.tab);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    useEffect(() => {
        if (isPopping.current) {
            isPopping.current = false;
            return;
        }
        window.history.pushState({ tab: activeTab }, '', `#${activeTab}`);
    }, [activeTab]);

    // MOBILE SIDEBAR STATE
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [prefillClient, setPrefillClient] = useState<Client | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [globalSearchResults, setGlobalSearchResults] = useState<{ projects: Project[], clients: Client[] } | null>(null);
    const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'ALL'>('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    const [isDarkMode] = useState(true);

    const [projectViewMode, setProjectViewMode] = useState<'LIST' | 'KANBAN'>('LIST');

    // DOC MONITORING EFFECT
    useEffect(() => {
        if (!isHydrated) return;

        const checkDocs = () => {
            let expiredCount = 0;
            let warningCount = 0;
            const now = new Date();

            // 1. Check Partners Docs
            clients.filter(c => c.type === 'PARTENAIRE' || c.type === 'SOUS_TRAITANT').forEach(partner => {
                partner.documents?.forEach(doc => {
                    if (doc.expiryDate) {
                        const exp = new Date(doc.expiryDate);
                        const diff = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
                        if (diff < 0) expiredCount++;
                        else if (diff < 30) warningCount++;
                    }
                });
            });

            // 2. Check Admin Docs
            adminData.documents.forEach(doc => {
                if (doc.expiryDate) {
                    const exp = new Date(doc.expiryDate);
                    const diff = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
                    if (diff < 0) expiredCount++;
                    else if (diff < 30) warningCount++;
                }
            });

            if (expiredCount > 0) {
                setDocAlerts({ count: expiredCount, type: 'expired' });
            } else if (warningCount > 0) {
                setDocAlerts({ count: warningCount, type: 'warning' });
            } else {
                setDocAlerts(null);
            }
        };

        checkDocs();
    }, [clients, adminData, isHydrated]);



    // --- AUTH STATE LISTENER ---
    useEffect(() => {
        const unsubscribe = subscribeToAuth((firebaseUser: any) => {
            if (firebaseUser) {
                // User is signed in
                if (!currentUser || currentUser.id !== firebaseUser.uid) {
                    const basicUser: User = {
                        id: firebaseUser.uid,
                        username: firebaseUser.email || 'User',
                        email: firebaseUser.email || '',
                        fullName: firebaseUser.displayName || 'Utilisateur',
                        role: 'USER',
                        lastLogin: Date.now()
                    };
                    setCurrentUser(prev => prev?.id === firebaseUser.uid ? prev : basicUser);

                    setTimeout(() => {
                        saveDocument('users', basicUser.id, sanitizeStorageData(basicUser));
                    }, 2000);
                }
            } else {
                if (!import.meta.env.DEV || (currentUser?.id !== 'demo')) {
                    setCurrentUser(null);
                    sessionStorage.removeItem('currentUser');
                }
            }
        });
        return () => unsubscribe();
    }, []);

    // NETWORK LISTENER & VISIBILITY REFRESH
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            setShowSyncNotification(true);
            console.log("Network restored. Firestore will automatically reconcile pending writes and listen for updates.");
            setTimeout(() => setShowSyncNotification(false), 4000);
            updateServiceWorker(true); // Auto-update if online
        };
        const handleOffline = () => setIsOnline(false);

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && navigator.onLine) {
                console.log("App resumed - verifying connection");
                setIsOnline(true);
            }
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    // Async Hydration Effect
    useEffect(() => {
        const loadLocalData = () => {
            try {
                const savedProjects = localStorage.getItem('artisan-projects-backup');
                if (savedProjects) {
                    const parsed = JSON.parse(savedProjects);
                    if (Array.isArray(parsed)) setProjects(parsed);
                }
                const savedClients = localStorage.getItem('artisan-clients-backup');
                if (savedClients) {
                    const parsed = JSON.parse(savedClients);
                    if (Array.isArray(parsed)) setClients(parsed);
                }
                const savedEmployees = localStorage.getItem('artisan-employees-backup');
                if (savedEmployees) {
                    const parsed = JSON.parse(savedEmployees);
                    if (Array.isArray(parsed)) setEmployees(parsed);
                }
            } catch (e) {
                console.warn("Hydration failed", e);
            } finally {
                setIsHydrated(true);
            }
        };

        setTimeout(loadLocalData, 0);
    }, []);

    useEffect(() => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    }, []);

    useEffect(() => {
        if (!isHydrated) return;

        let unsubProjects: (() => void) | undefined;
        let unsubClients: (() => void) | undefined;
        let unsubUsers: (() => void) | undefined;
        let unsubCompany: (() => void) | undefined;
        let unsubEmployees: (() => void) | undefined;

        const setupSubscriptions = async () => {
            // Optimize: Only fetch non-archived projects initially
            unsubProjects = subscribeToCollection('projects', (data) => {
                const castData = Array.isArray(data) ? data as Project[] : [];
                const cleanData = sanitizeStorageData(castData);
                if (cleanData.length === 0 && projects.length > 0) return;
                setProjects(cleanData);
                safeLocalStorageSet('artisan-projects-backup', cleanData);
            }, [where('status', '!=', 'ARCHIVED')]);

            unsubClients = subscribeToCollection('clients', (data) => {
                const castData = Array.isArray(data) ? data as Client[] : [];
                const cleanData = sanitizeStorageData(castData);
                if (cleanData.length === 0 && clients.length > 0) return;
                setClients(cleanData);
                safeLocalStorageSet('artisan-clients-backup', cleanData);
            });

            unsubEmployees = subscribeToCollection('employees', (data) => {
                const castData = Array.isArray(data) ? data as Employee[] : [];
                const cleanData = sanitizeStorageData(castData);
                if (cleanData.length === 0 && employees.length > 0) return;
                setEmployees(cleanData);
                safeLocalStorageSet('artisan-employees-backup', cleanData);
            });

            unsubUsers = subscribeToCollection('users', (data) => {
                const castData = Array.isArray(data) ? data as User[] : [];
                const cleanData = sanitizeStorageData(castData);
                setUsers(cleanData);
            });

            unsubCompany = subscribeToCollection('company', (data) => {
                const dashboardDoc = data.find(d => d.id === 'dashboard');
                if (dashboardDoc && dashboardDoc.notes) {
                    setGlobalNotes(dashboardDoc.notes);
                } else if (dashboardDoc && dashboardDoc.memo) {
                    setGlobalNotes([{
                        id: 'legacy',
                        content: dashboardDoc.memo,
                        authorName: 'Système',
                        authorId: 'system',
                        createdAt: Date.now()
                    }]);
                }

                const adminDoc = data.find(d => d.id === 'administrative');
                if (adminDoc) {
                    setAdminData({
                        id: 'administrative',
                        documents: adminDoc.documents || [],
                        vehicles: adminDoc.vehicles || []
                    });
                }
            });
        };

        if (typeof window !== 'undefined' && (window as any).requestIdleCallback) {
            (window as any).requestIdleCallback(() => {
                if (currentUser) setupSubscriptions();
            });
        } else {
            setTimeout(() => {
                if (currentUser) setupSubscriptions();
            }, 100);
        }

        return () => {
            if (unsubProjects) unsubProjects();
            if (unsubClients) unsubClients();
            if (unsubUsers) unsubUsers();
            if (unsubCompany) unsubCompany();
            if (unsubEmployees) unsubEmployees();
        }
    }, [isHydrated, currentUser]);

    useEffect(() => {
        const timer = setTimeout(() => {
            handleGlobalSearch(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, projects, clients]);

    const filteredAndSortedProjects = useMemo(() => {
        let filtered = projects;
        if (statusFilter !== 'ALL') {
            filtered = filtered.filter(p => p.status === statusFilter);
        }
        return filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }, [projects, statusFilter]);

    const totalPages = Math.ceil(filteredAndSortedProjects.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedProjects = useMemo(() => {
        return filteredAndSortedProjects.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredAndSortedProjects, startIndex, itemsPerPage]);

    // OPTIMIZED LOGIN HANDLER: Corrected to trust Firebase result
    const handleLogin = useCallback((email: string, _password?: string) => {
        // Create a temporary user object for immediate UI feedback
        // The real full profile will be loaded by the Auth Listener in background
        const tempUser: User = {
            id: 'temp-id', // Will be overwritten by auth listener
            username: email,
            email: email,
            fullName: email.split('@')[0],
            role: 'USER',
            lastLogin: Date.now()
        };
        setCurrentUser(tempUser);
        sessionStorage.setItem('currentUser', safeJsonStringify(tempUser));
        return true;
    }, []);

    const handleLogout = useCallback(() => {
        setCurrentUser(null);
        sessionStorage.removeItem('currentUser');
    }, []);



    const handleTabSwitch = useCallback((tab: string, filter?: any) => {
        setActiveTab(tab);
        sessionStorage.setItem('lastActiveTab', tab);
        if (filter) setStatusFilter(filter);
        setGlobalSearchResults(null);
        setSelectedProject(null);
        setSearchQuery('');
        setIsSidebarOpen(false);
    }, []);

    const handleProjectSelect = useCallback((project: Project) => setSelectedProject(project), []);

    const addProject = useCallback(async (project: Project) => {
        const cleanProject = sanitizeStorageData(project);
        setProjects(prev => {
            const newProjects = [cleanProject, ...prev];
            safeLocalStorageSet('artisan-projects-backup', newProjects);
            return newProjects;
        });
        setActiveTab('projects');
        setStatusFilter(ProjectStatus.NEW);
        await saveDocument('projects', cleanProject.id, cleanProject);

        setClients(prevClients => {
            const existingClient = prevClients.find(c => c.email === cleanProject.client.email || c.name === cleanProject.client.name);
            if (!existingClient) {
                const newClient: Client = { ...cleanProject.client, id: Date.now().toString() };
                const newClients = [...prevClients, newClient];
                safeLocalStorageSet('artisan-clients-backup', newClients);
                saveDocument('clients', newClient.id!, newClient);
                return newClients;
            }
            return prevClients;
        });
    }, []);

    const handleBulkAddProjects = useCallback(async (newProjects: Project[]) => {
        const cleanProjects = newProjects.map(p => sanitizeStorageData(p));
        setProjects(prev => {
            const updated = [...cleanProjects, ...prev];
            safeLocalStorageSet('artisan-projects-backup', updated);
            return updated;
        });
        setActiveTab('projects');
        setStatusFilter('ALL');
        for (const proj of cleanProjects) {
            await saveDocument('projects', proj.id, proj);
        }
    }, []);

    const handleDuplicateProject = useCallback(async (sourceProject: Project) => {
        const newId = Date.now().toString();
        const duplicatedProject: Project = {
            ...sourceProject,
            id: newId,
            businessCode: `${sourceProject.businessCode}-COP`,
            title: `${sourceProject.title} (Copie)`,
            status: ProjectStatus.NEW,
            createdAt: Date.now(),
            appointments: [],
            tasks: sourceProject.tasks?.map(t => ({ ...t, isDone: false, id: Date.now().toString() + Math.random() })),
            documents: [],
            photos: [],
            invoices: []
        };
        await addProject(duplicatedProject);
        setSelectedProject(duplicatedProject);
    }, [addProject]);

    const updateProject = useCallback(async (project: Project) => {
        const cleanProject = sanitizeStorageData(project);
        setProjects(prev => {
            const updatedProjects = prev.map(p => p.id === cleanProject.id ? cleanProject : p);
            safeLocalStorageSet('artisan-projects-backup', updatedProjects);
            return updatedProjects;
        });
        await saveDocument('projects', cleanProject.id, cleanProject);
    }, []);

    const handleDeleteProject = useCallback(async (id: string) => {
        setProjects(prev => {
            const remainingProjects = prev.filter(p => p.id !== id);
            safeLocalStorageSet('artisan-projects-backup', remainingProjects);
            return remainingProjects;
        });
        setSelectedProject(null);
        await deleteDocument('projects', id);
    }, []);

    const validateQuote = useCallback(async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const project = projects.find(p => p.id === id);
        if (project) {
            const updated = { ...project, status: ProjectStatus.VALIDATED };
            const cleanUpdated = sanitizeStorageData(updated);
            setProjects(prev => {
                const updatedProjects = prev.map(p => p.id === id ? cleanUpdated : p);
                safeLocalStorageSet('artisan-projects-backup', updatedProjects);
                return updatedProjects;
            });
            await saveDocument('projects', cleanUpdated.id, cleanUpdated);
        }
    }, [projects]);

    const handleSort = useCallback((field: string) => { console.log("Sort", field); }, []);

    const handleDashboardNavigate = useCallback((tab: string, filter?: ProjectStatus) => {
        handleTabSwitch(tab, filter);
    }, [handleTabSwitch]);

    const handleAddClient = useCallback(async (client: Client) => {
        const id = Date.now().toString();
        const fullClient = { ...client, id };
        const cleanClient = sanitizeStorageData(fullClient);
        setClients(prev => {
            const newClients = [...prev, cleanClient];
            safeLocalStorageSet('artisan-clients-backup', newClients);
            return newClients;
        });
        await saveDocument('clients', id, cleanClient);
    }, []);

    const handleDeleteClient = useCallback(async (client: Client) => {
        if (window.confirm("Supprimer ce client ?")) {
            setClients(prev => {
                const remainingClients = prev.filter(c => c.id !== client.id);
                safeLocalStorageSet('artisan-clients-backup', remainingClients);
                return remainingClients;
            });
            if (client.id) await deleteDocument('clients', client.id);
        }
    }, []);

    const handleUpdateClient = useCallback(async (client: Client) => {
        const cleanClient = sanitizeStorageData(client);
        setClients(prev => {
            const updated = prev.map(c => c.id === cleanClient.id ? cleanClient : c);
            safeLocalStorageSet('artisan-clients-backup', updated);
            return updated;
        });
        if (cleanClient.id) await saveDocument('clients', cleanClient.id, cleanClient);
    }, []);

    const handleAddEmployee = useCallback(async (emp: Employee) => {
        const cleanEmp = sanitizeStorageData(emp);
        setEmployees(prev => {
            const newEmps = [...prev, cleanEmp];
            safeLocalStorageSet('artisan-employees-backup', newEmps);
            return newEmps;
        });
        await saveDocument('employees', cleanEmp.id, cleanEmp);
    }, []);

    const handleUpdateEmployee = useCallback(async (emp: Employee) => {
        const cleanEmp = sanitizeStorageData(emp);
        setEmployees(prev => {
            const updated = prev.map(e => e.id === cleanEmp.id ? cleanEmp : e);
            safeLocalStorageSet('artisan-employees-backup', updated);
            return updated;
        });
        await saveDocument('employees', cleanEmp.id, cleanEmp);
    }, []);

    const handleDeleteEmployee = useCallback(async (id: string) => {
        if (window.confirm("Supprimer ce salarié ?")) {
            setEmployees(prev => {
                const remaining = prev.filter(e => e.id !== id);
                safeLocalStorageSet('artisan-employees-backup', remaining);
                return remaining;
            });
            await deleteDocument('employees', id);
        }
    }, []);

    const handleUpdateAdminData = async (newData: CompanyAdministrativeData) => {
        setAdminData(newData);
        const cleanData = sanitizeStorageData(newData);
        await saveDocument('company', 'administrative', cleanData);
    };

    const handleAddUser = async (user: User) => { const clean = sanitizeStorageData(user); await saveDocument('users', clean.id, clean); };

    const handleUpdateUser = async (user: User) => {
        const updatedUser = { ...user };
        setCurrentUser(updatedUser);
        safeSessionStorageSet('currentUser', updatedUser);
        const clean = sanitizeStorageData(updatedUser);
        await saveDocument('users', clean.id, clean);
    };

    // Helper to get email initials
    const getEmailInitials = (email: string) => {
        if (!email) return '??';
        const part = email.split('@')[0];
        const segments = part.split('.');
        if (segments.length >= 2) {
            return (segments[0][0] + segments[1][0]).toUpperCase();
        }
        return part.substring(0, 2).toUpperCase();
    };

    const handleAddNote = async (text: string) => {
        if (!currentUser || !text.trim()) return;

        // Use email initials if available, otherwise fallback to full name
        const displayName = currentUser.email ? getEmailInitials(currentUser.email) : currentUser.fullName;

        const newNote: SharedNote = {
            id: Date.now().toString(),
            content: text,
            authorName: displayName,
            authorId: currentUser.id,
            createdAt: Date.now()
        };
        const updatedNotes = [newNote, ...globalNotes].slice(0, 8);
        setGlobalNotes(updatedNotes);
        await saveDocument('company', 'dashboard', { id: 'dashboard', notes: updatedNotes });
    };

    const handleDeleteNote = async (noteId: string) => {
        const updatedNotes = globalNotes.filter(n => n.id !== noteId);
        setGlobalNotes(updatedNotes);
        await saveDocument('company', 'dashboard', { id: 'dashboard', notes: updatedNotes });
    };

    const handleDeleteUser = async (id: string) => { await deleteDocument('users', id); };
    const handleUpdateProfile = async (user: User) => { const clean = sanitizeStorageData(user); await saveDocument('users', clean.id, clean); setCurrentUser(clean); safeSessionStorageSet('currentUser', clean); };

    const handleGlobalSearch = (query: string) => {
        if (!query || query.length < 2) {
            setGlobalSearchResults(null);
            return;
        }
        const lowerQuery = query.toLowerCase();
        const matchedProjects = projects.filter(p => p.title.toLowerCase().includes(lowerQuery) || p.client.name.toLowerCase().includes(lowerQuery));
        const matchedClients = clients.filter(c => c.name.toLowerCase().includes(lowerQuery));
        setGlobalSearchResults({ projects: matchedProjects, clients: matchedClients });
    };

    const triggerAutomation = useCallback(async (project: Project) => {
        if (!currentUser?.integrations?.automationWebhook) return;
        try {
            await fetch(currentUser.integrations.automationWebhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: safeJsonStringify(project) });
        } catch (error) { console.error("Automation error", error); }
    }, [currentUser]);

    const handleCreateProjectForClient = useCallback((client: Client) => {
        setPrefillClient(client);
        setIsModalOpen(true);
    }, []);

    const handleManualRefresh = () => {
        window.location.reload();
    };

    // OPTIMIZED LOGIN HANDLER: Updates state immediately for instant feedback


    if (!currentUser) return <LoginPage onLogin={handleLogin} />;

    return (
        <div className="flex min-h-screen transition-colors pt-[40px] md:pt-0">

            {/* ALERT BANNER (TOP) */}
            {docAlerts && (
                <div className={`fixed top-0 left-0 w-full z-[10000] px-4 py-2 flex items-center justify-between text-sm font-bold shadow-lg animate-slide-in-from-top ${docAlerts.type === 'expired' ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'}`}>
                    <div className="flex items-center mx-auto">
                        <AlertTriangle className="mr-2" size={18} />
                        <span>
                            {docAlerts.type === 'expired'
                                ? `ATTENTION: ${docAlerts.count} document(s) expiré(s) détectés !`
                                : `Info: ${docAlerts.count} document(s) expirent bientôt.`}
                        </span>
                        <button
                            onClick={() => setActiveTab(docAlerts.type === 'expired' ? 'partners' : 'administrative')}
                            className="ml-4 underline hover:text-slate-200"
                        >
                            Vérifier maintenant
                        </button>
                    </div>
                    <button onClick={() => setDocAlerts(null)} className="p-1 hover:bg-white dark:bg-slate-950/20 rounded"><X size={16} /></button>
                </div>
            )}

            {/* OFFLINE BANNER */}
            {!isOnline && (
                <div className="fixed bottom-4 right-4 z-[9999] bg-slate-800 text-white px-4 py-3 rounded-lg shadow-2xl flex items-center border border-red-500 animate-in slide-in-from-bottom-2">
                    <div className="bg-red-500/10 p-2 rounded-full mr-3">
                        <WifiOff size={20} className="text-red-500" />
                    </div>
                    <div>
                        <p className="font-bold text-sm">Mode Hors Ligne Activé</p>
                        <p className="text-xs text-slate-400">Vous pouvez continuer à travailler. Vos modifications sont sauvegardées localement.</p>
                    </div>
                </div>
            )}

            {/* SYNC NOTIFICATION */}
            {showSyncNotification && (
                <div className="fixed bottom-4 right-4 z-[9999] bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-2xl flex items-center animate-in slide-in-from-bottom-2 fade-in">
                    <div className="bg-white dark:bg-slate-950/20 p-2 rounded-full mr-3 animate-spin-once">
                        <RefreshCw size={20} className="text-white" />
                    </div>
                    <div>
                        <p className="font-bold text-sm">Connexion Rétablie</p>
                        <p className="text-xs text-emerald-100">Synchronisation des données effectuée avec succès.</p>
                    </div>
                </div>
            )}

            <Sidebar
                activeTab={activeTab}
                setActiveTab={handleTabSwitch}
                onLogout={handleLogout}
                isOnline={isOnline}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />

            <main className="flex-1 md:ml-64 bg-slate-50 dark:bg-slate-950 overflow-x-hidden min-h-screen relative w-full">
                {/* HEADER */}
                <div className="sticky top-0 z-30 bg-white dark:bg-slate-950 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 py-4 flex justify-between items-center print:hidden shadow-sm">
                    <div className="flex items-center space-x-2 md:space-x-4 flex-1">

                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="md:hidden p-2 mr-2 text-slate-600 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <Menu size={24} />
                        </button>

                        <h1 className="text-xl font-bold text-slate-800 dark:text-white capitalize hidden md:block">{activeTab === 'tasks' ? 'Mes Tâches' : activeTab}</h1>
                        <div className="relative max-w-md w-full md:ml-4 flex items-center">
                            <div className="relative w-full">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input type="text" placeholder="Rechercher..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-900 border-none rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400" />
                            </div>

                            {/* Manual Refresh Button */}
                            <button
                                onClick={handleManualRefresh}
                                className="md:hidden ml-2 p-2 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-white rounded-lg"
                                title="Actualiser l'application"
                            >
                                <RotateCw size={18} />
                            </button>

                            {globalSearchResults && (
                                <div className="absolute top-full left-0 w-full bg-white dark:bg-slate-950 dark:bg-slate-900 shadow-xl rounded-xl mt-2 border border-slate-200 dark:border-slate-700 overflow-hidden max-h-64 overflow-y-auto z-50">
                                    {globalSearchResults.projects.map(p => (
                                        <button key={p.id} onClick={() => { setSelectedProject(p); setGlobalSearchResults(null); setSearchQuery(''); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b last:border-0 dark:hover:bg-slate-700 dark:border-slate-700">
                                            <div className="font-bold text-sm text-slate-800 dark:text-white">{p.title}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <button onClick={() => setIsProfileModalOpen(true)} className="flex items-center space-x-2 hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-lg transition-colors">
                        <div className={`w-8 h-8 rounded-full ${currentUser.avatarColor || 'bg-emerald-600'} text-white flex items-center justify-center font-bold text-sm`}>{currentUser.customInitials || currentUser.fullName.charAt(0)}</div>
                    </button>
                </div>

                {/* CONTENT AREA */}
                {!isHydrated && activeTab === 'dashboard' ? <DashboardSkeleton /> : !isHydrated ? <div className="h-screen"></div> : (
                    <Suspense fallback={<DashboardSkeleton />}>
                        {selectedProject ? (
                            <ProjectDetail
                                project={selectedProject}
                                onBack={() => setSelectedProject(null)}
                                onSave={updateProject}
                                onDelete={handleDeleteProject}
                                onDuplicate={handleDuplicateProject}
                                onTriggerAutomation={triggerAutomation}
                                clients={clients}
                            />
                        ) : (
                            <div className="p-4 md:p-8">
                                {activeTab === 'dashboard' ? (
                                    <>
                                        <div className="flex justify-end mb-6">
                                            <button onClick={() => { setPrefillClient(null); setIsModalOpen(true); }} className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all active:scale-95">
                                                <Plus size={20} /><span>Nouvelle Demande</span>
                                            </button>
                                        </div>
                                        <Dashboard
                                            projects={projects}
                                            onNavigate={handleDashboardNavigate}
                                            notes={globalNotes}
                                            onAddNote={handleAddNote}
                                            onDeleteNote={handleDeleteNote}
                                            currentUser={currentUser}
                                        />
                                    </>
                                ) : activeTab === 'agenda' ? (
                                    <AgendaPage projects={projects} onProjectClick={handleProjectSelect} currentUser={currentUser} onUpdateProject={updateProject} />
                                ) : activeTab === 'projects' ? (
                                    <div className="bg-white dark:bg-slate-950 dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col h-[calc(100vh-200px)]">
                                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                                            <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg">
                                                <button onClick={() => setProjectViewMode('LIST')} className={`p-2 rounded-md ${projectViewMode === 'LIST' ? 'bg-white dark:bg-slate-950 shadow text-emerald-600' : 'text-slate-500'}`}><LayoutList size={18} /></button>
                                                <button onClick={() => { setProjectViewMode('KANBAN'); setStatusFilter('ALL'); }} className={`p-2 rounded-md ${projectViewMode === 'KANBAN' ? 'bg-white dark:bg-slate-950 shadow text-emerald-600' : 'text-slate-500'}`}><Kanban size={18} /></button>
                                            </div>
                                            {projectViewMode === 'LIST' && (
                                                <div className="flex space-x-2 overflow-x-auto scrollbar-hide">
                                                    <button onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }} className={`px-3 py-1 rounded-lg text-xs font-bold ${statusFilter === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-500'}`}>TOUS</button>
                                                    <button onClick={() => { setStatusFilter(ProjectStatus.IN_PROGRESS); setCurrentPage(1); }} className={`px-3 py-1 rounded-lg text-xs font-bold ${statusFilter === ProjectStatus.IN_PROGRESS ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-600'}`}>EN COURS</button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 overflow-hidden bg-[#F3F4F6] dark:bg-slate-900 relative">
                                            {projectViewMode === 'KANBAN' ? (
                                                <div className="h-full p-4 overflow-x-auto"><KanbanBoard projects={projects} onProjectClick={handleProjectSelect} onProjectDelete={handleDeleteProject} /></div>
                                            ) : (
                                                <ProjectList projects={paginatedProjects} onSelect={handleProjectSelect} onDelete={handleDeleteProject} onValidate={validateQuote} onSort={handleSort} startIndex={startIndex} />
                                            )}
                                        </div>
                                    </div>
                                ) : activeTab === 'clients' ? (
                                    <ClientsPage
                                        clients={clients}
                                        projects={projects}
                                        onAddClient={handleAddClient}
                                        onDeleteClient={handleDeleteClient}
                                        onUpdateClient={handleUpdateClient}
                                        onNavigateToProject={handleProjectSelect}
                                        onCreateProject={handleCreateProjectForClient}
                                        onBulkAddProjects={handleBulkAddProjects}
                                    />
                                ) : activeTab === 'partners' ? (
                                    <PartnersPage clients={clients} onAddClient={handleAddClient} onUpdateClient={handleUpdateClient} onDeleteClient={handleDeleteClient} />
                                ) : activeTab === 'employees' ? (
                                    <EmployeesPage
                                        employees={employees}
                                        onAddEmployee={handleAddEmployee}
                                        onUpdateEmployee={handleUpdateEmployee}
                                        onDeleteEmployee={handleDeleteEmployee}
                                    />
                                ) : activeTab === 'administrative' ? (
                                    <AdminPage
                                        data={adminData}
                                        onUpdate={handleUpdateAdminData}
                                    />
                                ) : activeTab === 'tasks' ? (
                                    <TasksPage
                                        currentUser={currentUser}
                                        onUpdateUser={handleUpdateUser}
                                        projects={projects}
                                        onUpdateProject={updateProject}
                                    />
                                ) : activeTab === 'settings' && currentUser ? (
                                    <SettingsPage currentUser={currentUser} users={users} onAddUser={handleAddUser} onDeleteUser={handleDeleteUser} onUpdateUser={handleUpdateUser} />
                                ) : null}
                            </div>
                        )}
                    </Suspense>
                )}
            </main>
            <Suspense fallback={null}>
                {isModalOpen && <AddProjectModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setPrefillClient(null); }} onAdd={addProject} initialClient={prefillClient} clients={clients} projects={projects} />}
            </Suspense>
            {currentUser && <UserProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} user={currentUser} onSave={handleUpdateProfile} />}
        </div>
    );
};

export default App;
