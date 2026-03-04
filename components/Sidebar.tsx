import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  X,
  CheckSquare,
  Wifi,
  WifiOff,
  HardHat,
  Building2,
  Handshake,
  Calendar,
  Briefcase,
  DollarSign,
  Megaphone,
  ChevronLeft,
  ChevronRight,
  PaintBucket,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string, statusFilter?: any) => void;
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  isOnline?: boolean;
  currentUser?: any;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onLogout,
  isOpen = false,
  onClose,
  isOnline = true,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuGroups: {
    id: string;
    label: string;
    items: { id: string; icon: React.ElementType; label: string; badge?: number }[];
  }[] = [
    {
      id: 'work',
      label: 'ESPACE DE TRAVAIL',
      items: [
        { id: 'dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
        { id: 'tasks', icon: CheckSquare, label: 'Mes Tâches' },
        { id: 'agenda', icon: Calendar, label: 'Agenda' },
      ],
    },
    {
      id: 'renovation',
      label: 'RÉNOVATION',
      items: [
        { id: 'projects', icon: PaintBucket, label: 'Chantiers' },
      ],
    },
    {
      id: 'relations',
      label: 'CONTACTS & CRM',
      items: [
        { id: 'clients', icon: Users, label: 'Clients' },
        { id: 'prospection', icon: Megaphone, label: 'Prospection' },
        { id: 'partners', icon: Handshake, label: 'Sous-traitants' },
        { id: 'employees', icon: HardHat, label: 'Équipe' },
      ],
    },
    {
      id: 'financial',
      label: 'GESTION',
      items: [
        { id: 'expenses', icon: DollarSign, label: 'Dépenses' },
        { id: 'administrative', icon: Building2, label: 'Administratif' },
      ],
    },
    {
      id: 'system',
      label: 'PARAMÈTRES',
      items: [{ id: 'settings', icon: Settings, label: 'Réglages' }],
    },
  ];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm"
          onClick={onClose}
        ></div>
      )}

      <aside
        className={`h-screen flex flex-col fixed left-0 top-0 z-50 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-[68px]' : 'w-[260px]'
        } ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        } bg-white dark:bg-[#0c1222] border-r border-slate-200/80 dark:border-slate-800/80`}
      >
        {/* Header / Logo */}
        <div className={`p-4 flex flex-col relative ${isCollapsed ? 'items-center' : ''}`}>
          <div className="flex justify-between items-center w-full">
            {!isCollapsed && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-md shadow-teal-500/20">
                  <PaintBucket size={18} className="text-white" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                    Bel Air Habitat
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                    Rénovation & Habitat
                  </div>
                </div>
              </div>
            )}

            {isCollapsed && (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-md shadow-teal-500/20">
                <PaintBucket size={18} className="text-white" />
              </div>
            )}

            <button
              onClick={onClose}
              className="md:hidden p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
            >
              <X size={20} />
            </button>
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex absolute -right-3 top-7 w-6 h-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full items-center justify-center transition-all shadow-sm hover:shadow-md hover:scale-110"
          >
            {isCollapsed ? (
              <ChevronRight size={12} className="text-slate-500" />
            ) : (
              <ChevronLeft size={12} className="text-slate-500" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-5 overflow-y-auto scrollbar-thin">
          {menuGroups.map((group) => (
            <div key={group.id} className="space-y-0.5">
              {!isCollapsed && (
                <div className="px-3 py-1.5">
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    {group.label}
                  </span>
                </div>
              )}
              {isCollapsed && (
                <div className="w-full flex justify-center py-1">
                  <div className="w-5 h-px bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                </div>
              )}
              {group.items.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      if (onClose) onClose();
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${
                      isActive
                        ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 font-medium'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                    } ${isCollapsed ? 'justify-center' : ''}`}
                    title={isCollapsed ? item.label : ''}
                  >
                    <item.icon
                      size={18}
                      className={`flex-shrink-0 transition-colors ${
                        isActive
                          ? 'text-teal-600 dark:text-teal-400'
                          : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                      }`}
                    />
                    {!isCollapsed && (
                      <span className="text-[13px] flex-1 text-left">{item.label}</span>
                    )}
                    {!isCollapsed && item.badge && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-full">
                        {item.badge}
                      </span>
                    )}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-teal-500 rounded-r-full"></div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className={`p-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
          {/* Online/Offline status */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isCollapsed ? 'justify-center px-0' : ''}`}>
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse-soft`}></div>
            {!isCollapsed && (
              <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                {isOnline ? 'Connecté' : 'Hors ligne'}
              </span>
            )}
          </div>

          <button
            onClick={onLogout}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-all ${isCollapsed ? 'justify-center' : ''}`}
            title={isCollapsed ? 'Déconnexion' : ''}
          >
            <LogOut size={17} />
            {!isCollapsed && <span className="text-[13px] font-medium">Déconnexion</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
