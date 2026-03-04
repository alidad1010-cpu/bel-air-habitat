import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import { useKeyboardShortcuts, StandardShortcuts } from './hooks/useKeyboardShortcuts';
import { useTheme } from './contexts/ThemeContext';
import ErrorHandler from './services/errorService';
import { auditLogService, AuditResource } from './services/auditLogService';
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
  Search,
  LayoutList,
  Kanban,
  WifiOff,
  RefreshCw,
  Menu,
  AlertTriangle,
  X,
  Bell,
  Upload,
  FileText,
  Users,
  Receipt,
  Briefcase,
  Send,
} from 'lucide-react';

import Sidebar from './components/Sidebar';
import UserProfileModal from './components/UserProfileModal';
import LoginPage from './components/LoginPage';
import NotificationDropdown from './components/NotificationDropdown';
import UniversalSearch from './components/UniversalSearch';
import KeyboardShortcutsHelper from './components/KeyboardShortcutsHelper';
import AIChatWidget from './components/AIChatWidget';
import {
  Project,
  ProjectStatus,
  ContactMethod,
  User,
  Client,
  Employee,
  CompanyAdministrativeData,
  Expense,
  ExpenseType,
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
const ClientDashboard = lazy(() => import('./components/ClientDashboard'));
const PartnerDashboard = lazy(() => import('./components/PartnerDashboard'));
const SendMessageModal = lazy(() => import('./components/SendMessageModal'));

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
    offlineReady: [, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(_r: ServiceWorkerRegistration | undefined) {
      console.log('SW Registered: ' + _r);
    },
    onRegisterError(error: Error) {
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
  const _closeUpdate = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };
  void _closeUpdate;

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
  const [isQuickAddMenuOpen, setIsQuickAddMenuOpen] = useState(false);
  const [isSendMessageModalOpen, setIsSendMessageModalOpen] = useState(false);

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
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'ALL'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  const [isDarkMode] = useState(true);
  void isDarkMode;

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
        } else {
          const demoProjects: Project[] = [
            {
              id: 'demo-1',
              title: 'Rénovation Appartement Paris 15ème',
              description: 'Rénovation complète d\'un appartement de 80m²',
              status: 'EN_COURS' as ProjectStatus,
              contactMethod: 'PHONE' as ContactMethod,
              budget: 45000,
              startDate: new Date().toISOString().split('T')[0],
              client: {
                id: 'demo-client-1',
                name: 'Jean Dupont',
                type: 'PARTICULIER',
                email: 'jean.dupont@example.com',
                phone: '06 12 34 56 78',
                address: '123 Rue de la Paix, 75001 Paris'
              },
              priority: 'Haute' as 'Haute' | 'Moyenne' | 'Basse',
              tasks: [],
              appointments: [],
              documents: [],
              photos: [],
              invoices: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
              businessCode: 'DEMO-001',
            },
            {
              id: 'demo-2',
              title: 'Construction Maison Individuelle',
              description: 'Construction d\'une maison de 120m²',
              status: 'PLANIFIE' as ProjectStatus,
              contactMethod: 'EMAIL' as ContactMethod,
              budget: 250000,
              startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              client: {
                id: 'demo-client-2',
                name: 'Marie Martin',
                type: 'PARTICULIER',
                email: 'marie.martin@example.com',
                phone: '06 98 76 54 32',
                address: '456 Avenue des Champs, 75008 Paris'
              },
              priority: 'Moyenne' as 'Haute' | 'Moyenne' | 'Basse',
              tasks: [],
              appointments: [],
              documents: [],
              photos: [],
              invoices: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
              businessCode: 'DEMO-002',
            },
          ];
          setProjects(demoProjects);
          localStorage.setItem('artisan-projects-backup', JSON.stringify(demoProjects));
        }

        const savedClients = localStorage.getItem('artisan-clients-backup');
        if (savedClients) {
          const parsed = JSON.parse(savedClients);
          if (Array.isArray(parsed)) setClients(parsed);
        } else {
          const demoClients: Client[] = [
            {
              id: 'demo-client-1',
              name: 'Jean Dupont',
              email: 'jean.dupont@example.com',
              phone: '06 12 34 56 78',
              address: '15 Rue de la Paix',
              zipCode: '75015',
              city: 'Paris',
              type: 'PARTICULIER',
            },
            {
              id: 'demo-client-2',
              name: 'Marie Martin',
              email: 'marie.martin@example.com',
              phone: '06 98 76 54 32',
              address: '42 Avenue des Champs',
              zipCode: '75008',
              city: 'Paris',
              type: 'PARTICULIER',
            },
            {
              id: 'demo-client-3',
              name: 'Entreprise ABC',
              email: 'contact@abc-entreprise.fr',
              phone: '01 23 45 67 89',
              address: '10 Boulevard Haussmann',
              zipCode: '75009',
              city: 'Paris',
              type: 'ENTREPRISE',
            },
          ];
          setClients(demoClients);
          localStorage.setItem('artisan-clients-backup', JSON.stringify(demoClients));
        }

        const savedEmployees = localStorage.getItem('artisan-employees-backup');
        if (savedEmployees) {
          const parsed = JSON.parse(savedEmployees);
          if (Array.isArray(parsed)) setEmployees(parsed);
        } else {
          const demoEmployees: Employee[] = [
            {
              id: 'demo-emp-1',
              firstName: 'Pierre',
              lastName: 'Dubois',
              email: 'pierre.dubois@example.com',
              phone: '06 11 22 33 44',
              position: 'Chef de chantier',
              startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              nationality: 'Française',
              isActive: true,
            },
            {
              id: 'demo-emp-2',
              firstName: 'Sophie',
              lastName: 'Lefebvre',
              email: 'sophie.lefebvre@example.com',
              phone: '06 55 66 77 88',
              position: 'Électricienne',
              startDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              nationality: 'Française',
              isActive: true,
            },
          ];
          setEmployees(demoEmployees);
          localStorage.setItem('artisan-employees-backup', JSON.stringify(demoEmployees));
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

    const checkAndCreateRecurringExpenses = async (allExpenses: Expense[]) => {
      try {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

        const lastCheckKey = 'lastRecurringExpensesCheck';
        const lastCheck = localStorage.getItem(lastCheckKey);

        if (lastCheck === currentMonthKey) {
          return;
        }

        const recurringExpenses = allExpenses.filter(e => e.type === ExpenseType.FIXED || e.isRecurring);

        if (recurringExpenses.length === 0) {
          localStorage.setItem(lastCheckKey, currentMonthKey);
          return;
        }

        const currentMonthExpenses = allExpenses.filter(e => {
          const expenseDate = new Date(e.date);
          return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
        });

        for (const recurringExpense of recurringExpenses) {
          const sourceId = recurringExpense.recurringSourceId || recurringExpense.id;

          const alreadyExists = currentMonthExpenses.some(e =>
            e.recurringSourceId === sourceId ||
            (e.id === sourceId && e.date.startsWith(currentMonthKey))
          );

          if (!alreadyExists) {
            const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
            const newExpense: Expense = {
              ...recurringExpense,
              id: `${sourceId}_${currentMonthKey}`,
              date: firstDayOfMonth.toISOString().split('T')[0],
              createdAt: Date.now(),
              updatedAt: Date.now(),
              recurringSourceId: sourceId,
            };

            console.log(`🔄 Creating recurring expense for ${currentMonthKey}:`, newExpense.merchant);
            await saveDocument('expenses', newExpense.id, sanitizeStorageData(newExpense));
          }
        }

        localStorage.setItem(lastCheckKey, currentMonthKey);
      } catch (error) {
        console.error('Error checking recurring expenses:', error);
      }
    };

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
        console.log('🔔 Expenses subscription triggered, received data count:', Array.isArray(data) ? data.length : 0);
        const castData = Array.isArray(data) ? (data as Expense[]) : [];
        const cleanData = sanitizeStorageData(castData);
        console.log('🔔 Setting expenses state with count:', cleanData.length);
        setExpenses(cleanData);

        checkAndCreateRecurringExpenses(cleanData);
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
      unsubUsers = subscribeToCollection('users', (data: any) => {
        const castData = Array.isArray(data) ? (data as User[]) : [];
        const cleanData = sanitizeStorageData(castData);
        setUsers(cleanData);
      });

      // NEW: Team Messages Subscription (Fast Sync)
      unsubTeamMessages = subscribeToCollection(
        'team_messages',
        (data: any) => {
          const messages = data.map((d: any) => ({ ...d, id: d.id }) as SharedNote);
          // Sort Descending (Newest first)
          messages.sort((a: SharedNote, b: SharedNote) => b.createdAt - a.createdAt);
          setGlobalNotes(messages);
        },
        [orderBy('createdAt', 'desc'), limit(50)]
      );

      // UPDATED: Company Data (Admin Only, Legacy Notes Removed)
      unsubCompany = subscribeToCollection('company', (data: any) => {
        const adminDoc = data.find((d: any) => d.id === 'administrative');
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

  const startIndex = (currentPage - 1) * 20;
  const paginatedProjects = useMemo(() => {
    return filteredAndSortedProjects.slice(startIndex, startIndex + 20);
  }, [filteredAndSortedProjects, startIndex]);

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
    setSelectedProject(null);
    setIsSidebarOpen(false);
  }, []);

  const handleProjectSelect = useCallback((project: Project) => setSelectedProject(project), []);

  // KEYBOARD SHORTCUTS
  const { toggleTheme } = useTheme();
  
  // BUG FIX 1: Memoize shortcuts array to prevent memory leak
  // The shortcuts array was being recreated on every render, causing handleKeyDown
  // to be recreated, which re-added event listeners without proper cleanup
  const keyboardShortcuts = useMemo(() => [
    {
      key: StandardShortcuts.SEARCH,
      ctrlOrCmd: true,
      action: () => {
        const searchInput = document.querySelector('input[type="text"][placeholder*="Recherche"], input[type="text"][placeholder*="recherche"]') as HTMLInputElement;
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
      },
      description: 'Fermer les modales',
    },
  ], [currentUser, handleTabSwitch, toggleTheme, isModalOpen, isProfileModalOpen, isImportProjectsModalOpen]);
  
  useKeyboardShortcuts({
    enabled: !!currentUser, // Only enable when logged in
    shortcuts: keyboardShortcuts,
  });

  const addProject = useCallback(async (project: Project) => {
    const projectWithMetadata = {
      ...project,
      createdByUserId: currentUser?.id || 'unknown',
    };
    const cleanProject = sanitizeStorageData(projectWithMetadata);
    setProjects((prev) => {
      const newProjects = [cleanProject, ...prev];
      safeLocalStorageSet('artisan-projects-backup', newProjects);
      return newProjects;
    });
    handleTabSwitch('projects');
    setStatusFilter(ProjectStatus.NEW);
    await saveDocument('projects', cleanProject.id, cleanProject);
    // Audit Log
    await auditLogService.logCreate(currentUser, AuditResource.PROJECT, cleanProject.id, cleanProject.title);

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
          createdByUserId: currentUser?.id || 'unknown',
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
  }, [currentUser]);

  const handleBulkAddProjects = useCallback(
    async (newProjects: Project[]) => {
      // 1. Add createdByUserId to Projects
      const projectsWithMetadata = newProjects.map((p) => ({
        ...p,
        createdByUserId: p.createdByUserId || currentUser?.id || 'unknown',
      }));
      const cleanProjects = projectsWithMetadata.map((p) => sanitizeStorageData(p));

      // 2. Identify and Create NEW Clients
      const newClientsToSave: Client[] = [];

      for (const proj of cleanProjects) {
        const clientExists = clients.some((c) => c.id === proj.client.id);
        const alreadyQueued = newClientsToSave.some((c) => c.id === proj.client.id);

        if (!clientExists && !alreadyQueued) {
          newClientsToSave.push({
            ...proj.client,
            createdByUserId: currentUser?.id || 'unknown',
          });
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
      handleTabSwitch('projects');
      setStatusFilter('ALL');

      // Save projects
      for (const proj of cleanProjects) {
        await saveDocument('projects', proj.id, proj);
      }
    },
    [clients, currentUser]
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

  const updateProject = useCallback(async (project: Project) => {
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
  }, [currentUser, projects]);

  const handleDeleteProject = useCallback(async (id: string) => {
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
      await auditLogService.logDelete(currentUser, AuditResource.PROJECT, id, project.title, project);
    }
  }, [currentUser, projects]);

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

  const handleAddClient = useCallback(async (client: Client) => {
    const id = Date.now().toString();
    const clientWithMetadata = {
      ...client,
      id,
      createdByUserId: currentUser?.id || 'unknown',
    };
    const cleanClient = sanitizeStorageData(clientWithMetadata);
    setClients((prev) => {
      const newClients = [...prev, cleanClient];
      safeLocalStorageSet('artisan-clients-backup', newClients);
      return newClients;
    });
    await saveDocument('clients', id, cleanClient);
    // Audit Log
    await auditLogService.logCreate(currentUser, AuditResource.CLIENT, id, cleanClient.name);
  }, [currentUser]);

  const handleDeleteClient = useCallback(async (client: Client) => {
    if (window.confirm('Supprimer ce client ?')) {
      setClients((prev) => {
        const remainingClients = prev.filter((c) => c.id !== client.id);
        safeLocalStorageSet('artisan-clients-backup', remainingClients);
        return remainingClients;
      });
      if (client.id) {
        await deleteDocument('clients', client.id);
        // Audit Log
        await auditLogService.logDelete(currentUser, AuditResource.CLIENT, client.id, client.name, client);
      }
    }
  }, [currentUser]);

  const handleUpdateClient = useCallback(async (client: Client) => {
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
  }, [currentUser, clients]);

  const handleAddEmployee = useCallback(async (emp: Employee) => {
    const empWithMetadata = {
      ...emp,
      createdByUserId: currentUser?.id || 'unknown',
    };
    const cleanEmp = sanitizeStorageData(empWithMetadata);
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
  }, [currentUser]);

  const handleUpdateEmployee = useCallback(async (emp: Employee) => {
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
  }, [currentUser, employees]);

  const handleDeleteEmployee = useCallback(async (id: string) => {
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
  }, [currentUser, employees]);

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
    console.log('🔵 handleAddExpense called with:', expense);
    const expenseWithMetadata = {
      ...expense,
      createdBy: currentUser?.fullName || currentUser?.username || 'Utilisateur inconnu',
      createdByUserId: currentUser?.id || 'unknown',
      createdAt: expense.createdAt || Date.now()
    };
    const clean = sanitizeStorageData(expenseWithMetadata);
    console.log('🔵 Sanitized expense:', clean);
    console.log('🔵 Current expenses count before add:', expenses.length);
    setExpenses((prev) => {
      const newExpenses = [...prev, clean];
      console.log('🔵 New expenses count after add:', newExpenses.length);
      return newExpenses;
    });
    console.log('🔵 Calling saveDocument...');
    await saveDocument('expenses', clean.id, clean);
    console.log('✅ Expense saved to database');
  }, [expenses.length, currentUser]);

  const handleUpdateExpense = useCallback(async (expense: Expense) => {
    console.log('🟡 handleUpdateExpense called with:', expense);
    const clean = sanitizeStorageData(expense);
    console.log('🟡 Sanitized expense:', clean);
    setExpenses((prev) => prev.map((e) => (e.id === clean.id ? clean : e)));
    console.log('🟡 Calling saveDocument...');
    await saveDocument('expenses', clean.id, clean);
    console.log('✅ Expense updated in database');
  }, []);

  const handleDeleteExpense = useCallback(async (id: string) => {
    const expenseToDelete = expenses.find(e => e.id === id);

    if (!expenseToDelete) {
      return;
    }

    const isRecurring = expenseToDelete.isRecurring || expenseToDelete.type === ExpenseType.FIXED;
    const sourceId = expenseToDelete.recurringSourceId || expenseToDelete.id;

    if (isRecurring) {
      const futureRecurringExpenses = expenses.filter(e => {
        if (e.id === id) return false;
        const expenseSourceId = e.recurringSourceId || e.id;
        if (expenseSourceId !== sourceId) return false;
        return new Date(e.date) > new Date(expenseToDelete.date);
      });

      if (futureRecurringExpenses.length > 0) {
        const confirmMessage = `Cette dépense est récurrente. Voulez-vous aussi supprimer les ${futureRecurringExpenses.length} dépense(s) des mois suivants ?\n\nCliquez sur "OK" pour supprimer tout, ou "Annuler" pour supprimer uniquement ce mois.`;

        if (window.confirm(confirmMessage)) {
          const idsToDelete = [id, ...futureRecurringExpenses.map(e => e.id)];
          setExpenses((prev) => prev.filter((e) => !idsToDelete.includes(e.id)));
          for (const deleteId of idsToDelete) {
            await deleteDocument('expenses', deleteId);
          }
        } else {
          if (window.confirm('Supprimer uniquement cette dépense ?')) {
            setExpenses((prev) => prev.filter((e) => e.id !== id));
            await deleteDocument('expenses', id);
          }
        }
      } else {
        if (window.confirm('Supprimer cette dépense récurrente ?')) {
          setExpenses((prev) => prev.filter((e) => e.id !== id));
          await deleteDocument('expenses', id);
        }
      }
    } else {
      if (window.confirm('Supprimer cette dépense ?')) {
        setExpenses((prev) => prev.filter((e) => e.id !== id));
        await deleteDocument('expenses', id);
      }
    }
  }, [expenses]);

  // --- ATTENDANCE HANDLERS ---
  const handleUpdateAttendance = useCallback(async (record: AttendanceRecord) => {
    const recordWithMetadata = {
      ...record,
      createdByUserId: record.createdByUserId || currentUser?.id || 'unknown',
    };
    const clean = sanitizeStorageData(recordWithMetadata);
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
  }, [currentUser]);

  const handleBulkUpdateAttendance = useCallback(async (records: AttendanceRecord[]) => {
    const recordsWithMetadata = records.map((r) => ({
      ...r,
      createdByUserId: r.createdByUserId || currentUser?.id || 'unknown',
    }));
    const cleanRecords = recordsWithMetadata.map((r) => sanitizeStorageData(r));
    setAttendances((prev) => {
      const newMap = new Map(prev.map((p) => [p.id, p]));
      cleanRecords.forEach((r) => newMap.set(r.id, r));
      return Array.from(newMap.values());
    });

    await Promise.all(cleanRecords.map((r) => saveDocument('attendances', r.id, r)));
  }, [currentUser]);

  const handleBulkDeleteAttendance = useCallback(async (ids: string[]) => {
    setAttendances((prev) => prev.filter((a) => !ids.includes(a.id)));
    await Promise.all(ids.map((id) => deleteDocument('attendances', id)));
  }, []);

  // --- PROSPECTION HANDLERS ---
  const handleAddProspect = useCallback(async (prospect: Prospect) => {
    const prospectWithMetadata = {
      ...prospect,
      createdByUserId: currentUser?.id || 'unknown',
    };
    const clean = sanitizeStorageData(prospectWithMetadata);
    setProspects((prev) => [...prev, clean]);
    await saveDocument('prospects', clean.id, clean);
  }, [currentUser]);

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
        handleTabSwitch('clients');
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

  // OPTIMIZED LOGIN HANDLER: Updates state immediately for instant feedback

  // if (!currentUser) return <LoginPage onLogin={handleLogin} />;
  // FORCE LOGIN FOR TESTING - REMOVE AFTER TEST
  if (!currentUser) return <LoginPage onLogin={handleLogin} />;

  const renderContent = () => {
    if (currentUser?.role === 'CLIENT') {
      return <ClientDashboard currentUser={currentUser} />;
    }

    if (currentUser?.role === 'PARTNER') {
      return <PartnerDashboard currentUser={currentUser} />;
    }

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
                className="flex items-center space-x-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-md shadow-teal-500/20 transition-all active:scale-95 text-sm"
              >
                <Plus size={18} />
                <span>Nouveau Chantier</span>
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
            employees={employees}
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
            projects={projects}
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
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg-primary)] ">
      {/* COMPACT SIDEBAR - Icon Only */}
      <aside className="hidden md:flex flex-col w-16 border-r-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0f1419] shadow-2xl">
        <div className="flex items-center justify-center h-16 border-b-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0f1419]">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)] flex items-center justify-center text-white font-bold text-sm">
            BH
          </div>
        </div>

        <nav className="flex-1 flex flex-col gap-1 p-2 overflow-y-auto scrollbar-thin bg-white dark:bg-[#0f1419]">
          <button
            onClick={() => handleTabSwitch('dashboard')}
            className={`w-12 h-12 flex items-center justify-center rounded-lg transition-all ${
              activeTab === 'dashboard'
                ? 'bg-blue-50 dark:bg-blue-950 text-[var(--color-accent)]'
                : 'text-[var(--color-text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-[var(--color-text-primary)]'
            }`}
            title="Tableau de bord"
          >
            <LayoutList size={20} />
          </button>

          <button
            onClick={() => handleTabSwitch('projects')}
            className={`w-12 h-12 flex items-center justify-center rounded-lg transition-all ${
              activeTab === 'projects'
                ? 'bg-blue-50 dark:bg-blue-950 text-[var(--color-accent)]'
                : 'text-[var(--color-text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-[var(--color-text-primary)]'
            }`}
            title="Dossiers"
          >
            <Kanban size={20} />
          </button>

          <button
            onClick={() => handleTabSwitch('clients')}
            className={`w-12 h-12 flex items-center justify-center rounded-lg transition-all ${
              activeTab === 'clients'
                ? 'bg-blue-50 dark:bg-blue-950 text-[var(--color-accent)]'
                : 'text-[var(--color-text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-[var(--color-text-primary)]'
            }`}
            title="Clients"
          >
            <Search size={20} />
          </button>

          <button
            onClick={() => handleTabSwitch('tasks')}
            className={`w-12 h-12 flex items-center justify-center rounded-lg transition-all relative ${
              activeTab === 'tasks'
                ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
            title="Tâches"
          >
            <Bell size={20} />
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
            )}
          </button>

          <div className="h-px bg-[var(--color-border)] my-2"></div>

          <button
            onClick={() => handleTabSwitch('agenda')}
            className={`w-12 h-12 flex items-center justify-center rounded-lg transition-all ${
              activeTab === 'agenda'
                ? 'bg-blue-50 dark:bg-blue-950 text-[var(--color-accent)]'
                : 'text-[var(--color-text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-[var(--color-text-primary)]'
            }`}
            title="Agenda"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </button>

          <button
            onClick={() => handleTabSwitch('prospection')}
            className={`w-12 h-12 flex items-center justify-center rounded-lg transition-all ${
              activeTab === 'prospection'
                ? 'bg-blue-50 dark:bg-blue-950 text-[var(--color-accent)]'
                : 'text-[var(--color-text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-[var(--color-text-primary)]'
            }`}
            title="Prospection"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </button>

          <button
            onClick={() => handleTabSwitch('partners')}
            className={`w-12 h-12 flex items-center justify-center rounded-lg transition-all ${
              activeTab === 'partners'
                ? 'bg-blue-50 dark:bg-blue-950 text-[var(--color-accent)]'
                : 'text-[var(--color-text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-[var(--color-text-primary)]'
            }`}
            title="Partenaires"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <line x1="20" y1="8" x2="20" y2="14"></line>
              <line x1="23" y1="11" x2="17" y2="11"></line>
            </svg>
          </button>

          <button
            onClick={() => handleTabSwitch('employees')}
            className={`w-12 h-12 flex items-center justify-center rounded-lg transition-all ${
              activeTab === 'employees'
                ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
            title="Salariés"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </button>

          <button
            onClick={() => handleTabSwitch('expenses')}
            className={`w-12 h-12 flex items-center justify-center rounded-lg transition-all ${
              activeTab === 'expenses'
                ? 'bg-blue-50 dark:bg-blue-950 text-[var(--color-accent)]'
                : 'text-[var(--color-text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-[var(--color-text-primary)]'
            }`}
            title="Dépenses"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </button>

          <button
            onClick={() => handleTabSwitch('administrative')}
            className={`w-12 h-12 flex items-center justify-center rounded-lg transition-all ${
              activeTab === 'administrative'
                ? 'bg-blue-50 dark:bg-blue-950 text-[var(--color-accent)]'
                : 'text-[var(--color-text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-[var(--color-text-primary)]'
            }`}
            title="Administratif"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </button>
        </nav>

        <div className="p-2 border-t bg-white dark:bg-[#0f1419] border-gray-200 dark:border-gray-800">
          <button
            onClick={() => handleTabSwitch('settings')}
            className={`w-12 h-12 flex items-center justify-center rounded-lg transition-all ${
              activeTab === 'settings'
                ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
            }`}
            title="Paramètres"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 1v6m0 6v6m8.66-15.66l-4.24 4.24m-4.24 4.24l-4.24 4.24M23 12h-6m-6 0H1m20.66 8.66l-4.24-4.24m-4.24-4.24l-4.24-4.24"></path>
            </svg>
          </button>

          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="w-12 h-12 flex items-center justify-center mt-2"
          >
            {currentUser.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt="Profil"
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center font-semibold text-xs">
                {currentUser.customInitials || currentUser.fullName.charAt(0)}
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* MINIMAL HEADER */}
        <header className="h-14 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4 flex-1">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-all"
            >
              <Menu size={20} />
            </button>

            <h1 className="text-base font-semibold text-[var(--color-text-primary)]">
              {activeTab === 'dashboard' ? 'Tableau de bord' :
               activeTab === 'tasks' ? 'Mes Tâches' :
               activeTab === 'agenda' ? 'Agenda' :
               activeTab === 'projects' ? 'Dossiers' :
               activeTab === 'clients' ? 'Clients' :
               activeTab === 'prospection' ? 'Prospection' :
               activeTab === 'partners' ? 'Partenaires' :
               activeTab === 'employees' ? 'Salariés' :
               activeTab === 'administrative' ? 'Administratif' :
               activeTab === 'expenses' ? 'Dépenses' :
               activeTab === 'settings' ? 'Paramètres' : 'Accueil'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:block w-64">
              <UniversalSearch
                clients={clients}
                employees={employees}
                projects={projects}
                onNavigate={(tab, id) => {
                  if (tab === 'projects' && id) {
                    const project = projects.find(p => p.id === id);
                    if (project) setSelectedProject(project);
                  } else {
                    handleTabSwitch(tab);
                  }
                }}
              />
            </div>

            {currentUser?.role === 'ADMIN' && (
              <button
                onClick={() => setIsSendMessageModalOpen(true)}
                className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-all"
                title="Envoyer un message"
              >
                <Send size={18} />
              </button>
            )}

            <button
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="relative p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-all"
            >
              <Bell size={18} />
              {notifications.some((n) => !n.read) && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[var(--color-danger)] rounded-full"></span>
              )}
            </button>

            <NotificationDropdown
              isOpen={isNotifOpen}
              onClose={() => setIsNotifOpen(false)}
              notifications={notifications}
              onNavigate={(pid) => handleDashboardNavigate(pid)}
            />

            <div className="relative hidden md:block">
              <button
                onClick={() => setIsQuickAddMenuOpen(!isQuickAddMenuOpen)}
                className="btn btn-primary btn-sm"
              >
                <Plus size={16} />
                Nouveau
              </button>

              {isQuickAddMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsQuickAddMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg shadow-lg z-50 py-2 animate-scale-in">
                    <button
                      onClick={() => {
                        setIsModalOpen(true);
                        setIsQuickAddMenuOpen(false);
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-[var(--color-bg-hover)] transition-colors flex items-center gap-3 text-sm"
                    >
                      <FileText size={18} className="text-[var(--color-accent)]" />
                      <div>
                        <div className="font-medium text-[var(--color-text-primary)]">Nouveau Projet</div>
                        <div className="text-xs text-[var(--color-text-tertiary)]">Créer un dossier</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        handleTabSwitch('expenses');
                        setIsQuickAddMenuOpen(false);
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-[var(--color-bg-hover)] transition-colors flex items-center gap-3 text-sm"
                    >
                      <Receipt size={18} className="text-[var(--color-success)]" />
                      <div>
                        <div className="font-medium text-[var(--color-text-primary)]">Nouvelle Dépense</div>
                        <div className="text-xs text-[var(--color-text-tertiary)]">Ajouter une dépense</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        handleTabSwitch('clients');
                        setIsQuickAddMenuOpen(false);
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-[var(--color-bg-hover)] transition-colors flex items-center gap-3 text-sm"
                    >
                      <Users size={18} className="text-[var(--color-warning)]" />
                      <div>
                        <div className="font-medium text-[var(--color-text-primary)]">Nouveau Client</div>
                        <div className="text-xs text-[var(--color-text-tertiary)]">Ajouter un client</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        handleTabSwitch('prospection');
                        setIsQuickAddMenuOpen(false);
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-[var(--color-bg-hover)] transition-colors flex items-center gap-3 text-sm"
                    >
                      <Briefcase size={18} className="text-blue-500" />
                      <div>
                        <div className="font-medium text-[var(--color-text-primary)]">Nouveau Prospect</div>
                        <div className="text-xs text-[var(--color-text-tertiary)]">Ajouter un prospect</div>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* CLEAN CONTENT AREA */}
        <main className="flex-1 overflow-y-auto bg-[var(--color-bg-secondary)] scrollbar-thin">
          <div className="max-w-[1600px] mx-auto p-4 md:p-6">
            {!isHydrated && activeTab === 'dashboard' ? (
              <DashboardSkeleton />
            ) : !isHydrated ? (
              <div className="h-screen"></div>
            ) : (
              <Suspense fallback={<DashboardSkeleton />}>{renderContent()}</Suspense>
            )}
          </div>
        </main>
      </div>

      {/* MOBILE SIDEBAR */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabSwitch}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isOnline={isOnline}
        currentUser={currentUser}
      />

      {/* MINIMAL MOBILE BOTTOM NAV */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--color-bg-primary)] border-t border-[var(--color-border)] pb-safe">
        <div className="grid grid-cols-5 gap-1 px-2 py-2">
          <button
            onClick={() => handleTabSwitch('dashboard')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all ${
              activeTab === 'dashboard'
                ? 'text-[var(--color-accent)]'
                : 'text-[var(--color-text-tertiary)]'
            }`}
          >
            <LayoutList size={20} />
            <span className="text-[10px] mt-1 font-medium">Accueil</span>
          </button>
          <button
            onClick={() => handleTabSwitch('projects')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all ${
              activeTab === 'projects'
                ? 'text-[var(--color-accent)]'
                : 'text-[var(--color-text-tertiary)]'
            }`}
          >
            <Kanban size={20} />
            <span className="text-[10px] mt-1 font-medium">Dossiers</span>
          </button>
          <button
            onClick={() => setIsQuickAddMenuOpen(!isQuickAddMenuOpen)}
            className="flex flex-col items-center justify-center py-1 px-1 rounded-lg bg-[var(--color-accent)] text-white transition-all relative"
          >
            <Plus size={22} strokeWidth={2.5} />
            <span className="text-[10px] mt-0.5 font-semibold">Nouveau</span>
          </button>
          <button
            onClick={() => handleTabSwitch('clients')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all ${
              activeTab === 'clients'
                ? 'text-[var(--color-accent)]'
                : 'text-[var(--color-text-tertiary)]'
            }`}
          >
            <Search size={20} />
            <span className="text-[10px] mt-1 font-medium">Clients</span>
          </button>
          <button
            onClick={() => handleTabSwitch('tasks')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all relative ${
              activeTab === 'tasks'
                ? 'text-[var(--color-accent)]'
                : 'text-[var(--color-text-tertiary)]'
            }`}
          >
            <Bell size={20} />
            <span className="text-[10px] mt-1 font-medium">Tâches</span>
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="absolute top-1.5 right-2 w-1.5 h-1.5 bg-[var(--color-danger)] rounded-full"></span>
            )}
          </button>
        </div>
      </div>

      {/* MOBILE QUICK ADD MENU */}
      {isQuickAddMenuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
            onClick={() => setIsQuickAddMenuOpen(false)}
          />
          <div className="md:hidden fixed bottom-20 left-4 right-4 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-2xl shadow-2xl z-50 p-3 animate-slide-in">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setIsModalOpen(true);
                  setIsQuickAddMenuOpen(false);
                }}
                className="flex flex-col items-center justify-center p-4 rounded-xl bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-hover)] transition-all"
              >
                <div className="w-12 h-12 rounded-full bg-[var(--color-accent-light)] flex items-center justify-center mb-2">
                  <FileText size={24} className="text-[var(--color-accent)]" />
                </div>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">Projet</span>
              </button>
              <button
                onClick={() => {
                  handleTabSwitch('expenses');
                  setIsQuickAddMenuOpen(false);
                }}
                className="flex flex-col items-center justify-center p-4 rounded-xl bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-hover)] transition-all"
              >
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-2">
                  <Receipt size={24} className="text-[var(--color-success)]" />
                </div>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">Dépense</span>
              </button>
              <button
                onClick={() => {
                  handleTabSwitch('clients');
                  setIsQuickAddMenuOpen(false);
                }}
                className="flex flex-col items-center justify-center p-4 rounded-xl bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-hover)] transition-all"
              >
                <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-2">
                  <Users size={24} className="text-[var(--color-warning)]" />
                </div>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">Client</span>
              </button>
              <button
                onClick={() => {
                  handleTabSwitch('prospection');
                  setIsQuickAddMenuOpen(false);
                }}
                className="flex flex-col items-center justify-center p-4 rounded-xl bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-hover)] transition-all"
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2">
                  <Briefcase size={24} className="text-blue-500" />
                </div>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">Prospect</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ALERT BANNER - Minimal */}
      {docAlerts && (
        <div className={`fixed top-0 left-0 right-0 z-50 px-4 py-2.5 flex items-center justify-between text-sm border-b ${
          docAlerts.type === 'expired'
            ? 'bg-[var(--color-danger-light)] text-[var(--color-danger)] border-[var(--color-danger)]'
            : 'bg-[var(--color-warning-light)] text-[var(--color-warning)] border-[var(--color-warning)]'
        }`}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span className="font-medium">
              {docAlerts.type === 'expired'
                ? `${docAlerts.count} document(s) expiré(s)`
                : `${docAlerts.count} document(s) expirent bientôt`}
            </span>
            <button
              onClick={() => handleTabSwitch(docAlerts.type === 'expired' ? 'partners' : 'administrative')}
              className="text-xs underline hover:no-underline ml-2"
            >
              Voir
            </button>
          </div>
          <button onClick={() => setDocAlerts(null)} className="p-1 hover:bg-black/5 rounded">
            <X size={14} />
          </button>
        </div>
      )}

      {/* OFFLINE INDICATOR - Minimal */}
      {!isOnline && (
        <div className="fixed bottom-20 md:bottom-4 right-4 z-50 bg-[var(--color-bg-primary)] border border-[var(--color-border)] px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm">
          <WifiOff size={16} className="text-[var(--color-warning)]" />
          <span className="text-[var(--color-text-secondary)]">Mode hors ligne</span>
        </div>
      )}

      {/* SYNC NOTIFICATION - Minimal */}
      {showSyncNotification && (
        <div className="fixed bottom-20 md:bottom-4 right-4 z-50 bg-[var(--color-success-light)] border border-[var(--color-success)] px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm animate-fade-in">
          <RefreshCw size={16} className="text-[var(--color-success)]" />
          <span className="text-[var(--color-success)] font-medium">Synchronisé</span>
        </div>
      )}

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

      {currentUser?.role === 'ADMIN' && (
        <Suspense fallback={<div>Chargement...</div>}>
          <SendMessageModal
            isOpen={isSendMessageModalOpen}
            onClose={() => setIsSendMessageModalOpen(false)}
            currentUser={currentUser}
            clients={clients}
            projects={projects}
          />
        </Suspense>
      )}

      <KeyboardShortcutsHelper />

      {/* AI Chat Widget — visible on all pages when logged in */}
      {currentUser && (
        <AIChatWidget
          currentPage={activeTab}
          userName={currentUser.fullName?.split(' ')[0]}
        />
      )}
    </div>
  );
};

export default App;
