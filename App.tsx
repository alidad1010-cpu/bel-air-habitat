import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import { useDebounce } from './hooks/useDebounce';
import { useKeyboardShortcuts, StandardShortcuts } from './hooks/useKeyboardShortcuts';
import { useTheme } from './contexts/ThemeContext';
import ErrorHandler from './services/errorService';
import { auditLogService, AuditAction, AuditResource } from './services/auditLogService';
// PWA registration - conditionally imported
// Fix: Handle case where PWA plugin is disabled in production build
let useRegisterSW: any;
try {
  // @ts-ignore - virtual module may not exist in production build
  const pwaModule = require('virtual:pwa-register/react');
  useRegisterSW = pwaModule.useRegisterSW;
} catch {
  // PWA not available - provide fallback
  useRegisterSW = () => ({
    offlineReady: [false, () => {}],
    needRefresh: [false, () => {}],
    updateServiceWorker: async () => {},
  });
}
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Search,
  LayoutList,
  Kanban,
  Loader2,
  Wifi,
  WifiOff,
  RefreshCw,
  Menu,
  RotateCw,
  AlertTriangle,
  X,
  Bell,
  Upload,
} from 'lucide-react';

import Sidebar from './components/Sidebar';
import UserProfileModal from './components/UserProfileModal';
import LoginPage from './components/LoginPage';
import Breadcrumbs from './components/Breadcrumbs';
import QuickActions from './components/QuickActions';
import ImprovedSearchResults from './components/ImprovedSearchResults';
import NotificationDropdown from './components/NotificationDropdown';
import {
  Project,
  ProjectStatus,
  User,
  Client,
  Employee,
  CompanyAdministrativeData,
  Expense,
  AttendanceRecord,
  Prospect,
  ProspectStatus,
  AppNotification,
} from './types';

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
const ExpensesPage = lazy(() => import('./components/ExpensesPage'));
const ProspectionPage = lazy(() => import('./components/ProspectionPage'));
const ImportProjectsModal = lazy(() => import('./components/ImportProjectsModal'));

// --- FIREBASE IMPORTS ---
import {
  saveDocument,
  deleteDocument,
  subscribeToAuth,
  subscribeToCollection,
  where,
  orderBy,
  limit,
} from './services/firebaseService';

// --- DATA SANITIZATION & STORAGE UTILITIES ---
const sanitizeStorageData = (data: any, ancestors = new Set<any>(), depth = 0): any => {
  // 0. Depth limit to prevent stack overflow
  if (depth > 20) return undefined;

  // 1. Primitive checks
  if (data === null || typeof data !== 'object') return data;
  if (data instanceof Date) return data.toISOString();

  // 2. Cycle detection (ANCESTORS ONLY - Allows DAGs/Shared Refs)
  if (ancestors.has(data)) return undefined;

  // 3. Duck typing for Firebase types
  if (typeof data.toDate === 'function') {
    try {
      return data.toDate().toISOString();
    } catch (e) {}
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
  )
    return undefined;

  // 5. Recursion with Ancestors Tracking
  const newAncestors = new Set(ancestors);
  newAncestors.add(data);

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeStorageData(item, newAncestors, depth + 1));
  }

  const newObj: any = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      // Block generic dangerous keys
      if (
        key.startsWith('__') ||
        key.startsWith('_react') ||
        // 'src' REMOVED from blacklist to allow images/iframes
        key === 'source' ||
        key === 'view' ||
        key === 'ownerDocument' ||
        key === 'delegate' ||
        key === 'firestore' ||
        typeof data[key] === 'function'
      )
        continue;

      const val = sanitizeStorageData(data[key], newAncestors, depth + 1);
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
    console.warn('JSON Stringify failed, fallback to empty object', e);
    return '{}';
  }
};

