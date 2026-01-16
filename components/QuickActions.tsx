/**
 * QuickActions Component (FAB - Floating Action Button)
 * UX: Menu flottant pour actions rapides
 */
import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, Briefcase, Users, DollarSign, CheckSquare, FileText } from 'lucide-react';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  color?: string;
}

interface QuickActionsProps {
  onCreateProject?: () => void;
  onCreateClient?: () => void;
  onCreateExpense?: () => void;
  onCreateTask?: () => void;
  className?: string;
}

const QuickActions: React.FC<QuickActionsProps> = ({
  onCreateProject,
  onCreateClient,
  onCreateExpense,
  onCreateTask,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const actions: QuickAction[] = [
    {
      id: 'project',
      label: 'Nouveau Projet',
      icon: Briefcase,
      onClick: () => {
        onCreateProject?.();
        setIsOpen(false);
      },
      color: 'bg-emerald-500 hover:bg-emerald-600',
    },
    {
      id: 'client',
      label: 'Nouveau Client',
      icon: Users,
      onClick: () => {
        onCreateClient?.();
        setIsOpen(false);
      },
      color: 'bg-blue-500 hover:bg-blue-600',
    },
    {
      id: 'expense',
      label: 'Nouvelle Dépense',
      icon: DollarSign,
      onClick: () => {
        onCreateExpense?.();
        setIsOpen(false);
      },
      color: 'bg-amber-500 hover:bg-amber-600',
    },
    {
      id: 'task',
      label: 'Nouvelle Tâche',
      icon: CheckSquare,
      onClick: () => {
        onCreateTask?.();
        setIsOpen(false);
      },
      color: 'bg-purple-500 hover:bg-purple-600',
    },
  ].filter((action) => action.onClick); // Filter out undefined actions

  if (actions.length === 0) return null;

  return (
    <div ref={menuRef} className={`fixed bottom-6 right-6 z-40 ${className}`}>
      {/* Actions Menu */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 mb-2 space-y-2 animate-in fade-in slide-in-from-bottom-4">
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={action.onClick}
                style={{ animationDelay: `${index * 50}ms` }}
                className={`flex items-center space-x-3 ${action.color || 'bg-slate-600 hover:bg-slate-700'} text-white px-4 py-3 rounded-xl shadow-lg transform transition-all hover:scale-105 active:scale-95 min-w-[180px]`}
              >
                <Icon size={18} />
                <span className="font-medium">{action.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main FAB Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transform transition-all hover:scale-110 active:scale-95 ${
          isOpen
            ? 'bg-red-500 hover:bg-red-600 rotate-45'
            : 'bg-emerald-600 hover:bg-emerald-700 rotate-0'
        } text-white`}
        aria-label={isOpen ? 'Fermer le menu' : 'Actions rapides'}
      >
        {isOpen ? <X size={24} /> : <Plus size={24} />}
      </button>
    </div>
  );
};

export default QuickActions;
