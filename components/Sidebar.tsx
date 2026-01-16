import React from 'react';
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
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string, statusFilter?: any) => void;
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  isOnline?: boolean;
  currentUser?: any; // Avoiding full User type import bloat if not needed, but ideally User.
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onLogout,
  isOpen = false,
  onClose,
  isOnline = true,
}) => {
  // Menu items organized by groups for better UX
  const menuGroups: {
    id: string;
    label: string;
    items: { id: string; icon: React.ElementType; label: string }[];
  }[] = [
    {
      id: 'work',
      label: 'MON TRAVAIL',
      items: [
        { id: 'dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
        { id: 'tasks', icon: CheckSquare, label: 'Mes Tâches' },
        { id: 'agenda', icon: Calendar, label: 'Agenda' },
      ],
    },
    {
      id: 'projects',
      label: 'PROJETS',
      items: [{ id: 'projects', icon: Briefcase, label: 'Dossiers' }],
    },
    {
      id: 'relations',
      label: 'RELATIONS',
      items: [
        { id: 'clients', icon: Users, label: 'Clients' },
        { id: 'prospection', icon: Megaphone, label: 'Prospection' },
        { id: 'partners', icon: Handshake, label: 'Partenaires' },
        { id: 'employees', icon: HardHat, label: 'Salariés' },
      ],
    },
    {
      id: 'financial',
      label: 'FINANCIER',
      items: [
        { id: 'expenses', icon: DollarSign, label: 'Dépenses' },
        { id: 'administrative', icon: Building2, label: 'Administratif' },
      ],
    },
    {
      id: 'system',
      label: 'SYSTÈME',
      items: [{ id: 'settings', icon: Settings, label: 'Paramètres' }],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={onClose}
        ></div>
      )}

      <aside
        className={`h-screen w-64 glass-sidebar flex flex-col fixed left-0 top-0 z-50 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="p-6 flex flex-col relative">
          <div className="flex justify-between items-start">
            <div className="flex flex-col mb-4 w-full">
              {/* LOGO SECTION */}
              <div className="p-3 self-start mb-2">
                <img
                  src="https://cdn.prod.website-files.com/6279383071a695621116a3bb/66aa3dc06cc8b3e76941f8a3_Final-logo.png"
                  alt="Bel Air Habitat"
                  className="h-12 w-auto object-contain brightness-0 dark:invert opacity-90"
                />
              </div>
            </div>
            {/* Close Button on Mobile */}
            <button
              onClick={onClose}
              className="md:hidden text-slate-300 hover:text-white absolute right-4 top-6"
            >
              <X size={24} />
            </button>
          </div>
          <div className="text-[11px] text-slate-400 font-medium leading-relaxed pl-1 uppercase mt-2 tracking-widest">
            19 B RUE DE LA TOURELLE
            <br />
            95170 DEUIL-LA-BARRE
            <br />
            SIREN : 930 674 932
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto scrollbar-hide">
          {menuGroups.map((group) => (
            <div key={group.id} className="space-y-2">
              {/* Group Label */}
              <div className="px-4 py-1.5">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {group.label}
                </span>
              </div>
              {/* Group Items */}
              {group.items.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      if (onClose) onClose();
                    }}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                      isActive
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <item.icon
                      size={20}
                      className={`transition-colors ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-400'}`}
                    />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-white/10">
          {/* CONNECTION STATUS INDICATOR */}
          <div
            className={`flex items-center space-x-2 px-4 py-2 mb-2 rounded-lg text-xs font-bold border ${isOnline ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400' : 'border-red-200 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400'}`}
          >
            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span>{isOnline ? 'CONNECTÉ' : 'HORS LIGNE'}</span>
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/5 transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-500/30"
          >
            <LogOut size={20} />
            <span className="font-medium">Déconnexion</span>
          </button>

          <div className="mt-4 text-center">
            <p className="text-[10px] text-slate-600 dark:text-slate-500 font-mono opacity-50">
              v1.3.1
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default React.memo(Sidebar);
