import React, { useState } from 'react';
import { Plus, X, Users, Handshake, Briefcase, HardHat, DollarSign, Calendar } from 'lucide-react';

interface FloatingActionButtonProps {
  onAction: (action: 'client' | 'partner' | 'project' | 'employee' | 'expense' | 'appointment') => void;
}

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ onAction }) => {
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    { id: 'client' as const, icon: Users, label: 'Client', color: 'from-emerald-500 to-teal-600' },
    { id: 'partner' as const, icon: Handshake, label: 'Partenaire', color: 'from-amber-500 to-orange-600' },
    { id: 'project' as const, icon: Briefcase, label: 'Projet', color: 'from-blue-500 to-indigo-600' },
    { id: 'employee' as const, icon: HardHat, label: 'Salarié', color: 'from-purple-500 to-pink-600' },
    { id: 'expense' as const, icon: DollarSign, label: 'Dépense', color: 'from-red-500 to-rose-600' },
    { id: 'appointment' as const, icon: Calendar, label: 'RDV', color: 'from-sky-500 to-cyan-600' },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute bottom-20 right-0 flex flex-col gap-3 mb-2">
            {actions.map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => {
                    onAction(action.id);
                    setIsOpen(false);
                  }}
                  className={`group relative flex items-center gap-3 bg-gradient-to-r ${action.color} text-white px-4 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105`}
                  style={{
                    animation: `slideInRight 0.3s ease-out ${index * 0.05}s both`,
                  }}
                >
                  <span className="absolute right-full mr-3 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                    {action.label}
                  </span>
                  <Icon size={20} strokeWidth={2.5} />
                  <span className="font-semibold text-sm">{action.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-16 h-16 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-2xl hover:shadow-emerald-500/50 transition-all duration-300 flex items-center justify-center group relative ${
          isOpen ? 'rotate-45 scale-110' : 'hover:scale-110'
        }`}
      >
        {isOpen ? (
          <X size={28} strokeWidth={2.5} />
        ) : (
          <Plus size={28} strokeWidth={2.5} />
        )}
        
        {!isOpen && (
          <span className="absolute -top-12 right-0 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
            Actions rapides
          </span>
        )}
      </button>

      <style>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};

export default FloatingActionButton;