const safeSessionStorageSet = (key: string, value: any) => {
  try {
    sessionStorage.setItem(key, safeJsonStringify(value));
  } catch (e) {
    console.warn('Session Storage full or error', e);
  }
};

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
};

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
  [key: string]: any; // Index signature for dynamic property access
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
    } catch (e) {
      return null;
    }
  });

  const [users, setUsers] = useState<User[]>([]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false); // Added state

  // ADMIN DATA STATE
  const [adminData, setAdminData] = useState<CompanyAdministrativeData>({
    id: 'administrative',
    documents: [],
    vehicles: [],
  });

  // Alert State
  const [docAlerts, setDocAlerts] = useState<{ count: number; type: 'expired' | 'warning' } | null>(
    null
  );

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
      console.log('Auto-updating application...');
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
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showSyncNotification, setShowSyncNotification] = useState(false);

  // Resume active tab from storage to avoid jarring switch on reload
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined')
      return sessionStorage.getItem('lastActiveTab') || 'dashboard';
    return 'dashboard';
  });

  // MOBILE SIDEBAR STATE
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isImportProjectsModalOpen, setIsImportProjectsModalOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [prefillClient, setPrefillClient] = useState<Client | null>(null);

  // MOBILE HISTORY SYNC (SWIPE TO BACK)
  const isPopping = useRef(false);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      isPopping.current = true;

      // 1. Restore Tab
      if (event.state?.tab) {
        setActiveTab(event.state.tab);
      }

      // 2. Restore Project Selection (or deselect)
      if (event.state?.selectedProjectId) {
        const proj = projects.find((p) => p.id === event.state.selectedProjectId);
        if (proj) setSelectedProject(proj);
      } else {
        setSelectedProject(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [projects]); // Depend on projects to find the project by ID

  // Sync Active Tab to URL (Basic validation)
  useEffect(() => {
    if (isPopping.current) {
      isPopping.current = false;
      return;
    }

    // If we have a selected project, the URL/History should reflect that
    if (selectedProject) {
      window.history.pushState(
        { tab: activeTab, selectedProjectId: selectedProject.id },
        '',
        `#${activeTab}/project/${selectedProject.id}`
      );
    } else {
      // Otherwise just the tab
      window.history.pushState({ tab: activeTab }, '', `#${activeTab}`);
    }
  }, [activeTab, selectedProject]);
  const [searchQuery, setSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState<{
    projects: Project[];
    clients: Client[];
    employees: Employee[];
  } | null>(null);
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
      clients
        .filter((c) => c.type === 'PARTENAIRE' || c.type === 'SOUS_TRAITANT')
        .forEach((partner) => {
          partner.documents?.forEach((doc) => {
            if (doc.expiryDate) {
              const exp = new Date(doc.expiryDate);
              const diff = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
              if (diff < 0) expiredCount++;
              else if (diff < 30) warningCount++;
            }
          });
        });

      // 2. Check Admin Docs
      adminData.documents.forEach((doc) => {
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
            lastLogin: Date.now(),
          };
          setCurrentUser((prev) => (prev?.id === firebaseUser.uid ? prev : basicUser));

          // Audit Log - Login (fire-and-forget with error handling)
          (async () => {
            try {
              await auditLogService.logLogin(basicUser);
            } catch (error) {
              // Errors are already handled by auditLogService, but we ensure completion
              console.warn('Audit log login failed:', error);
            }
          })();

          setTimeout(() => {
            saveDocument('users', basicUser.id, sanitizeStorageData(basicUser));
          }, 2000);
        }
      } else {
        if (!import.meta.env.DEV || currentUser?.id !== 'demo') {
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
      console.log(
        'Network restored. Firestore will automatically reconcile pending writes and listen for updates.'
      );
      setTimeout(() => setShowSyncNotification(false), 4000);
      updateServiceWorker(true); // Auto-update if online
    };
    const handleOffline = () => setIsOnline(false);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        console.log('App resumed - verifying connection');
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
        console.warn('Hydration failed', e);
      } finally {
        setIsHydrated(true);
      }
    };

    setTimeout(loadLocalData, 0);
  }, []);

  useEffect(() => {
    // FORCE CACHE BUSTING FOR THEME
    // Remove old 'theme' key to prevent 'light' mode sticking
    localStorage.removeItem('theme');
    // Set new key to ensure future persistence starts fresh
    localStorage.setItem('theme_v2', 'light');

    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    let unsubProjects: (() => void) | undefined;
    let unsubClients: (() => void) | undefined;
    let unsubUsers: (() => void) | undefined;
    let unsubCompany: (() => void) | undefined;
    let unsubEmployees: (() => void) | undefined;
    let unsubExpenses: (() => void) | undefined;
    let unsubAttendances: (() => void) | undefined;

    let unsubTeamMessages: (() => void) | undefined;
    let unsubProspects: (() => void) | undefined;
    let unsubNotifications: (() => void) | undefined;
    let unsubPartners: (() => void) | undefined;

    const setupSubscriptions = async () => {
      // Unchanged: Projects
      unsubProjects = subscribeToCollection(
        'projects',
        (data) => {
          const castData = Array.isArray(data) ? (data as Project[]) : [];
          const cleanData = sanitizeStorageData(castData);

          // AUTO-START LOGIC
          const today = new Date().toISOString().split('T')[0];
          const processedData = cleanData.map((p: Project) => {
            if (p.status === ProjectStatus.VALIDATED && p.startDate && p.startDate <= today) {
              console.log(`Auto-starting project: ${p.title} (${p.id})`);
              const updatedProject = { ...p, status: ProjectStatus.IN_PROGRESS };
              saveDocument('projects', updatedProject.id, updatedProject).catch(console.error);
              return updatedProject;
            }
            return p;
          });

          if (processedData.length === 0 && projects.length > 0) return;
          setProjects(processedData);
          safeLocalStorageSet('artisan-projects-backup', processedData);
        },
        [where('status', '!=', 'ARCHIVED')]
      );

      // Unified Clients + Partners Subscription
      let localClients: Client[] = [];
      let localPartners: Client[] = [];

      const updateMergedClients = () => {
        const merged = [...localClients, ...localPartners];
        // Deduplicate by ID
        const uniqueMap = new Map();
        merged.forEach((c) => uniqueMap.set(c.id, c));
        const uniqueList = Array.from(uniqueMap.values());
        setClients(uniqueList);
        safeLocalStorageSet('artisan-clients-backup', uniqueList);
      };

      unsubClients = subscribeToCollection('clients', (data) => {
        const castData = Array.isArray(data) ? (data as Client[]) : [];
        localClients = sanitizeStorageData(castData);
        updateMergedClients();
      });

      unsubPartners = subscribeToCollection('partners', (data) => {
        const castData = Array.isArray(data) ? (data as Client[]) : [];
        localPartners = sanitizeStorageData(castData);
        updateMergedClients();
      });

      // Unchanged: Employees
      unsubEmployees = subscribeToCollection('employees', (data) => {
        const castData = Array.isArray(data) ? (data as Employee[]) : [];
        const cleanData = sanitizeStorageData(castData);
        if (cleanData.length === 0 && employees.length > 0) return;
        setEmployees(cleanData);
        safeLocalStorageSet('artisan-employees-backup', cleanData);
      });

      // Unchanged: Expenses
      unsubExpenses = subscribeToCollection('expenses', (data) => {
        const castData = Array.isArray(data) ? (data as Expense[]) : [];
        const cleanData = sanitizeStorageData(castData);
        setExpenses(cleanData);
      });

      // Unchanged: Attendances
      unsubAttendances = subscribeToCollection('attendances', (data) => {
        const castData = Array.isArray(data) ? (data as AttendanceRecord[]) : [];
        const cleanData = sanitizeStorageData(castData);
        setAttendances(cleanData);
      });

      // NEW: Prospects
      unsubProspects = subscribeToCollection('prospects', (data) => {
        const castData = Array.isArray(data) ? (data as Prospect[]) : [];
        const cleanData = sanitizeStorageData(castData);
        setProspects(cleanData);
      });

      // NEW: Notifications
      unsubNotifications = subscribeToCollection(
        'notifications',
        (data) => {
          const castData = Array.isArray(data) ? (data as AppNotification[]) : [];
          // Sort by date desc
          const sorted = castData.sort((a, b) => (b.date || 0) - (a.date || 0));
          setNotifications(sorted);
        },
        [orderBy('date', 'desc'), limit(50)]
      );

      // Unchanged: Users
      unsubUsers = subscribeToCollection('users', (data) => {
        const castData = Array.isArray(data) ? (data as User[]) : [];
        const cleanData = sanitizeStorageData(castData);
        setUsers(cleanData);
      });

      // NEW: Team Messages Subscription (Fast Sync)
      unsubTeamMessages = subscribeToCollection(
        'team_messages',
        (data) => {
          const messages = data.map((d) => ({ ...d, id: d.id }) as SharedNote);
          // Sort Descending (Newest first)
          messages.sort((a, b) => b.createdAt - a.createdAt);
          setGlobalNotes(messages);
        },
        [orderBy('createdAt', 'desc'), limit(50)]
      );

      // UPDATED: Company Data (Admin Only, Legacy Notes Removed)
      unsubCompany = subscribeToCollection('company', (data) => {
        const adminDoc = data.find((d) => d.id === 'administrative');
        if (adminDoc) {
          setAdminData({
            id: 'administrative',
            documents: adminDoc.documents || [],
            vehicles: adminDoc.vehicles || [],
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
      if (unsubExpenses) unsubExpenses();
      if (unsubAttendances) unsubAttendances();
      if (unsubTeamMessages) unsubTeamMessages();
      if (unsubProspects) unsubProspects();
      if (unsubPartners) unsubPartners();
      if (unsubNotifications) unsubNotifications();
    };
  }, [isHydrated, currentUser]);

  // OPTIMIZATION: Debounce search query pour réduire les calculs
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // OPTIMIZATION: Mémoriser la fonction de recherche globale
  const handleGlobalSearch = useCallback(
    (query: string) => {
      if (!query || query.length < 2) {
        setGlobalSearchResults(null);
        return;
      }
      const lowerQuery = query.toLowerCase();

      const matchedProjects = projects.filter(
        (p) =>
          p.title.toLowerCase().includes(lowerQuery) ||
          p.client.name.toLowerCase().includes(lowerQuery) ||
          p.id.toLowerCase().includes(lowerQuery) ||
          p.description?.toLowerCase().includes(lowerQuery)
      );

      const matchedClients = clients.filter(
        (c) =>
          c.name.toLowerCase().includes(lowerQuery) ||
          c.email?.toLowerCase().includes(lowerQuery) ||
          c.phone?.toLowerCase().includes(lowerQuery)
      );

      const matchedEmployees = employees.filter(
        (e) =>
          (e.firstName + ' ' + e.lastName).toLowerCase().includes(lowerQuery) ||
          e.email?.toLowerCase().includes(lowerQuery) ||
          e.position.toLowerCase().includes(lowerQuery)
      );

      setGlobalSearchResults({
        projects: matchedProjects,
        clients: matchedClients,
        employees: matchedEmployees,
      });
    },
    [projects, clients, employees]
  );

  useEffect(() => {
    handleGlobalSearch(debouncedSearchQuery);
  }, [debouncedSearchQuery, handleGlobalSearch]);

  // SYNC USER PROFILE: Ensure currentUser reflects the latest Firestore data
  useEffect(() => {
    if (currentUser && users.length > 0) {
      const remoteProfile = users.find((u) => u.id === currentUser.id);
      if (remoteProfile) {
        // Determine if we need to update local state (deep comparison or key fields)
        // We use JSON stringify for simplicity as the object is sanitized
        const localStr = JSON.stringify(currentUser);
        const remoteStr = JSON.stringify(remoteProfile);

        if (localStr !== remoteStr) {
          console.log('Syncing local user profile with remote data');
          setCurrentUser(remoteProfile);
          safeSessionStorageSet('currentUser', remoteProfile);
        }
      }
    }
  }, [users, currentUser?.id]); // Only depend on users list and current ID, not full currentUser to avoid loops if possible, though strict equality check handles it.

  const filteredAndSortedProjects = useMemo(() => {
    let filtered = projects;
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((p) => p.status === statusFilter);
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
      lastLogin: Date.now(),
    };
    setCurrentUser(tempUser);
    sessionStorage.setItem('currentUser', safeJsonStringify(tempUser));
    return true;
  }, []);

  const handleLogout = useCallback(async () => {
    // Audit Log before clearing user
    if (currentUser) {
      try {
        await auditLogService.logLogout(currentUser);
      } catch (error) {
        // Errors are already handled by auditLogService, but we ensure completion
        console.warn('Audit log logout failed:', error);
      }
    }
    setCurrentUser(null);
    sessionStorage.removeItem('currentUser');
  }, [currentUser]);

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

  // KEYBOARD SHORTCUTS
  const { toggleTheme } = useTheme();

  // BUG FIX 1: Memoize shortcuts array to prevent memory leak
  // The shortcuts array was being recreated on every render, causing handleKeyDown
  // to be recreated, which re-added event listeners without proper cleanup
  const keyboardShortcuts = useMemo(
    () => [
      {
        key: StandardShortcuts.SEARCH,
        ctrlOrCmd: true,
        action: () => {
          const searchInput = document.querySelector(
            'input[type="text"][placeholder*="Recherche"], input[type="text"][placeholder*="recherche"]'
          ) as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
            searchInput.select();
          }
        },
        description: 'Ouvrir la recherche',
      },
      {
        key: StandardShortcuts.NEW_PROJECT,
        ctrlOrCmd: true,
        action: () => {
          if (currentUser) setIsModalOpen(true);
        },
        description: 'Nouveau projet',
      },
      {
        key: StandardShortcuts.SETTINGS,
        ctrlOrCmd: true,
        action: () => {
          if (currentUser) handleTabSwitch('settings');
        },
        description: 'Ouvrir les paramètres',
      },
      {
        key: StandardShortcuts.HELP,
        ctrlOrCmd: true,
        action: () => {
          // Toggle theme as help shortcut (can be changed later)
          toggleTheme();
        },
        description: 'Basculer le thème',
      },
      {
        key: StandardShortcuts.ESCAPE,
        action: () => {
          if (isModalOpen) setIsModalOpen(false);
          if (isProfileModalOpen) setIsProfileModalOpen(false);
          if (isImportProjectsModalOpen) setIsImportProjectsModalOpen(false);
          setGlobalSearchResults(null);
          setSearchQuery('');
        },
        description: 'Fermer les modales',
      },
    ],
    [
      currentUser,
      handleTabSwitch,
      toggleTheme,
      isModalOpen,
      isProfileModalOpen,
      isImportProjectsModalOpen,
    ]
  );

  useKeyboardShortcuts({
    enabled: !!currentUser, // Only enable when logged in
    shortcuts: keyboardShortcuts,
  });

  const addProject = useCallback(
    async (project: Project) => {
      const cleanProject = sanitizeStorageData(project);
      setProjects((prev) => {
        const newProjects = [cleanProject, ...prev];
        safeLocalStorageSet('artisan-projects-backup', newProjects);
        return newProjects;
      });
      setActiveTab('projects');
      setStatusFilter(ProjectStatus.NEW);
      await saveDocument('projects', cleanProject.id, cleanProject);
      // Audit Log
      await auditLogService.logCreate(
        currentUser,
        AuditResource.PROJECT,
        cleanProject.id,
        cleanProject.title
      );

      // BUG FIX 2: Check for existing client and create new one if needed
      // We need to do this outside setState because setState updater functions can't be async
      setClients((prevClients) => {
        const existingClient = prevClients.find((c) => {
          const emailMatch =
            c.email &&
            cleanProject.client.email &&
            c.email.toLowerCase() === cleanProject.client.email.toLowerCase();
          const nameMatch =
            c.name.trim().toLowerCase() === cleanProject.client.name.trim().toLowerCase();
          return emailMatch || nameMatch;
        });

        if (!existingClient) {
          const newClient: Client = {
            ...cleanProject.client,
            id: Date.now().toString(),
            type: cleanProject.client.type || 'PARTICULIER', // Default type
          };
          const newClients = [...prevClients, newClient];
          safeLocalStorageSet('artisan-clients-backup', newClients);

          // BUG FIX 2: Save client asynchronously after state update
          // Without await, local state updates immediately but Firestore save happens async
          // This can cause data sync issues if save fails or component unmounts
          // We save it outside the setState to avoid making the updater async
          saveDocument('clients', newClient.id!, newClient).catch((error) => {
            console.error('Failed to save new client:', error);
            ErrorHandler.handle(error, 'App - addProject - Client Save');
          });

          return newClients;
        }
        return prevClients;
      });
    },
    [currentUser]
  );

  const handleBulkAddProjects = useCallback(
    async (newProjects: Project[]) => {
      // 1. Sanitize Projects
      const cleanProjects = newProjects.map((p) => sanitizeStorageData(p));

      // 2. Identify and Create NEW Clients
      const newClientsToSave: Client[] = [];

      for (const proj of cleanProjects) {
        const clientExists = clients.some((c) => c.id === proj.client.id);
        const alreadyQueued = newClientsToSave.some((c) => c.id === proj.client.id);

        if (!clientExists && !alreadyQueued) {
          newClientsToSave.push(proj.client);
        }
      }

      // 3. Update Local State & Save Clients
      if (newClientsToSave.length > 0) {
        setClients((prev) => {
          const updated = [...prev, ...newClientsToSave];
          safeLocalStorageSet('artisan-clients-backup', updated);
          return updated;
        });

        for (const client of newClientsToSave) {
          await saveDocument('clients', client.id!, client);
        }
      }

      // 4. Update Local State & Save Projects
      setProjects((prev) => {
        const updated = [...cleanProjects, ...prev];
        safeLocalStorageSet('artisan-projects-backup', updated);
        return updated;
      });

      // Switch to projects tab
      setActiveTab('projects');
      setStatusFilter('ALL');

      // Save projects
      for (const proj of cleanProjects) {
        await saveDocument('projects', proj.id, proj);
      }
    },
    [clients]
  );

  const handleDuplicateProject = useCallback(
    async (sourceProject: Project) => {
      const newId = Date.now().toString();
      const duplicatedProject: Project = {
        ...sourceProject,
        id: newId,
        businessCode: `${sourceProject.businessCode}-COP`,
        title: `${sourceProject.title} (Copie)`,
        status: ProjectStatus.NEW,
        createdAt: Date.now(),
        appointments: [],
        tasks: sourceProject.tasks?.map((t) => ({
          ...t,
          isDone: false,
          id: Date.now().toString() + Math.random(),
        })),
        documents: [],
        photos: [],
        invoices: [],
      };
      await addProject(duplicatedProject);
      setSelectedProject(duplicatedProject);
    },
    [addProject]
  );

  const updateProject = useCallback(
    async (project: Project) => {
      const cleanProject = sanitizeStorageData(project);
      const oldProject = projects.find((p) => p.id === cleanProject.id);
      setProjects((prev) => {
        const updatedProjects = prev.map((p) => (p.id === cleanProject.id ? cleanProject : p));
        safeLocalStorageSet('artisan-projects-backup', updatedProjects);
        return updatedProjects;
      });
      await saveDocument('projects', cleanProject.id, cleanProject);
      // Audit Log
      await auditLogService.logUpdate(
        currentUser,
        AuditResource.PROJECT,
        cleanProject.id,
        cleanProject.title,
        oldProject,
        cleanProject
      );
    },
    [currentUser, projects]
  );

  const handleDeleteProject = useCallback(
    async (id: string) => {
      const project = projects.find((p) => p.id === id);
      setProjects((prev) => {
        const remainingProjects = prev.filter((p) => p.id !== id);
        safeLocalStorageSet('artisan-projects-backup', remainingProjects);
        return remainingProjects;
      });
      setSelectedProject(null);
      await deleteDocument('projects', id);
      // Audit Log
      if (project) {
        await auditLogService.logDelete(
          currentUser,
          AuditResource.PROJECT,
          id,
          project.title,
          project
        );
      }
    },
    [currentUser, projects]
  );

  const validateQuote = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const project = projects.find((p) => p.id === id);
      if (project) {
        const updated = { ...project, status: ProjectStatus.VALIDATED };
        const cleanUpdated = sanitizeStorageData(updated);
        setProjects((prev) => {
          const updatedProjects = prev.map((p) => (p.id === id ? cleanUpdated : p));
          safeLocalStorageSet('artisan-projects-backup', updatedProjects);
          return updatedProjects;
        });
        await saveDocument('projects', cleanUpdated.id, cleanUpdated);
      }
    },
    [projects]
  );

  const handleSort = useCallback((field: string) => {
    console.log('Sort', field);
  }, []);

  const handleDashboardNavigate = useCallback(
    (tab: string, filter?: ProjectStatus | 'ALL' | null) => {
      handleTabSwitch(tab, filter);
    },
    [handleTabSwitch]
  );

  const handleAddClient = useCallback(
    async (client: Client) => {
      const id = Date.now().toString();
      const fullClient = { ...client, id };
      const cleanClient = sanitizeStorageData(fullClient);
      setClients((prev) => {
        const newClients = [...prev, cleanClient];
        safeLocalStorageSet('artisan-clients-backup', newClients);
        return newClients;
      });
      await saveDocument('clients', id, cleanClient);
      // Audit Log
      await auditLogService.logCreate(currentUser, AuditResource.CLIENT, id, cleanClient.name);
    },
    [currentUser]
  );

  const handleDeleteClient = useCallback(
    async (client: Client) => {
      if (window.confirm('Supprimer ce client ?')) {
        setClients((prev) => {
          const remainingClients = prev.filter((c) => c.id !== client.id);
          safeLocalStorageSet('artisan-clients-backup', remainingClients);
          return remainingClients;
        });
        if (client.id) {
          await deleteDocument('clients', client.id);
          // Audit Log
          await auditLogService.logDelete(
            currentUser,
            AuditResource.CLIENT,
            client.id,
            client.name,
            client
          );
        }
      }
    },
    [currentUser]
  );

  const handleUpdateClient = useCallback(
    async (client: Client) => {
      const cleanClient = sanitizeStorageData(client);
      const oldClient = clients.find((c) => c.id === cleanClient.id);
      setClients((prev) => {
        const updated = prev.map((c) => (c.id === cleanClient.id ? cleanClient : c));
        safeLocalStorageSet('artisan-clients-backup', updated);
        return updated;
      });
      if (cleanClient.id) {
        await saveDocument('clients', cleanClient.id, cleanClient);
        // Audit Log
        await auditLogService.logUpdate(
          currentUser,
          AuditResource.CLIENT,
          cleanClient.id,
          cleanClient.name,
          oldClient,
          cleanClient
        );
      }
    },
    [currentUser, clients]
  );

  const handleAddEmployee = useCallback(
    async (emp: Employee) => {
      const cleanEmp = sanitizeStorageData(emp);
      setEmployees((prev) => {
        const newEmps = [...prev, cleanEmp];
        safeLocalStorageSet('artisan-employees-backup', newEmps);
        return newEmps;
      });
      await saveDocument('employees', cleanEmp.id, cleanEmp);
      // Audit Log
      await auditLogService.logCreate(
        currentUser,
        AuditResource.EMPLOYEE,
        cleanEmp.id,
        `${cleanEmp.firstName} ${cleanEmp.lastName}`
      );
    },
    [currentUser]
  );

  const handleUpdateEmployee = useCallback(
    async (emp: Employee) => {
      const cleanEmp = sanitizeStorageData(emp);
      const oldEmp = employees.find((e) => e.id === cleanEmp.id);
      setEmployees((prev) => {
        const updated = prev.map((e) => (e.id === cleanEmp.id ? cleanEmp : e));
        safeLocalStorageSet('artisan-employees-backup', updated);
        return updated;
      });
      await saveDocument('employees', cleanEmp.id, cleanEmp);
      // Audit Log
      await auditLogService.logUpdate(
        currentUser,
        AuditResource.EMPLOYEE,
        cleanEmp.id,
        `${cleanEmp.firstName} ${cleanEmp.lastName}`,
        oldEmp,
        cleanEmp
      );
    },
    [currentUser, employees]
  );

  const handleDeleteEmployee = useCallback(
    async (id: string) => {
      if (window.confirm('Supprimer ce salarié ?')) {
        const employee = employees.find((e) => e.id === id);
        setEmployees((prev) => {
          const remaining = prev.filter((e) => e.id !== id);
          safeLocalStorageSet('artisan-employees-backup', remaining);
          return remaining;
        });
        await deleteDocument('employees', id);
        // Audit Log
        if (employee) {
          await auditLogService.logDelete(
            currentUser,
            AuditResource.EMPLOYEE,
            id,
            `${employee.firstName} ${employee.lastName}`,
            employee
          );
        }
      }
    },
    [currentUser, employees]
  );

  const handleUpdateAdminData = async (newData: CompanyAdministrativeData) => {
    setAdminData(newData);
    const cleanData = sanitizeStorageData(newData);
    await saveDocument('company', 'administrative', cleanData);
  };

  const handleAddUser = async (user: User) => {
    const clean = sanitizeStorageData(user);
    await saveDocument('users', clean.id, clean);
  };

  const handleUpdateUser = async (user: User) => {
    const updatedUser = { ...user };
    setCurrentUser(updatedUser);
    safeSessionStorageSet('currentUser', updatedUser);
    const clean = sanitizeStorageData(updatedUser);
    await saveDocument('users', clean.id, clean);
  };

  // --- EXPENSE HANDLERS ---
  const handleAddExpense = useCallback(async (expense: Expense) => {
    const clean = sanitizeStorageData(expense);
    setExpenses((prev) => [...prev, clean]);
    await saveDocument('expenses', clean.id, clean);
  }, []);

  const handleUpdateExpense = useCallback(async (expense: Expense) => {
    const clean = sanitizeStorageData(expense);
    setExpenses((prev) => prev.map((e) => (e.id === clean.id ? clean : e)));
    await saveDocument('expenses', clean.id, clean);
  }, []);

  const handleDeleteExpense = useCallback(async (id: string) => {
    if (window.confirm('Supprimer cette dépense ?')) {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      await deleteDocument('expenses', id);
    }
  }, []);

  // --- ATTENDANCE HANDLERS ---
  const handleUpdateAttendance = useCallback(async (record: AttendanceRecord) => {
    const clean = sanitizeStorageData(record);
    setAttendances((prev) => {
      const index = prev.findIndex((a) => a.id === clean.id);
      if (index >= 0) {
        const newArr = [...prev];
        newArr[index] = clean;
        return newArr;
      }
      return [...prev, clean];
    });
    await saveDocument('attendances', clean.id, clean);
  }, []);

  const handleBulkUpdateAttendance = useCallback(async (records: AttendanceRecord[]) => {
    const cleanRecords = records.map((r) => sanitizeStorageData(r));
    setAttendances((prev) => {
      const newMap = new Map(prev.map((p) => [p.id, p]));
      cleanRecords.forEach((r) => newMap.set(r.id, r));
      return Array.from(newMap.values());
    });

    await Promise.all(cleanRecords.map((r) => saveDocument('attendances', r.id, r)));
  }, []);

  const handleBulkDeleteAttendance = useCallback(async (ids: string[]) => {
    setAttendances((prev) => prev.filter((a) => !ids.includes(a.id)));
    await Promise.all(ids.map((id) => deleteDocument('attendances', id)));
  }, []);

  // --- PROSPECTION HANDLERS ---
  const handleAddProspect = useCallback(async (prospect: Prospect) => {
    const clean = sanitizeStorageData(prospect);
    setProspects((prev) => [...prev, clean]);
    await saveDocument('prospects', clean.id, clean);
  }, []);

  const handleUpdateProspect = useCallback(async (prospect: Prospect) => {
    const clean = sanitizeStorageData(prospect);
    setProspects((prev) => prev.map((p) => (p.id === clean.id ? clean : p)));
    await saveDocument('prospects', clean.id, clean);
  }, []);

  const handleDeleteProspect = useCallback(async (id: string) => {
    if (window.confirm('Supprimer ce prospect ?')) {
      setProspects((prev) => prev.filter((p) => p.id !== id));
      await deleteDocument('prospects', id);
    }
  }, []);

  const handleConvertToClient = useCallback(
    async (prospect: Prospect) => {
      if (window.confirm(`Convertir "${prospect.contactName}" en client ?`)) {
        const newClient: Client = {
          id: Date.now().toString(),
          name: prospect.companyName || prospect.contactName,
          email: prospect.email || '',
          phone: prospect.phone || '',
          city: prospect.city || '',
          address: prospect.address || prospect.city || '',
          type: 'PARTICULIER', // Default
          notes: `Issu du prospect: ${prospect.contactName}\n${prospect.notes?.[0]?.content || ''}`,
        };

        // 1. Add Client
        await handleAddClient(newClient);

        // 2. Update Prospect to WON
        await handleUpdateProspect({ ...prospect, status: ProspectStatus.WON });

        // 3. Navigate/Feedback
        alert('Client créé avec succès !');
        setActiveTab('clients');
      }
    },
    [handleAddClient, handleUpdateProspect]
  );

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

    // Priority: Custom Initials -> Username -> Full Name -> Email -> Default
    let displayName = currentUser.customInitials || currentUser.username || currentUser.fullName;
    if (!displayName && currentUser.email) {
      displayName = getEmailInitials(currentUser.email);
    }

    const newNote: SharedNote = {
      id: Date.now().toString(),
      content: text,
      authorName: displayName || 'Utilisateur',
      authorId: currentUser.id,
      createdAt: Date.now(),
    };

    // Writes to 'team_messages' collection.
    // The real-time listener will automatically update the UI (locally immediately, then synced).
    try {
      await saveDocument('team_messages', newNote.id, newNote);
    } catch (error) {
      console.error('Failed to save note', error);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    // Direct delete from collection
    await deleteDocument('team_messages', noteId);
  };

  const handleDeleteUser = async (id: string) => {
    await deleteDocument('users', id);
  };
  const handleUpdateProfile = async (user: User) => {
    const clean = sanitizeStorageData(user);
    await saveDocument('users', clean.id, clean);
    setCurrentUser(clean);
    safeSessionStorageSet('currentUser', clean);
  };

  const triggerAutomation = useCallback(
    async (project: Project) => {
      if (!currentUser?.integrations?.automationWebhook) return;
      try {
        await fetch(currentUser.integrations.automationWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: safeJsonStringify(project),
        });
      } catch (error) {
        console.error('Automation error', error);
      }
    },
    [currentUser]
  );

  const handleCreateProjectForClient = useCallback((client: Client) => {
    setPrefillClient(client);
    setIsModalOpen(true);
  }, []);

  const handleManualRefresh = () => {
    window.location.reload();
  };

  // OPTIMIZED LOGIN HANDLER: Updates state immediately for instant feedback

  // if (!currentUser) return <LoginPage onLogin={handleLogin} />;
  // FORCE LOGIN FOR TESTING - REMOVE AFTER TEST
  if (!currentUser) return <LoginPage onLogin={handleLogin} />;

  const renderContent = () => {
    if (selectedProject) {
      return (
        <ProjectDetail
          project={selectedProject}
          onBack={() => setSelectedProject(null)}
          onSave={updateProject}
          onDelete={handleDeleteProject}
          onDuplicate={handleDuplicateProject}
          onTriggerAutomation={triggerAutomation}
          clients={clients}
        />
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="p-4 md:p-8">
            <div className="flex justify-end mb-6">
              <button
                onClick={() => {
                  setPrefillClient(null);
                  setIsModalOpen(true);
                }}
                className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all active:scale-95"
              >
                <Plus size={20} />
                <span>Nouvelle Demande</span>
              </button>
            </div>
            <Dashboard
              projects={projects}
              onNavigate={handleDashboardNavigate}
              notes={globalNotes}
              onAddNote={handleAddNote}
              onDeleteNote={handleDeleteNote}
              currentUser={currentUser}
              notifications={notifications}
            />
          </div>
        );
      case 'agenda':
        return (
          <AgendaPage
            projects={projects}
            onProjectClick={handleProjectSelect}
            currentUser={currentUser}
            onUpdateProject={updateProject}
          />
        );
      case 'projects':
        return (
          <div className="bg-white dark:bg-slate-950 dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col h-[calc(100vh-200px)]">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center space-x-2">
                <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg">
                  <button
                    onClick={() => setProjectViewMode('LIST')}
                    className={`p-2 rounded-md ${projectViewMode === 'LIST' ? 'bg-white dark:bg-slate-950 shadow text-emerald-600' : 'text-slate-500'}`}
                  >
                    <LayoutList size={18} />
                  </button>

                  <button
                    onClick={() => setIsImportProjectsModalOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg font-bold text-xs shadow transition-all ml-2 flex items-center"
                    title="Importer des chantiers (IA)"
                  >
                    <Upload size={14} className="mr-2" />
                    Import IA
                  </button>

                  <button
                    onClick={() => {
                      setProjectViewMode('KANBAN');
                      setStatusFilter('ALL');
                    }}
                    className={`p-2 rounded-md ${projectViewMode === 'KANBAN' ? 'bg-white dark:bg-slate-950 shadow text-emerald-600' : 'text-slate-500'}`}
                  >
                    <Kanban size={18} />
                  </button>
                </div>
              </div>
              {projectViewMode === 'LIST' && (
                <div className="flex space-x-2 overflow-x-auto scrollbar-hide">
                  <button
                    onClick={() => {
                      setStatusFilter('ALL');
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold ${statusFilter === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-500'}`}
                  >
                    TOUS
                  </button>
                  <button
                    onClick={() => {
                      setStatusFilter(ProjectStatus.IN_PROGRESS);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold ${statusFilter === ProjectStatus.IN_PROGRESS ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-600'}`}
                  >
                    EN COURS
                  </button>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-hidden bg-[#F3F4F6] dark:bg-slate-900 relative">
              {projectViewMode === 'KANBAN' ? (
                <div className="h-full p-4 overflow-x-auto">
                  <KanbanBoard
                    projects={projects}
                    onProjectClick={handleProjectSelect}
                    onProjectDelete={handleDeleteProject}
                  />
                </div>
              ) : (
                <ProjectList
                  projects={paginatedProjects}
                  onSelect={handleProjectSelect}
                  onDelete={handleDeleteProject}
                  onValidate={validateQuote}
                  onSort={handleSort}
                  startIndex={startIndex}
                />
              )}
            </div>
          </div>
        );
      case 'clients':
        return (
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
        );
      case 'partners':
        return (
          <PartnersPage
            clients={clients}
            onAddClient={handleAddClient}
            onUpdateClient={handleUpdateClient}
            onDeleteClient={handleDeleteClient}
          />
        );
      case 'employees':
        return (
          <EmployeesPage
            employees={employees}
            onAddEmployee={handleAddEmployee}
            onUpdateEmployee={handleUpdateEmployee}
            onDeleteEmployee={handleDeleteEmployee}
            expenses={expenses}
            onAddExpense={handleAddExpense}
            onUpdateExpense={handleUpdateExpense}
            onDeleteExpense={handleDeleteExpense}
            attendances={attendances}
            onUpdateAttendance={handleUpdateAttendance}
            onBulkUpdateAttendance={handleBulkUpdateAttendance}
            onBulkDeleteAttendance={handleBulkDeleteAttendance}
          />
        );
      case 'administrative':
        return <AdminPage data={adminData} onUpdate={handleUpdateAdminData} />;
      case 'tasks':
        return (
          <TasksPage
            currentUser={currentUser}
            onUpdateUser={handleUpdateUser}
            projects={projects}
            onUpdateProject={updateProject}
          />
        );
      case 'expenses':
        return (
          <ExpensesPage
            expenses={expenses}
            onAddExpense={handleAddExpense}
            onUpdateExpense={handleUpdateExpense}
            onDeleteExpense={handleDeleteExpense}
          />
        );
      case 'prospection':
        return (
          <ProspectionPage
            prospects={prospects}
            onAddProspect={handleAddProspect}
            onUpdateProspect={handleUpdateProspect}
            onDeleteProspect={handleDeleteProspect}
            onConvertToClient={handleConvertToClient}
          />
        );
      case 'settings':
        if (currentUser) {
          return (
            <SettingsPage
              currentUser={currentUser}
              users={users}
              onAddUser={handleAddUser}
              onDeleteUser={handleDeleteUser}
              onUpdateUser={handleUpdateUser}
            />
          );
        }
        return null;
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen transition-colors pt-[40px] md:pt-0">
      {/* ALERT BANNER (TOP) */}
      {docAlerts && (
        <div
          className={`fixed top-0 left-0 w-full z-[10000] px-4 py-2 flex items-center justify-between text-sm font-bold shadow-lg animate-slide-in-from-top ${docAlerts.type === 'expired' ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'}`}
        >
          <div className="flex items-center mx-auto">
            <AlertTriangle className="mr-2" size={18} />
            <span>
              {docAlerts.type === 'expired'
                ? `ATTENTION: ${docAlerts.count} document(s) expiré(s) détectés !`
                : `Info: ${docAlerts.count} document(s) expirent bientôt.`}
            </span>
            <button
              onClick={() =>
                setActiveTab(docAlerts.type === 'expired' ? 'partners' : 'administrative')
              }
              className="ml-4 underline hover:text-slate-200"
            >
              Vérifier maintenant
            </button>
          </div>
          <button
            onClick={() => setDocAlerts(null)}
            className="p-1 hover:bg-white dark:bg-slate-950/20 rounded"
          >
            <X size={16} />
          </button>
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
            <p className="text-xs text-slate-400">
              Vous pouvez continuer à travailler. Vos modifications sont sauvegardées localement.
            </p>
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
            <p className="text-xs text-emerald-100">
              Synchronisation des données effectuée avec succès.
            </p>
          </div>
        </div>
      )}

      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabSwitch}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isOnline={isOnline}
        currentUser={currentUser}
      />

      <main className="flex-1 md:ml-64 bg-transparent overflow-x-hidden min-h-screen relative w-full">
        {/* HEADER */}
        <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-950/50 backdrop-blur-md border-b border-slate-200 dark:border-white/5 px-4 md:px-8 py-4 flex justify-between items-center print:hidden shadow-sm">
          <div className="flex items-center space-x-2 md:space-x-4 flex-1">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 mr-2 text-white hover:bg-slate-800 rounded-lg md:hidden transition-colors"
            >
              <Menu size={24} />
            </button>

            {/* Breadcrumbs */}
            <Breadcrumbs
              items={[
                {
                  label:
                    activeTab === 'dashboard'
                      ? 'Tableau de bord'
                      : activeTab === 'tasks'
                        ? 'Mes Tâches'
                        : activeTab === 'agenda'
                          ? 'Agenda'
                          : activeTab === 'projects'
                            ? 'Dossiers'
                            : activeTab === 'clients'
                              ? 'Clients'
                              : activeTab === 'prospection'
                                ? 'Prospection'
                                : activeTab === 'partners'
                                  ? 'Partenaires'
                                  : activeTab === 'employees'
                                    ? 'Salariés'
                                    : activeTab === 'administrative'
                                      ? 'Administratif'
                                      : activeTab === 'expenses'
                                        ? 'Dépenses'
                                        : activeTab === 'settings'
                                          ? 'Paramètres'
                                          : 'Accueil',
                  onClick: () => {},
                },
                ...(selectedProject
                  ? [
                      {
                        label: selectedProject.client?.name || 'Client',
                        onClick: () => setActiveTab('clients'),
                      },
                      {
                        label: selectedProject.title,
                        onClick: () => {},
                      },
                    ]
                  : []),
              ]}
              className="hidden md:flex"
            />

            <h1 className="text-xl font-bold text-slate-800 dark:text-white capitalize md:hidden">
              {activeTab === 'tasks' ? 'Mes Tâches' : activeTab}
            </h1>
            <div className="relative max-w-md w-full md:ml-4 flex items-center">
              <div className="relative w-full">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <input
                  type="text"
                  name="search"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-900 border-none rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400"
                />
              </div>

              {/* Manual Refresh Button */}
              <button
                onClick={handleManualRefresh}
                className="md:hidden ml-2 p-2 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-white rounded-lg"
                title="Actualiser l'application"
              >
                <RotateCw size={18} />
              </button>

              {globalSearchResults && searchQuery.length > 0 && (
                <ImprovedSearchResults
                  results={globalSearchResults}
                  query={searchQuery}
                  onProjectClick={(p) => {
                    setSelectedProject(p);
                    setGlobalSearchResults(null);
                    setSearchQuery('');
                  }}
                  onClientClick={(c) => {
                    const isPartner = c.type === 'PARTENAIRE' || c.type === 'SOUS_TRAITANT';
                    setActiveTab(isPartner ? 'partners' : 'clients');
                    setGlobalSearchResults(null);
                    setSearchQuery('');
                  }}
                  onEmployeeClick={(e) => {
                    setActiveTab('employees');
                    setGlobalSearchResults(null);
                    setSearchQuery('');
                  }}
                  onClose={() => {
                    setGlobalSearchResults(null);
                    setSearchQuery('');
                  }}
                />
              )}
            </div>
          </div>

          {/* Notification Bell */}
          <div className="relative mr-2">
            <button
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors relative"
            >
              <Bell size={20} />
              {notifications.some((n) => !n.read) && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse"></span>
              )}
            </button>
            <NotificationDropdown
              isOpen={isNotifOpen}
              onClose={() => setIsNotifOpen(false)}
              notifications={notifications}
              onNavigate={(pid) => handleDashboardNavigate(pid)}
            />
          </div>

          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="flex items-center space-x-2 hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-lg transition-colors"
          >
            {currentUser.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt="Profil"
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div
                className={`w-8 h-8 rounded-full ${currentUser.avatarColor || 'bg-emerald-600'} text-white flex items-center justify-center font-bold text-sm`}
              >
                {currentUser.customInitials || currentUser.fullName.charAt(0)}
              </div>
            )}
          </button>
        </div>

        {/* CONTENT AREA */}
        {!isHydrated && activeTab === 'dashboard' ? (
          <DashboardSkeleton />
        ) : !isHydrated ? (
          <div className="h-screen"></div>
        ) : (
          <Suspense fallback={<DashboardSkeleton />}>{renderContent()}</Suspense>
        )}
      </main>

      {/* Quick Actions FAB */}
      <QuickActions
        onCreateProject={() => {
          setPrefillClient(null);
          setIsModalOpen(true);
        }}
        onCreateClient={() => {
          setActiveTab('clients');
          // The ClientsPage modal will open when the page mounts if we add a prop
        }}
        onCreateExpense={() => {
          setActiveTab('expenses');
        }}
        onCreateTask={() => {
          setActiveTab('tasks');
        }}
      />

      <Suspense fallback={null}>
        {isModalOpen && (
          <AddProjectModal
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setPrefillClient(null);
            }}
            onAdd={addProject}
            initialClient={prefillClient}
            clients={clients}
            projects={projects}
          />
        )}
        {isImportProjectsModalOpen && (
          <ImportProjectsModal
            onClose={() => setIsImportProjectsModalOpen(false)}
            onImport={handleBulkAddProjects}
            existingClients={clients}
          />
        )}
      </Suspense>
      {currentUser && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          user={currentUser}
          onSave={handleUpdateProfile}
        />
      )}
    </div>
  );
};

export default App;
