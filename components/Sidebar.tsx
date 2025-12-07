

import React from 'react';
import { LayoutDashboard, Users, Settings, LogOut, X, CheckSquare, Wifi, WifiOff, HardHat, FileText, Building2, Handshake } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string, statusFilter?: any) => void;
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  isOnline?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onLogout, isOpen = false, onClose, isOnline = true }) => {

  // Custom list to ensure correct icons and order
  const displayMenu: { id: string; icon: React.ElementType; label: string }[] = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
    { id: 'tasks', icon: CheckSquare, label: 'Mes Tâches' }, // Moved up as requested
    { id: 'agenda', icon: React.lazy(() => import('lucide-react').then(m => ({ default: m.Calendar }))), label: 'Agenda' },
    { id: 'projects', icon: React.lazy(() => import('lucide-react').then(m => ({ default: m.Briefcase }))), label: 'Dossiers' },
    { id: 'clients', icon: Users, label: 'Clients' },
    { id: 'partners', icon: Handshake, label: 'Partenaires' },
    { id: 'employees', icon: React.lazy(() => import('lucide-react').then(m => ({ default: m.HardHat }))), label: 'Salariés' },
    { id: 'administrative', icon: Building2, label: 'Administratif' },
    { id: 'settings', icon: Settings, label: 'Paramètres' },
  ];

  const sidebarClasses = `
    flex flex-col glass-sidebar text-white h-screen 
    fixed left-0 top-0 overflow-y-auto z-50
    transition-transform duration-300 ease-in-out
    ${isOpen ? 'translate-x-0 w-64 shadow-2xl' : '-translate-x-full md:translate-x-0 w-64'}
  `;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={onClose}
        ></div>
      )}

      <aside className="h-screen w-64 bg-slate-950 border-r border-slate-800 flex flex-col fixed left-0 top-0 z-20">
        <div className="p-6 flex flex-col border-b border-white/10 relative">
          <div className="flex justify-between items-start">
            <div className="flex flex-col mb-4 w-full">
              {/* LOGO SECTION - OPTIMIZED FOR VISIBILITY */}
              <div className="bg-white dark:bg-slate-900/10 backdrop-blur-md p-3 rounded-xl self-start mb-2 border border-white/20 shadow-lg shadow-black/20">
                <img
                  src="https://cdn.prod.website-files.com/6279383071a695621116a3bb/66aa3dc06cc8b3e76941f8a3_Final-logo.png"
                  alt="Bel Air Habitat"
                  width="200"
                  height="64"
                  fetchPriority="high"
                  decoding="async"
                  className="h-12 w-auto object-contain brightness-0 invert drop-shadow-md"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = document.getElementById('logo-fallback-sidebar');
                    if (fallback) fallback.style.display = 'block';
                  }}
                />
                {/* Fallback Text */}
                <div id="logo-fallback-sidebar" style={{ display: 'none' }}>
                  <h1 className="text-xl font-black tracking-tight text-white leading-none">BEL AIR</h1>
                  <p className="text-[10px] font-semibold text-emerald-400 tracking-[0.25em] mt-1">HABITAT</p>
                </div>
              </div>
            </div>
            {/* Close Button on Mobile */}
            <button onClick={onClose} className="md:hidden text-slate-300 hover:text-white absolute right-4 top-6">
              <X size={24} />
            </button>
          </div>
          <div className="text-[11px] text-slate-300 font-medium leading-relaxed pl-1 uppercase mt-2">
            19 B RUE DE LA TOURELLE<br />
            95170 DEUIL-LA-BARRE<br />
            SIREN : 930 674 932
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {displayMenu.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (onClose) onClose();
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                  }`}
              >
                {/* @ts-ignore - Dynamic icon rendering */}
                <React.Suspense fallback={<div className="w-5 h-5" />}>
                  <item.icon size={20} className={`transition-colors ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-emerald-400'}`} />
                </React.Suspense>
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          {/* CONNECTION STATUS INDICATOR */}
          <div className={`flex items-center space-x-2 px-4 py-2 mb-2 rounded-lg text-xs font-bold border border-white/5 ${isOnline ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span>{isOnline ? 'CONNECTÉ' : 'HORS LIGNE'}</span>
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-slate-300 hover:text-white hover:bg-white dark:bg-slate-900/5 transition-colors border border-transparent hover:border-red-500/30"
          >
            <LogOut size={20} />
            <span className="font-medium">Déconnexion</span>
          </button>

          <div className="mt-4 text-center">
            <p className="text-[10px] text-slate-600 dark:text-slate-500 font-mono opacity-50">
              v1.3.0
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default React.memo(Sidebar);