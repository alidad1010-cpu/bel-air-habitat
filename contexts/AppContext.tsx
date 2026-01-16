/**
 * AppContext - State Management Centralisé
 * Architecture: Réduit le props drilling et centralise l'état global
 */
import React, { createContext, useContext, useReducer, ReactNode, useMemo } from 'react';
import {
  Project,
  User,
  Client,
  Employee,
  Expense,
  AttendanceRecord,
  Prospect,
  AppNotification,
  CompanyAdministrativeData,
} from '../types';
import { SharedNote } from '../App';

// État global de l'application
interface AppState {
  user: User | null;
  projects: Project[];
  clients: Client[];
  employees: Employee[];
  expenses: Expense[];
  attendances: AttendanceRecord[];
  prospects: Prospect[];
  notifications: AppNotification[];
  adminData: CompanyAdministrativeData;
  globalNotes: SharedNote[];
  isHydrated: boolean;
  isOnline: boolean;
}

// Actions pour le reducer
type AppAction =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_PROJECTS'; payload: Project[] }
  | { type: 'SET_CLIENTS'; payload: Client[] }
  | { type: 'SET_EMPLOYEES'; payload: Employee[] }
  | { type: 'SET_EXPENSES'; payload: Expense[] }
  | { type: 'SET_ATTENDANCES'; payload: AttendanceRecord[] }
  | { type: 'SET_PROSPECTS'; payload: Prospect[] }
  | { type: 'SET_NOTIFICATIONS'; payload: AppNotification[] }
  | { type: 'SET_ADMIN_DATA'; payload: CompanyAdministrativeData }
  | { type: 'SET_GLOBAL_NOTES'; payload: SharedNote[] }
  | { type: 'SET_HYDRATED'; payload: boolean }
  | { type: 'SET_ONLINE'; payload: boolean };

// État initial
const initialState: AppState = {
  user: null,
  projects: [],
  clients: [],
  employees: [],
  expenses: [],
  attendances: [],
  prospects: [],
  notifications: [],
  adminData: {
    id: 'administrative',
    documents: [],
    vehicles: [],
  },
  globalNotes: [],
  isHydrated: false,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_PROJECTS':
      return { ...state, projects: action.payload };
    case 'SET_CLIENTS':
      return { ...state, clients: action.payload };
    case 'SET_EMPLOYEES':
      return { ...state, employees: action.payload };
    case 'SET_EXPENSES':
      return { ...state, expenses: action.payload };
    case 'SET_ATTENDANCES':
      return { ...state, attendances: action.payload };
    case 'SET_PROSPECTS':
      return { ...state, prospects: action.payload };
    case 'SET_NOTIFICATIONS':
      return { ...state, notifications: action.payload };
    case 'SET_ADMIN_DATA':
      return { ...state, adminData: action.payload };
    case 'SET_GLOBAL_NOTES':
      return { ...state, globalNotes: action.payload };
    case 'SET_HYDRATED':
      return { ...state, isHydrated: action.payload };
    case 'SET_ONLINE':
      return { ...state, isOnline: action.payload };
    default:
      return state;
  }
}

// Context
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextType | null>(null);

// Provider
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Mémoriser la valeur du context pour éviter les re-renders inutiles
  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Hook pour utiliser le context
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}

// Hooks sélecteurs pour optimiser les re-renders
export function useProjects() {
  const { state } = useApp();
  return state.projects;
}

export function useClients() {
  const { state } = useApp();
  return state.clients;
}

export function useUser() {
  const { state } = useApp();
  return state.user;
}

export function useEmployees() {
  const { state } = useApp();
  return state.employees;
}
